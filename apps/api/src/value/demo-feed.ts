import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { TelemetryMessage, TelemetryReading } from "@greecon/shared";
import { PlatformService } from "../platform/platform.service";
import { demoValue, DEMO_FEED_PRINCIPAL, offsetFor } from "./demo";
import { DEFAULT_TIME_ZONE } from "./periods";

const TICK_MS = 15_000;
/** Raw readings are written to the history table once in this many ticks (five minutes), the rest
 * only drive the live view, so the demo stays lively without filling the database. */
const PERSIST_EVERY_TICKS = 20;

/** Keeps the demo tenant alive: every few seconds its simulated sites report what they would be
 * reporting now. It sends through the same ingestion a real gateway uses, as simulated readings, so
 * the screens, the states, the alerts and the energy totals all see exactly what they would see from
 * real equipment. It only ever speaks for the demo tenant. Off with DEMO_FEED=false. */
@Injectable()
export class DemoFeedService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DemoFeedService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ticks = 0;

  constructor(private readonly platform: PlatformService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.DEMO_FEED?.trim().toLowerCase() === "false") return;
    // The first pass is waited for, so whatever reads the demo straight after start-up (the static
    // demo build, the first visitor) sees current values and not the stored ones.
    await this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One pass: what every simulated point in the demo tenant reads at `nowMs`. Exposed with an
   * injectable clock so a test can move time. */
  async tick(nowMs: number = Date.now()): Promise<void> {
    try {
      const offsetMs = offsetFor(nowMs, DEFAULT_TIME_ZONE);
      const persistRaw = this.ticks % PERSIST_EVERY_TICKS === 0;
      this.ticks += 1;

      const bySite = new Map<string, TelemetryReading[]>();
      for (const point of this.platform.listPoints(DEMO_FEED_PRINCIPAL)) {
        const value = demoValue(point.siteId, point.canonicalName, nowMs, offsetMs);
        if (value === undefined) continue;
        const reading: TelemetryReading = {
          timestampUtc: new Date(nowMs).toISOString(),
          tenantId: point.tenantId,
          siteId: point.siteId,
          assetId: point.assetId,
          deviceId: point.deviceId,
          pointId: point.id,
          canonicalName: point.canonicalName,
          value,
          unit: point.unit,
          quality: "OK",
          source: "simulator",
          ingestionTimestampUtc: new Date(nowMs).toISOString()
        };
        bySite.set(point.siteId, [...(bySite.get(point.siteId) ?? []), reading]);
      }

      for (const [siteId, readings] of bySite) {
        const message: TelemetryMessage = {
          messageType: "telemetry",
          tenantId: DEMO_FEED_PRINCIPAL.tenantId,
          siteId,
          deviceId: readings[0]?.deviceId as string,
          publishedAtUtc: new Date(nowMs).toISOString(),
          correlationId: `demo-feed-${nowMs}`,
          readings
        };
        await this.platform.ingestTelemetry(message, DEMO_FEED_PRINCIPAL, { persistRaw });
      }
    } catch (error) {
      // The demo must never be the reason the API is unhealthy; the next pass tries again.
      this.logger.warn(`Demo feed pass failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
