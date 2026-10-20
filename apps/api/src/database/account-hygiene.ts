import * as bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { DEMO_TENANT_ID } from "@greecon/shared";

// Two shared logins were once published in this repository so that a sales demo could be opened
// without setting anything up. The demo tenant may keep its own (it holds nothing real, and its
// login can only look). No other account may ever carry a published password, and the platform
// administrator in particular must not: a redeploy used to put the published one back.

/** The exact bcrypt hashes that 003_auth.sql and 006_split_demo_and_real_tenant.sql wrote.
 * "greecon-demo-2026" and "demo123". An account outside the demo tenant that still carries one of
 * them is shut until its owner sets a password of their own. */
export const PUBLISHED_PASSWORD_HASHES: readonly string[] = [
  "$2b$10$uaQDHxzYiU.u7qZl/lCbCui7Fq8kbjFuqnKI5Htzx3MxLYEuxJ3IG",
  "$2b$10$rO6OR6h6aLLvqMcc73USp.n8sLZCkd5uLC988scCXBqG9xQaO34mm"
];

export const MINIMUM_BOOTSTRAP_PASSWORD_LENGTH = 12;

type Env = Record<string, string | undefined>;

export interface AccountHygieneResult {
  /** Accounts shut because they still carried a published password. */
  locked: string[];
  bootstrap: "not_requested" | "created" | "password_set" | "already_has_password" | "skipped";
}

export async function secureAccounts(pool: Pool, env: Env, log: (message: string) => void = () => undefined): Promise<AccountHygieneResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const locked = (
        await client.query<{ email: string }>(
          `UPDATE users SET password_hash = NULL
           WHERE password_hash = ANY($1::text[]) AND tenant_id <> $2
           RETURNING email`,
          [PUBLISHED_PASSWORD_HASHES, DEMO_TENANT_ID]
        )
      ).rows.map((row) => row.email);
      for (const email of locked) {
        log(`SECURITY: ${email} still had a published password, so sign-in is shut for it until a new password is set (BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD can do that).`);
      }

      const bootstrap = await bootstrapAdministrator(client, env, log);
      await client.query("COMMIT");
      return { locked, bootstrap };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

type Queryable = Pick<import("pg").PoolClient, "query">;

// Lets whoever deploys give the first administrator a password through the host's own settings page
// instead of a database console. It only ever fills a gap: an account that already has a password
// keeps it, so leaving the variables in place cannot undo a password someone has since chosen.
async function bootstrapAdministrator(client: Queryable, env: Env, log: (message: string) => void): Promise<AccountHygieneResult["bootstrap"]> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password) return "not_requested";
  if (!email || !password) {
    log("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together; neither was used.");
    return "skipped";
  }
  if (password.length < MINIMUM_BOOTSTRAP_PASSWORD_LENGTH) {
    log(`BOOTSTRAP_ADMIN_PASSWORD is shorter than ${MINIMUM_BOOTSTRAP_PASSWORD_LENGTH} characters and was not used.`);
    return "skipped";
  }

  const existing = (await client.query<{ id: string; password_hash: string | null }>("SELECT id, password_hash FROM users WHERE lower(email) = $1 LIMIT 1", [email])).rows[0];
  if (existing) {
    if (existing.password_hash) {
      log(`${email} already has a password; BOOTSTRAP_ADMIN_PASSWORD was ignored. Remove both BOOTSTRAP_ADMIN variables.`);
      return "already_has_password";
    }
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(password, 10), existing.id]);
    log(`Password set for ${email} from BOOTSTRAP_ADMIN_PASSWORD. Sign in, change it in Settings, then remove both BOOTSTRAP_ADMIN variables.`);
    return "password_set";
  }

  const tenant = (await client.query<{ id: string }>("SELECT id FROM tenants WHERE domain = 'greecon.earth' LIMIT 1")).rows[0];
  if (!tenant) {
    log(`No Greecon tenant exists to create ${email} in; BOOTSTRAP_ADMIN was not used.`);
    return "skipped";
  }
  const created = (
    await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, name, status, password_hash, is_platform_admin)
       VALUES ($1, $2, $3, 'active', $4, true) RETURNING id`,
      [tenant.id, email, email.split("@")[0] ?? email, await bcrypt.hash(password, 10)]
    )
  ).rows[0];
  await client.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenant.id, created?.id]);
  log(`Administrator ${email} created from BOOTSTRAP_ADMIN_PASSWORD. Sign in, change the password in Settings, then remove both BOOTSTRAP_ADMIN variables.`);
  return "created";
}
