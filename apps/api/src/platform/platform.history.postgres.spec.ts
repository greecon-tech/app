import { join } from "path";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { CanonicalPointName, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { PlatformService } from "./platform.service";
import { PLATFORM_ADMIN, ProvisionedSite, provisionSite } from "./test-support";

const T0 = Date.parse("2026-10-19T10:00:00Z");

async function inPlatform<T>(use: (world: { platform: PlatformService; owner: Principal; site: ProvisionedSite; pool: Pool }) => Promise<T>): Promise<T> {
  return withEmptyDatabase(async (pool, connectionString) => {
    await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = new DatabaseService();
    process.env.DATABASE_URL = previous;
    const platform = new PlatformService(db);
    await platform.onModuleInit();
    try {
      const { tenant, owner } = await platform.createTenant({ name: "History Ltd", domain: "history.example", ownerName: "O", ownerEmail: "o@history.example" }, PLATFORM_ADMIN);
      const principal: Principal = { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false };
      const site = await provisionSite(platform, principal, [
        { canonicalName: "energy.grid.import.kw", unit: "kW" },
        { canonicalName: "water.pump.status", unit: "state" }
      ]);
      return await use({ platform, owner: principal, site, pool });
    } finally {
      await platform.onApplicationShutdown();
      await db.onModuleDestroy();
    }
  });
}

describe.skipIf(!testDatabaseUrl)("history kept for a point (real PostgreSQL)", () => {
  function message(world: { owner: Principal; site: ProvisionedSite }, name: CanonicalPointName, value: number | boolean | string, secondsFromStart: number, quality: "OK" | "WARN" | "BAD" = "OK"): TelemetryMessage {
    const stamp = new Date(T0 + secondsFromStart * 1000).toISOString();
    return {
      messageType: "telemetry",
      tenantId: world.owner.tenantId,
      siteId: world.site.site.id,
      deviceId: world.site.device.id,
      publishedAtUtc: stamp,
      correlationId: `c-${secondsFromStart}`,
      readings: [
        {
          timestampUtc: stamp,
          tenantId: world.owner.tenantId,
          siteId: world.site.site.id,
          deviceId: world.site.device.id,
          pointId: world.site.pointIds[name] as string,
          canonicalName: name,
          value,
          unit: name === "water.pump.status" ? "state" : "kW",
          quality,
          source: "edge",
          ingestionTimestampUtc: stamp
        }
      ]
    };
  }

  const rows = async (pool: Pool, point: string) =>
    (await pool.query("SELECT extract(epoch from timestamp_utc)::int AS t, value_numeric, value_bool, quality FROM telemetry_readings WHERE point_id = $1 ORDER BY timestamp_utc", [point])).rows;

  it("keeps a reading a minute from a box that reads every ten seconds, and every reading is still counted and shown", async () => {
    await inPlatform(async (world) => {
      const grid = world.site.pointIds["energy.grid.import.kw"] as string;
      // Two minutes of readings, ten seconds apart.
      const messages = Array.from({ length: 13 }, (_, index) => message(world, "energy.grid.import.kw", 3 + index * 0.1, index * 10));
      await world.platform.ingestTelemetryBatch(messages, world.owner);

      expect((await rows(world.pool, grid)).map((row) => row.t - T0 / 1000)).toEqual([0, 60, 120]);
      // The latest value is the newest reading, not the newest one kept in history.
      expect(world.platform.latestTelemetry(world.owner, world.site.site.id).find((reading) => reading.canonicalName === "energy.grid.import.kw")?.value).toBeCloseTo(4.2, 6);
    });
  }, 120_000);

  it("always keeps a reading that is not fine, and a switch that changed", async () => {
    await inPlatform(async (world) => {
      const grid = world.site.pointIds["energy.grid.import.kw"] as string;
      const pump = world.site.pointIds["water.pump.status"] as string;
      await world.platform.ingestTelemetryBatch(
        [
          message(world, "energy.grid.import.kw", 1, 0),
          message(world, "energy.grid.import.kw", 2, 10, "WARN"),
          message(world, "energy.grid.import.kw", 3, 20),
          message(world, "water.pump.status", false, 0),
          message(world, "water.pump.status", false, 10),
          message(world, "water.pump.status", true, 20),
          message(world, "water.pump.status", true, 30)
        ],
        world.owner
      );
      expect((await rows(world.pool, grid)).map((row) => row.quality)).toEqual(["OK", "WARN"]);
      expect((await rows(world.pool, pump)).map((row) => row.value_bool)).toEqual([false, true]);
    });
  }, 120_000);

  it("keeps the readings of a backlog delivered after an outage, in their own time", async () => {
    await inPlatform(async (world) => {
      const grid = world.site.pointIds["energy.grid.import.kw"] as string;
      await world.platform.ingestTelemetryBatch([message(world, "energy.grid.import.kw", 1, 600)], world.owner);
      // Delivered late, oldest first, a minute apart.
      await world.platform.ingestTelemetryBatch([message(world, "energy.grid.import.kw", 2, 0), message(world, "energy.grid.import.kw", 3, 60), message(world, "energy.grid.import.kw", 4, 120)], world.owner);
      expect((await rows(world.pool, grid)).map((row) => row.t - T0 / 1000).sort((a, b) => a - b)).toEqual([0, 60, 120, 600]);
    });
  }, 120_000);

  it("does not add a reading twice when the box sends it again", async () => {
    await inPlatform(async (world) => {
      const grid = world.site.pointIds["energy.grid.import.kw"] as string;
      const same = message(world, "energy.grid.import.kw", 5, 0);
      await world.platform.ingestTelemetryBatch([same], world.owner);
      await world.platform.ingestTelemetryBatch([same], world.owner);
      await world.platform.ingestTelemetry(same, world.owner);
      expect(await rows(world.pool, grid)).toHaveLength(1);
    });
  }, 120_000);

  it("still keeps every reading sent one message at a time, as older boxes and the simulator do", async () => {
    await inPlatform(async (world) => {
      const grid = world.site.pointIds["energy.grid.import.kw"] as string;
      for (let index = 0; index < 5; index += 1) await world.platform.ingestTelemetry(message(world, "energy.grid.import.kw", index, index * 5), world.owner);
      expect(await rows(world.pool, grid)).toHaveLength(5);
    });
  }, 120_000);
});

describe.skipIf(!testDatabaseUrl)("history shown on a chart (real PostgreSQL)", () => {
  /** Twelve days of a reading a minute from two points: more than the old twenty-thousand-row cut-off could carry. */
  async function seedTwelveDays(world: { owner: Principal; site: ProvisionedSite; pool: Pool }) {
    const grid = world.site.pointIds["energy.grid.import.kw"] as string;
    const pump = world.site.pointIds["water.pump.status"] as string;
    const common = [world.owner.tenantId, world.site.site.id, world.site.device.id];
    // The value falls by one for every day further back, so where a window starts shows in its values.
    await world.pool.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
       SELECT now() - (g || ' minutes')::interval, $1, $2, $3, $4, 'energy.grid.import.kw', 100 - g / 1440.0, 'kW', 'OK', 'edge' FROM generate_series(0, 17279) g`,
      [...common, grid]
    );
    await world.pool.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, device_id, point_id, canonical_name, value_bool, unit, quality, source)
       SELECT now() - (g || ' minutes')::interval, $1, $2, $3, $4, 'water.pump.status', (g / 360) % 2 = 0, 'state', 'OK', 'edge' FROM generate_series(0, 17279) g`,
      [...common, pump]
    );
    return { grid, pump };
  }

  it("covers the whole of a week, newest included, instead of the oldest twenty thousand readings", async () => {
    await inPlatform(async (world) => {
      const { grid } = await seedTwelveDays(world);
      const history = await world.platform.telemetryHistory(world.owner, world.site.site.id, 24 * 7);
      const gridPoints = history.filter((reading) => reading.pointId === grid);

      // About 168 hourly buckets, not 10,080 readings and not a cut-off.
      expect(gridPoints.length).toBeGreaterThan(160);
      expect(gridPoints.length).toBeLessThanOrEqual(170);
      const times = gridPoints.map((reading) => Date.parse(reading.timestampUtc));
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(Date.now() - (times.at(-1) as number)).toBeLessThan(2 * 3_600_000);
      expect(Date.now() - (times[0] as number)).toBeGreaterThan(6.5 * 24 * 3_600_000);
      expect(Date.now() - (times[0] as number)).toBeLessThan(7.2 * 24 * 3_600_000);

      // Values are the averages of what was read: roughly 100 now, and seven less seven days back.
      expect(Number(gridPoints.at(-1)?.value)).toBeGreaterThan(99.9);
      expect(Number(gridPoints[0]?.value)).toBeGreaterThan(92.5);
      expect(Number(gridPoints[0]?.value)).toBeLessThan(93.2);
    });
  }, 180_000);

  it("shows a switch as on if it was on at any time in the bucket, and keeps the unit and the point", async () => {
    await inPlatform(async (world) => {
      const { pump } = await seedTwelveDays(world);
      const history = await world.platform.telemetryHistory(world.owner, world.site.site.id, 24 * 7);
      const pumpPoints = history.filter((reading) => reading.pointId === pump);
      expect(pumpPoints.length).toBeGreaterThan(160);
      expect(pumpPoints.every((reading) => typeof reading.value === "boolean" && reading.unit === "state" && reading.canonicalName === "water.pump.status")).toBe(true);
      expect(pumpPoints.some((reading) => reading.value === true)).toBe(true);
      expect(pumpPoints.some((reading) => reading.value === false)).toBe(true);
    });
  }, 180_000);

  it("gives a short window reading by reading", async () => {
    await inPlatform(async (world) => {
      const { grid } = await seedTwelveDays(world);
      const history = await world.platform.telemetryHistory(world.owner, world.site.site.id, 2);
      const gridPoints = history.filter((reading) => reading.pointId === grid);
      expect(gridPoints.length).toBeGreaterThanOrEqual(120);
      expect(gridPoints.length).toBeLessThanOrEqual(122);
    });
  }, 180_000);

  it("is the account's own history and nobody else's", async () => {
    await inPlatform(async (world) => {
      await seedTwelveDays(world);
      const other = await world.platform.createTenant({ name: "Other Ltd", domain: "other.example", ownerName: "O", ownerEmail: "o@other.example" }, PLATFORM_ADMIN);
      const stranger: Principal = { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
      expect(await world.platform.telemetryHistory(stranger, undefined, 24 * 7)).toEqual([]);
      await expect(world.platform.telemetryHistory(stranger, world.site.site.id, 24 * 7)).rejects.toThrow();
    });
  }, 180_000);
});
