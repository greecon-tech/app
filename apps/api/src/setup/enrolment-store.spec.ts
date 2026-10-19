import { join } from "path";
import { describe, expect, it } from "vitest";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { EnrolmentStore, MemoryEnrolmentStore, NewEnrolment, PostgresEnrolmentStore } from "./enrolment-store";

const NOW = Date.parse("2026-10-19T10:00:00Z");
const DAY = 24 * 3_600_000;

function enrolment(gatewayId: string, codeHash: string, tenantId: string, overrides: Partial<NewEnrolment> = {}): NewEnrolment {
  return { tenantId, gatewayId, codeHash, createdBy: "pm@greecon.earth", createdAtMs: NOW, expiresAtMs: NOW + 7 * DAY, ...overrides };
}

// The same behaviour is required of both stores, so the cases are written once.
function behaves(make: () => Promise<{ store: EnrolmentStore; gateways: [string, string]; tenantId: string; close: () => Promise<void> }>): void {
  it("lets a code be used once, and only once", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-a", tenantId));
      expect(await store.peek("hash-a", NOW)).toBeDefined();

      const first = await store.claim("hash-a", NOW + 1000);
      expect(first?.gatewayId).toBe(gateways[0]);
      expect(await store.claim("hash-a", NOW + 2000)).toBeUndefined();
      expect(await store.peek("hash-a", NOW + 2000)).toBeUndefined();
    } finally {
      await close();
    }
  });

  it("lets only one of two simultaneous attempts use a code", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-race", tenantId));
      const results = await Promise.all(Array.from({ length: 8 }, () => store.claim("hash-race", NOW + 1000)));
      expect(results.filter((result) => result !== undefined)).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it("refuses a code that has expired, and one that was never issued", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-old", tenantId, { expiresAtMs: NOW + 1000 }));
      expect(await store.claim("hash-old", NOW + 1000)).toBeUndefined();
      expect(await store.claim("hash-old", NOW + 5000)).toBeUndefined();
      expect(await store.peek("hash-nobody", NOW)).toBeUndefined();
      expect(await store.claim("hash-nobody", NOW)).toBeUndefined();
    } finally {
      await close();
    }
  });

  it("keeps only the newest unused code for a gateway", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-1", tenantId));
      await store.issue(enrolment(gateways[0], "hash-2", tenantId));
      await store.issue(enrolment(gateways[1], "hash-other", tenantId));

      expect(await store.claim("hash-1", NOW)).toBeUndefined();
      expect(await store.claim("hash-2", NOW)).toBeDefined();
      // Another gateway's code is untouched.
      expect(await store.claim("hash-other", NOW)).toBeDefined();
    } finally {
      await close();
    }
  });

  it("does not remove a code that was already used when a new one is issued", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-used", tenantId));
      await store.claim("hash-used", NOW);
      await store.issue(enrolment(gateways[0], "hash-new", tenantId));
      expect(await store.peek("hash-new", NOW)).toBeDefined();
    } finally {
      await close();
    }
  });

  it("puts a code back when the step that needed it failed", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-retry", tenantId));
      const claimed = await store.claim("hash-retry", NOW);
      expect(await store.peek("hash-retry", NOW)).toBeUndefined();
      await store.release((claimed as { id: string }).id);
      expect(await store.claim("hash-retry", NOW)).toBeDefined();
    } finally {
      await close();
    }
  });

  it("removes a gateway's unused codes on request", async () => {
    const { store, gateways, tenantId, close } = await make();
    try {
      await store.issue(enrolment(gateways[0], "hash-gone", tenantId));
      await store.revokeUnused(gateways[0]);
      expect(await store.claim("hash-gone", NOW)).toBeUndefined();
    } finally {
      await close();
    }
  });
}

describe("enrolment codes in memory", () => {
  behaves(async () => ({
    store: new MemoryEnrolmentStore(),
    gateways: ["gw-1", "gw-2"],
    tenantId: "tenant-1",
    close: async () => undefined
  }));
});

describe.skipIf(!testDatabaseUrl)("enrolment codes in PostgreSQL", () => {
  // Each case gets its own empty database, migrated, with a tenant, a site and two gateways.
  async function postgres() {
    const holder: { done?: () => void } = {};
    const finished = new Promise<void>((resolve) => (holder.done = resolve));
    const ready = new Promise<{ store: EnrolmentStore; gateways: [string, string]; tenantId: string; close: () => Promise<void> }>((resolve, reject) => {
      withEmptyDatabase(async (pool, connectionString) => {
        await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
        const tenant = (await pool.query("INSERT INTO tenants (name, domain) VALUES ('T', 't.example') RETURNING id")).rows[0].id as string;
        const site = (await pool.query("INSERT INTO sites (tenant_id, name, type, location_name) VALUES ($1,'S','farm','L') RETURNING id", [tenant])).rows[0].id as string;
        const gateways: string[] = [];
        for (const name of ["g1", "g2"]) {
          gateways.push((await pool.query("INSERT INTO edge_gateways (tenant_id, site_id, name) VALUES ($1,$2,$3) RETURNING id", [tenant, site, name])).rows[0].id as string);
        }
        const previous = process.env.DATABASE_URL;
        process.env.DATABASE_URL = connectionString;
        const db = new DatabaseService();
        process.env.DATABASE_URL = previous;
        resolve({
          store: new PostgresEnrolmentStore(db),
          gateways: gateways as [string, string],
          tenantId: tenant,
          close: async () => {
            await db.onModuleDestroy();
            holder.done?.();
          }
        });
        await finished;
      }).catch(reject);
    });
    return ready;
  }

  behaves(postgres);
});
