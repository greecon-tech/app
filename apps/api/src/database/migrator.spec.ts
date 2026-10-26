import { randomUUID } from "crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readMigrationFiles, runMigrations } from "./migrator";
import { testDatabaseUrl, withEmptyDatabase } from "./test-database";

const MIGRATIONS = join(__dirname, "migrations");

/** The text of 003 before it was fixed: it gave the platform administrator the published demo
 * password every time the old runner replayed it. A database that predates the ledger has run it. */
const OLD_003 = `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
UPDATE users SET password_hash = '$2b$10$uaQDHxzYiU.u7qZl/lCbCui7Fq8kbjFuqnKI5Htzx3MxLYEuxJ3IG'
WHERE email IN ('eridon.manuka@greecon.earth','operator@greecon.earth','auditor@greecon.earth','admin@greecon.earth','viewer@greecon.earth');`;

const FOUNDERS_OWN_HASH = "$2b$10$thisIsNotTheDemoPasswordItIsTheFoundersOwnChoiceXXXXXXXXXXXXXXXX";
const FOUNDER = "eridon.manuka@greecon.earth";

function copyOfMigrations(): string {
  const dir = mkdtempSync(join(tmpdir(), "greecon-migrations-"));
  for (const file of readMigrationFiles(MIGRATIONS)) copyFileSync(join(MIGRATIONS, file.name), join(dir, file.name));
  return dir;
}

async function founderHash(pool: Pool): Promise<string | null | undefined> {
  return (await pool.query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE email = $1", [FOUNDER])).rows[0]?.password_hash;
}

/** What `db:migrate` used to do: replay every file, record nothing. */
async function runLikeTheOldRunner(pool: Pool, dir: string, only: (name: string) => boolean): Promise<void> {
  for (const file of readMigrationFiles(dir)) if (only(file.name)) await pool.query(file.sql);
}

describe.skipIf(!testDatabaseUrl)("migration ledger (real PostgreSQL)", () => {
  it("applies every migration to an empty database once, in order, and leaves the administrator without a password", async () => {
    await withEmptyDatabase(async (pool) => {
      const names = readMigrationFiles(MIGRATIONS).map((file) => file.name);

      const first = await runMigrations(pool, MIGRATIONS);
      expect(first.applied).toEqual(names);
      expect(first.baselined).toEqual([]);

      const second = await runMigrations(pool, MIGRATIONS);
      expect(second).toEqual({ applied: [], baselined: [] });

      const ledger = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name");
      expect(ledger.rows.map((row) => row.name)).toEqual(names);

      expect(await founderHash(pool)).toBeNull();
      const demo = await pool.query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE email = 'demo@greecon.earth'");
      expect(demo.rows[0]?.password_hash).toBeTruthy();
    });
  }, 60_000);

  it("brings a database from before the ledger under it without replaying what it already carries, so the administrator's own password survives", async () => {
    await withEmptyDatabase(async (pool) => {
      const dir = copyOfMigrations();
      writeFileSync(join(dir, "003_auth.sql"), OLD_003);
      const names = readMigrationFiles(dir).map((file) => file.name);
      const legacyNames = names.filter((name) => name <= "008_gateway_credentials.sql");

      await runLikeTheOldRunner(pool, dir, (name) => legacyNames.includes(name));
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [FOUNDERS_OWN_HASH, FOUNDER]);

      const result = await runMigrations(pool, dir);

      expect(result.baselined).toEqual(legacyNames);
      expect(result.applied).toEqual(names.filter((name) => !legacyNames.includes(name)));
      expect(await founderHash(pool)).toBe(FOUNDERS_OWN_HASH);

      expect(await runMigrations(pool, dir)).toEqual({ applied: [], baselined: [] });
      expect(await founderHash(pool)).toBe(FOUNDERS_OWN_HASH);
    });
  }, 60_000);

  it("runs only the migrations an older database is still missing", async () => {
    await withEmptyDatabase(async (pool) => {
      const dir = copyOfMigrations();
      writeFileSync(join(dir, "003_auth.sql"), OLD_003);
      await runLikeTheOldRunner(pool, dir, (name) => name <= "005_platform_admin.sql");
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [FOUNDERS_OWN_HASH, FOUNDER]);

      const result = await runMigrations(pool, dir);

      expect(result.baselined).toEqual(["001_schema.sql", "002_seed_demo.sql", "003_auth.sql", "004_site_safety_limits.sql", "005_platform_admin.sql"]);
      expect(result.applied).toContain("008_gateway_credentials.sql");
      const column = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'edge_gateways' AND column_name = 'secret_hash'");
      expect(column.rowCount).toBe(1);
      expect(await founderHash(pool)).toBe(FOUNDERS_OWN_HASH);
    });
  }, 60_000);

  it("refuses to continue when a migration that was already applied has been edited", async () => {
    await withEmptyDatabase(async (pool) => {
      const dir = copyOfMigrations();
      await runMigrations(pool, dir);
      const edited = join(dir, "004_site_safety_limits.sql");
      writeFileSync(edited, `${readFileSync(edited, "utf8")}\n-- edited later\n`);

      await expect(runMigrations(pool, dir)).rejects.toThrow(/004_site_safety_limits\.sql was changed after it was applied/);
    });
  }, 60_000);

  it("rolls a failing migration back completely and does not record it", async () => {
    await withEmptyDatabase(async (pool) => {
      const dir = mkdtempSync(join(tmpdir(), "greecon-bad-migration-"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "001_ok.sql"), "CREATE TABLE ok_table (id int);");
      writeFileSync(join(dir, "002_bad.sql"), "CREATE TABLE half_done (id int); SELECT 1/0;");

      await expect(runMigrations(pool, dir)).rejects.toThrow(/002_bad\.sql failed and was rolled back/);

      const ledger = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
      expect(ledger.rows.map((row) => row.name)).toEqual(["001_ok.sql"]);
      expect((await pool.query("SELECT to_regclass('public.half_done') AS t")).rows[0]?.t).toBeNull();
    });
  }, 60_000);

  it("removes an empty, hand-made site from the published demo, and nothing else", async () => {
    await withEmptyDatabase(async (pool) => {
      // The database as it was before this migration, with what an early version let someone add by hand.
      const dir = copyOfMigrations();
      rmSync(join(dir, "019_clean_published_demo.sql"));
      await runMigrations(pool, dir);

      const DEMO = "11111111-1111-4111-8111-111111111111";
      const stray = randomUUID();
      const withBox = randomUUID();
      const other = randomUUID();
      const otherSite = randomUUID();
      const addSite = (id: string, tenant: string, name: string) =>
        pool.query("INSERT INTO sites (id, tenant_id, name, type, location_name) VALUES ($1, $2, $3, 'farm', 'Tirana Albania')", [id, tenant, name]);
      await addSite(stray, DEMO, "X Farm");
      await pool.query("INSERT INTO devices (tenant_id, site_id, name, device_type, protocol, driver_type) VALUES ($1, $2, 'A device', 'meter', 'modbus', 'modbus')", [DEMO, stray]);
      await addSite(withBox, DEMO, "A demo site with a box");
      await pool.query("INSERT INTO edge_gateways (tenant_id, site_id, name) VALUES ($1, $2, 'A box')", [DEMO, withBox]);
      await pool.query("INSERT INTO tenants (id, name, domain) VALUES ($1, 'Another client', 'another.example')", [other]);
      await addSite(otherSite, other, "Another client's empty site");

      copyFileSync(join(MIGRATIONS, "019_clean_published_demo.sql"), join(dir, "019_clean_published_demo.sql"));
      const result = await runMigrations(pool, dir);
      expect(result.applied).toEqual(["019_clean_published_demo.sql"]);

      const sites = (await pool.query<{ id: string; name: string }>("SELECT id, name FROM sites ORDER BY name")).rows.map((row) => row.name);
      expect(sites).toEqual(["A demo site with a box", "Another client's empty site", "Integrated Farm Site", "Solar + Battery Site", "Water Management Site"]);
      // What belonged to the removed site went with it.
      expect((await pool.query("SELECT 1 FROM devices WHERE site_id = $1", [stray])).rowCount).toBe(0);
      // And the three the demo is made of still have their history.
      expect(Number((await pool.query("SELECT count(*) AS n FROM telemetry_readings WHERE site_id = '22222222-2222-4222-8222-222222222201'")).rows[0]?.n)).toBeGreaterThan(0);
    });
  }, 60_000);

  it("applies each migration once when two instances start together", async () => {
    await withEmptyDatabase(async (pool, connectionString) => {
      const other = new Pool({ connectionString });
      try {
        const names = readMigrationFiles(MIGRATIONS).map((file) => file.name);
        const [a, b] = await Promise.all([runMigrations(pool, MIGRATIONS), runMigrations(other, MIGRATIONS)]);
        expect(a.applied.length + b.applied.length).toBe(names.length);
        const ledger = await pool.query("SELECT 1 FROM schema_migrations");
        expect(ledger.rowCount).toBe(names.length);
      } finally {
        await other.end();
      }
    });
  }, 60_000);
});
