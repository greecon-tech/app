import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@greecon/shared";
import { DatabaseService } from "../database/database.service";
import { Channels, EmailChannel, OutgoingEmail, SendResult, SmsChannel } from "./channels";
import { NotificationConfig } from "./config";
import { DigestFacts } from "./messages";
import { NotificationsService, AlertSource, AlertView } from "./notifications.service";
import { MemoryOutboxStore } from "./outbox";
import { AlertEvent, PlannedMessage } from "./plan";

const T1 = "t-1";
const T2 = "t-2";
const MIN = 60_000;
const NOON = Date.parse("2026-10-19T10:00:00Z"); // 12:00 in Europe/Tirane (UTC+2)

class FakeSource implements AlertSource {
  alerts = new Map<string, AlertView>();
  /** The site of an alert, where it is not the usual one. */
  siteNames = new Map<string, string>();
  stable = true;
  /** Accounts the platform has suspended. */
  suspended = new Set<string>();
  /** Greecon's own account, whose morning message names the customers whose alert messages are not arriving. */
  operator = new Set<string>();
  listener: ((events: AlertEvent[]) => void) | undefined;
  alertById(tenantId: string, alertId: string): AlertView | undefined {
    const alert = this.alerts.get(alertId);
    return alert && alert.tenantId === tenantId ? { ...alert } : undefined;
  }
  openAlertsAcrossTenants() {
    return [...this.alerts.values()].filter((alert) => alert.status === "open").map((alert) => ({ alert: { ...alert }, siteName: this.siteNames.get(alert.id) ?? "Hotel Adriatik" }));
  }
  tenantNameOf(tenantId: string): string {
    return tenantId === T1 ? "Hotel Adriatik Ltd" : "Vlora Farm";
  }
  digestOf(tenantId: string, nowMs: number): DigestFacts {
    return {
      customer: this.tenantNameOf(tenantId),
      sites: [{ name: "Hotel Adriatik", state: this.stable ? "stable" : "attention", reasons: this.stable ? [] : ["Tank level is low"], lastReadingAtUtc: new Date(nowMs - 120_000).toISOString() }]
    };
  }
  setAlertListener(listener: ((events: AlertEvent[]) => void) | undefined): void {
    this.listener = listener;
  }
  isTenantActive(tenantId: string): boolean {
    return !this.suspended.has(tenantId);
  }
  isOperatorTenant(tenantId: string): boolean {
    return this.operator.has(tenantId);
  }
  add(overrides: Partial<AlertView> = {}): AlertView {
    const alert: AlertView = {
      id: `a-${this.alerts.size + 1}`,
      tenantId: T1,
      siteId: "s-1",
      severity: "critical",
      title: "Tank level is critical",
      suggestedAction: "Check the water supply and refill the tank as soon as it is safe to do so.",
      createdAtUtc: new Date(NOON).toISOString(),
      status: "open",
      ...overrides
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }
}

interface Sent {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  key?: string;
}

class FakeChannels {
  sent: Sent[] = [];
  /** What the next sends answer, in order; sends succeed when this is empty. */
  results: SendResult[] = [];
  email: EmailChannel = {
    send: async (message: OutgoingEmail) => {
      const result = this.results.shift() ?? { ok: true as const, providerId: `em_${this.sent.length + 1}` };
      if (result.ok) this.sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body, key: message.idempotencyKey });
      return result;
    }
  };
  sms: SmsChannel = {
    send: async (message) => {
      const result = this.results.shift() ?? { ok: true as const, providerId: `sm_${this.sent.length + 1}` };
      if (result.ok) this.sent.push({ channel: "sms", to: message.to, body: message.body });
      return result;
    }
  };
}

const besa = { name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691111111" };
const arben = { name: "Arben Hoxha", email: "arben@hotel.example", phone: "+355692222222" };

describe("telling people", () => {
  let source: FakeSource;
  let config: NotificationConfig;
  let outbox: MemoryOutboxStore;
  let fake: FakeChannels;
  let service: NotificationsService;

  const build = (channels: Channels = { email: fake.email, sms: fake.sms, problems: [] }, existing?: { outbox: MemoryOutboxStore; config: NotificationConfig }) => {
    const useOutbox = existing?.outbox ?? outbox;
    const useConfig = existing?.config ?? config;
    return new NotificationsService(source, useConfig, useOutbox, channels, { webUrl: "https://app.greecon.example/", autoSend: false });
  };

  beforeEach(async () => {
    source = new FakeSource();
    config = new NotificationConfig(new DatabaseService());
    outbox = new MemoryOutboxStore();
    fake = new FakeChannels();
    service = build();
    await config.setContacts(T1, [besa, arben]);
  });

  const opened = (alert: AlertView, atMs = NOON): AlertEvent => ({ type: "opened", atMs, alert, siteName: "Hotel Adriatik" });
  const sentTo = () => fake.sent.map((message) => `${message.channel}:${message.to}`);
  const statuses = () => outbox.rows.map((row) => `${row.contactName.split(" ")[0]} ${row.channel} ${row.kind} ${row.status}`);

  describe("an Act now alert nobody answers", () => {
    it("emails the first person at once, texts them at ten minutes, and goes on to the next at thirty", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);

      expect(await service.tick(NOON)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.subject).toBe("Act now: Tank level is critical, Hotel Adriatik");
      expect(fake.sent[0]?.body).toContain("https://app.greecon.example/alerts");

      expect(await service.tick(NOON + 9 * MIN)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + 10 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example", "sms:+355691111111"]);

      expect(await service.tick(NOON + 30 * MIN)).toMatchObject({ sent: 2 });
      expect(sentTo().slice(2).sort()).toEqual(["email:arben@hotel.example", "sms:+355692222222"]);
      const escalation = fake.sent.find((message) => message.to === "arben@hotel.example");
      expect(escalation?.subject).toBe("Act now, not acknowledged: Tank level is critical, Hotel Adriatik");
      expect(escalation?.body).toContain("Besa Krasniqi was told at 12:00 and has not answered. You are next.");
      expect(outbox.rows.every((row) => row.status === "sent")).toBe(true);
    });

    it("sends the text in the cheap alphabet", async () => {
      const alert = source.add({ title: "Tank level is critical" });
      source.siteNames.set(alert.id, "Hotel Adriatik, Durrës");
      await service.onAlertEvents([{ type: "opened", atMs: NOON, alert, siteName: "Hotel Adriatik, Durrës" }], NOON);
      await service.tick(NOON + 10 * MIN);
      const text = fake.sent.find((message) => message.channel === "sms");
      expect(text?.body).toContain("Durres");
      expect(text?.body).not.toMatch(/[^\x20-\x7e]/);
    });

    it("stops at once when somebody acknowledges, and tells the others who was told", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      await service.tick(NOON + 10 * MIN); // Besa is also texted
      await service.tick(NOON + 30 * MIN); // Arben is told too
      fake.sent.length = 0;

      source.alerts.set(alert.id, { ...alert, status: "acknowledged" });
      await service.onAlertEvents([{ type: "acknowledged", atMs: NOON + 31 * MIN, alert, siteName: "Hotel Adriatik", by: "Arben Hoxha", byEmail: "arben@hotel.example" }], NOON + 31 * MIN);
      await service.tick(NOON + 31 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.body.split("\n")[0]).toBe("Acknowledged by Arben Hoxha at 12:31. The message will not go on to anyone else.");
    });

    it("never sends a later step of an escalation once the alert is acknowledged", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      source.alerts.set(alert.id, { ...alert, status: "acknowledged" });
      await service.onAlertEvents([{ type: "acknowledged", atMs: NOON + 2 * MIN, alert, siteName: "Hotel Adriatik", by: "Besa Krasniqi", byEmail: "besa@hotel.example" }], NOON + 2 * MIN);

      expect(await service.tick(NOON + 60 * MIN)).toMatchObject({ sent: 0, skipped: 3 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(outbox.rows.filter((row) => row.status === "skipped").map((row) => row.error)).toEqual(Array(3).fill("Someone acknowledged the alert before this was sent."));
    });

    it("stops when the condition clears, and says so only after the readings stay clear", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      fake.sent.length = 0;

      const clearedAt = NOON + 5 * MIN;
      source.alerts.set(alert.id, { ...alert, status: "resolved", resolvedAtUtc: new Date(clearedAt).toISOString() });
      await service.onAlertEvents([{ type: "resolved", atMs: clearedAt, alert, siteName: "Hotel Adriatik" }], clearedAt);
      expect(await service.tick(clearedAt)).toMatchObject({ sent: 0, skipped: 0 });
      // Besa's text, due at 12:10, falls due while the condition may still come back: it waits, and is not dropped yet.
      expect(await service.tick(clearedAt + 14 * MIN)).toMatchObject({ sent: 0, skipped: 0, retried: 1 });
      // Fifteen minutes clear: the same alert can no longer return, so the text is dropped, and the resolved note goes.
      expect(await service.tick(clearedAt + 15 * MIN)).toMatchObject({ sent: 1, skipped: 1 });
      expect(outbox.rows.find((row) => row.channel === "sms" && row.contactName.startsWith("Besa"))).toMatchObject({ status: "skipped", error: "The condition cleared before this was sent." });
      expect(fake.sent[0]?.subject).toBe("Resolved: Tank level is critical, Hotel Adriatik");
      expect(fake.sent[0]?.body).toContain("no longer show it (since 12:05)");
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(await service.tick(NOON + 30 * MIN)).toMatchObject({ sent: 0, skipped: 2 }); // Arben is never told
    });

    it("does not say resolved when the condition came back in between", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      fake.sent.length = 0;

      const clearedAt = NOON + 5 * MIN;
      source.alerts.set(alert.id, { ...alert, status: "resolved", resolvedAtUtc: new Date(clearedAt).toISOString() });
      await service.onAlertEvents([{ type: "resolved", atMs: clearedAt, alert, siteName: "Hotel Adriatik" }], clearedAt);
      source.alerts.set(alert.id, { ...alert, status: "open" });
      await service.onAlertEvents([{ type: "reopened", atMs: clearedAt + 3 * MIN, alert, siteName: "Hotel Adriatik" }], clearedAt + 3 * MIN);

      await service.tick(clearedAt + 20 * MIN);
      expect(fake.sent.filter((message) => message.subject?.startsWith("Resolved"))).toEqual([]);
      expect(outbox.rows.find((row) => row.kind === "resolved")?.error).toBe("The condition came back before this was sent.");
    });
  });

  describe("a Check today alert", () => {
    const warning = () => source.add({ severity: "warning", title: "Tank level is low", suggestedAction: "Plan a refill before the level drops further." });

    it("is one email, now", async () => {
      await service.onAlertEvents([opened(warning())], NOON);
      await service.tick(NOON);
      await service.tick(NOON + 6 * 60 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.subject).toBe("Check today: Tank level is low, Hotel Adriatik");
    });

    it("waits for the morning when it happens in quiet hours", async () => {
      const night = Date.parse("2026-10-19T23:30:00Z"); // 01:30
      const alert = source.add({ severity: "warning", createdAtUtc: new Date(night).toISOString() });
      await service.onAlertEvents([opened(alert, night)], night);
      await service.tick(night);
      expect(sentTo()).toEqual([]);
      await service.tick(Date.parse("2026-10-20T04:59:00Z"));
      expect(sentTo()).toEqual([]);
      await service.tick(Date.parse("2026-10-20T05:00:00Z")); // 07:00
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("still waits for the morning when it fell due in the evening and the platform was down until the quiet hours had begun", async () => {
      const evening = Date.parse("2026-10-19T19:45:00Z"); // 21:45: not quiet, so it is due at once
      const alert = source.add({ severity: "warning", title: "Tank level is low", createdAtUtc: new Date(evening).toISOString() });
      await service.onAlertEvents([opened(alert, evening)], evening);

      // The platform comes back at 22:30. Quiet hours are kept when the message is sent, not only when it is planned.
      expect(await service.tick(Date.parse("2026-10-19T20:30:00Z"))).toMatchObject({ sent: 0, retried: 1 });
      expect(outbox.rows.find((row) => row.kind === "alert")).toMatchObject({ status: "planned", dueAtMs: Date.parse("2026-10-20T05:00:00Z") });
      expect(await service.tick(Date.parse("2026-10-20T04:59:00Z"))).toMatchObject({ sent: 0 });
      expect(sentTo()).toEqual([]);
      expect(await service.tick(Date.parse("2026-10-20T05:00:00Z"))).toMatchObject({ sent: 1 }); // 07:00
    });

    it("is not held by the quiet hours when it is Act now: that is only for Check today", async () => {
      const night = Date.parse("2026-10-19T23:30:00Z"); // 01:30
      await service.onAlertEvents([opened(source.add({ createdAtUtc: new Date(night).toISOString() }), night)], night);
      expect(await service.tick(night)).toMatchObject({ sent: 1 });
    });

    it("is dropped, not sent late, if someone acknowledged it while it waited", async () => {
      const night = Date.parse("2026-10-19T23:30:00Z");
      const alert = source.add({ severity: "warning" });
      await service.onAlertEvents([opened(alert, night)], night);
      source.alerts.set(alert.id, { ...alert, status: "acknowledged" });
      await service.tick(Date.parse("2026-10-20T05:00:00Z"));
      expect(sentTo()).toEqual([]);
    });

    it("is replaced by the urgent chain when the alert gets worse, and the first email is then not sent", async () => {
      const night = Date.parse("2026-10-19T23:30:00Z");
      const alert = source.add({ severity: "warning" });
      await service.onAlertEvents([opened(alert, night)], night);
      source.alerts.set(alert.id, { ...alert, severity: "critical" });
      await service.onAlertEvents([{ type: "escalated", atMs: night + MIN, alert: { ...alert, severity: "critical" }, siteName: "Hotel Adriatik" }], night + MIN);
      await service.tick(night + MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.subject).toContain("Act now:");
      await service.tick(Date.parse("2026-10-20T05:00:00Z")); // 07:00, when the quiet hours end and the old one was due
      expect(fake.sent.filter((message) => message.subject?.startsWith("Check today"))).toEqual([]);
      expect(outbox.rows.find((row) => row.priority === "check_today")?.error).toBe("The alert changed priority before this was sent.");
    });
  });

  describe("what is never sent", () => {
    it("tells nobody about information", async () => {
      const alert = source.add({ severity: "info" });
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      expect(fake.sent).toEqual([]);
      expect(outbox.rows).toEqual([]);
    });

    it("does not page again for one wobble", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      fake.sent.length = 0;
      await service.onAlertEvents([{ type: "reopened", atMs: NOON + 8 * MIN, alert, siteName: "Hotel Adriatik" }], NOON + 8 * MIN);
      await service.tick(NOON + 9 * MIN);
      expect(fake.sent).toEqual([]);
    });
  });

  describe("when messages cannot go", () => {
    it("says so in the log, not nothing, when the platform has no email or text service", async () => {
      service = build({ problems: [] });
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON)).toMatchObject({ failed: 1 });
      expect(outbox.rows[0]).toMatchObject({ status: "failed", error: "Not sent: email is not set up on this Greecon platform." });
      await service.tick(NOON + 10 * MIN);
      expect(outbox.rows[1]).toMatchObject({ status: "failed", error: "Not sent: text messages are not set up on this Greecon platform." });
    });

    it("keeps trying an alert message, five minutes on, as a new line in the log, when the service is having trouble", async () => {
      fake.results = [{ ok: false, transient: true, error: "The email service answered 503: unavailable" }];
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON)).toMatchObject({ failed: 1, sent: 0 });

      // One line for the failure, with its reason, and the same message planned again for five minutes on.
      expect(outbox.rows[0]).toMatchObject({ status: "failed", error: "The email service answered 503: unavailable", destination: "besa@hotel.example" });
      const again = outbox.rows.find((row) => row.dedupeKey.endsWith("#retry1"));
      expect(again).toMatchObject({ status: "planned", kind: "alert", priority: "act_now", dueAtMs: NOON + 5 * MIN, body: outbox.rows[0]?.body });
      expect(await service.tick(NOON + 4 * MIN)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + 5 * MIN)).toMatchObject({ sent: 1 });
      expect(outbox.rows.find((row) => row.id === again?.id)).toMatchObject({ status: "sent", destination: "besa@hotel.example" });
      expect(outbox.rows[0]?.status).toBe("failed"); // the failure stays in the log
    });

    it("keeps the tries of one message together, so that its arrival clears every failure before it from the screen", async () => {
      let serviceIsUp = false;
      const email: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          if (!serviceIsUp) return { ok: false, transient: true, error: "The email service answered 503: unavailable" };
          fake.sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body });
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      for (const minute of [0, 5, 10]) await service.tick(NOON + minute * MIN);

      // One key for the message and one for each try again, never a try of a try.
      expect(outbox.rows).toHaveLength(4);
      expect(outbox.rows.every((row) => /^chain:a-1:g0:[^:]+:email(#retry[0-9]+)?$/.test(row.dedupeKey))).toBe(true);
      expect((await service.status(T1, NOON + 11 * MIN)).words.at(-1)).toMatch(/^1 alert message could not be delivered, the last because: The email service answered 503: unavailable/);

      serviceIsUp = true;
      expect(await service.tick(NOON + 15 * MIN)).toMatchObject({ sent: 1 });
      expect((await service.status(T1, NOON + 16 * MIN)).words.join(" ")).not.toContain("could not be delivered");
    });

    it("never gives up on an alert message while the alert stands: twelve tries an hour apart from the first, then one every half hour", async () => {
      const down: EmailChannel = { send: async () => ({ ok: false, transient: true, error: "The email service could not be reached: timeout" }) };
      service = build({ email: down, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      const triedAt: number[] = [];
      for (let minute = 0; minute <= 150; minute += 1) {
        const counts = await service.tick(NOON + minute * MIN);
        if (counts.failed === 1) triedAt.push(minute);
      }
      expect(triedAt).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 85, 115, 145]);
      // Never more than twelve in any hour.
      for (const start of triedAt) expect(triedAt.filter((minute) => minute >= start && minute < start + 60).length).toBeLessThanOrEqual(12);
      // A line for every failure, each with the reason, and the next try waiting.
      expect(outbox.rows.filter((row) => row.status === "failed")).toHaveLength(triedAt.length);
      expect(outbox.rows.filter((row) => row.status === "failed").every((row) => row.error === "The email service could not be reached: timeout")).toBe(true);
      expect(outbox.rows.filter((row) => row.status === "planned")).toHaveLength(1);
    });

    it("tries again even when it will fail the same way, because an address can be mended while the alert is open", async () => {
      fake.results = [{ ok: false, transient: false, error: "The email service answered 422: Invalid `to` field." }];
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel,example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON)).toMatchObject({ failed: 1, retried: 0 });
      expect(outbox.rows[0]?.status).toBe("failed");

      const [first] = config.contacts(T1);
      await config.setContacts(T1, [{ id: first?.id, name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      expect(await service.tick(NOON + 5 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("holds a Check today email whose first try failed until the quiet hours end, however long the service is down", async () => {
      const evening = Date.parse("2026-10-19T19:58:00Z"); // 21:58, two minutes before the quiet hours begin
      let serviceIsUp = false;
      const email: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          if (!serviceIsUp) return { ok: false, transient: true, error: "The email service answered 503: unavailable" };
          fake.sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body });
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      const alert = source.add({ severity: "warning", title: "Tank level is low", createdAtUtc: new Date(evening).toISOString() });
      await service.onAlertEvents([opened(alert, evening)], evening);
      expect(await service.tick(evening)).toMatchObject({ failed: 1 });

      // The service is back a minute later, in the middle of the night. A Check today email waits for the morning all the same.
      serviceIsUp = true;
      expect(await service.tick(evening + 5 * MIN)).toMatchObject({ sent: 0 }); // 22:03
      expect(await service.tick(Date.parse("2026-10-20T01:30:00Z"))).toMatchObject({ sent: 0 }); // 03:30
      expect(await service.tick(Date.parse("2026-10-20T04:59:00Z"))).toMatchObject({ sent: 0 }); // 06:59
      expect(sentTo()).toEqual([]);
      expect(await service.tick(Date.parse("2026-10-20T05:00:00Z"))).toMatchObject({ sent: 1 }); // 07:00
      expect(fake.sent[0]?.subject).toBe("Check today: Tank level is low, Hotel Adriatik");
    });

    it("keeps trying an Act now message through the night: quiet hours never delay it", async () => {
      const night = Date.parse("2026-10-19T21:30:00Z"); // 23:30
      fake.results = [{ ok: false, transient: true, error: "The email service answered 503: unavailable" }];
      await service.onAlertEvents([opened(source.add({ createdAtUtc: new Date(night).toISOString() }), night)], night);
      expect(await service.tick(night)).toMatchObject({ failed: 1 });
      expect(await service.tick(night + 5 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("tries a way of sending that is not set up once an hour, not every five minutes, and sends it when it has been set up", async () => {
      service = build({ problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      const triedAt: number[] = [];
      for (let minute = 0; minute <= 190; minute += 1) {
        const counts = await service.tick(NOON + minute * MIN);
        if (counts.failed === 1) triedAt.push(minute);
      }
      expect(triedAt).toEqual([0, 60, 120, 180]);

      // The platform is started again with the email service set up: the next try, which is waiting, is sent.
      service = build();
      expect(await service.tick(NOON + 239 * MIN)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + 240 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("never leaves an alert message with no next try, even when the database drops just after the provider refused it", async () => {
      class Dropping extends MemoryOutboxStore {
        dropsOfThePlan = 0;
        dropsOfTheRetry = 0;
        override async plan(tenantId: string, messages: readonly PlannedMessage[], nowMs: number) {
          if (this.dropsOfThePlan > 0 && messages.some((message) => message.dedupeKey.includes("#retry"))) {
            this.dropsOfThePlan -= 1;
            throw new Error("the connection dropped");
          }
          return super.plan(tenantId, messages, nowMs);
        }
        override async retryAt(...args: Parameters<MemoryOutboxStore["retryAt"]>) {
          if (this.dropsOfTheRetry > 0) {
            this.dropsOfTheRetry -= 1;
            throw new Error("the connection dropped");
          }
          return super.retryAt(...args);
        }
      }
      const dropping = new Dropping();
      service = build(undefined, { outbox: dropping, config });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      fake.results = [{ ok: false, transient: true, error: "The email service answered 503: unavailable" }];
      await service.onAlertEvents([opened(source.add())], NOON);
      dropping.dropsOfThePlan = 1;
      dropping.dropsOfTheRetry = 1;
      await service.tick(NOON);

      // Written down as failed with no next try, nobody would ever send it. Not written down, it is taken for a message whose
      // worker died, and is sent again a few minutes later.
      for (let minute = 1; minute <= 10; minute += 1) await service.tick(NOON + minute * MIN);
      expect(sentTo()).toContain("email:besa@hotel.example");
    });

    it("stops trying once the alert is acknowledged, or has cleared for good", async () => {
      const down: EmailChannel = { send: async () => ({ ok: false, transient: true, error: "The email service answered 503: unavailable" }) };
      service = build({ email: down, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      source.alerts.set(alert.id, { ...alert, status: "acknowledged" });
      expect(await service.tick(NOON + 5 * MIN)).toMatchObject({ skipped: 1, failed: 0 });
      expect(outbox.rows.find((row) => row.dedupeKey.endsWith("#retry1"))).toMatchObject({ status: "skipped", error: "Someone acknowledged the alert before this was sent." });
      expect(await service.tick(NOON + 60 * MIN)).toMatchObject({ failed: 0, retried: 0 });
      expect(outbox.rows).toHaveLength(2);

      // And no further try is planned for a message that failed just as the alert was acknowledged: the service refuses it
      // at the very moment that someone presses the button.
      const other = source.add({ id: "a-9", title: "Pump is running dry" });
      const closing: EmailChannel = {
        send: async () => {
          source.alerts.set(other.id, { ...other, status: "acknowledged" });
          return { ok: false, transient: true, error: "The email service answered 503: unavailable" };
        }
      };
      service = build({ email: closing, problems: [] });
      await service.onAlertEvents([opened(other, NOON + 61 * MIN)], NOON + 61 * MIN);
      expect(await service.tick(NOON + 61 * MIN)).toMatchObject({ failed: 1 });
      expect(outbox.rows.filter((row) => row.alertId === other.id)).toHaveLength(1);
      expect(await service.tick(NOON + 70 * MIN)).toMatchObject({ failed: 0, retried: 0, sent: 0 });

      // And one that clears for good while its next try waits: the try waits out the clear window, and is then dropped.
      const third = source.add({ id: "a-10", title: "Battery is low" });
      service = build({ email: down, problems: [] });
      await service.onAlertEvents([opened(third, NOON + 80 * MIN)], NOON + 80 * MIN);
      expect(await service.tick(NOON + 80 * MIN)).toMatchObject({ failed: 1 });
      source.alerts.set(third.id, { ...third, status: "resolved", resolvedAtUtc: new Date(NOON + 82 * MIN).toISOString() });
      expect(await service.tick(NOON + 85 * MIN)).toMatchObject({ retried: 1, sent: 0 });
      expect(await service.tick(NOON + 98 * MIN)).toMatchObject({ skipped: 1, sent: 0 });
      expect(outbox.rows.filter((row) => row.alertId === third.id).map((row) => row.status).sort()).toEqual(["failed", "skipped"]);
    });

    it("tells the screen that alert messages did not arrive, how many, and why the last one failed", async () => {
      const down: EmailChannel = { send: async () => ({ ok: false, transient: false, error: "The email service answered 401: invalid API key." }) };
      service = build({ email: down, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      expect((await service.status(T1, NOON)).words.join(" ")).not.toContain("could not be delivered");

      await service.onAlertEvents([opened(source.add()), opened(source.add({ title: "Pump is running dry" }))], NOON);
      await service.tick(NOON);
      const words = (await service.status(T1, NOON + MIN)).words;
      expect(words.at(-1)).toBe("2 alert messages could not be delivered, the last because: The email service answered 401: invalid API key. Greecon keeps trying while the alert is open.");
      // Another account's screen says nothing of it.
      expect((await service.status(T2, NOON + MIN)).words.join(" ")).not.toContain("could not be delivered");
      // Once the alerts are no longer open there is nothing to say.
      for (const alert of source.alerts.values()) source.alerts.set(alert.id, { ...alert, status: "acknowledged" });
      expect((await service.status(T1, NOON + 2 * MIN)).words.join(" ")).not.toContain("could not be delivered");
    });
  });

  describe("a platform that has not set up text messages", () => {
    it("does not call that a message that could not be delivered: the screen says once that texts are off", async () => {
      service = build({ email: fake.email, problems: [] }); // email is set up; text messages are not
      await service.onAlertEvents([opened(source.add())], NOON);
      for (let minute = 0; minute <= 60; minute += 1) await service.tick(NOON + minute * MIN);

      // The texts are in the log, as not sent, with the reason...
      expect(outbox.rows.filter((row) => row.channel === "sms" && row.status === "failed").every((row) => row.error === "Not sent: text messages are not set up on this Greecon platform.")).toBe(true);
      expect(outbox.rows.some((row) => row.channel === "sms" && row.status === "failed")).toBe(true);
      // ...and the screen says it is off, but does not alarm anyone with "could not be delivered" for a way of sending nobody set up.
      const words = (await service.status(T1, NOON + 61 * MIN)).words.join(" ");
      expect(words).toContain("Text messages are off, so Act now alerts reach people by email only.");
      expect(words).not.toContain("could not be delivered");
    });

    it("treats a platform that has not set up email in the same way: it is off, said once, and not a failure to put right", async () => {
      service = build({ sms: fake.sms, problems: [] }); // text messages are set up; email is not
      await service.onAlertEvents([opened(source.add())], NOON);
      for (let minute = 0; minute <= 40; minute += 1) await service.tick(NOON + minute * MIN);
      expect(outbox.rows.some((row) => row.channel === "email" && row.status === "failed")).toBe(true);
      const words = (await service.status(T1, NOON + 41 * MIN)).words.join(" ");
      expect(words).toContain("Email is off on this Greecon platform.");
      expect(words).not.toContain("could not be delivered");
    });

    it("does not name the customer in Greecon's own morning message for it either", async () => {
      source.operator.add("t-greecon");
      await config.setContacts("t-greecon", [{ name: "Greecon team", email: "team@greecon.example" }]);
      service = build({ email: fake.email, problems: [] });
      await service.onAlertEvents([opened(source.add())], NOON);
      for (let minute = 0; minute <= 40; minute += 1) await service.tick(NOON + minute * MIN);
      expect(outbox.rows.some((row) => row.channel === "sms" && row.status === "failed")).toBe(true);

      await service.tick(Date.parse("2026-10-20T05:30:00Z")); // the next morning, 07:30
      const note = fake.sent.find((message) => message.to === "team@greecon.example");
      expect(note).toBeDefined();
      expect(note?.body).not.toContain("could not be delivered");
    });
  });

  describe("the most one account is sent in an hour", () => {
    // One person, reached one way, so that each Act now alert is exactly one message and a run of them counts exactly.
    const emailOnly = [{ name: "Besa Krasniqi", email: "besa@hotel.example" }];
    const textOnly = [{ name: "Night porter", phone: "+355693333333" }];
    const raise = async (count: number, overrides: Partial<AlertView> = {}) => {
      for (let index = 0; index < count; index += 1) {
        await service.onAlertEvents([opened(source.add({ createdAtUtc: new Date(NOON).toISOString(), ...overrides }), NOON + index)], NOON);
      }
    };
    const held = () => outbox.rows.filter((row) => row.status === "planned");

    it("stops Check today emails at a limit an hour, so a flapping condition cannot become a flood", async () => {
      await config.setContacts(T1, emailOnly);
      await raise(61, { severity: "warning", title: "Tank level is low" });
      const counts = await service.tick(NOON + 100);
      expect(counts).toMatchObject({ sent: 60, failed: 1, retried: 0 });
      expect(outbox.rows.find((row) => row.status === "failed")?.error).toBe("Not sent: this account has already been sent 60 emails in the last hour.");
    });

    it("has a ceiling of its own for Act now emails, and holds what is past it instead of dropping it", async () => {
      await config.setContacts(T1, emailOnly);
      await raise(121);
      const counts = await service.tick(NOON + 200);
      expect(counts).toMatchObject({ sent: 120, retried: 1, failed: 0, skipped: 0 });

      // Waiting its turn: still planned, no try used up, and the log says why.
      expect(held()).toHaveLength(1);
      const waitingId = held()[0]?.id;
      expect(held()[0]).toMatchObject({ attempts: 0, dueAtMs: NOON + 200 + 2 * MIN });
      expect(held()[0]?.error).toBe("Held: this account has already been sent 120 Act now emails in the last hour. It is sent as soon as the hour allows.");

      // Asked again while the hour is still full, it waits again, however many times.
      for (let round = 1; round <= 5; round += 1) {
        expect(await service.tick(NOON + 200 + round * 5 * MIN)).toMatchObject({ sent: 0, retried: 1, failed: 0 });
      }
      expect(held()[0]?.attempts).toBe(0);

      // When the hour has passed it goes out.
      expect(await service.tick(NOON + 200 + 61 * MIN)).toMatchObject({ sent: 1, retried: 0, failed: 0 });
      expect(outbox.rows.every((row) => row.status === "sent")).toBe(true);
      expect(outbox.rows.find((row) => row.id === waitingId)).toMatchObject({ status: "sent", error: undefined });
    });

    it("has a ceiling of its own for Act now texts, and holds the next one", async () => {
      await config.setContacts(T1, textOnly);
      await raise(61);
      const counts = await service.tick(NOON + 200);
      expect(counts).toMatchObject({ sent: 60, retried: 1, failed: 0 });
      expect(held()[0]?.error).toBe("Held: this account has already been sent 60 Act now text messages in the last hour. It is sent as soon as the hour allows.");
      expect(await service.tick(NOON + 200 + 61 * MIN)).toMatchObject({ sent: 1 });
    });

    it("still skips a held message if the alert is acknowledged, or clears, while it waits", async () => {
      await config.setContacts(T1, emailOnly);
      await raise(121);
      await service.tick(NOON + 200);
      const waiting = held()[0];
      const alertId = waiting?.alertId as string;
      source.alerts.set(alertId, { ...(source.alerts.get(alertId) as AlertView), status: "acknowledged" });
      expect(await service.tick(NOON + 200 + 5 * MIN)).toMatchObject({ sent: 0, skipped: 1, retried: 0 });
      expect(outbox.rows.find((row) => row.id === waiting?.id)).toMatchObject({ status: "skipped", error: "Someone acknowledged the alert before this was sent." });
    });

    it("is not used up by Check today emails: after sixty of them, a hundred Act now alerts are still all sent", async () => {
      await config.setContacts(T1, emailOnly);
      await raise(61, { severity: "warning", title: "Tank level is low" });
      await service.tick(NOON + 100);
      expect(fake.sent).toHaveLength(60);

      for (let index = 0; index < 100; index += 1) await service.onAlertEvents([opened(source.add({ title: `Pump ${index} is running dry` }), NOON + 200 + index)], NOON + 200);
      expect(await service.tick(NOON + 300)).toMatchObject({ sent: 100, failed: 0, retried: 0 });
      expect(fake.sent).toHaveLength(160);
      expect(fake.sent.at(-1)?.subject).toContain("Act now");
    });

    it("is not used up by notes that someone acknowledged an alert or that it cleared", async () => {
      await config.setContacts(T1, emailOnly);
      const [besaOnTheList] = config.contacts(T1);
      const notes = Array.from({ length: 61 }, (_, index) => ({
        alertId: `old-${index}`,
        contactId: besaOnTheList?.id,
        contactName: "Besa Krasniqi",
        channel: "email" as const,
        kind: "acknowledged" as const,
        priority: "act_now" as const,
        subject: "Acknowledged",
        body: "Someone is on it.",
        dueAtMs: NOON,
        dedupeKey: `acknowledged:old-${index}:${NOON}:besa:email`
      }));
      await outbox.plan(T1, notes, NOON);
      // The notes have their own limit and meet it...
      expect(await service.tick(NOON)).toMatchObject({ sent: 60, failed: 1 });
      expect(outbox.rows.find((row) => row.status === "failed")?.error).toBe("Not sent: this account has already been sent 60 emails in the last hour.");
      // ...which says nothing about an Act now message, and an Act now message says nothing about them.
      await service.onAlertEvents([opened(source.add(), NOON + 100)], NOON + 100);
      expect(await service.tick(NOON + 200)).toMatchObject({ sent: 1, failed: 0, retried: 0 });
    });

    it("does not count Act now messages against the Check today limit", async () => {
      await config.setContacts(T1, emailOnly);
      await raise(100);
      await service.tick(NOON + 100);
      expect(fake.sent).toHaveLength(100);

      await service.onAlertEvents([opened(source.add({ severity: "warning", title: "Tank level is low" }), NOON + 200)], NOON + 200);
      expect(await service.tick(NOON + 300)).toMatchObject({ sent: 1, failed: 0 });
    });

    it("counts each account on its own", async () => {
      await config.setContacts(T1, emailOnly);
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      await raise(121);
      await service.tick(NOON + 200);
      await service.onAlertEvents([opened(source.add({ tenantId: T2 }), NOON + 300)], NOON + 300);
      expect(await service.tick(NOON + 3 * MIN)).toMatchObject({ sent: 1, retried: 1 }); // the other account's alert goes; this account's held one waits again
      expect(sentTo().at(-1)).toBe("email:owner@vlora.example");
    });
  });

  describe("people changing while messages wait", () => {
    it("drops a message to someone taken off the list", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);
      await config.setContacts(T1, [arben]);
      await service.tick(NOON + 10 * MIN);
      expect(outbox.rows.find((row) => row.channel === "sms" && row.contactName.startsWith("Besa"))).toMatchObject({ status: "skipped", error: "Besa Krasniqi is no longer on the list." });
    });

    it("sends to a corrected address, not the mistyped one it was planned with", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      const [first] = config.contacts(T1);
      await config.setContacts(T1, [{ id: first?.id, name: besa.name, email: "besa.krasniqi@hotel.example", phone: besa.phone }, arben]);
      await service.tick(NOON);
      expect(sentTo()).toEqual(["email:besa.krasniqi@hotel.example"]);
    });

    it("drops a text for someone whose phone number was taken away", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      const [first] = config.contacts(T1);
      await config.setContacts(T1, [{ id: first?.id, name: besa.name, email: besa.email }, arben]);
      await service.tick(NOON + 10 * MIN);
      expect(outbox.rows.find((row) => row.channel === "sms" && row.contactName.startsWith("Besa"))?.error).toBe("Besa Krasniqi no longer has a phone number on the list.");
    });
  });

  describe("an alert that nobody was told about", () => {
    it("is noticed and told, because the moment it opened was lost", async () => {
      source.add();
      await service.tick(NOON);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      await service.tick(NOON + MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("is told once somebody is put on the list, even if it was open before", async () => {
      await config.setContacts(T1, []);
      source.add();
      await service.tick(NOON);
      expect(fake.sent).toEqual([]);
      await config.setContacts(T1, [besa]);
      await service.tick(NOON + MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("is not told again after the first messages were planned, however they ended", async () => {
      service = build({ problems: [] });
      source.add();
      await service.tick(NOON);
      expect(outbox.rows).toHaveLength(5); // an email and a text for each of the two people, and the first email planned again
      service = build();
      await service.tick(NOON + 2 * MIN);
      expect(fake.sent).toEqual([]);
      expect(outbox.rows).toHaveLength(5);
      // The first email failed because the email service was not set up, so its next try is an hour on; by then the rest of the chain
      // is due as well. All of it goes when the platform can send it, and still nothing is planned twice.
      await service.tick(NOON + 60 * MIN);
      expect(sentTo().sort()).toEqual(["email:arben@hotel.example", "email:besa@hotel.example", "sms:+355691111111", "sms:+355692222222"]);
      expect(outbox.rows).toHaveLength(5);
    });

    it("is not told about when it is only information, or acknowledged, or resolved", async () => {
      source.add({ severity: "info" });
      source.add({ status: "acknowledged" });
      source.add({ status: "resolved" });
      await service.tick(NOON);
      expect(fake.sent).toEqual([]);
    });
  });

  describe("a customer who has been suspended", () => {
    const at = (iso: string) => Date.parse(iso);
    const SUSPENDED = "The account is suspended, so nothing is sent for it.";

    it("is planned for nothing, however its alerts change, and is sent nothing", async () => {
      source.suspended.add(T1);
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON); // the box has gone quiet; it is turned away, so this is what happens
      expect(outbox.rows).toEqual([]);
      // An open alert nobody planned for is noticed on the next round, as for any account; here it is not.
      expect(await service.tick(NOON + MIN)).toMatchObject({ sent: 0, failed: 0 });
      expect(outbox.rows).toEqual([]);
      await service.onAlertEvents([{ type: "resolved", atMs: NOON + 2 * MIN, alert, siteName: "Hotel Adriatik" }], NOON + 2 * MIN);
      expect(outbox.rows).toEqual([]);
      expect(fake.sent).toEqual([]);
    });

    it("gets no morning message", async () => {
      source.suspended.add(T1);
      await service.tick(at("2026-10-19T05:30:00Z")); // 07:30
      expect(fake.sent).toEqual([]);
      expect(outbox.rows).toEqual([]);
    });

    it("has what was already planned dropped, with the reason, from the moment it is suspended", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON); // the first email goes
      expect(fake.sent).toHaveLength(1);

      source.suspended.add(T1);
      expect(await service.tick(NOON + 30 * MIN)).toMatchObject({ sent: 0, skipped: 3 }); // the text, and the second person
      expect(fake.sent).toHaveLength(1);
      const dropped = outbox.rows.filter((row) => row.status === "skipped");
      expect(dropped).toHaveLength(3);
      expect(dropped.every((row) => row.error === SUSPENDED)).toBe(true);
    });

    it("drops even a test message", async () => {
      const [first] = config.contacts(T1);
      source.suspended.add(T1);
      const entries = await service.sendTest(T1, first?.id as string, NOON);
      expect(fake.sent).toEqual([]);
      expect(entries.map((entry) => entry.status)).toEqual(["skipped", "skipped"]);
      expect(entries.map((entry) => entry.error)).toEqual([SUSPENDED, SUSPENDED]);
    });

    it("is told again as soon as it is active: about what opened while it was suspended, and about what happens from then on", async () => {
      source.suspended.add(T1);
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(outbox.rows).toEqual([]);

      source.suspended.delete(T1);
      await service.onAlertEvents([opened(source.add({ title: "Pump is running dry" }), NOON + 5 * MIN)], NOON + 5 * MIN);
      await service.tick(NOON + 5 * MIN);
      expect(fake.sent.map((message) => message.subject).sort()).toEqual(["Act now: Pump is running dry, Hotel Adriatik", "Act now: Tank level is critical, Hotel Adriatik"]);
    });

    it("does not stop another account from being told", async () => {
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      source.suspended.add(T1);
      await service.onAlertEvents([opened(source.add()), opened(source.add({ tenantId: T2 }))], NOON);
      await service.tick(NOON);
      expect(sentTo()).toEqual(["email:owner@vlora.example"]);
    });
  });


  describe("a condition that clears and comes back", () => {
    const iso = (ms: number) => new Date(ms).toISOString();
    const clear = async (alert: AlertView, atMs: number, extra: Partial<AlertView> = {}) => {
      source.alerts.set(alert.id, { ...alert, ...extra, status: "resolved", resolvedAtUtc: iso(atMs) });
      await service.onAlertEvents([{ type: "resolved", atMs, alert, siteName: "Hotel Adriatik" }], atMs);
    };
    const returns = async (alert: AlertView, atMs: number, extra: Partial<AlertView> = {}) => {
      const back = { ...alert, ...extra, status: "open" as const };
      source.alerts.set(alert.id, back);
      await service.onAlertEvents([{ type: "reopened", atMs, alert: back, siteName: "Hotel Adriatik" }], atMs);
    };

    it("still texts the person when it comes back inside the flap window, though the text fell due while it was clear", async () => {
      await config.setContacts(T1, [besa]);
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON); // the email, 12:00
      await clear(alert, NOON + 5 * MIN);

      // Her text falls due at 12:10, five minutes into the gap: it waits, with the reason in the log.
      expect(await service.tick(NOON + 10 * MIN)).toMatchObject({ sent: 0, skipped: 0, retried: 1 });
      const text = outbox.rows.find((row) => row.channel === "sms");
      expect(text).toMatchObject({ status: "planned", dueAtMs: NOON + 11 * MIN, attempts: 0 });
      expect(text?.error).toBe("Held: the condition cleared a moment ago and may come back. This is sent if it does.");
      expect(await service.tick(NOON + 11 * MIN)).toMatchObject({ sent: 0, retried: 1 });

      // It comes back at 12:12, the same alert: she is texted, though the alert is open and she was never told it was.
      await returns(alert, NOON + 12 * MIN);
      expect(await service.tick(NOON + 12 * MIN)).toMatchObject({ sent: 1, skipped: 0 });
      expect(sentTo()).toEqual(["email:besa@hotel.example", "sms:+355691111111"]);
    });

    it("does not page the first person again for a wobble nobody had acknowledged", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      await clear(alert, NOON + 5 * MIN);
      await returns(alert, NOON + 8 * MIN);
      fake.sent.length = 0;
      await service.tick(NOON + 9 * MIN);
      expect(fake.sent).toEqual([]);
      const steps = outbox.rows.filter((row) => row.kind === "alert" || row.kind === "escalation");
      expect(steps).toHaveLength(4);
      expect(steps.every((row) => row.dedupeKey.includes(":g0:"))).toBe(true);
    });

    it("starts again from the first person when it comes back after someone had acknowledged it, and does not tell the second person the first has not answered", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON); // Besa is emailed at 12:00

      // Besa acknowledges at 12:02. It clears at 12:10 (her text, due then, waits) and comes back at 12:21.
      const acknowledged = { acknowledgedAtUtc: iso(NOON + 2 * MIN) };
      source.alerts.set(alert.id, { ...alert, ...acknowledged, status: "acknowledged" });
      await service.onAlertEvents([{ type: "acknowledged", atMs: NOON + 2 * MIN, alert: { ...alert, ...acknowledged }, siteName: "Hotel Adriatik", by: "Besa Krasniqi", byEmail: besa.email }], NOON + 2 * MIN);
      await clear(alert, NOON + 10 * MIN, acknowledged);
      await service.tick(NOON + 10 * MIN);
      fake.sent.length = 0;
      await returns(alert, NOON + 21 * MIN, acknowledged);

      // She is told it is back, at once; what was still waiting from the first round is dropped.
      await service.tick(NOON + 21 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.subject).toBe("Act now: Tank level is critical, Hotel Adriatik");
      const dropped = outbox.rows.filter((row) => row.status === "skipped" && row.error?.startsWith("The condition came back after someone had acknowledged it"));
      expect(dropped.map((row) => `${row.contactName.split(" ")[0]} ${row.channel}`).sort()).toEqual(["Arben email", "Arben sms", "Besa sms"]);

      // The second round runs as the first did: her text at ten minutes, Arben at thirty, and what he is told is true of this round.
      await service.tick(NOON + 31 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example", "sms:+355691111111"]);
      await service.tick(NOON + 51 * MIN);
      expect(sentTo().slice(2).sort()).toEqual(["email:arben@hotel.example", "sms:+355692222222"]);
      const escalation = fake.sent.find((message) => message.to === "arben@hotel.example");
      expect(escalation?.body).toContain("Besa Krasniqi was told at 12:21 and has not answered. You are next.");
      expect(escalation?.body).not.toContain("was told at 12:00");
      expect(outbox.rows.filter((row) => row.status === "sent").every((row) => row.dedupeKey.includes(":g0:") || row.dedupeKey.includes(":g1:"))).toBe(true);
    });

    it("starts again from the first person even when nobody heard that it came back", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON); // Besa is emailed at 12:00

      const acknowledged = { acknowledgedAtUtc: iso(NOON + 2 * MIN) };
      source.alerts.set(alert.id, { ...alert, ...acknowledged, status: "acknowledged" });
      await service.onAlertEvents([{ type: "acknowledged", atMs: NOON + 2 * MIN, alert: { ...alert, ...acknowledged }, siteName: "Hotel Adriatik", by: "Besa Krasniqi", byEmail: besa.email }], NOON + 2 * MIN);
      await clear(alert, NOON + 10 * MIN, acknowledged);
      await service.tick(NOON + 10 * MIN);
      fake.sent.length = 0;

      // It comes back at 12:21 and the announcement of it is lost (the platform was restarting, or the database dropped at that
      // moment). The alert itself is open again and says that it was acknowledged after its messages began: that is enough.
      source.alerts.set(alert.id, { ...alert, ...acknowledged, status: "open" });
      await service.tick(NOON + 21 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      expect(fake.sent[0]?.subject).toBe("Act now: Tank level is critical, Hotel Adriatik");

      // Once, however many rounds notice it; and the new round runs as the first did, saying only what is true of it.
      await service.tick(NOON + 22 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
      await service.tick(NOON + 31 * MIN);
      expect(sentTo()).toEqual(["email:besa@hotel.example", "sms:+355691111111"]);
      await service.tick(NOON + 51 * MIN);
      expect(sentTo().slice(2).sort()).toEqual(["email:arben@hotel.example", "sms:+355692222222"]);
      const escalation = fake.sent.find((message) => message.to === "arben@hotel.example");
      expect(escalation?.body).toContain("Besa Krasniqi was told at 12:21 and has not answered. You are next.");
      expect(outbox.rows.some((row) => row.dedupeKey.includes(":g2:"))).toBe(false);
    });

    it("does not start the messages again a second time when the announcement was heard and a round notices as well", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      const acknowledged = { acknowledgedAtUtc: iso(NOON + 2 * MIN) };
      source.alerts.set(alert.id, { ...alert, ...acknowledged, status: "acknowledged" });
      await clear(alert, NOON + 10 * MIN, acknowledged);
      await returns(alert, NOON + 21 * MIN, acknowledged);
      // Heard at once, the new round is planned at once, without waiting for the next round of work to notice.
      expect(outbox.rows.some((row) => row.dedupeKey.includes(":g1:"))).toBe(true);
      for (let minute = 21; minute <= 60; minute += 1) await service.tick(NOON + minute * MIN);
      const generations = new Set(outbox.rows.filter((row) => row.kind === "alert" || row.kind === "escalation").map((row) => /:g([0-9]+):/.exec(row.dedupeKey)?.[1]));
      expect([...generations].sort()).toEqual(["0", "1"]);
    });

    it("puts back, when the same alert comes back, a step that was dropped as cleared", async () => {
      await config.setContacts(T1, [besa]);
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      // Its condition had been clear for a quarter of an hour when the text fell due, so the text was dropped...
      await clear(alert, NOON - 6 * MIN);
      expect(await service.tick(NOON + 10 * MIN)).toMatchObject({ skipped: 1 });
      expect(outbox.rows.find((row) => row.channel === "sms")).toMatchObject({ status: "skipped", error: "The condition cleared before this was sent." });

      // ...and then the same alert returned: the text is sent after all.
      await returns(alert, NOON + 11 * MIN);
      expect(outbox.rows.find((row) => row.channel === "sms")).toMatchObject({ status: "planned", error: "The condition came back, so this is sent after all." });
      expect(await service.tick(NOON + 11 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toContain("sms:+355691111111");
      expect(outbox.rows.find((row) => row.channel === "sms")).toMatchObject({ status: "sent" });
    });
  });

  describe("what an escalation says of the person before", () => {
    it("says they were told, and have not answered, when they were", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);
      await service.tick(NOON + 30 * MIN);
      const email = fake.sent.find((message) => message.to === "arben@hotel.example");
      const text = fake.sent.find((message) => message.to === "+355692222222");
      expect(email?.body).toContain("Besa Krasniqi was told at 12:00 and has not answered. You are next.");
      expect(text?.body).toContain("Besa Krasniqi was told 12:00. You are next.");
    });

    it("does not say so when the first person was never told: their messages failed, so they cannot have 'not answered'", async () => {
      // Besa can be reached only by email, and that address bounces; Arben's work.
      const sent: Sent[] = [];
      const email: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          if (message.to === "besa@hotel.example") return { ok: false, transient: false, error: "The email service answered 422: the mailbox does not exist." };
          sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body });
          return { ok: true, providerId: "em" };
        }
      };
      const sms: SmsChannel = {
        send: async (message) => {
          sent.push({ channel: "sms", to: message.to, body: message.body });
          return { ok: true, providerId: "sm" };
        }
      };
      service = build({ email, sms, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }, arben]);
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);
      await service.tick(NOON + 30 * MIN);

      const email2 = sent.find((message) => message.to === "arben@hotel.example");
      const text2 = sent.find((message) => message.to === "+355692222222");
      expect(email2?.body).toContain("You are next on the list.");
      expect(email2?.body).not.toContain("has not answered");
      expect(email2?.body).not.toContain("was told");
      expect(text2?.body).toContain("You are next.");
      expect(text2?.body).not.toContain("was told");
    });
  });

  describe("an escalation after the list has been reordered", () => {
    it("says only that the person is next when nobody is before them on the list any more", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);
      const [first, second] = config.contacts(T1);
      await config.setContacts(T1, [
        { id: second?.id, name: second?.name as string, email: second?.email, phone: second?.phone },
        { id: first?.id, name: first?.name as string, email: first?.email, phone: first?.phone }
      ]);
      await service.tick(NOON + 30 * MIN);
      const escalation = fake.sent.find((message) => message.to === "arben@hotel.example" && message.subject?.startsWith("Act now, not acknowledged"));
      expect(escalation?.body).toContain("You are next on the list.");
      expect(escalation?.body).not.toContain("was told");
    });
  });

  describe("a chain of messages that has to be whole", () => {
    it("completes one that was only partly planned, timing the missing steps from when the chain began", async () => {
      const alert = source.add();
      const [onlyTheFirst] = (await import("./plan")).planAlertEvent(opened(alert), { contacts: config.contacts(T1), settings: config.settings(T1), generation: 0 });
      await outbox.plan(T1, [onlyTheFirst as PlannedMessage], NOON); // the database dropped after the first row
      expect(outbox.rows).toHaveLength(1);

      await service.tick(NOON + 3 * MIN);
      expect(outbox.rows).toHaveLength(4);
      const due = outbox.rows.map((row) => `${row.contactName.split(" ")[0]} ${row.channel} +${(row.dueAtMs - NOON) / MIN}`).sort();
      expect(due).toEqual(["Arben email +30", "Arben sms +30", "Besa email +0", "Besa sms +10"]);
      await service.tick(NOON + 30 * MIN);
      expect(sentTo().sort()).toEqual(["email:arben@hotel.example", "email:besa@hotel.example", "sms:+355691111111", "sms:+355692222222"]);
    });

    it("does not make a second chain when a round that noticed the alert and the event that announced it both plan it", async () => {
      const alert = source.add();
      await service.tick(NOON + 30_000); // a round notices the open alert nobody was told of, and plans its chain from now
      expect(outbox.rows).toHaveLength(4);
      await service.onAlertEvents([opened(alert, NOON)], NOON + 40_000); // then the event that was announced earlier is planned too
      expect(outbox.rows).toHaveLength(4);
      await service.tick(NOON + 60 * MIN);
      expect(sentTo().filter((to) => to === "email:besa@hotel.example")).toHaveLength(1);
    });

    it("plans for a person added to the list while the alert stands, in their place in the order, and only once", async () => {
      const alert = source.add();
      await service.onAlertEvents([opened(alert)], NOON);
      await service.tick(NOON);
      const plumber = { name: "Night plumber", phone: "+355693333333" };
      await config.setContacts(T1, [...config.contacts(T1), plumber]);
      await service.tick(NOON + 5 * MIN);
      const theirs = () => outbox.rows.filter((row) => row.contactName === "Night plumber");
      expect(theirs().map((row) => `${row.channel} +${(row.dueAtMs - NOON) / MIN}`)).toEqual(["sms +60"]);
      await service.tick(NOON + 6 * MIN);
      expect(theirs()).toHaveLength(1);
      expect(outbox.rows).toHaveLength(5);
    });
  });

  describe("a round of work that cannot be planned, or is held up", () => {
    class FailingOutbox extends MemoryOutboxStore {
      brokenAlert: string | undefined;
      override async chains(tenantId: string, alertId: string) {
        if (alertId === this.brokenAlert) throw new Error("the database dropped");
        return super.chains(tenantId, alertId);
      }
    }

    it("does not let one alert that cannot be checked stop the messages that are due", async () => {
      const failing = new FailingOutbox();
      service = build(undefined, { outbox: failing, config });
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      const broken = source.add({ id: "a-broken" });
      failing.brokenAlert = broken.id;
      source.add({ tenantId: T2, id: "a-fine" });
      expect(await service.tick(NOON)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:owner@vlora.example"]);
    });

    it("plans the other alerts announced with it when one alert cannot be planned", async () => {
      const failing = new FailingOutbox();
      service = build(undefined, { outbox: failing, config });
      const broken = source.add({ id: "a-broken" });
      failing.brokenAlert = broken.id;
      const fine = source.add({ id: "a-fine", title: "Pump is running dry" });
      await service.onAlertEvents([opened(broken), opened(fine)], NOON);
      expect(failing.rows.filter((row) => row.alertId === fine.id).length).toBeGreaterThan(0);
      expect(failing.rows.filter((row) => row.alertId === broken.id)).toEqual([]);
    });

    it("sends what is due even when the open alerts cannot be listed at all", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      source.openAlertsAcrossTenants = () => {
        throw new Error("the platform could not list its alerts");
      };
      expect(await service.tick(NOON)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("does not let one account's morning message that cannot be planned stop another's, or the messages that are due", async () => {
      const bad = source.digestOf.bind(source);
      source.digestOf = (tenantId: string, nowMs: number) => {
        if (tenantId === T1) throw new Error("the report would not build");
        return bad(tenantId, nowMs);
      };
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      source.add({ tenantId: T2 });
      // Both the morning and an alert fall due in the same round.
      const morning = Date.parse("2026-10-19T05:30:00Z");
      source.alerts.get("a-1")!.createdAtUtc = new Date(morning).toISOString();
      expect(await service.tick(morning)).toMatchObject({ sent: 2 }); // the alert, and Vlora's morning message
      expect(sentTo().sort()).toEqual(["email:owner@vlora.example", "email:owner@vlora.example"]);
    });

    it("turns away a message that goes wrong in a way nobody foresaw, puts it back, and sends the rest", async () => {
      const email: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          if (message.to === "besa@hotel.example") throw new Error("the connection fell over");
          fake.sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body });
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, sms: fake.sms, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }, { name: "Arben Hoxha", email: "arben@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON + 30 * MIN)).toMatchObject({ sent: 1, retried: 1 });
      expect(sentTo()).toEqual(["email:arben@hotel.example"]);
      expect(outbox.rows.find((row) => row.contactName.startsWith("Besa"))).toMatchObject({ status: "planned", error: "Not sent yet: the connection fell over" });
    });
  });

  describe("sending to several people at once", () => {
    const people = ["Ana", "Besa", "Cena", "Drita", "Elda"].map((name) => ({ name, email: `${name.toLowerCase()}@hotel.example` }));

    it("does not let a provider that hangs on one person hold up everyone else", async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const started: string[] = [];
      const done: string[] = [];
      const email: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          started.push(message.to);
          if (message.to === "ana@hotel.example") await gate;
          done.push(message.to);
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, problems: [] });
      await config.setContacts(T1, people);
      await service.onAlertEvents([opened(source.add())], NOON);
      const round = service.tick(NOON + 120 * MIN); // everyone's step is due by now
      for (let spin = 0; spin < 200 && done.length < 4; spin += 1) await new Promise((resolve) => setTimeout(resolve, 5));
      expect(done.sort()).toEqual(["besa@hotel.example", "cena@hotel.example", "drita@hotel.example", "elda@hotel.example"]);
      release();
      expect(await round).toMatchObject({ sent: 5 });
    });

    it("never sends more than four people's messages at the same moment", async () => {
      let running = 0;
      let most = 0;
      const email: EmailChannel = {
        send: async () => {
          running += 1;
          most = Math.max(most, running);
          await new Promise((resolve) => setTimeout(resolve, 20));
          running -= 1;
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, problems: [] });
      await config.setContacts(T1, [...people, ...["Fatos", "Gent", "Hana"].map((name) => ({ name, email: `${name.toLowerCase()}@hotel.example` }))]);
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON + 4 * 60 * MIN)).toMatchObject({ sent: 8 });
      expect(most).toBe(4);
    });

    it("keeps one person's messages in order: the text waits for their email", async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const order: string[] = [];
      const email: EmailChannel = {
        send: async () => {
          order.push("email started");
          await gate;
          order.push("email done");
          return { ok: true, providerId: "em" };
        }
      };
      const sms: SmsChannel = {
        send: async () => {
          order.push("text started");
          return { ok: true, providerId: "sm" };
        }
      };
      service = build({ email, sms, problems: [] });
      await config.setContacts(T1, [besa]);
      await service.onAlertEvents([opened(source.add())], NOON);
      const round = service.tick(NOON + 10 * MIN); // the email and the text of the same person are both due
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(order).toEqual(["email started"]);
      release();
      await round;
      expect(order).toEqual(["email started", "email done", "text started"]);
    });

    it("cannot pass an hourly limit by sending to several people at once: it holds exactly what is past it", async () => {
      const email: EmailChannel = {
        send: async () => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return { ok: true, providerId: "em" };
        }
      };
      service = build({ email, problems: [] });
      // Ten people, each emailed in turn about each of thirteen Act now alerts: 130 emails are due, 120 may go in an hour.
      await config.setContacts(T1, Array.from({ length: 10 }, (_, index) => ({ name: `Person ${index}`, email: `p${index}@hotel.example` })));
      for (let index = 0; index < 13; index += 1) await service.onAlertEvents([opened(source.add({ title: `Tank ${index} is critical` }), NOON + index)], NOON);
      const counts = await service.tick(NOON + 10 * 60 * MIN);
      expect(counts).toMatchObject({ sent: 120, retried: 10, failed: 0 });
    });
  });

  describe("two platforms working at once", () => {
    class LockedOutbox extends MemoryOutboxStore {
      free = true;
      granted = 0;
      released = 0;
      override async tryLock() {
        if (!this.free) return undefined;
        this.granted += 1;
        return async () => {
          this.released += 1;
        };
      }
    }

    it("sends nothing while another platform has the round, and says nothing is wrong", async () => {
      const locked = new LockedOutbox();
      service = build(undefined, { outbox: locked, config });
      await service.onAlertEvents([opened(source.add())], NOON);
      locked.free = false;
      expect(await service.tick(NOON)).toEqual({ sent: 0, failed: 0, skipped: 0, retried: 0 });
      expect(fake.sent).toEqual([]);
      locked.free = true;
      expect(await service.tick(NOON + MIN)).toMatchObject({ sent: 1 });
      expect(locked.released).toBe(locked.granted);
    });

    it("goes ahead anyway when the round has been held for more than two rounds running, so a lock never let go cannot silence an alert", async () => {
      const locked = new LockedOutbox();
      service = build(undefined, { outbox: locked, config });
      await service.onAlertEvents([opened(source.add())], NOON);
      locked.free = false;
      expect(await service.tick(NOON)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + MIN)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + 2 * MIN)).toMatchObject({ sent: 1 });
      expect(sentTo()).toEqual(["email:besa@hotel.example"]);
    });

    it("lets go of the round even when the round fails", async () => {
      class Breaking extends LockedOutbox {
        override async claimDue(): Promise<never> {
          throw new Error("the database dropped");
        }
      }
      const broken = new Breaking();
      service = build(undefined, { outbox: broken, config });
      await expect(service.tick(NOON)).rejects.toThrow("the database dropped");
      expect(broken.released).toBe(1);
    });
  });

  describe("what Greecon's own morning message says of the customers' alert messages", () => {
    it("names each customer whose alert messages are not arriving, and why, and leaves out the ones that are", async () => {
      source.operator.add("t-greecon");
      await config.setContacts("t-greecon", [{ name: "Greecon team", email: "team@greecon.example" }]);
      const down: EmailChannel = {
        send: async (message: OutgoingEmail) => {
          if (message.to === "team@greecon.example") {
            fake.sent.push({ channel: "email", to: message.to, subject: message.subject, body: message.body });
            return { ok: true, providerId: "em" };
          }
          return { ok: false, transient: false, error: "The email service answered 401: invalid API key." };
        }
      };
      service = build({ email: down, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);

      await service.tick(Date.parse("2026-10-20T05:30:00Z")); // the next morning, 07:30
      const note = fake.sent.find((message) => message.to === "team@greecon.example");
      expect(note?.body).toContain("Hotel Adriatik Ltd: 1 alert message could not be delivered, the last because: The email service answered 401: invalid API key.");

      // A customer's own morning message is about its own sites, and carries no such line about others.
      source.alerts.forEach((alert) => source.alerts.set(alert.id, { ...alert, status: "acknowledged" }));
      fake.sent.length = 0;
      await service.tick(Date.parse("2026-10-21T05:30:00Z"));
      expect(fake.sent.find((message) => message.to === "team@greecon.example")?.body).not.toContain("could not be delivered");
    });
  });

  describe("a message that was being sent when the process died", () => {
    it("is sent after a restart rather than lost", async () => {
      await service.onAlertEvents([opened(source.add())], NOON);
      await outbox.claimDue(NOON, 25); // taken, never finished
      expect(await service.tick(NOON + MIN)).toMatchObject({ sent: 0 });
      await service.tick(NOON + 6 * MIN);
      expect(sentTo()).toContain("email:besa@hotel.example");
    });
  });

  describe("the morning message", () => {
    const at = (iso: string) => Date.parse(iso);

    it("goes to each person with an email address once a day, at the time set, on the account's clock", async () => {
      await config.setContacts(T1, [besa, { name: "Plumber", phone: "+355693333333" }, arben]);
      await service.tick(at("2026-10-19T05:29:00Z")); // 07:29
      expect(fake.sent).toEqual([]);
      await service.tick(at("2026-10-19T05:30:00Z")); // 07:30
      expect(sentTo()).toEqual(["email:besa@hotel.example", "email:arben@hotel.example"]);
      expect(fake.sent[0]?.subject).toBe("Greecon, Mon 19 Oct: Stable. The site is reporting and nothing needs doing.");
      expect(fake.sent[0]?.body).toContain("Hotel Adriatik: Stable. Last reading 2 minutes ago.");

      await service.tick(at("2026-10-19T06:30:00Z"));
      expect(fake.sent).toHaveLength(2);

      await service.tick(at("2026-10-20T05:30:00Z"));
      expect(fake.sent).toHaveLength(4);
    });

    it("does not go twice if the platform restarts in the morning", async () => {
      await service.tick(at("2026-10-19T05:31:00Z"));
      expect(fake.sent).toHaveLength(2);
      const restarted = build(undefined, { outbox, config });
      await restarted.tick(at("2026-10-19T05:40:00Z"));
      expect(fake.sent).toHaveLength(2);
    });

    it("says what is wrong when something is", async () => {
      source.stable = false;
      await service.tick(at("2026-10-19T05:30:00Z"));
      expect(fake.sent[0]?.subject).toBe("Greecon, Mon 19 Oct: Attention needed. 1 of 1 site needs a look.");
      expect(fake.sent[0]?.body).toContain("Hotel Adriatik: Attention needed. Tank level is low.");
    });

    it("is not sent in the afternoon: that would be a different message", async () => {
      await service.tick(at("2026-10-19T09:00:00Z")); // 11:00, past the three hours
      expect(fake.sent).toEqual([]);
    });

    it("can be turned off, and moved", async () => {
      await service.saveSettings(T1, { digestEnabled: false });
      await service.tick(at("2026-10-19T05:30:00Z"));
      expect(fake.sent).toEqual([]);
      await service.saveSettings(T1, { digestEnabled: true, digestAt: "08:15" });
      await service.tick(at("2026-10-19T06:14:00Z")); // 08:14
      expect(fake.sent).toEqual([]);
      await service.tick(at("2026-10-19T06:15:00Z"));
      expect(fake.sent).toHaveLength(2);
    });

    it("is dropped if it was turned off after it was planned", async () => {
      await service.tick(at("2026-10-19T05:30:00Z"));
      fake.sent.length = 0;
      outbox.rows.forEach((row) => Object.assign(row, { status: "planned" }));
      await service.saveSettings(T1, { digestEnabled: false });
      await service.tick(at("2026-10-19T05:31:00Z"));
      expect(fake.sent).toEqual([]);
      expect(outbox.rows[0]?.error).toBe("The morning message was turned off before this was sent.");
    });

    it("goes to nobody on an account with nobody on the list", async () => {
      await config.setContacts(T1, []);
      await service.tick(at("2026-10-19T05:30:00Z"));
      expect(fake.sent).toEqual([]);
    });
  });

  describe("a test message", () => {
    it("goes to the person by every way that reaches them now, and says what happened", async () => {
      const [first] = config.contacts(T1);
      const entries = await service.sendTest(T1, first?.id as string, NOON);
      expect(entries.map((entry) => `${entry.channel} ${entry.kind} ${entry.status}`).sort()).toEqual(["email test sent", "sms test sent"]);
      expect(fake.sent.find((message) => message.channel === "email")?.subject).toBe("Greecon test message for Hotel Adriatik Ltd");
      expect(fake.sent.find((message) => message.channel === "sms")?.body).toBe("Greecon test message for Hotel Adriatik Ltd. If you can read this, Act now alerts reach you by text. Nothing is wrong.");
      expect(entries.find((entry) => entry.channel === "email")?.destination).toBe("b••••@hotel.example");
      expect(service.summary(T1).lastTestAtMs).toBe(NOON);
    });

    it("says plainly that nothing was sent when the platform cannot send", async () => {
      service = build({ problems: [] });
      const [first] = config.contacts(T1);
      const entries = await service.sendTest(T1, first?.id as string, NOON);
      expect(entries.map((entry) => entry.status)).toEqual(["failed", "failed"]);
      expect(entries.map((entry) => entry.error).sort()).toEqual(["Not sent: email is not set up on this Greecon platform.", "Not sent: text messages are not set up on this Greecon platform."]);
      expect(service.summary(T1).lastTestAtMs).toBeUndefined();
    });

    it("reports the provider's reason when it refuses", async () => {
      fake.results = [{ ok: false, transient: false, error: "The email service answered 422: Invalid `to` field." }];
      const [first] = config.contacts(T1);
      const entries = await service.sendTest(T1, first?.id as string, NOON);
      expect(entries.find((entry) => entry.channel === "email")).toMatchObject({ status: "failed", error: "The email service answered 422: Invalid `to` field." });
    });

    it("is not sent to someone who is not on the account's list", async () => {
      await expect(service.sendTest(T1, "00000000-0000-4000-8000-000000000000", NOON)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("is limited, so the button cannot be used to send a hundred messages", async () => {
      const [first] = config.contacts(T1);
      for (let index = 0; index < 6; index += 1) await service.sendTest(T1, first?.id as string, NOON + index);
      await expect(service.sendTest(T1, first?.id as string, NOON + 10)).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe("one account and another", () => {
    it("never shows, tests or uses another account's people or log", async () => {
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      await service.tick(NOON);

      const [theirs] = config.contacts(T2);
      await expect(service.sendTest(T1, theirs?.id as string, NOON)).rejects.toBeInstanceOf(NotFoundException);
      expect(await service.log(T2, 50)).toEqual([]);
      expect((await service.log(T1, 50)).length).toBeGreaterThan(0);
      expect(sentTo()).not.toContain("email:owner@vlora.example");
      expect(service.contacts(T2).map((contact) => contact.name)).toEqual(["Vlora Owner"]);
    });

    it("keeps each account's quiet hours and clock to itself", async () => {
      await service.saveSettings(T2, { timezone: "UTC", quietFrom: "01:00", quietTo: "02:00" });
      expect(service.settings(T1)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(service.settings(T2)).toMatchObject({ timezone: "UTC", quietFrom: "01:00" });
    });
  });

  describe("the list and the settings", () => {
    it("refuses a list with a mistake in it, in words that say what to change", async () => {
      await expect(service.saveContacts(T1, [{ name: "Besa", email: "not an address" }])).rejects.toThrow(new BadRequestException('Besa: "not an address" is not an email address.'));
      expect(service.contacts(T1).map((contact) => contact.name)).toEqual(["Besa Krasniqi", "Arben Hoxha"]);
    });

    it("keeps a person's place, and their id, when the list is saved again", async () => {
      const before = service.contacts(T1);
      const after = await service.saveContacts(T1, [{ id: before[1]?.id, name: "Arben Hoxha", email: "arben@hotel.example" }, { id: before[0]?.id, name: "Besa K.", email: "besa@hotel.example" }]);
      expect(after.map((contact) => contact.name)).toEqual(["Arben Hoxha", "Besa K."]);
      expect(after.map((contact) => contact.id)).toEqual([before[1]?.id, before[0]?.id]);
    });

    it("does not accept somebody else's person id as its own", async () => {
      await config.setContacts(T2, [{ name: "Vlora Owner", email: "owner@vlora.example" }]);
      const [theirs] = config.contacts(T2);
      const saved = await service.saveContacts(T1, [{ id: theirs?.id, name: "Intruder", email: "intruder@hotel.example" }]);
      expect(saved[0]?.id).not.toBe(theirs?.id);
      expect(service.contacts(T2).map((contact) => contact.name)).toEqual(["Vlora Owner"]);
    });

    it("refuses settings that are not times or clocks", async () => {
      await expect(service.saveSettings(T1, { quietFrom: "late" })).rejects.toBeInstanceOf(BadRequestException);
      expect(service.settings(T1).quietFrom).toBe("22:00");
    });
  });

  describe("saying how things stand, in plain sentences", () => {
    it("says that nothing is sent when the platform has no email or text service, and that nobody is on the list", async () => {
      service = build({ problems: [] });
      await config.setContacts(T1, []);
      const status = await service.status(T1);
      expect(status.email.configured).toBe(false);
      expect(status.words).toEqual([
        "Alert messages are off on this Greecon platform. Alerts show in Greecon, but nobody is sent a message.",
        "Nobody is on the list yet. Add the people who should hear first, in the order they should be told."
      ]);
    });

    it("says what is on, and asks for a test when none has been sent", async () => {
      const status = await service.status(T1);
      expect(status).toMatchObject({ contacts: 2, byEmail: 2, bySms: 2, email: { configured: true }, sms: { configured: true } });
      expect(status.words).toEqual(["Email is on.", "Text messages are on.", "No test message has been sent yet. Send one to each person and ask them to confirm it arrived."]);
    });

    it("says when text messages are off that Act now reaches people by email only", async () => {
      service = build({ email: fake.email, problems: [] });
      expect((await service.status(T1)).words[1]).toBe("Text messages are off, so Act now alerts reach people by email only.");
    });

    it("gives the time of the last test, and asks whether it arrived", async () => {
      const [first] = config.contacts(T1);
      await service.sendTest(T1, first?.id as string, NOON);
      const status = await service.status(T1);
      expect(status.lastTestAtUtc).toBe(new Date(NOON).toISOString());
      expect(status.words.at(-1)).toBe("A test message was last sent on 2026-10-19 10:00 UTC. Ask the person whether it arrived.");
    });
  });

  describe("being told by the platform", () => {
    it("plans messages for the events the platform announces, without anyone waiting for it", async () => {
      service = new NotificationsService(source, config, outbox, { email: fake.email, sms: fake.sms, problems: [] }, { autoSend: false });
      service.onModuleInit();
      try {
        expect(source.listener).toBeDefined();
        const alert = source.add();
        source.listener?.([opened(alert, Date.now())]);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(outbox.rows.length).toBe(4);
      } finally {
        service.onModuleDestroy();
      }
      expect(source.listener).toBeUndefined();
    });
  });
});
