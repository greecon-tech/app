import { join } from "node:path";
import { DriverDeviceStatus, EdgeConfig, GatewayHeartbeat, HEARTBEAT_INTERVAL_SECONDS } from "@greecon/shared";
import type { TelemetryMessage } from "@greecon/shared";
import { EdgeIdentity } from "./identity";
import { DevicePoller } from "./modbus/poller";
import { ModbusTcpReader, RegisterReader } from "./modbus/reader";
import { OfflineBuffer } from "./offline-buffer";
import { Outbox } from "./outbox";
import { PlatformClient, PlatformError } from "./platform-client";
import { readJsonFile, writeJsonFile } from "./state-files";
import { Updater } from "./updater";
import { AGENT_VERSION } from "./version";

// The box's whole job, in one process: read the devices it has been told about, send what it reads, say
// how it is, and pick up changes to what it reads without anyone touching it. Every step that depends
// on the network or on a device is allowed to fail, and none of them can stop the others.

export interface RuntimeLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface RuntimeOptions {
  identity: EdgeIdentity;
  /** Where the box keeps what must survive a restart: the queue, the last configuration, its status. */
  stateDir: string;
  log: RuntimeLog;
  fetchImpl?: typeof fetch;
  /** Replaced in tests; a real reader opens network connections. */
  reader?: RegisterReader;
  now?: () => number;
  /** Most messages kept while the platform cannot be reached. Enough for three days with thirty devices. */
  bufferMaxMessages?: number;
  requestTimeoutMs?: number;
  /** A device is read every this long unless the platform says otherwise. */
  defaultPollIntervalMs?: number;
  /** Where the installer keeps releases (GREECON_EDGE_HOME). Without it the box does not update itself. */
  updateHome?: string;
  /** What ends this process after an update so the service starts the new version. */
  restart?: () => void;
  /** The clock the updater uses; replaced in tests to get past the time a new box waits before updating. */
  updateClock?: () => number;
}

/** What `greecon-edge status` shows, and what the installer waits on. */
export interface StatusFile {
  agentVersion: string;
  startedAtUtc: string;
  updatedAtUtc: string;
  gatewayId: string;
  siteId: string;
  configVersion?: string;
  devices: Array<DriverDeviceStatus & { name: string }>;
  queue: { pending: number; oldestAgeSeconds?: number };
  heartbeat: { lastOkAtUtc?: string; lastError?: string; clockSkewSeconds?: number; latestAgentVersion?: string; updateAvailable: boolean };
}

const MIN_POLL_MS = 2_000;
const MAX_POLL_MS = 300_000;
/** For a while after the box starts, someone is probably watching it come up: report in more often. */
const WATCHED_FOR_MS = 15 * 60_000;
const WATCHED_HEARTBEAT_MS = 10_000;

export class EdgeRuntime {
  readonly outbox: Outbox;
  private readonly platform: PlatformClient;
  private readonly reader: RegisterReader;
  private readonly poller: DevicePoller;
  private readonly updater: Updater;
  private readonly now: () => number;
  private readonly startedMs: number;
  private readonly statusPath: string;
  private readonly configPath: string;

  private config?: EdgeConfig;
  private statuses: DriverDeviceStatus[] = [];
  private heartbeat: StatusFile["heartbeat"] = { updateAvailable: false };
  private lastHeartbeatProblem = "";
  private lastConfigProblem = "";
  private timers: Array<NodeJS.Timeout> = [];
  private running = false;
  private cycling: Promise<void> | undefined;
  private beating: Promise<void> | undefined;

  constructor(private readonly options: RuntimeOptions) {
    this.now = options.now ?? Date.now;
    this.startedMs = this.now();
    this.statusPath = join(options.stateDir, "status.json");
    this.configPath = join(options.stateDir, "config.json");
    this.platform = new PlatformClient(options.identity, options.fetchImpl, options.requestTimeoutMs);
    this.reader = options.reader ?? new ModbusTcpReader();
    this.poller = new DevicePoller(this.reader, options.log, this.now);
    this.updater = new Updater({
      home: options.updateHome,
      stateDir: options.stateDir,
      identity: options.identity,
      currentVersion: AGENT_VERSION,
      log: options.log,
      fetchImpl: options.fetchImpl,
      now: options.updateClock ?? this.now,
      restart: options.restart ?? (() => setTimeout(() => process.kill(process.pid, "SIGTERM"), 500))
    });

    let outbox: Outbox | undefined;
    const buffer = new OfflineBuffer<TelemetryMessage>({
      maxItems: options.bufferMaxMessages ?? 150_000,
      persistPath: join(options.stateDir, "queue.jsonl"),
      onDrop: (_item, reason) => {
        if (reason.startsWith("buffer full")) outbox?.noteEvicted();
      }
    });
    outbox = new Outbox({
      apiUrl: options.identity.apiUrl,
      headers: { "x-edge-device-token": options.identity.secret },
      buffer,
      log: options.log,
      timeoutMs: options.requestTimeoutMs,
      fetchImpl: options.fetchImpl
    });
    this.outbox = outbox;
    this.config = this.loadCachedConfig();
  }

  // ---- Running ----------------------------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    const { identity } = this.options;
    this.options.log.info(
      `Greecon edge ${AGENT_VERSION} starting for gateway ${identity.gatewayId} at site ${identity.siteId}. ` +
        `${this.config ? `Reading ${this.config.devices.length} device(s) from the saved configuration.` : "No configuration saved yet; asking the platform."} ` +
        `${this.outbox.pending() > 0 ? `${this.outbox.pending()} message(s) were waiting from before.` : ""}`.trimEnd()
    );
    this.loop("cycle", () => this.runCycle(), () => this.cycleDelayMs(), 0);
    this.loop("heartbeat", () => this.runHeartbeat(), () => this.heartbeatDelayMs(), 500);
    this.loop("drain", () => this.outbox.drain(), () => 10_000, 5_000);
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    await Promise.allSettled([this.cycling, this.beating, this.outbox.drain()]);
    await this.reader.close();
    this.writeStatus();
    this.options.log.info("Greecon edge stopped.");
  }

  /** Runs `work`, then again after `delay()`: never two at once, and a failure never ends the loop. */
  private loop(name: string, work: () => Promise<void>, delay: () => number, firstDelayMs: number): void {
    const arm = (wait: number) => {
      if (!this.running) return;
      const timer = setTimeout(() => {
        this.timers = this.timers.filter((candidate) => candidate !== timer);
        const startedAt = this.now();
        work()
          .catch((error: unknown) => this.options.log.error(`The ${name} step failed and will be tried again: ${error instanceof Error ? error.message : String(error)}`))
          .finally(() => arm(Math.max(0, delay() - (this.now() - startedAt))));
      }, wait);
      this.timers.push(timer);
    };
    arm(firstDelayMs);
  }

  private cycleDelayMs(): number {
    const wanted = this.config?.pollIntervalMs ?? this.options.defaultPollIntervalMs ?? 10_000;
    return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, wanted));
  }

  private heartbeatDelayMs(): number {
    return this.now() - this.startedMs < WATCHED_FOR_MS ? WATCHED_HEARTBEAT_MS : HEARTBEAT_INTERVAL_SECONDS * 1000;
  }

  // ---- One round of reading ---------------------------------------------------------------------------

  runCycle(): Promise<void> {
    // A round that is still running (a slow device) is not started again on top of itself.
    if (this.cycling) return this.cycling;
    this.cycling = this.cycle().finally(() => {
      this.cycling = undefined;
    });
    return this.cycling;
  }

  private async cycle(): Promise<void> {
    const config = this.config;
    if (!config || config.devices.length === 0) {
      this.statuses = [];
      this.writeStatus();
      return;
    }
    const result = await this.poller.pollAll(config);
    this.statuses = result.statuses;
    await this.outbox.submit(result.messages);
    this.writeStatus();
  }

  // ---- Saying how it is, and learning what to read -----------------------------------------------------

  runHeartbeat(): Promise<void> {
    if (this.beating) return this.beating;
    this.beating = this.beat().finally(() => {
      this.beating = undefined;
    });
    return this.beating;
  }

  private async beat(): Promise<void> {
    const nowMs = this.now();
    const message: GatewayHeartbeat = {
      agentVersion: AGENT_VERSION,
      uptimeSeconds: Math.round((nowMs - this.startedMs) / 1000),
      sentAtUtc: new Date(nowMs).toISOString(),
      bufferDepth: this.outbox.pending(),
      ...(this.outbox.oldestPendingAgeSeconds(nowMs) !== undefined ? { oldestBufferedAgeSeconds: this.outbox.oldestPendingAgeSeconds(nowMs) } : {}),
      ...(this.config ? { configVersion: this.config.version } : {}),
      devices: this.statuses
    };

    try {
      const reply = await this.platform.heartbeat(message);
      this.lastHeartbeatProblem = "";
      this.heartbeat = { lastOkAtUtc: new Date(this.now()).toISOString(), clockSkewSeconds: reply.clockSkewSeconds, latestAgentVersion: reply.latestAgentVersion, updateAvailable: reply.updateAvailable };
      if (Math.abs(reply.clockSkewSeconds) > 120) {
        this.options.log.warn(`This box's clock is ${Math.abs(reply.clockSkewSeconds)} seconds ${reply.clockSkewSeconds > 0 ? "fast" : "slow"}. Readings are stamped with it: check the box's network time.`);
      }
      this.writeStatus();
      // A new version that has just started has now proved it can reach the platform.
      this.updater.proved();

      if (reply.configVersion !== this.config?.version) {
        const changed = await this.refreshConfig();
        // Someone is probably waiting to see what the new setting does: read now and say so now,
        // instead of at the next round and the next heartbeat.
        if (changed) {
          await this.runCycle();
          await this.beatOnce();
        }
      }
      if (reply.updateAvailable) await this.updater.consider(reply);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.heartbeat = { ...this.heartbeat, lastError: reason };
      if (reason !== this.lastHeartbeatProblem) {
        this.lastHeartbeatProblem = reason;
        this.options.log.warn(`Could not tell the platform how this box is: ${reason}`);
      }
      this.writeStatus();
    }
  }

  /** One more heartbeat, without checking the configuration again. */
  private async beatOnce(): Promise<void> {
    const nowMs = this.now();
    try {
      await this.platform.heartbeat({
        agentVersion: AGENT_VERSION,
        uptimeSeconds: Math.round((nowMs - this.startedMs) / 1000),
        sentAtUtc: new Date(nowMs).toISOString(),
        bufferDepth: this.outbox.pending(),
        ...(this.config ? { configVersion: this.config.version } : {}),
        devices: this.statuses
      });
    } catch {
      // The next ordinary heartbeat says it.
    }
  }

  /** Fetches what the platform says to read and starts reading that. Returns whether it changed. */
  async refreshConfig(): Promise<boolean> {
    try {
      const fetched = await this.platform.fetchConfig();
      this.lastConfigProblem = "";
      if (fetched.version === this.config?.version) return false;
      if (fetched.gatewayId !== this.options.identity.gatewayId) throw new PlatformError("the platform sent the configuration of a different gateway.");

      this.config = fetched;
      writeJsonFile(this.configPath, { savedAtUtc: new Date(this.now()).toISOString(), config: fetched });
      await this.reader.keepOnly(fetched.devices.map((device) => device.connection));
      this.options.log.info(`Now reading ${fetched.devices.length} device(s), every ${Math.round(fetched.pollIntervalMs / 1000)} s (configuration ${fetched.version}).`);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (reason !== this.lastConfigProblem) {
        this.lastConfigProblem = reason;
        this.options.log.warn(`Could not fetch what to read: ${reason}`);
      }
      return false;
    }
  }

  private loadCachedConfig(): EdgeConfig | undefined {
    const saved = readJsonFile<{ config?: EdgeConfig }>(this.configPath)?.config;
    const { identity } = this.options;
    // A box enrolled to a different gateway since the file was written must not read the old one's devices.
    if (!saved || saved.gatewayId !== identity.gatewayId || saved.siteId !== identity.siteId || saved.tenantId !== identity.tenantId || !Array.isArray(saved.devices)) return undefined;
    return saved;
  }

  // ---- Status -----------------------------------------------------------------------------------------

  status(): StatusFile {
    const names = new Map((this.config?.devices ?? []).map((device) => [device.deviceId, device.name]));
    const oldest = this.outbox.oldestPendingAgeSeconds(this.now());
    return {
      agentVersion: AGENT_VERSION,
      startedAtUtc: new Date(this.startedMs).toISOString(),
      updatedAtUtc: new Date(this.now()).toISOString(),
      gatewayId: this.options.identity.gatewayId,
      siteId: this.options.identity.siteId,
      ...(this.config ? { configVersion: this.config.version } : {}),
      devices: this.statuses.map((status) => ({ ...status, name: names.get(status.deviceId) ?? status.deviceId })),
      queue: { pending: this.outbox.pending(), ...(oldest !== undefined ? { oldestAgeSeconds: oldest } : {}) },
      heartbeat: this.heartbeat
    };
  }

  private writeStatus(): void {
    writeJsonFile(this.statusPath, this.status());
  }
}
