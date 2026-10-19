import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Pool, PoolClient } from "pg";

// Until this ledger existed, every run of `db:migrate` replayed every file, so each file was written
// to be harmless to repeat. Some were not harmless: 003 set the platform administrator's password to
// a published one on every run. A ledger makes a migration run exactly once, and a database that
// predates it is brought under it without replaying anything it already carries.

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationResult {
  /** Files that were run now. */
  applied: string[];
  /** Files recorded as already applied because the database was migrated before the ledger existed. */
  baselined: string[];
}

export class MigrationError extends Error {}

/** Probes for the migrations that were replayed on every run before the ledger. Each answers "does
 * this database already carry the effect of that file?". A true answer records the file as applied
 * without running it; a false one lets it run, which was always safe because every one of them could
 * be repeated. Later files are not listed: they run exactly once, like any new migration. */
const LEGACY_PROBES: Record<string, string> = {
  "001_schema.sql": "SELECT to_regclass('public.tenants') IS NOT NULL AND to_regclass('public.telemetry_readings') IS NOT NULL AS applied",
  "002_seed_demo.sql": "SELECT EXISTS (SELECT 1 FROM tenants WHERE id = '11111111-1111-4111-8111-111111111111') AS applied",
  "003_auth.sql": columnProbe("users", "password_hash"),
  "004_site_safety_limits.sql": columnProbe("sites", "safety_limits"),
  "005_platform_admin.sql": columnProbe("users", "is_platform_admin"),
  "006_split_demo_and_real_tenant.sql": "SELECT EXISTS (SELECT 1 FROM tenants WHERE domain = 'greecon.earth') AS applied",
  "007_dashboard_preferences.sql": "SELECT to_regclass('public.dashboard_preferences') IS NOT NULL AS applied",
  "008_gateway_credentials.sql": columnProbe("edge_gateways", "secret_hash")
};

function columnProbe(table: string, column: string): string {
  return `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}') AS applied`;
}

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  baselined boolean NOT NULL DEFAULT false
)`;

// Two API instances starting together (a rolling deploy) must not both run a migration.
const LOCK_KEY = "greecon:schema_migrations";

export function checksumOf(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function readMigrationFiles(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), "utf8");
      return { name, sql, checksum: checksumOf(sql) };
    });
}

export async function runMigrations(pool: Pool, dir: string, log: (message: string) => void = () => undefined): Promise<MigrationResult> {
  const files = readMigrationFiles(dir);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_KEY]);
    try {
      return await applyPending(client, files, log);
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function applyPending(client: PoolClient, files: MigrationFile[], log: (message: string) => void): Promise<MigrationResult> {
  const result: MigrationResult = { applied: [], baselined: [] };

  // Creating the ledger and recording what an older database already carries happen together, so a
  // crash in between cannot leave a ledger that is half filled: the next run would then replay the
  // files that were not yet recorded, 003 among them.
  const ledgerExisted = (await client.query<{ present: boolean }>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present")).rows[0]?.present === true;
  if (!ledgerExisted) {
    await client.query("BEGIN");
    try {
      await client.query(LEDGER_DDL);
      // Tables but no ledger: this database was migrated by the old runner.
      if (await tableExists(client, "tenants")) {
        for (const file of files) {
          if (!(await alreadyCarries(client, file.name))) continue;
          await client.query("INSERT INTO schema_migrations (name, checksum, baselined) VALUES ($1, $2, true)", [file.name, file.checksum]);
          result.baselined.push(file.name);
          log(`Recorded ${file.name} as already applied (this database predates the migration ledger).`);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new MigrationError(`Could not create the migration ledger: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const recorded = new Map<string, string>();
  for (const row of (await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations")).rows) {
    recorded.set(row.name, row.checksum);
  }

  for (const file of files) {
    const known = recorded.get(file.name);
    if (known !== undefined) {
      if (known !== file.checksum) {
        throw new MigrationError(
          `Migration ${file.name} was changed after it was applied. Applied migrations are never edited; add a new migration instead.`
        );
      }
      continue;
    }

    log(`Applying ${file.name}...`);
    await client.query("BEGIN");
    try {
      await client.query(file.sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file.name, file.checksum]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new MigrationError(`Migration ${file.name} failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
    }
    result.applied.push(file.name);
  }

  return result;
}

async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  return (await client.query<{ present: boolean }>("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${table}`])).rows[0]?.present === true;
}

async function alreadyCarries(client: PoolClient, name: string): Promise<boolean> {
  const probe = LEGACY_PROBES[name];
  if (!probe) return false;
  return (await client.query<{ applied: boolean }>(probe)).rows[0]?.applied === true;
}
