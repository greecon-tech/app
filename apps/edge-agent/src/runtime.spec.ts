import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EdgeConfig, profileByKey } from "@greecon/shared";
import type { EdgeIdentity } from "./identity";
import { ModbusTcpReader } from "./modbus/reader";
import { EdgeRuntime } from "./runtime";
import { FakeModbusServer, startFakeModbusServer } from "./testing/fake-modbus-server";
import { FakePlatform, startFakePlatform } from "./testing/fake-platform";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222201";
const GATEWAY = "77777777-7777-4777-8777-777777777701";
const SECRET = "box-secret-0123456789";

describe("the box, start to finish", () => {
  let modbus: FakeModbusServer;
  let platform: FakePlatform;
  let stateDir: string;
  let log: string[];
  let runtimes: EdgeRuntime[];

  const gridPoints = () =>
    (profileByKey("eastron-sdm630-grid")?.points ?? []).map((entry, index) => ({ pointId: `grid-${index}`, canonicalName: entry.canonicalName, label: entry.label, unit: entry.unit, source: entry.source }));

  const configWith = (version: string, unitId = 1): EdgeConfig => ({
    version,
    tenantId: TENANT,
    siteId: SITE,
    gatewayId: GATEWAY,
    pollIntervalMs: 10_000,
    devices: [{ deviceId: "grid-meter", name: "Grid meter", connection: { kind: "modbus_tcp", host: modbus.host, port: modbus.port, unitId }, points: gridPoints() }]
  });

  const identity = (): EdgeIdentity => ({ apiUrl: platform.url, tenantId: TENANT, siteId: SITE, gatewayId: GATEWAY, secret: SECRET });

  const newRuntime = (overrides: Partial<ConstructorParameters<typeof EdgeRuntime>[0]> = {}) => {
    const runtime = new EdgeRuntime({
      identity: identity(),
      stateDir,
      log: { info: (line) => log.push(`info: ${line}`), warn: (line) => log.push(`warn: ${line}`), error: (line) => log.push(`error: ${line}`) },
      reader: new ModbusTcpReader({ requestTimeoutMs: 200, connectTimeoutMs: 400 }),
      requestTimeoutMs: 1500,
      ...overrides
    });
    runtimes.push(runtime);
    return runtime;
  };

  beforeEach(async () => {
    modbus = await startFakeModbusServer([1, 2]);
    modbus.setFloat32(1, "input", 52, 4213.5);
    platform = await startFakePlatform(configWith("v1"), SECRET);
    stateDir = mkdtempSync(join(tmpdir(), "greecon-edge-"));
    log = [];
    runtimes = [];
  });

  afterEach(async () => {
    for (const runtime of runtimes) await runtime.stop();
    await platform.close();
    await modbus.close();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("learns what to read from the platform, reads it at once, and says how each device answered", async () => {
    const runtime = newRuntime();
    await runtime.runHeartbeat();

    // The configuration came with the first heartbeat's answer; the box read straight away and reported again.
    expect(platform.calls.slice(0, 2)).toEqual(["POST /edge/heartbeat", "GET /edge/config"]);
    const readings = platform.messages.flatMap((message) => message.readings);
    expect(readings.map((reading) => [reading.pointId, reading.value])).toEqual([
      ["grid-0", 4.2135],
      ["grid-1", 0]
    ]);
    const last = platform.heartbeats[platform.heartbeats.length - 1];
    expect(last?.configVersion).toBe("v1");
    expect(last?.devices).toEqual([expect.objectContaining({ deviceId: "grid-meter", ok: true, readingsOk: 2, readingsFailed: 0 })]);
    expect(log.some((line) => line.includes("Now reading 1 device(s)"))).toBe(true);
  });

  it("says who it is and what it runs in every heartbeat", async () => {
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    const first = platform.heartbeats[0];
    expect(first?.agentVersion).toBe("0.0.0+source");
    expect(first?.bufferDepth).toBe(0);
    expect(first?.configVersion).toBeUndefined();
    expect(Date.parse(first?.sentAtUtc ?? "")).toBeGreaterThan(Date.now() - 5000);
  });

  it("picks up a change to what it reads from the next heartbeat, and drops what it no longer reads", async () => {
    modbus.setFloat32(2, "input", 52, -2000);
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    expect(modbus.connections()).toBe(1);

    platform.messages.length = 0;
    platform.config = configWith("v2", 2);
    await runtime.runHeartbeat();
    const readings = platform.messages.flatMap((message) => message.readings);
    expect(readings.map((reading) => [reading.pointId, reading.value])).toEqual([
      ["grid-0", 0],
      ["grid-1", 2]
    ]);

    platform.messages.length = 0;
    platform.config = { ...configWith("v3"), devices: [] };
    await runtime.runHeartbeat();
    await runtime.runCycle();
    expect(platform.messages).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(modbus.connections()).toBe(0);
  });

  it("goes on reading what it knew when the platform cannot be reached at start, and sends it all when it can", async () => {
    // A first run saves the configuration.
    const first = newRuntime();
    await first.runHeartbeat();
    await first.stop();
    platform.messages.length = 0;

    // Then power returns with the platform's network down.
    platform.mode = "down";
    const second = newRuntime();
    await second.runCycle();
    modbus.setFloat32(1, "input", 52, 5000);
    await second.runCycle();
    await second.outbox.drain();
    expect(second.outbox.pending()).toBe(1);
    expect(log.some((line) => line.startsWith("warn: Keeping readings: the platform could not be reached"))).toBe(true);

    platform.mode = "normal";
    await second.outbox.drain();
    expect(second.outbox.pending()).toBe(0);
    expect(platform.messages.flatMap((message) => message.readings).map((reading) => reading.value)).toEqual([4.2135, 0]);
  });

  it("says in words what is wrong with a device, and goes on with the others", async () => {
    modbus.removeUnit(1);
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    const last = platform.heartbeats[platform.heartbeats.length - 1];
    expect(last?.devices[0]).toMatchObject({ deviceId: "grid-meter", ok: false });
    expect(last?.devices[0]?.lastError).toContain("no answer from");
    expect(platform.messages).toEqual([]);

    modbus.setFloat32(1, "input", 52, 1000);
    // The unit is back: the box asks again (after its first quiet rounds it would ask once a minute).
    await runtime.runCycle();
    expect(platform.messages.flatMap((message) => message.readings).length).toBe(2);
  });

  it("keeps its readings and says what to do when the platform does not recognise it", async () => {
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    platform.mode = "unauthorised";
    platform.messages.length = 0;
    await runtime.runHeartbeat();
    await runtime.runCycle();
    await runtime.outbox.drain();
    expect(runtime.outbox.pending()).toBeGreaterThan(0);
    expect(log.some((line) => line.includes("does not recognise this box's credential"))).toBe(true);
    expect(runtime.status().heartbeat.lastError).toContain("does not recognise this box's credential");
  });

  it("refuses the configuration of another gateway and keeps reading what it had", async () => {
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    platform.config = { ...configWith("v9"), gatewayId: "someone-else" };
    await runtime.runHeartbeat();
    expect(runtime.status().configVersion).toBe("v1");
    expect(log.some((line) => line.includes("configuration of a different gateway"))).toBe(true);
  });

  it("remembers what to read and what was waiting across a restart", async () => {
    const first = newRuntime();
    await first.runHeartbeat();
    platform.mode = "down";
    modbus.setFloat32(1, "input", 52, 7000);
    await first.runCycle();
    await first.outbox.drain();
    expect(first.outbox.pending()).toBe(1);
    await first.stop();

    platform.mode = "normal";
    platform.messages.length = 0;
    const second = newRuntime();
    expect(second.status().configVersion).toBe("v1");
    expect(second.outbox.pending()).toBe(1);
    await second.outbox.drain();
    expect(platform.messages.flatMap((message) => message.readings).map((reading) => reading.value)).toEqual([7, 0]);
  });

  it("ignores a saved configuration that belongs to another gateway", async () => {
    const first = newRuntime();
    await first.runHeartbeat();
    await first.stop();
    const other = newRuntime({ identity: { ...identity(), gatewayId: "replaced-with-another" } });
    expect(other.status().configVersion).toBeUndefined();
  });

  it("warns when its own clock is wrong, because readings are stamped with it", async () => {
    platform.clockSkewSeconds = 3600;
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    expect(log.some((line) => line.startsWith("warn: This box's clock is 3600 seconds fast"))).toBe(true);
    expect(runtime.status().heartbeat.clockSkewSeconds).toBe(3600);
  });

  it("writes a status file that says what it is doing", async () => {
    const runtime = newRuntime();
    await runtime.runHeartbeat();
    const status = JSON.parse(readFileSync(join(stateDir, "status.json"), "utf8"));
    expect(status).toMatchObject({ gatewayId: GATEWAY, siteId: SITE, configVersion: "v1", queue: { pending: 0 } });
    expect(status.devices[0]).toMatchObject({ name: "Grid meter", ok: true });
    expect(status.heartbeat.lastOkAtUtc).toBeTruthy();
    expect(existsSync(join(stateDir, "status.json.tmp"))).toBe(false);
  });

  it("runs by itself, and stops cleanly, closing its connections", async () => {
    const runtime = newRuntime();
    runtime.start();
    const deadline = Date.now() + 5000;
    while (platform.messages.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(platform.messages.length).toBeGreaterThan(0);

    await runtime.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(modbus.connections()).toBe(0);
    expect(log[log.length - 1]).toBe("info: Greecon edge stopped.");
  }, 15_000);

  describe("taking an update", () => {
    const NEW = "9.9.9+newer";
    let home: string;

    beforeEach(() => {
      home = join(stateDir, "edge-home");
      mkdirSync(join(home, "releases", "0.0.0+source"), { recursive: true });
      symlinkSync(join(home, "releases", "0.0.0+source"), join(home, "current"));
      platform.bundle = { version: NEW, bytes: Buffer.from(`console.log(${JSON.stringify(NEW)});\n`) };
      platform.updateAvailable = true;
      platform.latestAgentVersion = NEW;
    });

    it("switches to the version the platform announces and restarts, once the box has settled", async () => {
      let restarts = 0;
      let later = 0;
      const runtime = newRuntime({ updateHome: home, restart: () => void (restarts += 1), updateClock: () => Date.now() + later });
      await runtime.runHeartbeat();
      expect(restarts).toBe(0);

      later = 11 * 60_000;
      await runtime.runHeartbeat();
      expect(restarts).toBe(1);
      expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", NEW));
      expect(readFileSync(join(stateDir, "probation", "version"), "utf8")).toBe(NEW);
      expect(log.some((line) => line.includes(`Updated from 0.0.0+source to ${NEW}. Restarting.`))).toBe(true);
    });

    it("does not update a box that was not installed by the installer", async () => {
      let restarts = 0;
      const runtime = newRuntime({ restart: () => void (restarts += 1), updateClock: () => Date.now() + 11 * 60_000 });
      await runtime.runHeartbeat();
      expect(restarts).toBe(0);
      expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", "0.0.0+source"));
    });

    it("is not stopped from reading and reporting by an update that fails", async () => {
      platform.bundle = { version: NEW, bytes: Buffer.from("process.exit(1);") };
      let later = 0;
      const runtime = newRuntime({ updateHome: home, restart: () => undefined, updateClock: () => Date.now() + later });
      later = 11 * 60_000;
      await runtime.runHeartbeat();
      expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", "0.0.0+source"));
      expect(platform.messages.length).toBeGreaterThan(0);
      expect(log.some((line) => line.startsWith("warn: Could not update to version"))).toBe(true);
    });

    it("lets a new version that has reported in prove itself, which ends its probation", async () => {
      mkdirSync(join(stateDir, "probation"), { recursive: true });
      writeFileSync(join(stateDir, "probation", "version"), "0.0.0+source");
      platform.updateAvailable = false;
      const runtime = newRuntime({ updateHome: home });
      await runtime.runHeartbeat();
      expect(existsSync(join(stateDir, "probation"))).toBe(false);
      expect(log).toContain("info: Version 0.0.0+source is running well.");
    });
  });
});

