import { join } from "path";
import { Pool } from "pg";
import { secureAccounts } from "./account-hygiene";
import { runMigrations } from "./migrator";

type Env = Record<string, string | undefined>;

/** Brings the database to what this version of the API expects, then closes the accounts that must
 * not be open. It runs before the API starts, so a deploy needs no separate migration step and a
 * failed migration stops the new version rather than serving from half a schema. Without a database
 * (the demo and local development) there is nothing to do. */
export async function prepareDatabase(env: Env, log: (message: string) => void, migrationsDir: string = join(__dirname, "migrations")): Promise<void> {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString });
  try {
    if (env.AUTO_MIGRATE?.trim().toLowerCase() === "false") {
      log("AUTO_MIGRATE is false: migrations were not run.");
    } else {
      const { applied, baselined } = await runMigrations(pool, migrationsDir, log);
      log(
        applied.length === 0 && baselined.length === 0
          ? "Database is up to date."
          : `Database updated: ${applied.length} migration(s) applied, ${baselined.length} recorded as already applied.`
      );
    }

    const hasUsers = (await pool.query<{ present: boolean }>("SELECT to_regclass('public.users') IS NOT NULL AS present")).rows[0]?.present === true;
    if (hasUsers) await secureAccounts(pool, env, log);
  } finally {
    await pool.end();
  }
}
