import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HeartbeatReply } from "@greecon/shared";
import type { EdgeIdentity } from "./identity";
import type { RuntimeLog } from "./runtime";

// A box that cannot be visited must be able to take a fix. It fetches the new version from the platform
// it reports to, checks it against the checksum the platform gave, runs it once to see that it runs,
// switches to it and restarts. The version before stays on the disk. The new one is on probation until it
// has reported in: if it fails to start three times first, the starting program (run-edge, installed by
// the installer and not changeable by this software) goes back to the previous version by itself and the
// platform's newer version is not tried again.

export interface UpdaterOptions {
  /** Where releases and the current version live (GREECON_EDGE_HOME). Without it the box was not
   * installed by the installer, and does not update itself. */
  home?: string;
  stateDir: string;
  identity: EdgeIdentity;
  currentVersion: string;
  log: RuntimeLog;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Ends this process so that the service starts the new version. Replaced in tests. */
  restart: () => void;
  /** Runs a downloaded file's `version` command and returns what it printed. Replaced in tests. */
  versionOf?: (file: string) => Promise<string | undefined>;
}

export type UpdateOutcome = "not-installed" | "not-needed" | "too-soon" | "rejected-before" | "failed" | "restarting";

/** A box does not start updating itself the moment it starts: someone setting it up should see it settle first. */
const SETTLE_MS = 10 * 60_000;
/** After any attempt, however it ended, this long before another. */
const BETWEEN_ATTEMPTS_MS = 6 * 3_600_000;
const KEEP_RELEASES = 3;

export class Updater {
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch;
  private readonly startedMs: number;
  private reportedRejected = 0;

  constructor(private readonly options: UpdaterOptions) {
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.startedMs = this.now();
  }

  /** Called after each successful heartbeat. Returns what it did, and when it returns "restarting" the
   * process is about to end. */
  async consider(reply: HeartbeatReply): Promise<UpdateOutcome> {
    const { home, stateDir, log } = this.options;
    if (!home) return "not-installed";
    if (!reply.updateAvailable || reply.latestAgentVersion === this.options.currentVersion) return "not-needed";
    if (this.now() - this.startedMs < SETTLE_MS) return "too-soon";

    const attemptedPath = join(stateDir, "last-update-attempt");
    const lastAttempt = Number(this.read(attemptedPath) ?? 0);
    if (Number.isFinite(lastAttempt) && this.now() - lastAttempt < BETWEEN_ATTEMPTS_MS) return "too-soon";

    if (this.read(join(stateDir, "rejected-version"))?.trim() === reply.latestAgentVersion) {
      // Said once a day, not every heartbeat.
      if (this.now() - this.reportedRejected > 24 * 3_600_000) {
        this.reportedRejected = this.now();
        log.warn(`Version ${reply.latestAgentVersion} did not work on this box and is not being tried again. Tell Greecon support.`);
      }
      return "rejected-before";
    }

    mkdirSync(stateDir, { recursive: true });
    writeFileSync(attemptedPath, String(this.now()));
    try {
      await this.install(reply.latestAgentVersion, home, stateDir);
    } catch (error) {
      log.warn(`Could not update to version ${reply.latestAgentVersion}; carrying on with ${this.options.currentVersion}: ${error instanceof Error ? error.message : String(error)}`);
      return "failed";
    }
    log.info(`Updated from ${this.options.currentVersion} to ${reply.latestAgentVersion}. Restarting.`);
    this.options.restart();
    return "restarting";
  }

  private async install(version: string, home: string, stateDir: string): Promise<void> {
    if (!/^[0-9A-Za-z.+_-]+$/.test(version)) throw new Error("the version name is not one this box accepts");
    const headers = { "x-edge-device-token": this.options.identity.secret };
    const base = this.options.identity.apiUrl;

    const manifestResponse = await this.fetchImpl(`${base}/edge/bundle.json`, { headers, signal: AbortSignal.timeout(30_000) });
    if (!manifestResponse.ok) throw new Error(`the platform answered ${manifestResponse.status} when asked about the new version`);
    const manifest = (await manifestResponse.json()) as { version?: string; sha256?: string; size?: number };
    if (manifest.version !== version || typeof manifest.sha256 !== "string") throw new Error("the platform's description of the new version does not match what it announced");

    const bundleResponse = await this.fetchImpl(`${base}/edge/bundle`, { headers, signal: AbortSignal.timeout(300_000) });
    if (!bundleResponse.ok) throw new Error(`the platform answered ${bundleResponse.status} when asked for the new version`);
    const bytes = Buffer.from(await bundleResponse.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256 || (manifest.size !== undefined && bytes.length !== manifest.size)) {
      throw new Error("the new version did not match its checksum, so it was not used");
    }

    const release = join(home, "releases", version);
    mkdirSync(release, { recursive: true });
    const partial = join(release, "greecon-edge.mjs.partial");
    const file = join(release, "greecon-edge.mjs");
    writeFileSync(partial, bytes, { mode: 0o644 });
    renameSync(partial, file);

    const printed = await (this.options.versionOf ?? runVersion)(file);
    if (printed !== version) {
      rmSync(release, { recursive: true, force: true });
      throw new Error(`the new version does not run on this box (it printed ${printed === undefined ? "nothing" : `"${printed}"`} instead of its version)`);
    }

    // On probation until it has reported in; run-edge counts its starts and goes back if they fail.
    const probation = join(stateDir, "probation");
    rmSync(probation, { recursive: true, force: true });
    mkdirSync(probation, { recursive: true });
    writeFileSync(join(probation, "version"), version);
    writeFileSync(join(probation, "previous"), this.options.currentVersion);
    writeFileSync(join(probation, "attempts"), "0");

    point(join(home, "previous"), join(home, "releases", this.options.currentVersion));
    point(join(home, "current"), release);
    this.prune(home, version);
  }

  /** Called when the box has reported in: a version on probation has proved itself. */
  proved(): void {
    const probation = join(this.options.stateDir, "probation");
    if (this.read(join(probation, "version"))?.trim() === this.options.currentVersion) {
      rmSync(probation, { recursive: true, force: true });
      this.options.log.info(`Version ${this.options.currentVersion} is running well.`);
    }
  }

  private prune(home: string, keep: string): void {
    const releases = join(home, "releases");
    const previous = this.options.currentVersion;
    const others = readdirSync(releases)
      .filter((name) => name !== keep && name !== previous)
      .map((name) => ({ name, mtime: statSync(join(releases, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of others.slice(Math.max(0, KEEP_RELEASES - 2))) rmSync(join(releases, old.name), { recursive: true, force: true });
  }

  private read(path: string): string | undefined {
    try {
      return existsSync(path) ? readFileSync(path, "utf8") : undefined;
    } catch {
      return undefined;
    }
  }
}

/** Replaces a symbolic link in one step, so there is never a moment with none. */
function point(link: string, target: string): void {
  const next = `${link}.new`;
  rmSync(next, { force: true });
  symlinkSync(target, next);
  renameSync(next, link);
}

function runVersion(file: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, "version"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (chunk) => (out += String(chunk)));
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.on("error", () => resolve(undefined));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? out.trim() : undefined);
    });
  });
}
