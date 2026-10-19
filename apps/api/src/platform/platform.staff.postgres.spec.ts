import { join } from "path";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { forgetAllUsers, sessionIsStillGood } from "../common/active-users";
import { Principal } from "../common/principal";
import { AuthService } from "../modules/auth/auth.service";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { PlatformService } from "./platform.service";

const SECRET = "t".repeat(40);

interface World {
  platform: PlatformService;
  auth: AuthService;
  db: DatabaseService;
  pool: Pool;
  /** The owner of Greecon's own account: the only one who may change the team. */
  founder: Principal;
  restart: () => Promise<PlatformService>;
}

async function inTeam<T>(use: (world: World) => Promise<T>): Promise<T> {
  return withEmptyDatabase(async (pool, connectionString) => {
    await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = new DatabaseService();
    process.env.DATABASE_URL = previous;
    const platform = new PlatformService(db);
    await platform.onModuleInit();
    const found = (
      await pool.query<{ id: string; tenant_id: string; role: string }>(
        `SELECT u.id, u.tenant_id, m.role FROM users u JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id WHERE u.email = 'eridon.manuka@greecon.earth'`
      )
    ).rows[0];
    if (!found) throw new Error("The migrations did not leave the founder's account.");
    const founder: Principal = { tenantId: found.tenant_id, userId: found.id, role: "owner", email: "eridon.manuka@greecon.earth", isPlatformAdmin: true };
    const started: PlatformService[] = [platform];
    try {
      return await use({
        platform,
        auth: new AuthService(db),
        db,
        pool,
        founder,
        restart: async () => {
          const again = new PlatformService(db);
          await again.onModuleInit();
          started.push(again);
          return again;
        }
      });
    } finally {
      for (const service of started) await service.onApplicationShutdown();
      await db.onModuleDestroy();
    }
  });
}

/** The principal a team member has once signed in. */
const asTeamMember = (founder: Principal, member: { id: string; email: string }): Principal => ({ tenantId: founder.tenantId, userId: member.id, role: "admin", email: member.email, isPlatformAdmin: true });

describe.skipIf(!testDatabaseUrl)("Greecon's own team (real PostgreSQL)", () => {
  const original = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    forgetAllUsers();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it("lets the owner add a project manager, who signs in with a temporary password and must choose their own", async () => {
    await inTeam(async ({ platform, auth, founder }) => {
      const before = platform.listStaff(founder);
      expect(before.map((member) => member.email)).toEqual(["eridon.manuka@greecon.earth"]);
      expect(before[0]?.isYou).toBe(true);

      const { member, temporaryPassword } = await platform.addStaffMember({ name: "Arta Project", email: "Arta.PM@Greecon.earth" }, founder);
      expect(member).toMatchObject({ name: "Arta Project", email: "arta.pm@greecon.earth", status: "active", isYou: false });
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

      const login = await auth.login("arta.pm@greecon.earth", temporaryPassword);
      expect(login.user).toMatchObject({ isPlatformAdmin: true, mustChangePassword: true, role: "admin", tenantId: founder.tenantId });

      const audit = platform.listAudit(founder).find((event) => event.eventType === "staff.added");
      expect(audit?.reason).toContain("arta.pm@greecon.earth");
      expect(JSON.stringify(audit)).not.toContain(temporaryPassword);
    });
  }, 60_000);

  it("keeps the team across a restart, because it is in the database and not only in memory", async () => {
    await inTeam(async ({ platform, founder, restart }) => {
      await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      const again = await restart();
      expect(again.listStaff(founder).map((member) => member.email).sort()).toEqual(["arta.pm@greecon.earth", "eridon.manuka@greecon.earth"]);
    });
  }, 60_000);

  it("lets a team member see the team but not change it, so a project manager cannot make more project managers", async () => {
    await inTeam(async ({ platform, founder }) => {
      const { member } = await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      const arta = asTeamMember(founder, member);

      expect(platform.listStaff(arta)).toHaveLength(2);
      expect(platform.listStaff(arta).find((entry) => entry.id === arta.userId)?.isYou).toBe(true);
      await expect(platform.addStaffMember({ name: "Another", email: "another@greecon.earth" }, arta)).rejects.toThrow(/Only the owner/);
      await expect(platform.setStaffStatus(founder.userId, "disabled", arta)).rejects.toThrow(/Only the owner/);
      await expect(platform.resetStaffPassword(founder.userId, arta)).rejects.toThrow(/Only the owner/);
    });
  }, 60_000);

  it("shows the team to nobody who is not on it, and not to a team member while they are inside a customer's account", async () => {
    await inTeam(async ({ platform, founder }) => {
      const customer = await platform.createTenant({ name: "Hotel Adriatik", ownerName: "Besa", ownerEmail: "besa@hotel-adriatik.example" }, founder);
      const owner: Principal = { tenantId: customer.tenant.id, userId: customer.owner.id, role: "owner", email: customer.owner.email, isPlatformAdmin: false };
      expect(() => platform.listStaff(owner)).toThrow(/platform-administrator/);
      await expect(platform.addStaffMember({ name: "Sneaky", email: "sneaky@hotel-adriatik.example" }, owner)).rejects.toThrow(/platform-administrator/);

      const insideCustomer: Principal = { ...founder, tenantId: customer.tenant.id, role: "admin", isPlatformAdmin: false, support: true };
      expect(() => platform.listStaff(insideCustomer)).toThrow();
      await expect(platform.addStaffMember({ name: "Sneaky", email: "sneaky@greecon.earth" }, { ...founder, support: true })).rejects.toThrow();
    });
  }, 60_000);

  it("gives each email address one account, however it is spelled and wherever it is asked for", async () => {
    await inTeam(async ({ platform, founder }) => {
      await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      await expect(platform.addStaffMember({ name: "Arta Again", email: "ARTA.PM@greecon.earth" }, founder)).rejects.toThrow(/already has an account/);

      // The founder's own address, which belongs to the Greecon account.
      await expect(platform.addStaffMember({ name: "Me", email: "eridon.manuka@greecon.earth" }, founder)).rejects.toThrow(/already has an account/);
      // A customer cannot be onboarded under a team member's address...
      await expect(platform.createTenant({ name: "Client", ownerName: "Arta", ownerEmail: "arta.pm@greecon.earth" }, founder)).rejects.toThrow(/already has an account/);

      // ...nor can one customer's person be given an address another customer's person signs in with.
      const first = await platform.createTenant({ name: "Hotel One", ownerName: "Besa", ownerEmail: "besa@one.example" }, founder);
      await expect(platform.createTenant({ name: "Hotel Two", ownerName: "Besa", ownerEmail: "Besa@One.example" }, founder)).rejects.toThrow(/already has an account/);
      const owner: Principal = { tenantId: first.tenant.id, userId: first.owner.id, role: "owner", email: first.owner.email, isPlatformAdmin: false };
      await expect(platform.createUser({ name: "Besa Too", email: "arta.pm@greecon.earth", role: "viewer" }, owner)).rejects.toThrow(/already has an account/);
      await expect(platform.createUser({ name: "Staff", email: "colleague@one.example", role: "viewer" }, owner)).resolves.toBeDefined();
    });
  }, 60_000);

  it("ends a person's session on their very next request when they are turned off, and refuses their next sign-in", async () => {
    await inTeam(async ({ platform, auth, db, founder }) => {
      const { member, temporaryPassword } = await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      const { token } = await auth.login("arta.pm@greecon.earth", temporaryPassword);
      const iat = (jwt.decode(token) as { iat: number }).iat;

      expect(await sessionIsStillGood(db, member.id, iat)).toBe(true);
      await platform.setStaffStatus(member.id, "disabled", founder);
      expect(await sessionIsStillGood(db, member.id, iat)).toBe(false);
      await expect(auth.login("arta.pm@greecon.earth", temporaryPassword)).rejects.toThrow(/Invalid email or password/);
      expect(platform.listStaff(founder).find((entry) => entry.id === member.id)?.status).toBe("disabled");

      // Turned back on, she signs in again with the same temporary password; the old token stays dead.
      await platform.setStaffStatus(member.id, "active", founder);
      const again = await auth.login("arta.pm@greecon.earth", temporaryPassword);
      expect(await sessionIsStillGood(db, member.id, (jwt.decode(again.token) as { iat: number }).iat)).toBe(true);
      expect(await sessionIsStillGood(db, member.id, iat - 5)).toBe(false);

      const events = platform.listAudit(founder).map((event) => event.eventType);
      expect(events.filter((type) => type === "staff.updated")).toHaveLength(2);
    });
  }, 60_000);

  it("ends sessions opened before a password reset, and the new temporary password works", async () => {
    await inTeam(async ({ platform, auth, db, founder }) => {
      const { member, temporaryPassword } = await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      const oldSession = Math.floor(Date.now() / 1000) - 120;

      const reset = await platform.resetStaffPassword(member.id, founder);
      expect(reset.temporaryPassword).not.toBe(temporaryPassword);
      expect(await sessionIsStillGood(db, member.id, oldSession)).toBe(false);
      await expect(auth.login("arta.pm@greecon.earth", temporaryPassword)).rejects.toThrow(/Invalid email or password/);
      const fresh = await auth.login("arta.pm@greecon.earth", reset.temporaryPassword);
      expect(fresh.user.mustChangePassword).toBe(true);
      expect(await sessionIsStillGood(db, member.id, (jwt.decode(fresh.token) as { iat: number }).iat)).toBe(true);
    });
  }, 60_000);

  it("ends every session when a person chooses a new password, so one left open elsewhere does not survive it", async () => {
    await inTeam(async ({ platform, auth, db, founder }) => {
      const { member, temporaryPassword } = await platform.addStaffMember({ name: "Arta Project", email: "arta.pm@greecon.earth" }, founder);
      const openElsewhere = Math.floor(Date.now() / 1000) - 120;
      await auth.changePassword(member.id, founder.tenantId, temporaryPassword, "My-own-long-password-7");
      expect(await sessionIsStillGood(db, member.id, openElsewhere)).toBe(false);
      const next = await auth.login("arta.pm@greecon.earth", "My-own-long-password-7");
      expect(await sessionIsStillGood(db, member.id, (jwt.decode(next.token) as { iat: number }).iat)).toBe(true);
    });
  }, 60_000);

  it("ends a customer user's session when the customer's owner turns them off or resets their password", async () => {
    await inTeam(async ({ platform, db, founder }) => {
      const customer = await platform.createTenant({ name: "Hotel Adriatik", ownerName: "Besa", ownerEmail: "besa@hotel-adriatik.example" }, founder);
      const owner: Principal = { tenantId: customer.tenant.id, userId: customer.owner.id, role: "owner", email: customer.owner.email, isPlatformAdmin: false };
      const { user } = await platform.createUser({ name: "Arben", email: "arben@hotel-adriatik.example", role: "viewer" }, owner);
      const open = Math.floor(Date.now() / 1000) - 120;

      expect(await sessionIsStillGood(db, user.id, open)).toBe(true);
      await platform.resetUserPassword(user.id, owner);
      expect(await sessionIsStillGood(db, user.id, open)).toBe(false);

      forgetAllUsers();
      const later = Math.floor(Date.now() / 1000) + 5;
      expect(await sessionIsStillGood(db, user.id, later)).toBe(true);
      await platform.updateUser(user.id, { status: "disabled" }, owner);
      expect(await sessionIsStillGood(db, user.id, later)).toBe(false);
    });
  }, 60_000);

  it("will not turn off or reset the person asking, or someone who is not on the team", async () => {
    await inTeam(async ({ platform, founder }) => {
      await expect(platform.setStaffStatus(founder.userId, "disabled", founder)).rejects.toThrow(/own access/);
      await expect(platform.resetStaffPassword(founder.userId, founder)).rejects.toThrow(/in Settings/);
      const customer = await platform.createTenant({ name: "Hotel Adriatik", ownerName: "Besa", ownerEmail: "besa@hotel-adriatik.example" }, founder);
      await expect(platform.setStaffStatus(customer.owner.id, "disabled", founder)).rejects.toThrow(/no such person/);
      await expect(platform.resetStaffPassword(customer.owner.id, founder)).rejects.toThrow(/no such person/);
    });
  }, 60_000);
});
