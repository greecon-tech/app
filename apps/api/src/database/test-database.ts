import { randomBytes } from "crypto";
import { Pool } from "pg";

/** Integration tests that need a real PostgreSQL (the migration runner, account safeguards) run
 * when TEST_DATABASE_URL points at one the test may create databases in, and are skipped when it is
 * not set. CI provides one; `docs/09-testing-and-verification.md` says how to run one locally. */
export const testDatabaseUrl: string | undefined = process.env.TEST_DATABASE_URL;

/** Runs `use` against a brand-new empty database and drops it afterwards, so tests cannot see each
 * other's tables. */
export async function withEmptyDatabase<T>(use: (pool: Pool, connectionString: string) => Promise<T>): Promise<T> {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is not set.");
  const name = `greecon_t_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString: testDatabaseUrl });
  await admin.query(`CREATE DATABASE ${name}`);
  const target = new URL(testDatabaseUrl);
  target.pathname = `/${name}`;
  const pool = new Pool({ connectionString: target.toString() });
  try {
    return await use(pool, target.toString());
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}
