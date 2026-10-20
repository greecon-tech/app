import { randomUUID } from "node:crypto";
import { EdgeConfig, EdgeConfigDevice, DriverDeviceStatus, ModbusRegisterType, TelemetryMessage, TelemetryReading, readModbusValue, registersFor } from "@greecon/shared";
import { ModbusReadError, RegisterReader } from "./reader";

// One round of reading: every device in the configuration, every reading mapped to a register, turned
// into the same telemetry the platform already understands. Nothing here invents a value: a register
// that cannot be read gives no reading and a sentence saying why, and a reading that stops arriving is
// itself the signal.

export interface PollResult {
  /** One message for each device that gave at least one reading, ready to send. */
  messages: TelemetryMessage[];
  /** How each device answered, including those that did not. */
  statuses: DriverDeviceStatus[];
}

export interface PollerLog {
  info(message: string): void;
  warn(message: string): void;
}

interface Health {
  failures: number;
  /** Do not ask again before this time (a device that has been silent for a while is asked less often). */
  nextTryMs: number;
  lastOkAtUtc?: string;
  lastError?: string;
}

/** After this many rounds in a row with nothing from a device it is asked once a minute instead of
 * every round: a dead device must not slow down reading the others, or fill a log. */
const FAILURES_BEFORE_BACKING_OFF = 3;
const BACKED_OFF_RETRY_MS = 60_000;
/** A device that stays silent is mentioned in the log this often, not every round. */
const REPEAT_LOG_MS = 10 * 60_000;

export class DevicePoller {
  private readonly health = new Map<string, Health>();
  private readonly lastLogged = new Map<string, number>();

  constructor(
    private readonly reader: RegisterReader,
    private readonly log: PollerLog,
    private readonly now: () => number = Date.now
  ) {}

  async pollAll(config: EdgeConfig): Promise<PollResult> {
    // Devices behind the same converter share one connection and are read one after another; devices
    // on different converters are read at the same time.
    const groups = new Map<string, EdgeConfigDevice[]>();
    for (const device of config.devices) {
      const key = `${device.connection.host.toLowerCase()}:${device.connection.port}`;
      groups.set(key, [...(groups.get(key) ?? []), device]);
    }
    const startedMs = this.now();
    const done = await Promise.all(
      [...groups.values()].map(async (devices) => {
        const results: Array<{ device: EdgeConfigDevice; readings: TelemetryReading[]; status: DriverDeviceStatus }> = [];
        // Once the converter itself cannot be reached, the devices after the first are not tried this round:
        // each would wait out its own connection attempt, and thirteen meters behind one dead converter would
        // hold up every other converter's readings for most of a minute.
        let converterDown: string | undefined;
        for (const device of devices) {
          const polled = await this.pollDevice(config, device, startedMs, converterDown);
          results.push({ device, readings: polled.readings, status: polled.status });
          converterDown ??= polled.converterDown;
        }
        return results;
      })
    );

    // The order of the configuration, whatever order the answers came in.
    const byDevice = new Map(done.flat().map((entry) => [entry.device.deviceId, entry]));
    const messages: TelemetryMessage[] = [];
    const statuses: DriverDeviceStatus[] = [];
    const publishedAtUtc = new Date(startedMs).toISOString();
    for (const device of config.devices) {
      const entry = byDevice.get(device.deviceId);
      if (!entry) continue;
      statuses.push(entry.status);
      if (entry.readings.length > 0) {
        messages.push({ messageType: "telemetry", tenantId: config.tenantId, siteId: config.siteId, deviceId: device.deviceId, readings: entry.readings, publishedAtUtc, correlationId: randomUUID() });
      }
    }
    // Forget devices that are no longer configured.
    const configured = new Set(config.devices.map((device) => device.deviceId));
    for (const id of [...this.health.keys()]) if (!configured.has(id)) this.health.delete(id);
    return { messages, statuses };
  }

  private async pollDevice(
    config: EdgeConfig,
    device: EdgeConfigDevice,
    startedMs: number,
    converterAlreadyDown?: string
  ): Promise<{ readings: TelemetryReading[]; status: DriverDeviceStatus; converterDown?: string }> {
    const health = this.health.get(device.deviceId) ?? { failures: 0, nextTryMs: 0 };
    this.health.set(device.deviceId, health);

    if (this.now() < health.nextTryMs) {
      return { readings: [], status: this.statusOf(device, health, 0, device.points.length) };
    }

    const at = new Date(startedMs).toISOString();
    const words = new Map<string, number[] | ModbusReadError>();
    const readings: TelemetryReading[] = [];
    let failed = 0;
    let firstError: string | undefined = converterAlreadyDown;
    let silent = converterAlreadyDown !== undefined;
    let converterDown: string | undefined;

    for (const point of device.points) {
      const count = registersFor(point.source.dataType);
      const key = `${point.source.registerType}:${point.source.address}:${count}`;

      if (!words.has(key)) {
        if (silent) {
          // The device did not answer a moment ago; asking for more would only wait for the same silence.
          words.set(key, new ModbusReadError(firstError ?? "no answer", "transport"));
        } else {
          try {
            words.set(key, await this.reader.read(device.connection, point.source.registerType as ModbusRegisterType, point.source.address, count));
          } catch (error) {
            const read = error instanceof ModbusReadError ? error : new ModbusReadError(error instanceof Error ? error.message : String(error), "transport");
            words.set(key, read);
            if (read.kind === "transport") silent = true;
            if (read.converterUnreachable) converterDown = read.message;
          }
        }
      }

      const got = words.get(key) as number[] | ModbusReadError;
      if (got instanceof ModbusReadError) {
        failed += 1;
        firstError ??= got.message;
        continue;
      }

      const value = readModbusValue(got, point.source);
      if (value === undefined) {
        failed += 1;
        firstError ??= `${device.name} reported no value for ${point.label} (the register does not hold a number).`;
        continue;
      }
      readings.push({
        timestampUtc: at,
        tenantId: config.tenantId,
        siteId: config.siteId,
        ...(point.assetId ? { assetId: point.assetId } : {}),
        deviceId: device.deviceId,
        pointId: point.pointId,
        canonicalName: point.canonicalName,
        value: Math.round(value * 10_000) / 10_000,
        unit: point.unit,
        quality: "OK",
        source: "edge",
        ingestionTimestampUtc: at
      });
    }

    const wasFailing = health.failures >= 1;
    if (readings.length > 0) {
      health.failures = 0;
      health.nextTryMs = 0;
      health.lastOkAtUtc = at;
      health.lastError = failed > 0 ? firstError : undefined;
      if (wasFailing) this.log.info(`${device.name} is answering again.`);
      this.lastLogged.delete(device.deviceId);
    } else {
      health.failures += 1;
      health.lastError = firstError;
      if (health.failures >= FAILURES_BEFORE_BACKING_OFF) health.nextTryMs = this.now() + BACKED_OFF_RETRY_MS;
      this.logSilence(device, firstError ?? "no readings", health.failures);
    }
    return { readings, status: this.statusOf(device, health, readings.length, failed), ...(converterDown ? { converterDown } : {}) };
  }

  private logSilence(device: EdgeConfigDevice, reason: string, failures: number): void {
    const last = this.lastLogged.get(device.deviceId);
    if (last !== undefined && this.now() - last < REPEAT_LOG_MS) return;
    this.lastLogged.set(device.deviceId, this.now());
    const note = failures >= FAILURES_BEFORE_BACKING_OFF ? " Trying again once a minute." : "";
    this.log.warn(`${device.name}: ${reason}${note}`);
  }

  private statusOf(device: EdgeConfigDevice, health: Health, ok: number, failed: number): DriverDeviceStatus {
    return {
      deviceId: device.deviceId,
      ok: ok > 0,
      readingsOk: ok,
      readingsFailed: failed,
      ...(health.lastError ? { lastError: health.lastError } : {}),
      ...(health.lastOkAtUtc ? { lastOkAtUtc: health.lastOkAtUtc } : {})
    };
  }
}
