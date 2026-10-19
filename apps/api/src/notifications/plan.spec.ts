import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationContact, NotificationSettings } from "@greecon/shared";
import {
  AlertEvent,
  AlertSummary,
  ESCALATION_STEP_MS,
  FIRST_SMS_DELAY_MS,
  PlanContext,
  RESOLVED_DELAY_MS,
  digestWindow,
  inQuietHours,
  localDate,
  minutesOfDay,
  planAlertEvent,
  quietHoursEnd
} from "./plan";

// 2026-10-19 is in Europe/Tirane's summer-time period until 25 October: UTC+2.
const at = (iso: string) => Date.parse(iso);
const NOON = at("2026-10-19T10:00:00Z"); // 12:00 in Tirane
const settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
const LINK = "https://app.greecon.example/alerts";

const besa: NotificationContact = { id: "c-besa", name: "Besa", email: "besa@x.example", phone: "+355691111111" };
const arben: NotificationContact = { id: "c-arben", name: "Arben", email: "arben@x.example", phone: "+355692222222" };
const plumber: NotificationContact = { id: "c-plumber", name: "Plumber", phone: "+355693333333" };
const office: NotificationContact = { id: "c-office", name: "Office", email: "office@x.example" };

const alert = (severity: string, overrides: Partial<AlertSummary> = {}): AlertSummary => ({
  id: "a-1",
  tenantId: "t-1",
  siteId: "s-1",
  severity,
  title: severity === "critical" ? "Tank level is critical" : "Tank level is low",
  suggestedAction: severity === "critical" ? "Check the water supply and refill the tank." : "Plan a refill.",
  createdAtUtc: new Date(NOON).toISOString(),
  ...overrides
});

const opened = (severity: string, atMs = NOON): AlertEvent => ({ type: "opened", atMs, alert: alert(severity), siteName: "Hotel Adriatik" });
const context = (contacts: NotificationContact[], extra: Partial<PlanContext> = {}): PlanContext => ({ contacts, settings, link: LINK, ...extra });
const summary = (messages: ReturnType<typeof planAlertEvent>) => messages.map((m) => `${m.contactName} ${m.channel} +${(m.dueAtMs - NOON) / 60_000}min ${m.kind}`);

describe("quiet hours", () => {
  it("knows the account's own clock, not the server's", () => {
    expect(minutesOfDay(at("2026-10-19T10:00:00Z"), "Europe/Tirane")).toBe(12 * 60);
    expect(minutesOfDay(at("2026-10-19T10:00:00Z"), "UTC")).toBe(10 * 60);
    expect(localDate(at("2026-10-19T22:30:00Z"), "Europe/Tirane")).toBe("2026-10-20");
  });

  it("is quiet across midnight, from the start time up to but not including the end time", () => {
    const quiet = (utc: string) => inQuietHours(at(utc), settings);
    expect(quiet("2026-10-19T19:59:00Z")).toBe(false); // 21:59
    expect(quiet("2026-10-19T20:00:00Z")).toBe(true); // 22:00
    expect(quiet("2026-10-20T02:00:00Z")).toBe(true); // 04:00
    expect(quiet("2026-10-20T04:59:00Z")).toBe(true); // 06:59
    expect(quiet("2026-10-20T05:00:00Z")).toBe(false); // 07:00
  });

  it("is quiet inside one day too, and never when the two times are equal", () => {
    const nap = { ...settings, quietFrom: "13:00", quietTo: "15:00" };
    expect(inQuietHours(at("2026-10-19T11:30:00Z"), nap)).toBe(true); // 13:30
    expect(inQuietHours(at("2026-10-19T09:30:00Z"), nap)).toBe(false); // 11:30
    expect(inQuietHours(NOON, { ...settings, quietFrom: "08:00", quietTo: "08:00" })).toBe(false);
  });

  it("ends at the first quiet-free minute", () => {
    expect(quietHoursEnd(at("2026-10-19T22:30:20Z"), settings)).toBe(at("2026-10-20T05:00:00Z"));
    expect(quietHoursEnd(NOON, settings)).toBe(NOON);
  });

  it("follows a clock change rather than assuming 24 hours", () => {
    // Tirane goes from UTC+2 to UTC+1 on 25 October 2026: the quiet night then ends at 06:00 UTC.
    expect(quietHoursEnd(at("2026-10-25T01:00:00Z"), settings)).toBe(at("2026-10-25T06:00:00Z"));
  });
});

describe("the morning message's window", () => {
  const digestAt = (utc: string) => digestWindow(at(utc), settings);

  it("is early before its time, due from it, and late three hours on", () => {
    expect(digestAt("2026-10-19T05:29:00Z")).toEqual({ localDate: "2026-10-19", state: "early" }); // 07:29
    expect(digestAt("2026-10-19T05:30:00Z")).toEqual({ localDate: "2026-10-19", state: "due" }); // 07:30
    expect(digestAt("2026-10-19T08:29:00Z")).toEqual({ localDate: "2026-10-19", state: "due" }); // 10:29
    expect(digestAt("2026-10-19T08:30:00Z")).toEqual({ localDate: "2026-10-19", state: "late" }); // 10:30
  });

  it("belongs to the account's own date", () => {
    expect(digestAt("2026-10-19T22:30:00Z").localDate).toBe("2026-10-20");
  });
});

describe("an Act now alert", () => {
  it("tells the first person by email now and by text ten minutes later, then each next person by both, every half hour", () => {
    const messages = planAlertEvent(opened("critical"), context([besa, arben, office]));
    expect(summary(messages)).toEqual([
      "Besa email +0min alert",
      "Besa sms +10min alert",
      "Arben email +30min escalation",
      "Arben sms +30min escalation",
      "Office email +60min escalation"
    ]);
    expect(FIRST_SMS_DELAY_MS).toBe(10 * 60_000);
    expect(ESCALATION_STEP_MS).toBe(30 * 60_000);
  });

  it("says who was told before, in the escalation, with the time they were told", () => {
    const [, , escalationEmail, escalationSms] = planAlertEvent(opened("critical"), context([besa, arben]));
    expect(escalationEmail?.subject).toBe("Act now, not acknowledged: Tank level is critical, Hotel Adriatik");
    expect(escalationEmail?.body).toContain("Besa was told at 12:00 and has not answered. You are next.");
    expect(escalationSms?.body).toContain("Besa was told 12:00. You are next.");
  });

  it("texts a person who has no email at once, since there is no email to wait for", () => {
    expect(summary(planAlertEvent(opened("critical"), context([plumber, besa])))).toEqual([
      "Plumber sms +0min alert",
      "Besa email +30min escalation",
      "Besa sms +30min escalation"
    ]);
  });

  it("does not text someone who has no phone", () => {
    expect(summary(planAlertEvent(opened("critical"), context([office])))).toEqual(["Office email +0min alert"]);
  });

  it("is not held back by quiet hours", () => {
    const night = at("2026-10-19T23:30:00Z"); // 01:30 in Tirane
    const messages = planAlertEvent(opened("critical", night), context([besa]));
    expect(messages[0]?.dueAtMs).toBe(night);
  });

  it("links to the alert in every message that can carry a link", () => {
    for (const message of planAlertEvent(opened("critical"), context([besa, arben]))) expect(message.body).toContain(LINK);
  });

  it("gives every message its own key, so planning the same event twice makes no second message", () => {
    const keys = planAlertEvent(opened("critical"), context([besa, arben, plumber])).map((message) => message.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(planAlertEvent(opened("critical"), context([besa, arben, plumber])).map((m) => m.dedupeKey)).toEqual(keys);
  });

  it("plans nothing when nobody is on the list", () => {
    expect(planAlertEvent(opened("critical"), context([]))).toEqual([]);
  });

  it("starts again, at the new priority, when an alert gets worse", () => {
    const escalated: AlertEvent = { type: "escalated", atMs: NOON + 3_600_000, alert: alert("critical"), siteName: "Hotel Adriatik" };
    const messages = planAlertEvent(escalated, context([besa]));
    expect(messages.map((m) => `${m.channel} ${m.priority} +${(m.dueAtMs - escalated.atMs) / 60_000}`)).toEqual(["email act_now +0", "sms act_now +10"]);
    expect(messages[0]?.dedupeKey).not.toBe(planAlertEvent(opened("critical"), context([besa]))[0]?.dedupeKey);
  });
});

describe("a Check today alert", () => {
  it("is one email to the first person who has an email address, and no text", () => {
    const messages = planAlertEvent(opened("warning"), context([plumber, besa, arben]));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ contactName: "Besa", channel: "email", priority: "check_today", dueAtMs: NOON });
    expect(messages[0]?.subject).toBe("Check today: Tank level is low, Hotel Adriatik");
  });

  it("waits for quiet hours to end", () => {
    const night = at("2026-10-19T23:30:00Z"); // 01:30
    const [message] = planAlertEvent(opened("warning", night), context([besa]));
    expect(message?.dueAtMs).toBe(at("2026-10-20T05:00:00Z")); // 07:00
  });

  it("plans nothing if nobody on the list has an email address", () => {
    expect(planAlertEvent(opened("warning"), context([plumber]))).toEqual([]);
  });
});

describe("information", () => {
  it("is never pushed", () => {
    expect(planAlertEvent(opened("info"), context([besa, arben]))).toEqual([]);
    expect(planAlertEvent(opened("watch"), context([besa, arben]))).toEqual([]);
  });
});

describe("a condition that comes back", () => {
  it("does not page anyone again, because it is the same alert", () => {
    const reopened: AlertEvent = { type: "reopened", atMs: NOON + 600_000, alert: alert("critical"), siteName: "Hotel Adriatik" };
    expect(planAlertEvent(reopened, context([besa, arben]))).toEqual([]);
  });
});

describe("an acknowledgement", () => {
  const acknowledged = (byEmail?: string): AlertEvent => ({ type: "acknowledged", atMs: NOON + 7 * 60_000, alert: alert("critical"), siteName: "Hotel Adriatik", by: "Besa Krasniqi", byEmail });
  const told = [
    { contactId: besa.id, contactName: "Besa", email: besa.email, priority: "act_now" as const },
    { contactId: arben.id, contactName: "Arben", email: arben.email, priority: "act_now" as const },
    { contactId: plumber.id, contactName: "Plumber", priority: "act_now" as const }
  ];

  it("tells the others who were told, by email, at once, and who it was", () => {
    const messages = planAlertEvent(acknowledged(), context([besa, arben, plumber], { told }));
    expect(messages.map((m) => `${m.contactName} ${m.channel}`)).toEqual(["Besa email", "Arben email"]);
    expect(messages[0]?.body.split("\n")[0]).toBe("Acknowledged by Besa Krasniqi at 12:07. The message will not go on to anyone else.");
    expect(messages.every((m) => m.dueAtMs === NOON + 7 * 60_000)).toBe(true);
  });

  it("does not tell the person who pressed the button", () => {
    const messages = planAlertEvent(acknowledged("besa@x.example"), context([besa, arben], { told }));
    expect(messages.map((m) => m.contactName)).toEqual(["Arben"]);
  });

  it("says nothing when nobody had been told", () => {
    expect(planAlertEvent(acknowledged(), context([besa], { told: [] }))).toEqual([]);
  });
});

describe("an alert that cleared", () => {
  const resolved: AlertEvent = { type: "resolved", atMs: NOON + 20 * 60_000, alert: alert("critical"), siteName: "Hotel Adriatik" };

  it("tells those who were told it was urgent, once the readings have stayed clear for the flap window", () => {
    const told = [{ contactId: besa.id, contactName: "Besa", email: besa.email, priority: "act_now" as const }];
    const [message] = planAlertEvent(resolved, context([besa], { told }));
    expect(message).toMatchObject({ kind: "resolved", channel: "email", contactName: "Besa", dueAtMs: resolved.atMs + RESOLVED_DELAY_MS, eventAtMs: resolved.atMs });
    expect(message?.body).toContain("no longer show it (since 12:20)");
  });

  it("does not tell people about a Check today alert clearing", () => {
    const told = [{ contactId: besa.id, contactName: "Besa", email: besa.email, priority: "check_today" as const }];
    expect(planAlertEvent(resolved, context([besa], { told }))).toEqual([]);
  });

  it("does not tell people who were never told", () => {
    expect(planAlertEvent(resolved, context([besa], { told: [] }))).toEqual([]);
  });
});
