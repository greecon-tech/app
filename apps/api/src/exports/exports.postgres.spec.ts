import { join } from "path";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { NotificationConfig } from "../notifications/config";
import { PlatformService } from "../platform/platform.service";
import { PLATFORM_ADMIN, ProvisionedSite, provisionSite } from "../platform/test-support";
import { CsvDownload, ExportsService } from "./exports.service";

async function read(download: CsvDownload): Promise<string> {
  let out = "";
  for await (const chunk of download.chunks) out += chunk;
  return out;
}

async function inWorld<T>(use: (world: { service: ExportsService; platform: PlatformService; owner: Principal; site: ProvisionedSite; pool: Pool }) => Promise<T>): Promise<T> {
  return withEmptyDatabase(async (pool, connectionString) => {
    await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = new DatabaseService();
    process.env.DATABASE_URL = previous;
    const platform = new PlatformService(db);
    await platform.onModuleInit();
    try {
      const { tenant, owner } = await platform.createTenant({ name: "Export Ltd", domain: "export.example", ownerName: "O", ownerEmail: "o@export.example" }, PLATFORM_ADMIN);
      const principal: Principal = { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false };
      const site = await provisionSite(platform, principal, [
        { canonicalName: "energy.grid.import.kw", unit: "kW" },
        { canonicalName: "water.pump.status", unit: "state" }
      ]);
      return await use({ service: new ExportsService(platform, db, new NotificationConfig(db)), platform, owner: principal, site, pool });
    } finally {
      await platform.onApplicationShutdown();
      await db.onModuleDestroy();
    }
  });
}

const NOW = Date.parse("2026-10-19T12:00:00Z");

describe.skipIf(!testDatabaseUrl)("the readings spreadsheet, on a real PostgreSQL", () => {
  async function seed(world: { owner: Principal; site: ProvisionedSite; pool: Pool }, from: string, minutes: number) {
    const grid = world.site.pointIds["energy.grid.import.kw"] as string;
    const pump = world.site.pointIds["water.pump.status"] as string;
    const common = [world.owner.tenantId, world.site.site.id, world.site.device.id, from, minutes];
    await world.pool.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
       SELECT $4::timestamptz + (g || ' minutes')::interval, $1, $2, $3, '${grid}', 'energy.grid.import.kw', 2 + (g % 60) / 30.0, 'kW', 'OK', 'edge' FROM generate_series(0, $5::int - 1) g`,
      common
    );
    await world.pool.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, device_id, point_id, canonical_name, value_bool, unit, quality, source)
       SELECT $4::timestamptz + (g || ' minutes')::interval, $1, $2, $3, '${pump}', 'water.pump.status', (g % 120) < 30, 'state', 'OK', 'edge' FROM generate_series(0, $5::int - 1) g`,
      common
    );
  }

  it("gives one row an hour for each reading, with the average, the lowest, the highest and how many were read, on the site's own clock", async () => {
    await inWorld(async (world) => {
      await seed(world, "2026-10-18T10:00:00Z", 180); // three hours of a reading a minute
      const body = await read(await world.service.readings(world.owner, { siteId: world.site.site.id, days: 2, resolution: "hourly", style: "standard" }, NOW));
      const lines = body.slice(1).trim().split("\r\n");
      expect(lines[0]).toBe("hour_utc,hour_local,site,device,reading,canonical_name,average,minimum,maximum,unit,samples");
      const grid = lines.filter((line) => line.includes("energy.grid.import.kw"));
      expect(grid).toHaveLength(3);
      // 2026-10-18 10:00 UTC is 12:00 in Tirane (summer time).
      expect(grid[0]).toBe(`2026-10-18 10:00:00,2026-10-18 12:00:00,${world.site.site.name},Controller,energy.grid.import.kw,energy.grid.import.kw,2.983333,2,3.966667,kW,60`);
      const pump = lines.filter((line) => line.includes("water.pump.status"));
      expect(pump).toHaveLength(3);
      // On for the first thirty minutes of every two hours: half an hour in the first hour, none in the second.
      expect(pump[0]).toMatch(/,0\.5,0,1,state,60$/);
      expect(pump[1]).toMatch(/,0,0,0,state,60$/);
    });
  }, 120_000);

  it("gives every reading, one row each, oldest first, with the value the box read", async () => {
    await inWorld(async (world) => {
      await seed(world, "2026-10-19T00:00:00Z", 12 * 60); // twelve hours up to NOW: spans two six-hour windows
      const body = await read(await world.service.readings(world.owner, { siteId: world.site.site.id, days: 1, resolution: "raw", style: "standard" }, NOW));
      const lines = body.slice(1).trim().split("\r\n");
      expect(lines[0]).toBe("time_utc,time_local,site,device,reading,canonical_name,value,unit,quality");
      expect(lines).toHaveLength(1 + 12 * 60 * 2);
      expect(lines[1]).toBe(`2026-10-19 00:00:00,2026-10-19 02:00:00,${world.site.site.name},Controller,energy.grid.import.kw,energy.grid.import.kw,2,kW,OK`);
      const times = lines.slice(1).map((line) => line.slice(0, 19));
      expect(times).toEqual([...times].sort());
      expect(lines.some((line) => line.includes("water.pump.status") && line.endsWith(",1,state,OK"))).toBe(true);
    });
  }, 120_000);

  it("uses the semicolon and the decimal comma for a European spreadsheet", async () => {
    await inWorld(async (world) => {
      await seed(world, "2026-10-19T09:00:00Z", 60);
      const body = await read(await world.service.readings(world.owner, { siteId: world.site.site.id, days: 1, resolution: "hourly", style: "eu" }, NOW));
      const grid = body.slice(1).trim().split("\r\n").find((line) => line.includes("energy.grid.import.kw")) as string;
      expect(grid.split(";")).toHaveLength(11);
      expect(grid).toContain(";2,983333;2;3,966667;kW;60");
    });
  }, 120_000);

  it("keeps to the period asked for", async () => {
    await inWorld(async (world) => {
      await seed(world, "2026-10-01T00:00:00Z", 60); // eighteen days ago
      await seed(world, "2026-10-19T09:00:00Z", 60);
      const week = (await read(await world.service.readings(world.owner, { siteId: world.site.site.id, days: 7, resolution: "hourly", style: "standard" }, NOW))).trim().split("\r\n");
      expect(week.filter((line) => line.includes("energy.grid.import.kw")).map((line) => line.slice(0, 10))).toEqual(["2026-10-19"]);
      const month = (await read(await world.service.readings(world.owner, { siteId: world.site.site.id, days: 30, resolution: "hourly", style: "standard" }, NOW))).trim().split("\r\n");
      expect(month.filter((line) => line.includes("energy.grid.import.kw")).map((line) => line.slice(0, 10))).toEqual(["2026-10-01", "2026-10-19"]);
    });
  }, 120_000);

  it("never holds another account's readings, even for a site id it was given", async () => {
    await inWorld(async (world) => {
      await seed(world, "2026-10-19T09:00:00Z", 60);
      const other = await world.platform.createTenant({ name: "Other Ltd", domain: "other.example", ownerName: "O", ownerEmail: "o@other.example" }, PLATFORM_ADMIN);
      const stranger: Principal = { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
      await expect(world.service.readings(stranger, { siteId: world.site.site.id, days: 1, resolution: "raw", style: "standard" }, NOW)).rejects.toThrow("That site is not one of this account's sites.");
      const theirSite = await provisionSite(world.platform, stranger, [{ canonicalName: "energy.grid.import.kw", unit: "kW" }]);
      const body = await read(await world.service.readings(stranger, { siteId: theirSite.site.id, days: 1, resolution: "raw", style: "standard" }, NOW));
      expect(body.slice(1).trim().split("\r\n")).toHaveLength(1);
    });
  }, 120_000);
});
