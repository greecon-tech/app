import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@greecon/shared";
import { DatabaseService } from "../database/database.service";
import { Channels, EmailChannel, OutgoingEmail, SendResult, SmsChannel } from "./channels";
import { NotificationConfig } from "./config";
import { DigestFacts } from "./messages";
import { NotificationsService, AlertSource, AlertView } from "./notifications.service";
import { MemoryOutboxStore } from "./outbox";
import { AlertEvent } from "./plan";

const T1 = "t-1";
const T2 = "t-2";
const MIN = 60_000;
const NOON = Date.parse("2026-10-19T10:00:00Z"); // 12:00 in Europe/Tirane (UTC+2)

class FakeSource implements AlertSource {
  alerts = new Map<string, AlertView>();
  stable = true;
  listener: ((events: AlertEvent[]) => void) | undefined;
  alertById(tenantId: string, alertId: string): AlertView | undefined {
    const alert = this.alerts.get(alertId);
    return alert && alert.tenantId === tenantId ? { ...alert } : undefined;
  }
  openAlertsAcrossTenants() {
    return [...this.alerts.values()].filter((alert) => alert.status === "open").map((alert) => ({ alert: { ...alert }, siteName: "Hotel Adriatik" }));
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
      expect(await service.tick(clearedAt + 14 * MIN)).toMatchObject({ sent: 0, skipped: 1 }); // Besa's text, due at 12:10, is no longer wanted
      expect(await service.tick(clearedAt + 15 * MIN)).toMatchObject({ sent: 1 });
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

    it("tries again, a little later each time, when the service is having trouble", async () => {
      fake.results = [{ ok: false, transient: true, error: "The email service answered 503: unavailable" }];
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON)).toMatchObject({ retried: 1, sent: 0 });
      expect(outbox.rows[0]).toMatchObject({ status: "planned", attempts: 1, error: "The email service answered 503: unavailable", dueAtMs: NOON + MIN });
      expect(await service.tick(NOON + 30_000)).toMatchObject({ sent: 0 });
      expect(await service.tick(NOON + MIN)).toMatchObject({ sent: 1 });
      expect(outbox.rows[0]).toMatchObject({ status: "sent", destination: "besa@hotel.example" });
    });

    it("gives up after five tries and keeps the reason", async () => {
      const down: EmailChannel = { send: async () => ({ ok: false, transient: true, error: "The email service could not be reached: timeout" }) };
      service = build({ email: down, problems: [] });
      await config.setContacts(T1, [{ name: "Besa Krasniqi", email: "besa@hotel.example" }]);
      await service.onAlertEvents([opened(source.add())], NOON);
      let now = NOON;
      const outcomes: string[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const counts = await service.tick(now);
        outcomes.push(counts.retried === 1 ? "retried" : counts.failed === 1 ? "failed" : "nothing");
        now += 10 * MIN;
      }
      expect(outcomes).toEqual(["retried", "retried", "retried", "retried", "failed"]);
      expect(outbox.rows[0]).toMatchObject({ status: "failed", attempts: 4, error: "The email service could not be reached: timeout" });
    });

    it("does not try again when it will fail the same way", async () => {
      fake.results = [{ ok: false, transient: false, error: "The email service answered 422: Invalid `to` field." }];
      await service.onAlertEvents([opened(source.add())], NOON);
      expect(await service.tick(NOON)).toMatchObject({ failed: 1, retried: 0 });
      expect(outbox.rows[0]?.status).toBe("failed");
    });

    it("sends nothing more than a limit an hour, so a flapping condition cannot become a flood", async () => {
      for (let index = 0; index < 61; index += 1) {
        await service.onAlertEvents([opened(source.add({ createdAtUtc: new Date(NOON).toISOString() }), NOON + index)], NOON);
      }
      const counts = await service.tick(NOON + 100);
      expect(counts.sent).toBe(60);
      expect(counts.failed).toBe(1);
      expect(outbox.rows.find((row) => row.status === "failed")?.error).toBe("Not sent: this account has already been sent 60 emails in the last hour.");
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
      expect(outbox.rows).toHaveLength(4); // an email and a text for each of the two people
      service = build();
      await service.tick(NOON + 2 * MIN);
      expect(fake.sent).toEqual([]);
      expect(outbox.rows).toHaveLength(4);
    });

    it("is not told about when it is only information, or acknowledged, or resolved", async () => {
      source.add({ severity: "info" });
      source.add({ status: "acknowledged" });
      source.add({ status: "resolved" });
      await service.tick(NOON);
      expect(fake.sent).toEqual([]);
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
      const status = service.status(T1);
      expect(status.email.configured).toBe(false);
      expect(status.words).toEqual([
        "Alert messages are off on this Greecon platform. Alerts show in Greecon, but nobody is sent a message.",
        "Nobody is on the list yet. Add the people who should hear first, in the order they should be told."
      ]);
    });

    it("says what is on, and asks for a test when none has been sent", async () => {
      const status = service.status(T1);
      expect(status).toMatchObject({ contacts: 2, byEmail: 2, bySms: 2, email: { configured: true }, sms: { configured: true } });
      expect(status.words).toEqual(["Email is on.", "Text messages are on.", "No test message has been sent yet. Send one to each person and ask them to confirm it arrived."]);
    });

    it("says when text messages are off that Act now reaches people by email only", async () => {
      service = build({ email: fake.email, problems: [] });
      expect(service.status(T1).words[1]).toBe("Text messages are off, so Act now alerts reach people by email only.");
    });

    it("gives the time of the last test, and asks whether it arrived", async () => {
      const [first] = config.contacts(T1);
      await service.sendTest(T1, first?.id as string, NOON);
      const status = service.status(T1);
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
