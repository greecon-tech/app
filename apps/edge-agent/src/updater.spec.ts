import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HeartbeatReply } from "@greecon/shared";
import type { EdgeIdentity } from "./identity";
import { Updater, UpdaterOptions } from "./updater";
import { FakePlatform, startFakePlatform } from "./testing/fake-platform";

const SECRET = "box-secret-0123456789";
const T0 = Date.parse("2026-10-19T10:00:00Z");
const NEW = "0.2.0+bbbbbbbb";
const OLD = "0.1.0+aaaaaaaa";
const MINUTE = 60_000;

describe("a box taking a fix without being visited", () => {
  let platform: FakePlatform;
  let directory: string;
  let home: string;
  let stateDir: string;
  let clock: number;
  let restarts: number;
  let logs: string[];

  const reply = (overrides: Partial<HeartbeatReply> = {}): HeartbeatReply => ({ serverTimeUtc: "x", configVersion: "v", clockSkewSeconds: 0, latestAgentVersion: NEW, updateAvailable: true, ...overrides });
  const identity = (): EdgeIdentity => ({ apiUrl: platform.url, tenantId: "t", siteId: "s", gatewayId: "g", secret: SECRET });
  const program = (version: string) => Buffer.from(`console.log(${JSON.stringify(version)});\n`);

  const updater = (overrides: Partial<UpdaterOptions> = {}) =>
    new Updater({
      home,
      stateDir,
      identity: identity(),
      currentVersion: OLD,
      log: { info: (line) => logs.push(`info: ${line}`), warn: (line) => logs.push(`warn: ${line}`), error: (line) => logs.push(`error: ${line}`) },
      now: () => clock,
      restart: () => void (restarts += 1),
      ...overrides
    });

  beforeEach(async () => {
    platform = await startFakePlatform({ version: "v", tenantId: "t", siteId: "s", gatewayId: "g", pollIntervalMs: 10_000, devices: [] }, SECRET);
    platform.bundle = { version: NEW, bytes: program(NEW) };
    directory = mkdtempSync(join(tmpdir(), "greecon-update-"));
    home = join(directory, "edge");
    stateDir = join(directory, "state");
    mkdirSync(join(home, "releases", OLD), { recursive: true });
    writeFileSync(join(home, "releases", OLD, "greecon-edge.mjs"), program(OLD));
    symlinkSync(join(home, "releases", OLD), join(home, "current"));
    mkdirSync(stateDir, { recursive: true });
    clock = T0;
    restarts = 0;
    logs = [];
  });

  afterEach(async () => {
    await platform.close();
    rmSync(directory, { recursive: true, force: true });
  });

  /** A box that has been up long enough to be updated. */
  const settled = () => {
    const box = updater();
    clock += 11 * MINUTE;
    return box;
  };

  it("does nothing on a box that was not installed by the installer", async () => {
    expect(await updater({ home: undefined }).consider(reply())).toBe("not-installed");
  });

  it("does nothing when there is nothing newer, or it is the version already running", async () => {
    const box = settled();
    expect(await box.consider(reply({ updateAvailable: false }))).toBe("not-needed");
    expect(await box.consider(reply({ latestAgentVersion: OLD }))).toBe("not-needed");
    expect(restarts).toBe(0);
  });

  it("waits for a box that has only just started to settle, so whoever is setting it up sees it settle first", async () => {
    expect(await updater().consider(reply())).toBe("too-soon");
    expect(restarts).toBe(0);
  });

  it("installs the new version beside the old one, checks it runs, switches to it, puts it on probation and restarts", async () => {
    expect(await settled().consider(reply())).toBe("restarting");

    expect(readFileSync(join(home, "releases", NEW, "greecon-edge.mjs"), "utf8")).toContain(NEW);
    expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", NEW));
    expect(readlinkSync(join(home, "previous"))).toBe(join(home, "releases", OLD));
    expect(existsSync(join(home, "releases", OLD, "greecon-edge.mjs"))).toBe(true);
    expect(readFileSync(join(stateDir, "probation", "version"), "utf8")).toBe(NEW);
    expect(readFileSync(join(stateDir, "probation", "previous"), "utf8")).toBe(OLD);
    expect(readFileSync(join(stateDir, "probation", "attempts"), "utf8")).toBe("0");
    expect(restarts).toBe(1);
    expect(logs).toContain(`info: Updated from ${OLD} to ${NEW}. Restarting.`);
    expect(existsSync(join(home, "current.new"))).toBe(false);
  });

  it("does not use software that does not match the checksum the platform gave", async () => {
    platform.bundle = { version: NEW, bytes: program(NEW), checksum: "0".repeat(64) };
    expect(await settled().consider(reply())).toBe("failed");
    expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", OLD));
    expect(existsSync(join(home, "releases", NEW))).toBe(false);
    expect(existsSync(join(stateDir, "probation"))).toBe(false);
    expect(restarts).toBe(0);
    expect(logs.join("\n")).toContain("did not match its checksum");
  });

  it("does not use software that is not the version the platform announced", async () => {
    platform.bundle = { version: "9.9.9+other", bytes: program("9.9.9+other") };
    expect(await settled().consider(reply())).toBe("failed");
    expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", OLD));
    expect(restarts).toBe(0);
  });

  it("does not switch to software that does not run, and takes it off the disk", async () => {
    platform.bundle = { version: NEW, bytes: Buffer.from("process.exit(1);") };
    expect(await settled().consider(reply())).toBe("failed");
    expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", OLD));
    expect(existsSync(join(home, "releases", NEW))).toBe(false);
    expect(logs.join("\n")).toContain("does not run on this box");

    platform.bundle = { version: NEW, bytes: program("0.0.1+wrong") };
    clock += 7 * 3_600_000;
    expect(await settled().consider(reply())).toBe("failed");
    expect(logs.join("\n")).toContain('printed "0.0.1+wrong"');
  });

  it("does not switch when the platform has nothing to give or does not recognise the box", async () => {
    platform.bundle = undefined;
    expect(await settled().consider(reply())).toBe("failed");
    expect(readlinkSync(join(home, "current"))).toBe(join(home, "releases", OLD));

    clock += 7 * 3_600_000;
    platform.bundle = { version: NEW, bytes: program(NEW) };
    platform.mode = "unauthorised";
    expect(await settled().consider(reply())).toBe("failed");
    expect(restarts).toBe(0);
  });

  it("does not try again for six hours after trying, however it went", async () => {
    platform.bundle = { version: NEW, bytes: Buffer.from("process.exit(1);") };
    const box = settled();
    expect(await box.consider(reply())).toBe("failed");
    clock += 5 * 3_600_000;
    expect(await box.consider(reply())).toBe("too-soon");
    platform.bundle = { version: NEW, bytes: program(NEW) };
    clock += 2 * 3_600_000;
    expect(await box.consider(reply())).toBe("restarting");
  });

  it("does not try a version again that was tried and gone back from, and says so once a day", async () => {
    writeFileSync(join(stateDir, "rejected-version"), `${NEW}\n`);
    const box = settled();
    expect(await box.consider(reply())).toBe("rejected-before");
    expect(await box.consider(reply())).toBe("rejected-before");
    expect(logs.filter((line) => line.includes("did not work on this box"))).toHaveLength(1);
    clock += 25 * 3_600_000;
    await box.consider(reply());
    expect(logs.filter((line) => line.includes("did not work on this box"))).toHaveLength(2);
    expect(restarts).toBe(0);
  });

  it("will not use a version name that could be a path", async () => {
    expect(await settled().consider(reply({ latestAgentVersion: "../../etc" }))).toBe("failed");
    expect(logs.join("\n")).toContain("version name is not one this box accepts");
  });

  it("lets a version on probation prove itself, and only that version", () => {
    mkdirSync(join(stateDir, "probation"), { recursive: true });
    writeFileSync(join(stateDir, "probation", "version"), "someone-else");
    updater().proved();
    expect(existsSync(join(stateDir, "probation"))).toBe(true);

    writeFileSync(join(stateDir, "probation", "version"), OLD);
    updater().proved();
    expect(existsSync(join(stateDir, "probation"))).toBe(false);
    expect(logs).toContain(`info: Version ${OLD} is running well.`);
  });

  it("keeps the version it left, the new one and one more, and clears away the rest", async () => {
    for (const [index, name] of ["0.0.1+old1", "0.0.2+old2", "0.0.3+old3"].entries()) {
      mkdirSync(join(home, "releases", name), { recursive: true });
      const when = new Date(T0 - (10 - index) * 86_400_000);
      utimesSync(join(home, "releases", name), when, when);
    }
    await settled().consider(reply());
    const kept = ["0.0.1+old1", "0.0.2+old2", "0.0.3+old3", OLD, NEW].filter((name) => existsSync(join(home, "releases", name)));
    expect(kept).toEqual(["0.0.3+old3", OLD, NEW]);
  });
});
