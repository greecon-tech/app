import { join } from "path";
import * as bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { DEMO_TENANT_ID } from "@greecon/shared";
import { PUBLISHED_PASSWORD_HASHES, secureAccounts } from "./account-hygiene";
import { runMigrations } from "./migrator";
import { testDatabaseUrl, withEmptyDatabase } from "./test-database";

const MIGRATIONS = join(__dirname, "migrations");
const FOUNDER = "eridon.manuka@greecon.earth";
const A_GOOD_PASSWORD = "a-long-password-of-my-own-1";

async function migrated(pool: Pool): Promise<void> {
  await runMigrations(pool, MIGRATIONS);
}

async function hashOf(pool: Pool, email: string): Promise<string | null | undefined> {
  return (await pool.query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE email = $1", [email])).rows[0]?.password_hash;
}

async function addRealUser(pool: Pool, email: string, hash: string | null): Promise<void> {
  const tenant = (await pool.query<{ id: string }>("SELECT id FROM tenants WHERE domain = 'greecon.earth'")).rows[0];
  const user = (
    await pool.query<{ id: string }>("INSERT INTO users (tenant_id, email, name, status, password_hash) VALUES ($1, $2, 'Someone', 'active', $3) RETURNING id", [tenant?.id, email, hash])
  ).rows[0];
  await pool.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenant?.id, user?.id]);
}

describe.skipIf(!testDatabaseUrl)("account safeguards (real PostgreSQL)", () => {
  it("shuts an account outside the demo tenant that still carries a published password, and leaves the demo login alone", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);
      await addRealUser(pool, "someone@example.com", PUBLISHED_PASSWORD_HASHES[0] as string);
      await addRealUser(pool, "other@example.com", PUBLISHED_PASSWORD_HASHES[1] as string);
      await addRealUser(pool, "careful@example.com", await bcrypt.hash(A_GOOD_PASSWORD, 4));
      const demoBefore = await hashOf(pool, "demo@greecon.earth");

      const result = await secureAccounts(pool, {});

      expect(result.locked.sort()).toEqual(["other@example.com", "someone@example.com"]);
      expect(await hashOf(pool, "someone@example.com")).toBeNull();
      expect(await hashOf(pool, "other@example.com")).toBeNull();
      expect(await bcrypt.compare(A_GOOD_PASSWORD, (await hashOf(pool, "careful@example.com")) as string)).toBe(true);
      expect(await hashOf(pool, "demo@greecon.earth")).toBe(demoBefore);
      expect(demoBefore).toBeTruthy();
      const demoTenant = await pool.query("SELECT 1 FROM users WHERE tenant_id = $1 AND email = 'demo@greecon.earth'", [DEMO_TENANT_ID]);
      expect(demoTenant.rowCount).toBe(1);
    });
  }, 60_000);

  it("gives the administrator a password from the deployment's settings, once, and never overwrites one that has been chosen", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);
      const env = { BOOTSTRAP_ADMIN_EMAIL: ` ${FOUNDER.toUpperCase()} `, BOOTSTRAP_ADMIN_PASSWORD: A_GOOD_PASSWORD };

      expect((await secureAccounts(pool, env)).bootstrap).toBe("password_set");
      expect(await bcrypt.compare(A_GOOD_PASSWORD, (await hashOf(pool, FOUNDER)) as string)).toBe(true);

      // The administrator signs in and picks their own password. The settings are still in place.
      const chosen = await bcrypt.hash("the-password-i-chose-myself", 4);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [chosen, FOUNDER]);
      expect((await secureAccounts(pool, env)).bootstrap).toBe("already_has_password");
      expect(await hashOf(pool, FOUNDER)).toBe(chosen);
    });
  }, 60_000);

  it("recovers an administrator whose password was the published one: shuts it, then sets the new one in the same pass", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [PUBLISHED_PASSWORD_HASHES[0], FOUNDER]);

      const result = await secureAccounts(pool, { BOOTSTRAP_ADMIN_EMAIL: FOUNDER, BOOTSTRAP_ADMIN_PASSWORD: A_GOOD_PASSWORD });

      expect(result.locked).toEqual([FOUNDER]);
      expect(result.bootstrap).toBe("password_set");
      expect(await bcrypt.compare(A_GOOD_PASSWORD, (await hashOf(pool, FOUNDER)) as string)).toBe(true);
    });
  }, 60_000);

  it("without the settings, leaves a shut administrator shut rather than guessing a password", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [PUBLISHED_PASSWORD_HASHES[0], FOUNDER]);

      const result = await secureAccounts(pool, {});

      expect(result).toEqual({ locked: [FOUNDER], bootstrap: "not_requested" });
      expect(await hashOf(pool, FOUNDER)).toBeNull();
    });
  }, 60_000);

  it("creates a new platform administrator in the Greecon tenant when the email is not known yet", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);

      const result = await secureAccounts(pool, { BOOTSTRAP_ADMIN_EMAIL: "pm@greecon.earth", BOOTSTRAP_ADMIN_PASSWORD: A_GOOD_PASSWORD });

      expect(result.bootstrap).toBe("created");
      const row = (
        await pool.query<{ is_platform_admin: boolean; role: string; domain: string; password_hash: string }>(
          `SELECT u.is_platform_admin, m.role, t.domain, u.password_hash
           FROM users u JOIN memberships m ON m.user_id = u.id JOIN tenants t ON t.id = u.tenant_id WHERE u.email = 'pm@greecon.earth'`
        )
      ).rows[0];
      expect(row?.is_platform_admin).toBe(true);
      expect(row?.role).toBe("owner");
      expect(row?.domain).toBe("greecon.earth");
      expect(await bcrypt.compare(A_GOOD_PASSWORD, row?.password_hash as string)).toBe(true);
    });
  }, 60_000);

  it("ignores settings that are half given or too short, and says nothing is done", async () => {
    await withEmptyDatabase(async (pool) => {
      await migrated(pool);

      expect((await secureAccounts(pool, { BOOTSTRAP_ADMIN_EMAIL: FOUNDER })).bootstrap).toBe("skipped");
      expect((await secureAccounts(pool, { BOOTSTRAP_ADMIN_PASSWORD: A_GOOD_PASSWORD })).bootstrap).toBe("skipped");
      expect((await secureAccounts(pool, { BOOTSTRAP_ADMIN_EMAIL: FOUNDER, BOOTSTRAP_ADMIN_PASSWORD: "short" })).bootstrap).toBe("skipped");
      expect(await hashOf(pool, FOUNDER)).toBeNull();
    });
  }, 60_000);
});
