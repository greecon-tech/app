import { join } from "path";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { BucketDelta } from "./energy-ledger";
import { PostgresBucketStore } from "./postgres-bucket-store";
import { DatabaseService } from "../database/database.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222201";
const SOLAR_POINT = "55555555-5555-4555-8555-555555555501";
const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-16T10:00:00Z");

const delta = (hours: number, amount: number, seconds: number, pointId = SOLAR_POINT): BucketDelta => ({
  tenantId: TENANT,
  siteId: SITE,
  pointId,
  canonicalName: "energy.solar.power.kw",
  hourStartMs: T0 + hours * HOUR,
  amount,
  coveredSeconds: seconds
});

async function storeFor(connectionString: string): Promise<{ store: PostgresBucketStore; db: DatabaseService; close: () => Promise<void> }> {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;
  const db = new DatabaseService();
  process.env.DATABASE_URL = previous;
  return { store: new PostgresBucketStore(db), db, close: () => db.onModuleDestroy() };
}

describe.skipIf(!testDatabaseUrl)("hourly totals in PostgreSQL", () => {
  it("adds to what is already saved, and sums a range", async () => {
    await withEmptyDatabase(async (pool, connectionString) => {
      await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
      const { store, close } = await storeFor(connectionString);
      try {
        await store.add([delta(0, 2, 1800), delta(1, 3, 3600)]);
        await store.add([delta(0, 1, 600)]);

        const totals = await store.totals(SITE, T0, T0 + 2 * HOUR);
        expect(totals).toHaveLength(1);
        expect(totals[0]?.amount).toBeCloseTo(6, 6);
        expect(totals[0]?.coveredSeconds).toBeCloseTo(6000, 6);
        expect(totals[0]?.firstHourMs).toBe(T0);

        const first = await store.totals(SITE, T0, T0 + 30 * 60_000);
        expect(first[0]?.amount).toBeCloseTo(3, 6);
        expect(await store.totals(SITE, T0 + 5 * HOUR, T0 + 6 * HOUR)).toEqual([]);
      } finally {
        await close();
      }
    });
  }, 60_000);

  it("lets go of counts for a point that has been deleted without losing the rest", async () => {
    await withEmptyDatabase(async (pool, connectionString) => {
      await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
      const { store, close } = await storeFor(connectionString);
      try {
        await store.add([delta(0, 2, 1800), delta(0, 9, 3600, "99999999-0000-4000-8000-000000000000")]);

        const totals = await store.totals(SITE, T0, T0 + HOUR);
        expect(totals.map((total) => total.pointId)).toEqual([SOLAR_POINT]);
        expect(totals[0]?.amount).toBeCloseTo(2, 6);
      } finally {
        await close();
      }
    });
  }, 60_000);

  it("removes a point's history with the point", async () => {
    await withEmptyDatabase(async (pool, connectionString) => {
      await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
      const { store, close } = await storeFor(connectionString);
      try {
        await store.add([delta(0, 2, 1800)]);
        await pool.query("DELETE FROM points WHERE id = $1", [SOLAR_POINT]);
        expect(await store.totals(SITE, T0, T0 + HOUR)).toEqual([]);
      } finally {
        await close();
      }
    });
  }, 60_000);
});
