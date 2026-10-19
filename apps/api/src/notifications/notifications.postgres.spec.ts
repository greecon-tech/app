import { join } from "path";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { Channels } from "./channels";
import { NotificationConfig } from "./config";
import { NotificationsService } from "./notifications.service";
import { PostgresOutboxStore } from "./outbox";
import { PlannedMessage } from "./plan";

const MIN = 60_000;
const NOON = Date.parse("2026-10-19T10:00:00Z");

/** A migrated empty database with two accounts, and a way to connect to it again as a restart would. */
async function inWorld<T>(use: (world: { pool: Pool; connect: () => DatabaseService; tenants: [string, string] }) => Promise<T>): Promise<T> {
  return withEmptyDatabase(async (pool, connectionString) => {
    await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
    const first = await pool.query<{ id: string }>("INSERT INTO tenants (name, domain) VALUES ('Hotel Adriatik Ltd', 'hotel-adriatik.example') RETURNING id");
    const second = await pool.query<{ id: string }>("INSERT INTO tenants (name, domain) VALUES ('Vlora Farm', 'vlora-farm.example') RETURNING id");
    const connect = () => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = new DatabaseService();
      process.env.DATABASE_URL = previous;
      return db;
    };
    return use({ pool, connect, tenants: [first.rows[0]?.id as string, second.rows[0]?.id as string] });
  });
}

const message = (overrides: Partial<PlannedMessage> = {}): PlannedMessage => ({
  alertId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  contactId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
  contactName: "Besa Krasniqi",
  channel: "email",
  kind: "alert",
  priority: "act_now",
  subject: "Act now: Tank level is critical, Hotel Adriatik",
  body: "Act now: Tank level is critical.",
  dueAtMs: NOON,
  eventAtMs: NOON,
  dedupeKey: "alert:a1:1:c1:email",
  ...overrides
});

describe.skipIf(!testDatabaseUrl)("the message outbox, on a real PostgreSQL", () => {
  it("keeps a planned message, and plans the same one only once", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const first = await outbox.plan(tenants[0], [message(), message({ channel: "sms", dedupeKey: "alert:a1:1:c1:sms", subject: undefined })], NOON);
      expect(first).toHaveLength(2);
      expect(await outbox.plan(tenants[0], [message()], NOON)).toEqual([]); // the same key: nothing new
      // The same key in another account is another message.
      expect(await outbox.plan(tenants[1], [message()], NOON)).toHaveLength(1);
      expect((await outbox.recent(tenants[0], 10)).map((row) => row.channel).sort()).toEqual(["email", "sms"]);
      await db.onModuleDestroy();
    });
  });

  it("gives a due message to exactly one of two workers asking at the same moment", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const dbA = connect();
      const dbB = connect();
      const planner = new PostgresOutboxStore(dbA);
      await planner.plan(tenants[0], Array.from({ length: 20 }, (_, index) => message({ dedupeKey: `alert:a1:1:c${index}:email`, dueAtMs: NOON + index })), NOON);

      const [fromA, fromB] = await Promise.all([new PostgresOutboxStore(dbA).claimDue(NOON + 1_000, 12), new PostgresOutboxStore(dbB).claimDue(NOON + 1_000, 12)]);
      const ids = [...fromA, ...fromB].map((row) => row.id);
      expect(ids).toHaveLength(20);
      expect(new Set(ids).size).toBe(20);
      expect(fromA.every((row) => row.status === "sending")).toBe(true);
      await dbA.onModuleDestroy();
      await dbB.onModuleDestroy();
    });
  });

  it("does not hand out what is not due yet, oldest first", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      await outbox.plan(tenants[0], [message({ dedupeKey: "later", dueAtMs: NOON + 10 * MIN }), message({ dedupeKey: "sooner", dueAtMs: NOON })], NOON);
      expect((await outbox.claimDue(NOON + MIN, 10)).map((row) => row.dedupeKey)).toEqual(["sooner"]);
      expect((await outbox.claimDue(NOON + 11 * MIN, 10)).map((row) => row.dedupeKey)).toEqual(["later"]);
      await db.onModuleDestroy();
    });
  });

  it("gives back what a worker took and never finished", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      await outbox.plan(tenants[0], [message()], NOON);
      expect(await outbox.claimDue(NOON, 10)).toHaveLength(1);
      expect(await outbox.claimDue(NOON + MIN, 10)).toEqual([]);
      expect(await outbox.recoverStuck(NOON + 2 * MIN, 5 * MIN)).toBe(0);
      expect(await outbox.recoverStuck(Date.now() + 10 * MIN, 5 * MIN)).toBe(1);
      expect(await outbox.claimDue(Date.now() + 10 * MIN, 10)).toHaveLength(1);
      await db.onModuleDestroy();
    });
  });

  it("records what became of a message, and counts what was sent in the last hour", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const [sent, failed, skipped, retried] = await outbox.plan(
        tenants[0],
        [message({ dedupeKey: "k1" }), message({ dedupeKey: "k2" }), message({ dedupeKey: "k3" }), message({ dedupeKey: "k4" })],
        NOON
      );
      await outbox.markSent(sent?.id as string, NOON + MIN, "besa@hotel.example", "em_1");
      await outbox.markFailed(failed?.id as string, NOON + MIN, "The email service answered 422: Invalid `to` field.", "bad");
      await outbox.markSkipped(skipped?.id as string, NOON + MIN, "Someone acknowledged the alert before this was sent.");
      await outbox.retryAt(retried?.id as string, NOON + 5 * MIN, 1, "The email service answered 503: unavailable");

      const rows = new Map((await outbox.recent(tenants[0], 10)).map((row) => [row.dedupeKey, row]));
      expect(rows.get("k1")).toMatchObject({ status: "sent", destination: "besa@hotel.example", providerId: "em_1", sentAtMs: NOON + MIN });
      expect(rows.get("k2")).toMatchObject({ status: "failed", error: "The email service answered 422: Invalid `to` field." });
      expect(rows.get("k3")).toMatchObject({ status: "skipped", error: "Someone acknowledged the alert before this was sent." });
      expect(rows.get("k4")).toMatchObject({ status: "planned", attempts: 1, dueAtMs: NOON + 5 * MIN });

      expect(await outbox.countSentSince(tenants[0], "email", NOON, ["alert"])).toBe(1);
      expect(await outbox.countSentSince(tenants[0], "email", NOON + 2 * MIN, ["alert"])).toBe(0);
      expect(await outbox.countSentSince(tenants[0], "sms", NOON, ["alert"])).toBe(0);
      expect(await outbox.countSentSince(tenants[1], "email", NOON, ["alert"])).toBe(0);
      await db.onModuleDestroy();
    });
  });

  it("knows who was told about an alert, most urgent first, and whether any message was ever planned", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const alertId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
      const [first, second, third] = await outbox.plan(
        tenants[0],
        [
          message({ dedupeKey: "t1", contactId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01", contactName: "Besa" }),
          message({ dedupeKey: "t2", contactId: "cccccccc-cccc-4ccc-8ccc-cccccccccc02", contactName: "Arben", priority: "check_today" }),
          message({ dedupeKey: "t3", contactId: "cccccccc-cccc-4ccc-8ccc-cccccccccc03", contactName: "Never sent" })
        ],
        NOON
      );
      await outbox.markSent(first?.id as string, NOON, "a@x.example");
      await outbox.markSent(second?.id as string, NOON, "b@x.example");
      await outbox.markFailed(third?.id as string, NOON, "nope");

      expect((await outbox.toldAbout(tenants[0], alertId)).map((row) => `${row.contactName} ${row.priority}`)).toEqual(["Besa act_now", "Arben check_today"]);
      expect(await outbox.toldAbout(tenants[1], alertId)).toEqual([]);
      expect(await outbox.hasAlertMessages(tenants[0], alertId, "act_now")).toBe(true);
      expect(await outbox.hasAlertMessages(tenants[0], alertId, "check_today")).toBe(true);
      expect(await outbox.hasAlertMessages(tenants[1], alertId, "act_now")).toBe(false);
      expect(await outbox.hasAlertMessages(tenants[0], "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02", "act_now")).toBe(false);
      await db.onModuleDestroy();
    });
  });

  it("keeps a message planned for an alert that is not in the database yet", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      // The alert's own row is written a moment after the platform announces it; planning must not wait for it.
      expect(await outbox.plan(tenants[0], [message({ alertId: "dddddddd-dddd-4ddd-8ddd-dddddddddd09" })], NOON)).toHaveLength(1);
      await db.onModuleDestroy();
    });
  });
});

describe.skipIf(!testDatabaseUrl)("who is told, on a real PostgreSQL", () => {
  it("is still there after a restart, with the same order, ids and settings", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      await config.setContacts(tenants[0], [
        { name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691111111" },
        { name: "Plumber", phone: "+355693333333" }
      ]);
      await config.setSettings(tenants[0], { timezone: "UTC", quietFrom: "23:00", quietTo: "06:00", digestEnabled: false, digestAt: "08:00" });
      await config.recordTest(tenants[0], NOON);
      const before = config.contacts(tenants[0]);
      await db.onModuleDestroy();

      const restarted = new NotificationConfig(connect());
      await restarted.onModuleInit();
      expect(restarted.contacts(tenants[0])).toEqual(before);
      expect(restarted.settings(tenants[0])).toEqual({ timezone: "UTC", quietFrom: "23:00", quietTo: "06:00", digestEnabled: false, digestAt: "08:00" });
      expect(restarted.lastTestAtMs(tenants[0])).toBe(NOON);
      expect(restarted.tenantsWithContacts()).toEqual([tenants[0]]);
      expect(restarted.contacts(tenants[1])).toEqual([]);
    });
  });

  it("replaces the list in one step: people removed go, people kept stay put, new people arrive in order", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      const first = await config.setContacts(tenants[0], [
        { name: "A", email: "a@x.example" },
        { name: "B", email: "b@x.example" },
        { name: "C", email: "c@x.example" }
      ]);
      const second = await config.setContacts(tenants[0], [{ id: first[2]?.id, name: "C", email: "c@x.example" }, { name: "D", email: "d@x.example" }, { id: first[0]?.id, name: "A", email: "a2@x.example" }]);
      expect(second.map((contact) => contact.name)).toEqual(["C", "D", "A"]);
      expect(second[0]?.id).toBe(first[2]?.id);
      expect(second[2]?.id).toBe(first[0]?.id);

      const rows = await pool.query("SELECT name, email, position FROM notification_contacts WHERE tenant_id = $1 ORDER BY position", [tenants[0]]);
      expect(rows.rows).toEqual([
        { name: "C", email: "c@x.example", position: 0 },
        { name: "D", email: "d@x.example", position: 1 },
        { name: "A", email: "a2@x.example", position: 2 }
      ]);
      await db.onModuleDestroy();
    });
  });

  it("never changes or removes another account's people, even when given their ids", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      const [theirs] = await config.setContacts(tenants[1], [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      await config.setContacts(tenants[0], [{ id: theirs?.id, name: "Intruder", email: "intruder@hotel.example" }]);
      await config.setContacts(tenants[0], []);

      const rows = await pool.query("SELECT tenant_id, name FROM notification_contacts ORDER BY name");
      expect(rows.rows).toEqual([{ tenant_id: tenants[1], name: "Vlora Owner" }]);
      await db.onModuleDestroy();
    });
  });

  it("refuses, in the database itself, a person with neither an email address nor a phone number", async () => {
    await inWorld(async ({ pool, tenants }) => {
      await expect(pool.query("INSERT INTO notification_contacts (tenant_id, position, name) VALUES ($1, 0, 'Nobody')", [tenants[0]])).rejects.toThrow();
    });
  });

  it("goes with the account: deleting an account removes its people, settings and messages", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      await config.setContacts(tenants[0], [{ name: "A", email: "a@x.example" }]);
      await config.recordTest(tenants[0], NOON);
      await new PostgresOutboxStore(db).plan(tenants[0], [message()], NOON);
      await pool.query("DELETE FROM tenants WHERE id = $1", [tenants[0]]);
      for (const table of ["notification_contacts", "notification_settings", "notifications"]) {
        expect((await pool.query(`SELECT 1 FROM ${table}`)).rows, table).toEqual([]);
      }
      await db.onModuleDestroy();
    });
  });
});

describe.skipIf(!testDatabaseUrl)("telling people, on a real PostgreSQL", () => {
  it("sends the morning message once even if two platforms start on the same morning", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const sent: string[] = [];
      const channels: Channels = { email: { send: async (mail) => (sent.push(mail.to), { ok: true as const }) }, problems: [] };
      const source = {
        alertById: () => undefined,
        openAlertsAcrossTenants: () => [],
        tenantNameOf: () => "Hotel Adriatik Ltd",
        digestOf: () => ({ customer: "Hotel Adriatik Ltd", sites: [] }),
        setAlertListener: () => undefined
      };
      const dbA = connect();
      const dbB = connect();
      const configA = new NotificationConfig(dbA);
      await configA.setContacts(tenants[0], [{ name: "Besa", email: "besa@hotel.example" }]);
      const configB = new NotificationConfig(dbB);
      await configB.onModuleInit();
      const a = new NotificationsService(source, configA, new PostgresOutboxStore(dbA), channels, { autoSend: false });
      const b = new NotificationsService(source, configB, new PostgresOutboxStore(dbB), channels, { autoSend: false });

      const morning = Date.parse("2026-10-19T05:31:00Z"); // 07:31 in Tirane
      await Promise.all([a.tick(morning), b.tick(morning)]);
      expect(sent).toEqual(["besa@hotel.example"]);
      await dbA.onModuleDestroy();
      await dbB.onModuleDestroy();
    });
  });
});
