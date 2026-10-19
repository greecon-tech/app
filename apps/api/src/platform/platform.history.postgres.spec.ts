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
