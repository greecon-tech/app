import { join } from "path";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_TENANT_ID } from "@greecon/shared";
import { runMigrations } from "../../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../../database/test-database";
import { DatabaseService } from "../../database/database.service";
import { AuthService } from "./auth.service";

const SECRET = "x".repeat(40);

describe.skipIf(!testDatabaseUrl)("signing in with a temporary password (real PostgreSQL)", () => {
  const original = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  async function withAuth<T>(use: (auth: AuthService, query: (sql: string, params?: unknown[]) => Promise<void>) => Promise<T>): Promise<T> {
    return withEmptyDatabase(async (pool, connectionString) => {
      await runMigrations(pool, join(__dirname, "..", "..", "database", "migrations"));
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = new DatabaseService();
      process.env.DATABASE_URL = previous;
      try {
        return await use(new AuthService(db), async (sql, params) => void (await pool.query(sql, params)));
      } finally {
        await db.onModuleDestroy();
      }
    });
  }

  /** A client owner the way the project manager creates one: a password they know, flagged temporary. */
  async function addOwner(query: (sql: string, params?: unknown[]) => Promise<void>, email: string, password: string, temporary: boolean): Promise<void> {
    const tenantId = "aaaaaaaa-0000-4000-8000-000000000001";
    await query("INSERT INTO tenants (id, name, domain) VALUES ($1, 'Client', 'client.example') ON CONFLICT DO NOTHING", [tenantId]);
    const hash = await bcrypt.hash(password, 4);
    const id = "aaaaaaaa-0000-4000-8000-000000000002";
    await query("INSERT INTO users (id, tenant_id, email, name, status, password_hash, must_change_password) VALUES ($1,$2,$3,'Owner','active',$4,$5)", [id, tenantId, email, hash, temporary]);
    await query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'owner')", [tenantId, id]);
  }

  it("opens a session that can only be used to choose a new password, and says so", async () => {
    await withAuth(async (auth, query) => {
      await addOwner(query, "owner@client.example", "Temporary-Pass-1", true);
      const { token, user } = await auth.login("owner@client.example", "Temporary-Pass-1");

      expect(user.mustChangePassword).toBe(true);
      expect((jwt.verify(token, SECRET) as { mcp?: boolean }).mcp).toBe(true);
    });
  }, 60_000);

  it("opens an ordinary session once the password is the person's own", async () => {
    await withAuth(async (auth, query) => {
      await addOwner(query, "owner@client.example", "Temporary-Pass-1", true);
      await auth.changePassword("aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000001", "Temporary-Pass-1", "My-own-long-password-7");

      await expect(auth.login("owner@client.example", "Temporary-Pass-1")).rejects.toThrow(/Invalid email or password/);
      const { token, user } = await auth.login("owner@client.example", "My-own-long-password-7");
      expect(user.mustChangePassword).toBe(false);
      expect((jwt.verify(token, SECRET) as { mcp?: boolean }).mcp).toBeUndefined();
    });
  }, 60_000);

  it("refuses a new password that is too short, the same, or one this product has published", async () => {
    await withAuth(async (auth, query) => {
      await addOwner(query, "owner@client.example", "Temporary-Pass-1", true);
      const change = (next: string, current = "Temporary-Pass-1") => auth.changePassword("aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000001", current, next);

      await expect(change("short")).rejects.toThrow(/at least 10 characters/);
      await expect(change("Temporary-Pass-1")).rejects.toThrow(/different from the current/);
      await expect(change("greecon-demo-2026")).rejects.toThrow(/too easy to guess/);
      await expect(change("aaaaaaaaaaaa")).rejects.toThrow(/repeated character/);
      await expect(change("Another-long-password-9", "wrong-current-password")).rejects.toThrow(/Current password is incorrect/);
      // Nothing changed: the temporary password still works and is still temporary.
      expect((await auth.login("owner@client.example", "Temporary-Pass-1")).user.mustChangePassword).toBe(true);
    });
  }, 60_000);

  it("never lets a demo account's shared password be changed", async () => {
    await withAuth(async (auth) => {
      await expect(auth.changePassword("any-user", DEMO_TENANT_ID, "demo123", "A-brand-new-password-3")).rejects.toThrow(/Demo account passwords/);
    });
  }, 60_000);

  it("finds an account only by its address in plain ASCII, so a spelling the database would lower-case into it does not sign in", async () => {
    await withAuth(async (auth, query) => {
      await addOwner(query, "ilir@client.example", "Temporary-Pass-1", false);
      // The database's lower() turns "İ" into "i" (with a Unicode collation), so without the check this reaches the account.
      await expect(auth.login("İlir@client.example", "Temporary-Pass-1")).rejects.toThrow(/Invalid email or password/);
      await expect(auth.login("ilir@client.example\u200b", "Temporary-Pass-1")).rejects.toThrow(/Invalid email or password/);
      // The ordinary spellings of the same address still do: case and spaces around it do not matter.
      expect((await auth.login("  Ilir@Client.Example ", "Temporary-Pass-1")).user.email).toBe("ilir@client.example");
    });
  }, 60_000);

  it("takes about as long to refuse an address with no account as one with the wrong password, so timing does not say which exist", async () => {
    await withAuth(async (auth, query) => {
      await addOwner(query, "owner@client.example", "Temporary-Pass-1", false);
      const time = async (email: string): Promise<number> => {
        const started = process.hrtime.bigint();
        await auth.login(email, "a-wrong-password-entirely").catch(() => undefined);
        return Number(process.hrtime.bigint() - started) / 1e6;
      };
      await time("owner@client.example"); // warm up
      const real = Math.min(await time("owner@client.example"), await time("owner@client.example"));
      const unknown = Math.min(await time("nobody@client.example"), await time("nobody-either@client.example"));
      // A hash of the wrong length is refused in a fraction of a millisecond; a real one takes tens of them.
      expect(unknown).toBeGreaterThan(real / 4);
    });
  }, 60_000);
});
