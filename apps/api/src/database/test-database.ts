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
  admin.on("error", () => undefined);
  await admin.query(`CREATE DATABASE ${name}`);
  const target = new URL(testDatabaseUrl);
  target.pathname = `/${name}`;
  const pool = new Pool({ connectionString: target.toString() });
  // Dropping the database with FORCE can reach a connection that is still closing; that is expected here.
  pool.on("error", () => undefined);
  try {
    return await use(pool, target.toString());
  } finally {
    await pool.end();
    // pool.end() answers while its connections are still closing. Dropping the database now, with FORCE, would send each of them a
    // "terminating connection" error that nothing is listening for, and the test run would end with an unhandled error (on a busy
    // machine, now and then). Wait until the server has seen them go; FORCE is only for one that will not.
    for (let waited = 0; waited < 4_000; waited += 50) {
      const open = await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]);
      if ((open.rows[0]?.n ?? 0) === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}
