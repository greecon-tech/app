import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, stateDirectory } from "./cli";
import { StatusFile } from "./runtime";
import { FakeModbusServer, startFakeModbusServer } from "./testing/fake-modbus-server";
import { FakePlatform, startFakePlatform } from "./testing/fake-platform";

describe("the commands a person uses at the box", () => {
  let directory: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "greecon-cli-"));
    stdout = [];
    stderr = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  const said = () => stdout.join("");
  const complained = () => stderr.join("");

  it("finds its state directory from systemd, taking the first when there are several", () => {
    expect(stateDirectory({ STATE_DIRECTORY: "/var/lib/greecon-edge" })).toBe("/var/lib/greecon-edge");
    expect(stateDirectory({ STATE_DIRECTORY: "/var/lib/a:/var/lib/b" })).toBe("/var/lib/a");
    expect(stateDirectory({})).toBe("/var/lib/greecon-edge");
  });

  it("says its version, and what it can do", async () => {
    expect(await main(["version"])).toBe(0);
    expect(said().trim()).toBe("0.0.0+source");
    expect(await main(["help"])).toBe(0);
    expect(said()).toContain("greecon-edge enrol");
    expect(await main(["frobnicate"])).toBe(2);
    expect(complained()).toContain('Unknown command "frobnicate"');
  });

  describe("enrol", () => {
    let platform: FakePlatform;
    beforeEach(async () => {
      platform = await startFakePlatform({ version: "v", tenantId: "tenant-1", siteId: "site-1", gatewayId: "gateway-1", pollIntervalMs: 10_000, devices: [] }, "the-credential-0123456789");
    });
    afterEach(async () => {
      await platform.close();
    });

    it("saves the credential in a file only its owner can read, and does not print it", async () => {
      const path = join(directory, "edge.json");
      expect(await main(["enrol", "--api", platform.url, "--code", "GRC-ABCD-EFGH-JKLM", "--identity", path])).toBe(0);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ apiUrl: platform.url, tenantId: "tenant-1", siteId: "site-1", gatewayId: "gateway-1", secret: "the-credential-0123456789" });
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(said()).toContain('Enrolled as "Plant room"');
      expect(said()).not.toContain("the-credential");
    });

    it("says what to do when the code is not good, and writes nothing", async () => {
      const path = join(directory, "edge.json");
      expect(await main(["enrol", "--api", platform.url, "--code", "GRC-WRONG-CODE0-0000", "--identity", path])).toBe(1);
      expect(complained()).toContain("has been used, has expired, or is not one of ours");
      expect(() => statSync(path)).toThrow();
    });

    it("says what to do when the platform cannot be reached", async () => {
      expect(await main(["enrol", "--api", "http://127.0.0.1:1", "--code", "GRC-ABCD-EFGH-JKLM", "--identity", join(directory, "x.json")])).toBe(1);
      expect(complained()).toContain("could not be reached");
    });

    it("explains the usage when it is not given what it needs", async () => {
      expect(await main(["enrol", "--api", platform.url])).toBe(2);
      expect(complained()).toContain("Usage: greecon-edge enrol");
    });
  });

  describe("status", () => {
    const status = (overrides: Partial<StatusFile> = {}): StatusFile => ({
      agentVersion: "0.2.0",
      startedAtUtc: new Date(Date.now() - 3_600_000).toISOString(),
      updatedAtUtc: new Date().toISOString(),
      gatewayId: "gateway-1",
      siteId: "site-1",
      configVersion: "v1",
      devices: [
        { deviceId: "a", name: "Grid meter", ok: true, readingsOk: 2, readingsFailed: 0 },
        { deviceId: "b", name: "Solar meter", ok: false, readingsOk: 0, readingsFailed: 1, lastError: "no answer from 192.168.1.50:502 (unit 2). Check the unit number." }
      ],
      queue: { pending: 3, oldestAgeSeconds: 120 },
      heartbeat: { lastOkAtUtc: new Date(Date.now() - 12_000).toISOString(), clockSkewSeconds: 1, updateAvailable: false },
      ...overrides
    });
    const run = (value?: StatusFile) => {
      if (value) writeFileSync(join(directory, "status.json"), JSON.stringify(value));
      return main(["status"], { STATE_DIRECTORY: directory });
    };

    it("says how each device is, in the box's own words, and that the box is reporting", async () => {
      expect(await run(status())).toBe(0);
      expect(said()).toContain("last heard 12 seconds ago.");
      expect(said()).toContain("ok      Grid meter: 2 reading(s)");
      expect(said()).toContain("NOT OK  Solar meter: no answer from 192.168.1.50:502 (unit 2). Check the unit number.");
      expect(said()).toContain("Queue: 3 waiting, the oldest 2 minutes old.");
    });

    it("exits with 1 when the box has not reported for minutes", async () => {
      expect(await run(status({ heartbeat: { lastOkAtUtc: new Date(Date.now() - 600_000).toISOString(), updateAvailable: false } }))).toBe(1);
      expect(said()).toContain("NOT REPORTING");
    });

    it("exits with 1 and says so when the platform has never heard from the box", async () => {
      expect(await run(status({ heartbeat: { updateAvailable: false } }))).toBe(1);
      expect(said()).toContain("has not heard from this box yet");
    });

    it("mentions a wrong clock, the last problem and a newer version", async () => {
      await run(status({ heartbeat: { lastOkAtUtc: new Date().toISOString(), lastError: "the platform answered 503", clockSkewSeconds: -900, latestAgentVersion: "0.3.0", updateAvailable: true } }));
      expect(said()).toContain("Last problem: the platform answered 503");
      expect(said()).toContain("clock is 900 seconds slow");
      expect(said()).toContain("A newer version is available (0.3.0)");
    });

    it("says what to check when there is no status at all", async () => {
      expect(await run()).toBe(1);
      expect(complained()).toContain("systemctl status greecon-edge");
    });
  });

  describe("modbus-test", () => {
    let server: FakeModbusServer;
    beforeEach(async () => {
      server = await startFakeModbusServer([3]);
      server.setFloat32(3, "input", 52, 4213.5);
    });
    afterEach(async () => {
      await server.close();
    });

    const test = (...args: string[]) => main(["modbus-test", "--host", server.host, "--port", String(server.port), "--unit", "3", ...args]);

    it("reads a register and shows the raw words and the value, so wiring and settings can be checked", async () => {
      expect(await test("--type", "input", "--address", "52", "--data-type", "float32", "--scale", "0.001")).toBe(0);
      expect(said()).toContain("Raw registers: 17795, 44032");
      expect(said()).toContain("Value: 4.2135");
    });

    it("shows what a different word order would have meant", async () => {
      expect(await test("--type", "input", "--address", "52", "--data-type", "float32", "--word-order", "little")).toBe(0);
      expect(Number(said().match(/Value: (\S+)/)?.[1])).not.toBeCloseTo(4213.5, 1);
    });

    it("says in words when the register is not there", async () => {
      expect(await test("--type", "holding", "--address", "5", "--data-type", "uint16")).toBe(1);
      expect(complained()).toContain("has no register at that address");
    });

    it("says when nothing answers for the unit", async () => {
      expect(await main(["modbus-test", "--host", server.host, "--port", String(server.port), "--unit", "9", "--type", "input", "--address", "0", "--data-type", "uint16"])).toBe(1);
      expect(complained()).toContain("no answer from");
    }, 15_000);

    it("explains what was wrong with what was typed, and how a manual's number maps to the address", async () => {
      expect(await test("--type", "input", "--address", "99999", "--data-type", "float32")).toBe(2);
      expect(complained()).toContain("register address must be a whole number from 0 to 65535");
      expect(complained()).toContain("a manual's 30053 is address 52");
    });
  });
});
