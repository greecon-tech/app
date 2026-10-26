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
import { PlannedMessage, chainKey } from "./plan";

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

  it("keeps a message to Greecon's team about a silent box, and a line that stands for one told with others, in one statement", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const team = { alertId: undefined, priority: undefined, kind: "box_silent" as const, subject: "Box silent: Hotel Adriatik Ltd, Main site" };
      const stored = await outbox.plan(
        tenants[0],
        [
          message({ ...team, dedupeKey: "boxes-silent:00000000-0000-4000-8000-000000000001:1:c1" }),
          message({ ...team, dedupeKey: "box-silent:00000000-0000-4000-8000-000000000001:1", skipped: "Told in one message about the 3 boxes that went silent at the same time." })
        ],
        NOON
      );
      expect(stored.map((row) => `${row.kind} ${row.status} ${row.error ?? ""}`.trim())).toEqual([
        "box_silent planned",
        "box_silent skipped Told in one message about the 3 boxes that went silent at the same time."
      ]);
      // Only the message is handed out to be sent; the line is in the log, and its key is taken.
      expect((await outbox.claimDue(NOON, 10)).map((row) => row.dedupeKey)).toEqual(["boxes-silent:00000000-0000-4000-8000-000000000001:1:c1"]);
      expect(await outbox.existingKeys(tenants[0], ["box-silent:00000000-0000-4000-8000-000000000001:1"])).toEqual(new Set(["box-silent:00000000-0000-4000-8000-000000000001:1"]));
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

const ALERT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const BESA = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
const ARBEN = "cccccccc-cccc-4ccc-8ccc-cccccccccc02";
const step = (generation: number, contactId: string, channel: "email" | "sms", overrides: Partial<PlannedMessage> = {}): PlannedMessage =>
  message({ contactId, channel, dedupeKey: chainKey(ALERT, generation, contactId, channel), subject: channel === "email" ? "Act now" : undefined, ...overrides });

describe.skipIf(!testDatabaseUrl)("rounds of messages for an alert, on a real PostgreSQL", () => {
  it("plans a whole round in one statement, so that a database that drops part way leaves all of it or none of it", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      // The second message is one the database refuses. Saved row by row, the first would have stayed and the chain looked planned.
      await expect(outbox.plan(tenants[0], [step(0, BESA, "email"), step(0, BESA, "sms", { channel: "carrier-pigeon" as never })], NOON)).rejects.toThrow();
      expect(await outbox.recent(tenants[0], 10)).toEqual([]);

      const whole = await outbox.plan(tenants[0], [step(0, BESA, "email"), step(0, BESA, "sms"), step(0, ARBEN, "email", { dueAtMs: NOON + 30 * MIN })], NOON);
      expect(whole.map((row) => row.dedupeKey)).toEqual([chainKey(ALERT, 0, BESA, "email"), chainKey(ALERT, 0, BESA, "sms"), chainKey(ALERT, 0, ARBEN, "email")]);
      // Planned again, or twice in one go, makes nothing new.
      expect(await outbox.plan(tenants[0], [step(0, BESA, "email"), step(0, BESA, "email")], NOON)).toEqual([]);
      expect(await outbox.plan(tenants[0], [], NOON)).toEqual([]);
      await db.onModuleDestroy();
    });
  });

  it("counts what went out in the last hour, only at one priority when asked, and never another account's", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const rows = await outbox.plan(
        tenants[0],
        [
          step(0, BESA, "email"), // Act now, the first message
          step(0, ARBEN, "email", { kind: "escalation" }), // Act now, a step of the escalation
          step(1, BESA, "email", { priority: "check_today" }), // Check today
          message({ kind: "acknowledged", priority: "act_now", dedupeKey: "ack:1" }), // a note about an Act now alert
          step(0, BESA, "sms")
        ],
        NOON
      );
      for (const row of rows) await outbox.markSent(row.id, NOON + MIN, "x");
      await outbox.plan(tenants[1], [step(0, BESA, "email")], NOON);
      const theirs = (await outbox.recent(tenants[1], 5))[0];
      await outbox.markSent(theirs?.id as string, NOON + MIN, "x");

      const urgent = ["alert", "escalation"] as const;
      expect(await outbox.countSentSince(tenants[0], "email", NOON, urgent)).toBe(3);
      expect(await outbox.countSentSince(tenants[0], "email", NOON, urgent, "act_now")).toBe(2);
      expect(await outbox.countSentSince(tenants[0], "email", NOON, urgent, "check_today")).toBe(1);
      expect(await outbox.countSentSince(tenants[0], "email", NOON, ["acknowledged"], "act_now")).toBe(1);
      expect(await outbox.countSentSince(tenants[0], "email", NOON, ["acknowledged"], "check_today")).toBe(0);
      expect(await outbox.countSentSince(tenants[0], "sms", NOON, urgent, "act_now")).toBe(1);
      expect(await outbox.countSentSince(tenants[1], "email", NOON, urgent, "act_now")).toBe(1);
      await db.onModuleDestroy();
    });
  });

  it("knows which rounds there are for an alert, which keys already have a message, and who was told in which round", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const [first, second, third] = await outbox.plan(
        tenants[0],
        [step(0, BESA, "email", { eventAtMs: NOON }), step(0, ARBEN, "email", { eventAtMs: NOON, dueAtMs: NOON + 30 * MIN }), step(1, BESA, "email", { eventAtMs: NOON + 21 * MIN, dueAtMs: NOON + 21 * MIN })],
        NOON
      );
      await outbox.plan(tenants[0], [step(2, BESA, "email", { priority: "check_today", eventAtMs: NOON + 90 * MIN })], NOON);
      expect((await outbox.chains(tenants[0], ALERT)).sort((a, b) => a.generation - b.generation)).toEqual([
        { generation: 0, priority: "act_now", startedAtMs: NOON },
        { generation: 1, priority: "act_now", startedAtMs: NOON + 21 * MIN },
        { generation: 2, priority: "check_today", startedAtMs: NOON + 90 * MIN }
      ]);
      expect(await outbox.chains(tenants[1], ALERT)).toEqual([]);

      const there = await outbox.existingKeys(tenants[0], [chainKey(ALERT, 0, BESA, "email"), chainKey(ALERT, 0, BESA, "sms"), chainKey(ALERT, 1, BESA, "email")]);
      expect([...there].sort()).toEqual([chainKey(ALERT, 0, BESA, "email"), chainKey(ALERT, 1, BESA, "email")].sort());
      expect([...(await outbox.existingKeys(tenants[1], [chainKey(ALERT, 0, BESA, "email")]))]).toEqual([]);
      expect(await outbox.existingKeys(tenants[0], [])).toEqual(new Set());

      await outbox.markSent(first?.id as string, NOON, "besa@hotel.example");
      await outbox.markSent(third?.id as string, NOON + 21 * MIN, "besa@hotel.example");
      await outbox.markSent(second?.id as string, NOON + 30 * MIN, "arben@hotel.example");
      const told = await outbox.toldAbout(tenants[0], ALERT);
      expect(told.find((row) => row.contactId === BESA)?.toldAtMs).toBe(NOON); // first told in the earliest round
      expect((await outbox.toldAbout(tenants[0], ALERT, 1)).map((row) => `${row.contactId} ${row.toldAtMs}`)).toEqual([`${BESA} ${NOON + 21 * MIN}`]);
      expect(await outbox.toldAbout(tenants[0], ALERT, 3)).toEqual([]);
      await db.onModuleDestroy();
    });
  });

  it("drops what still waits from earlier rounds, and puts back only what was dropped as cleared in the round asked for", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const rows = await outbox.plan(
        tenants[0],
        [step(0, BESA, "sms", { dueAtMs: NOON + 10 * MIN }), step(0, ARBEN, "email", { dueAtMs: NOON + 30 * MIN }), step(1, BESA, "email", { dueAtMs: NOON + 21 * MIN }), step(0, ARBEN, "sms", { dueAtMs: NOON + 30 * MIN })],
        NOON
      );
      const byKey = (key: string) => rows.find((row) => row.dedupeKey === key)?.id as string;
      await outbox.markSent(byKey(chainKey(ALERT, 0, ARBEN, "sms")), NOON + 30 * MIN, "+355692222222");

      expect(await outbox.supersedeBefore(tenants[0], ALERT, 1, NOON + 21 * MIN, "A new round started.")).toBe(2); // the two still waiting from round 0; the sent one is left
      const after = new Map((await outbox.recent(tenants[0], 10)).map((row) => [row.dedupeKey, row]));
      expect(after.get(chainKey(ALERT, 0, BESA, "sms"))).toMatchObject({ status: "skipped", error: "A new round started." });
      expect(after.get(chainKey(ALERT, 0, ARBEN, "sms"))).toMatchObject({ status: "sent" });
      expect(after.get(chainKey(ALERT, 1, BESA, "email"))).toMatchObject({ status: "planned" });
      expect(await outbox.supersedeBefore(tenants[1], ALERT, 9, NOON, "x")).toBe(0);

      const cleared = "The condition cleared before this was sent.";
      await outbox.markSkipped(byKey(chainKey(ALERT, 1, BESA, "email")), NOON + 22 * MIN, cleared);
      // Another reason is not put back, nor is another round, nor another account's.
      expect(await outbox.requeueSkipped(tenants[0], ALERT, 0, cleared, NOON + 25 * MIN, "back")).toBe(0);
      expect(await outbox.requeueSkipped(tenants[1], ALERT, 1, cleared, NOON + 25 * MIN, "back")).toBe(0);
      expect(await outbox.requeueSkipped(tenants[0], ALERT, 1, cleared, NOON + 25 * MIN, "The condition came back, so this is sent after all.")).toBe(1);
      const requeued = (await outbox.recent(tenants[0], 10)).find((row) => row.dedupeKey === chainKey(ALERT, 1, BESA, "email"));
      expect(requeued).toMatchObject({ status: "planned", dueAtMs: NOON + 25 * MIN, error: "The condition came back, so this is sent after all." });
      // A step whose own time is still to come keeps it.
      await outbox.markSkipped(byKey(chainKey(ALERT, 1, BESA, "email")), NOON + 26 * MIN, cleared);
      await outbox.requeueSkipped(tenants[0], ALERT, 1, cleared, NOON + 10 * MIN, "again");
      expect((await outbox.recent(tenants[0], 10)).find((row) => row.dedupeKey === chainKey(ALERT, 1, BESA, "email"))?.dueAtMs).toBe(NOON + 25 * MIN);
      await db.onModuleDestroy();
    });
  });

  it("counts a message as not delivered while its latest try failed and nobody has received it or called it off", async () => {
    await inWorld(async ({ connect, tenants }) => {
      const db = connect();
      const outbox = new PostgresOutboxStore(db);
      const other = "dddddddd-dddd-4ddd-8ddd-dddddddddd02";
      const planned = await outbox.plan(
        tenants[0],
        [
          step(0, BESA, "email"), // failed, and its try again is waiting: not delivered
          { ...step(0, BESA, "email"), dedupeKey: `${chainKey(ALERT, 0, BESA, "email")}#retry1`, dueAtMs: NOON + 5 * MIN },
          step(0, ARBEN, "email"), // failed, then received on the try again: delivered
          { ...step(0, ARBEN, "email"), dedupeKey: `${chainKey(ALERT, 0, ARBEN, "email")}#retry1`, dueAtMs: NOON + 5 * MIN },
          step(0, BESA, "sms"), // failed, and the try again was called off (the alert was acknowledged): not a failure to report
          { ...step(0, BESA, "sms"), dedupeKey: `${chainKey(ALERT, 0, BESA, "sms")}#retry1`, dueAtMs: NOON + 5 * MIN },
          step(0, ARBEN, "sms") // never failed
        ],
        NOON
      );
      const id = (key: string) => planned.find((row) => row.dedupeKey === key)?.id as string;
      await outbox.markFailed(id(chainKey(ALERT, 0, BESA, "email")), NOON + MIN, "The email service answered 401: invalid API key.", "besa@hotel.example");
      await outbox.markFailed(id(chainKey(ALERT, 0, ARBEN, "email")), NOON + MIN, "The email service answered 503.", "arben@hotel.example");
      await outbox.markSent(id(`${chainKey(ALERT, 0, ARBEN, "email")}#retry1`), NOON + 5 * MIN, "arben@hotel.example");
      await outbox.markFailed(id(chainKey(ALERT, 0, BESA, "sms")), NOON + MIN, "Twilio refused it.", "+355691111111");
      await outbox.markSkipped(id(`${chainKey(ALERT, 0, BESA, "sms")}#retry1`), NOON + 5 * MIN, "Someone acknowledged the alert before this was sent.");
      await outbox.plan(tenants[1], [message({ alertId: other, dedupeKey: chainKey(other, 0, BESA, "email") })], NOON);
      const theirs = (await outbox.recent(tenants[1], 5))[0];
      await outbox.markFailed(theirs?.id as string, NOON + 2 * MIN, "Their mailbox is full.");

      const ours = await outbox.undeliveredAlertMessages(NOON - MIN, tenants[0]);
      expect(ours).toHaveLength(1);
      expect(ours[0]).toMatchObject({ tenantId: tenants[0], alertId: ALERT, contactName: "Besa Krasniqi", channel: "email", error: "The email service answered 401: invalid API key.", atMs: NOON + MIN });
      expect((await outbox.undeliveredAlertMessages(NOON - MIN)).map((row) => row.tenantId).sort()).toEqual([tenants[0], tenants[1]].sort());
      expect(await outbox.undeliveredAlertMessages(NOON + 10 * MIN, tenants[0])).toEqual([]); // older than the window asked for
      await db.onModuleDestroy();
    });
  });

  it("lets one platform at a time have the round of work, and gives it up when it has finished", async () => {
    await inWorld(async ({ connect }) => {
      const dbA = connect();
      const dbB = connect();
      const a = new PostgresOutboxStore(dbA);
      const b = new PostgresOutboxStore(dbB);
      const releaseA = await a.tryLock();
      expect(releaseA).toBeDefined();
      expect(await b.tryLock()).toBeUndefined(); // another platform has it
      expect(await a.tryLock()).toBeUndefined(); // and nobody takes it twice
      await (releaseA as () => Promise<void>)();
      const releaseB = await b.tryLock();
      expect(releaseB).toBeDefined();
      await (releaseB as () => Promise<void>)();
      const againA = await a.tryLock();
      expect(againA).toBeDefined();
      await (againA as () => Promise<void>)();
      await dbA.onModuleDestroy();
      await dbB.onModuleDestroy();
    });
  });

  it("goes on when the database drops the connection that holds the round, instead of ending the whole process, and the round can be had again", async () => {
    await inWorld(async ({ pool, connect }) => {
      const db = connect();
      const store = new PostgresOutboxStore(db);
      // The connection is held for as long as a round goes on, and nothing else listens for it to fail: an error with no listener ends the process.
      const uncaught: Error[] = [];
      const note = (error: Error): void => void uncaught.push(error);
      process.on("uncaughtException", note);
      try {
        const release = await store.tryLock();
        expect(release).toBeDefined();
        const holders = await pool.query<{ pid: number }>(
          `SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`
        );
        expect(holders.rows).toHaveLength(1);
        await pool.query("SELECT pg_terminate_backend($1)", [holders.rows[0]?.pid]); // a restart, a failover, a connection the host cut
        await new Promise((resolve) => setTimeout(resolve, 300)); // the news reaches the connection
        await (release as () => Promise<void>)(); // letting go of what is already gone must not fail
        expect(uncaught).toEqual([]);

        const again = await store.tryLock();
        expect(again).toBeDefined();
        await (again as () => Promise<void>)();
      } finally {
        process.off("uncaughtException", note);
      }
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

describe.skipIf(!testDatabaseUrl)("alert messages that have to arrive, on a real PostgreSQL", () => {
  const openAlert = (tenantId: string, alertId: string) => ({
    id: alertId,
    tenantId,
    siteId: "s-1",
    severity: "critical",
    title: "Tank level is critical",
    suggestedAction: "Check the water supply.",
    createdAtUtc: new Date(NOON).toISOString(),
    status: "open" as const
  });
  const sourceFor = (tenantId: string, alerts: Map<string, ReturnType<typeof openAlert>>) => ({
    alertById: (_tenant: string, alertId: string) => alerts.get(alertId),
    openAlertsAcrossTenants: () => [...alerts.values()].filter((alert) => alert.status === "open").map((alert) => ({ alert, siteName: "Hotel Adriatik" })),
    tenantNameOf: () => "Hotel Adriatik Ltd",
    digestOf: () => ({ customer: "Hotel Adriatik Ltd", sites: [] }),
    setAlertListener: () => undefined,
    isTenantActive: (id: string) => id === tenantId
  });

  it("holds an Act now message past the hourly ceiling and sends it when the hour allows, counting by priority in the database", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      const [besa] = await config.setContacts(tenants[0], [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      const outbox = new PostgresOutboxStore(db);
      const alerts = new Map<string, ReturnType<typeof openAlert>>();
      const messages: PlannedMessage[] = [];
      for (let index = 0; index < 121; index += 1) {
        const alertId = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
        alerts.set(alertId, openAlert(tenants[0], alertId));
        messages.push(step(0, besa?.id as string, "email", { alertId, dedupeKey: chainKey(alertId, 0, besa?.id as string, "email") }));
      }
      await outbox.plan(tenants[0], messages, NOON);
      // Fifty notes that someone acknowledged something are sent too: they have a limit of their own and must not use up Act now's.
      await outbox.plan(
        tenants[0],
        Array.from({ length: 50 }, (_, index) => message({ alertId: ALERT, contactId: besa?.id, kind: "acknowledged", dedupeKey: `ack:${index}`, subject: "Acknowledged" })),
        NOON
      );
      const sent: string[] = [];
      const channels: Channels = { email: { send: async (mail) => (sent.push(mail.to), { ok: true as const, providerId: "em" }) }, problems: [] };
      const service = new NotificationsService(sourceFor(tenants[0], alerts), config, outbox, channels, { autoSend: false });

      const counts = await service.tick(NOON + 1000);
      expect(counts).toMatchObject({ sent: 170, retried: 1, failed: 0 });
      const waiting = (await pool.query("SELECT status, attempts, error FROM notifications WHERE status = 'planned'")).rows;
      expect(waiting).toHaveLength(1);
      expect(waiting[0]).toMatchObject({ attempts: 0 });
      expect(waiting[0].error).toMatch(/^Held: this account has already been sent 120 Act now emails in the last hour\./);

      expect(await service.tick(NOON + 61 * MIN)).toMatchObject({ sent: 1, retried: 0 });
      expect((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE status = 'sent'")).rows[0].n).toBe(171);
      await db.onModuleDestroy();
    });
  }, 60_000);

  it("plans a failed alert message again, shows it in the status, and stops saying so once it has arrived", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      const [besa] = await config.setContacts(tenants[0], [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      const outbox = new PostgresOutboxStore(db);
      const alerts = new Map([[ALERT, openAlert(tenants[0], ALERT)]]);
      let working = false;
      const channels: Channels = {
        email: { send: async () => (working ? { ok: true as const, providerId: "em" } : { ok: false as const, transient: false, error: "The email service answered 401: invalid API key." }) },
        problems: []
      };
      const service = new NotificationsService(sourceFor(tenants[0], alerts), config, outbox, channels, { autoSend: false });
      await outbox.plan(tenants[0], [step(0, besa?.id as string, "email")], NOON);

      expect(await service.tick(NOON)).toMatchObject({ failed: 1 });
      expect((await pool.query("SELECT status, error FROM notifications ORDER BY created_at, dedupe_key")).rows).toEqual([
        { status: "failed", error: "The email service answered 401: invalid API key." },
        { status: "planned", error: null }
      ]);
      expect((await service.status(tenants[0], NOON + MIN)).words.at(-1)).toBe("1 alert message could not be delivered, the last because: The email service answered 401: invalid API key. Greecon keeps trying while the alert is open.");

      working = true;
      expect(await service.tick(NOON + 5 * MIN)).toMatchObject({ sent: 1 });
      expect((await service.status(tenants[0], NOON + 6 * MIN)).words.join(" ")).not.toContain("could not be delivered");
      await db.onModuleDestroy();
    });
  }, 60_000);

  it("completes a chain that the database dropped part way through planning", async () => {
    await inWorld(async ({ connect, pool, tenants }) => {
      const db = connect();
      const config = new NotificationConfig(db);
      const [besa, arben] = await config.setContacts(tenants[0], [
        { name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691111111" },
        { name: "Arben Hoxha", email: "arben@hotel.example", phone: "+355692222222" }
      ]);
      const outbox = new PostgresOutboxStore(db);
      const alerts = new Map([[ALERT, openAlert(tenants[0], ALERT)]]);
      const channels: Channels = { email: { send: async () => ({ ok: true as const, providerId: "em" }) }, sms: { send: async () => ({ ok: true as const, providerId: "sm" }) }, problems: [] };
      const service = new NotificationsService(sourceFor(tenants[0], alerts), config, outbox, channels, { autoSend: false });
      await outbox.plan(tenants[0], [step(0, besa?.id as string, "email", { eventAtMs: NOON })], NOON); // only the first row was saved

      await service.tick(NOON + 2 * MIN);
      const rows = (await pool.query("SELECT contact_name, channel, due_at, status FROM notifications ORDER BY due_at, channel")).rows;
      expect(rows.map((row) => `${row.contact_name.split(" ")[0]} ${row.channel} +${(row.due_at.getTime() - NOON) / MIN} ${row.status}`)).toEqual([
        "Besa email +0 sent",
        "Besa sms +10 planned",
        "Arben email +30 planned",
        "Arben sms +30 planned"
      ]);
      await service.tick(NOON + 3 * MIN);
      expect((await pool.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n).toBe(4); // and nothing is planned twice
      await db.onModuleDestroy();
    });
  }, 60_000);
});
