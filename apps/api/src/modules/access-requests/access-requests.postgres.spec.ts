import { join } from "path";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../../database/test-database";
import { DatabaseService } from "../../database/database.service";
import { AccessRequestsService } from "./access-requests.service";

describe.skipIf(!testDatabaseUrl)("access requests in PostgreSQL", () => {
  it("stores, de-duplicates, lists newest first and records who handled a request", async () => {
    await withEmptyDatabase(async (pool, connectionString) => {
      await runMigrations(pool, join(__dirname, "..", "..", "database", "migrations"));
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = new DatabaseService();
      process.env.DATABASE_URL = previous;
      try {
        const service = new AccessRequestsService(db);
        const base = { name: "Besa", company: "Hotel Adriatik", siteType: "hotel" as const, phone: "+355 69 000 0000", message: "Hello" };
        await service.receive({ ...base, email: "besa@example.com" });
        await service.receive({ ...base, email: "BESA@example.com" });
        await service.receive({ ...base, email: "ardit@example.com", company: "Farm Lushnje", siteType: "farm" });

        const all = await service.list();
        expect(all.map((request) => request.email).sort()).toEqual(["ardit@example.com", "besa@example.com"]);
        expect(Date.parse(all[0]?.createdAtUtc as string)).toBeGreaterThanOrEqual(Date.parse(all[1]?.createdAtUtc as string));

        const adminId = (await pool.query<{ id: string }>("SELECT id FROM users WHERE email = 'demo@greecon.earth'")).rows[0]?.id as string;
        const updated = await service.update(all[0]?.id as string, { status: "onboarded", note: "Account created" }, adminId);
        expect(updated).toMatchObject({ status: "onboarded", note: "Account created" });
        expect((await pool.query("SELECT handled_by FROM access_requests WHERE id = $1", [updated.id])).rows[0]?.handled_by).toBe(adminId);

        // A caller that is not a row in users (the demo, a header identity) is allowed and recorded as nobody.
        await service.update(all[1]?.id as string, { status: "declined" }, "demo-feed");
        expect((await service.list("declined"))).toHaveLength(1);
        expect((await service.list("new"))).toHaveLength(0);
      } finally {
        await db.onModuleDestroy();
      }
    });
  }, 60_000);
});
