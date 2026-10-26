import { AlertPriority, NotificationChannel, NotificationContact, NotificationKind, NotificationSettings, alertPriority } from "@greecon/shared";
import {
  AlertFacts,
  acknowledgedEmail,
  alertEmail,
  alertSms,
  escalationEmail,
  escalationSms,
  resolvedEmail
} from "./messages";

// Deciding who is told what, and when, from something that happened to an alert. Pure: it takes the event,
// the people and the settings, and returns the messages to plan with their times. Sending them, and
// checking at the moment of sending that they are still wanted, is the service's job.
//
// The rules (docs/21-communication-system.md, section 3, and the choices written down in docs/27):
//  - Act now: the first person by email at once and by text 10 minutes later if nobody has acknowledged;
//    then the next person, by email and text, every 30 minutes, until the list ends or someone acknowledges.
//    Quiet hours never delay it.
//  - Check today: the first person who has an email address, once. Quiet hours hold it until they end.
//  - For your information: nobody is messaged. It is in the app and in the morning message.
//  - A condition that clears and returns within the flap window is the same alert and is not paged again.
//  - "Resolved" is only said to people who were told it was urgent, and only after the readings have stayed
//    clear for the flap window, so it never contradicts the next minute.

export const FIRST_SMS_DELAY_MS = 10 * 60_000;
export const ESCALATION_STEP_MS = 30 * 60_000;
/** The same as the alert engine's flap window: a return inside it re-opens the same alert. */
export const RESOLVED_DELAY_MS = 15 * 60_000;
/** A morning message later than this after its time is not sent: it would be an afternoon message. */
export const DIGEST_LATE_AFTER_MS = 3 * 3_600_000;

export interface AlertSummary {
  id: string;
  tenantId: string;
  siteId: string;
  severity: string;
  title: string;
  suggestedAction: string;
  createdAtUtc: string;
  /** When someone last acknowledged it, if anyone has. It stays set when the alert clears and returns. */
  acknowledgedAtUtc?: string;
}

export type AlertEvent =
  | { type: "opened" | "escalated" | "reopened" | "resolved"; atMs: number; alert: AlertSummary; siteName: string }
  | { type: "acknowledged"; atMs: number; alert: AlertSummary; siteName: string; by: string; byEmail?: string };

export interface PlannedMessage {
  alertId?: string;
  contactId?: string;
  contactName: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  priority?: AlertPriority;
  subject?: string;
  body: string;
  dueAtMs: number;
  /** When the alert change behind it happened. */
  eventAtMs?: number;
  dedupeKey: string;
  /** Set for an entry kept in the log only, as not needed, with this reason: what it stands for was told in another message. */
  skipped?: string;
}

/** The identity of one step of a chain: this alert, this round of it, this person, this way of reaching them. */
export function chainKey(alertId: string, generation: number, contactId: string, channel: NotificationChannel): string {
  return `chain:${alertId}:g${generation}:${contactId}:${channel}`;
}

/** Which round a message belongs to, from its key. A key that is not a chain step is round 0. */
export function generationOfKey(dedupeKey: string): number {
  const found = /^chain:[^:]*:g([0-9]+):/.exec(dedupeKey);
  return found ? Number(found[1]) : 0;
}

const RETRY_SUFFIX = /#retry([0-9]+)$/;

/** The key a message was first planned under: a try again of it is keyed `<that>#retry<n>`. */
export function baseKeyOf(dedupeKey: string): string {
  return dedupeKey.replace(RETRY_SUFFIX, "");
}

/** How many times this message has already been tried again. */
export function retryCountOf(dedupeKey: string): number {
  const found = RETRY_SUFFIX.exec(dedupeKey);
  return found ? Number(found[1]) : 0;
}

export function retryKeyOf(dedupeKey: string, retries: number): string {
  return `${baseKeyOf(dedupeKey)}#retry${retries}`;
}

/** One round of messages that was planned for an alert: when it began, and at which priority. */
export interface ChainInfo {
  generation: number;
  priority: AlertPriority;
  startedAtMs: number;
}

/** The round of messages to use for an alert at this priority: the one already there, or a new round after the others. */
export function generationFor(chains: readonly ChainInfo[], priority: AlertPriority): number {
  const same = chains.filter((chain) => chain.priority === priority);
  if (same.length > 0) return Math.max(...same.map((chain) => chain.generation));
  return chains.length > 0 ? Math.max(...chains.map((chain) => chain.generation)) + 1 : 0;
}

/** The newest round, whatever its priority. */
export function latestChain(chains: readonly ChainInfo[]): ChainInfo | undefined {
  return chains.reduce<ChainInfo | undefined>((newest, chain) => (!newest || chain.generation > newest.generation || (chain.generation === newest.generation && chain.startedAtMs > newest.startedAtMs) ? chain : newest), undefined);
}

/** A person who was in fact told about this alert, as the log shows. */
export interface ToldContact {
  contactId: string;
  contactName: string;
  email?: string;
  priority: AlertPriority;
}

export interface PlanContext {
  contacts: readonly NotificationContact[];
  settings: NotificationSettings;
  /** Which round of messages this is for the alert: 0 the first time, one more each time the chain starts again from the
   * first person. A message is keyed on it, so planning the same round twice, from two places, makes no second message. */
  generation?: number;
  /** Where "Open in Greecon" goes, if the platform knows its own web address. */
  link?: string;
  /** For acknowledged and resolved: who has been told so far. */
  told?: readonly ToldContact[];
}

// ---- Quiet hours and the morning message ------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(ms: number, timezone: string): { year: string; month: string; day: string; hour: number; minute: number } {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(ms);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return { year: get("year"), month: get("month"), day: get("day"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

const toMinutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function minutesOfDay(ms: number, timezone: string): number {
  const { hour, minute } = localParts(ms, timezone);
  return hour * 60 + minute;
}

/** "2026-10-19", on the account's own clock. */
export function localDate(ms: number, timezone: string): string {
  const { year, month, day } = localParts(ms, timezone);
  return `${year}-${month}-${day}`;
}

export function inQuietHours(ms: number, settings: NotificationSettings): boolean {
  const from = toMinutes(settings.quietFrom);
  const to = toMinutes(settings.quietTo);
  if (from === to) return false;
  const now = minutesOfDay(ms, settings.timezone);
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** The first minute that is not quiet. Walks forward a minute at a time, so a clock change cannot trip it. */
export function quietHoursEnd(ms: number, settings: NotificationSettings): number {
  if (!inQuietHours(ms, settings)) return ms;
  const start = Math.floor(ms / 60_000) * 60_000;
  for (let minutes = 1; minutes <= 24 * 60; minutes += 1) {
    const candidate = start + minutes * 60_000;
    if (!inQuietHours(candidate, settings)) return candidate;
  }
  return ms;
}

export type DigestWindow = { localDate: string; state: "early" | "due" | "late" };

/** Whether the morning message is due now, not yet, or too late for today. */
export function digestWindow(nowMs: number, settings: NotificationSettings): DigestWindow {
  const minutes = minutesOfDay(nowMs, settings.timezone);
  const at = toMinutes(settings.digestAt);
  const date = localDate(nowMs, settings.timezone);
  if (minutes < at) return { localDate: date, state: "early" };
  return { localDate: date, state: minutes >= at + DIGEST_LATE_AFTER_MS / 60_000 ? "late" : "due" };
}

// ---- Alert events ------------------------------------------------------------------------------------

function factsOf(event: AlertEvent, priority: AlertPriority, settings: NotificationSettings): AlertFacts {
  return {
    title: event.alert.title,
    action: event.alert.suggestedAction,
    siteName: event.siteName,
    priority,
    raisedAtMs: Date.parse(event.alert.createdAtUtc),
    timezone: settings.timezone
  };
}

/** The messages an alert event calls for. */
export function planAlertEvent(event: AlertEvent, context: PlanContext): PlannedMessage[] {
  switch (event.type) {
    case "opened":
    case "escalated":
      return planOpening(event, context);
    case "reopened":
      return []; // The same alert returned inside the flap window: nobody is paged twice for one wobble.
    case "acknowledged":
      return planAcknowledged(event, context);
    case "resolved":
      return planResolved(event, context);
  }
}

function planOpening(event: AlertEvent, context: PlanContext): PlannedMessage[] {
  const priority = alertPriority(event.alert.severity);
  if (priority === "fyi") return [];
  const facts = factsOf(event, priority, context.settings);
  const { contacts, link } = context;
  const generation = context.generation ?? 0;
  const key = (contact: NotificationContact, channel: NotificationChannel) => chainKey(event.alert.id, generation, contact.id, channel);

  if (priority === "check_today") {
    const contact = contacts.find((candidate) => candidate.email !== undefined);
    if (!contact?.email) return [];
    const message = alertEmail(facts, link);
    return [
      {
        alertId: event.alert.id,
        contactId: contact.id,
        contactName: contact.name,
        channel: "email",
        kind: "alert",
        priority,
        subject: message.subject,
        body: message.body,
        dueAtMs: quietHoursEnd(event.atMs, context.settings),
        eventAtMs: event.atMs,
        dedupeKey: key(contact, "email")
      }
    ];
  }

  const planned: PlannedMessage[] = [];
  contacts.forEach((contact, index) => {
    const emailDue = event.atMs + index * ESCALATION_STEP_MS;
    const previous = index > 0 ? { name: contacts[index - 1]?.name ?? "", toldAtMs: event.atMs + (index - 1) * ESCALATION_STEP_MS } : undefined;
    const kind: NotificationKind = previous ? "escalation" : "alert";
    const base = { alertId: event.alert.id, contactId: contact.id, contactName: contact.name, kind, priority, eventAtMs: event.atMs };

    if (contact.email) {
      const message = previous ? escalationEmail(facts, previous, link) : alertEmail(facts, link);
      planned.push({ ...base, channel: "email", subject: message.subject, body: message.body, dueAtMs: emailDue, dedupeKey: key(contact, "email") });
    }
    if (contact.phone) {
      // The first person is texted only if the email has not been answered; someone with no email is texted at once.
      const smsDue = index === 0 && contact.email ? event.atMs + FIRST_SMS_DELAY_MS : emailDue;
      planned.push({
        ...base,
        channel: "sms",
        body: previous ? escalationSms(facts, previous, link) : alertSms(facts, link),
        dueAtMs: smsDue,
        dedupeKey: key(contact, "sms")
      });
    }
  });
  return planned;
}

function planAcknowledged(event: Extract<AlertEvent, { type: "acknowledged" }>, context: PlanContext): PlannedMessage[] {
  const priority = alertPriority(event.alert.severity);
  const facts = factsOf(event, priority, context.settings);
  const planned: PlannedMessage[] = [];
  for (const told of context.told ?? []) {
    if (!told.email) continue;
    if (event.byEmail !== undefined && told.email === event.byEmail) continue; // they know: they pressed it
    const message = acknowledgedEmail(facts, event.by, event.atMs, context.link);
    planned.push({
      alertId: event.alert.id,
      contactId: told.contactId,
      contactName: told.contactName,
      channel: "email",
      kind: "acknowledged",
      priority,
      subject: message.subject,
      body: message.body,
      dueAtMs: event.atMs,
      eventAtMs: event.atMs,
      dedupeKey: `acknowledged:${event.alert.id}:${event.atMs}:${told.contactId}:email`
    });
  }
  return planned;
}

function planResolved(event: AlertEvent, context: PlanContext): PlannedMessage[] {
  const facts = factsOf(event, alertPriority(event.alert.severity), context.settings);
  const planned: PlannedMessage[] = [];
  for (const told of context.told ?? []) {
    if (!told.email || told.priority !== "act_now") continue;
    const message = resolvedEmail(facts, event.atMs, context.link);
    planned.push({
      alertId: event.alert.id,
      contactId: told.contactId,
      contactName: told.contactName,
      channel: "email",
      kind: "resolved",
      priority: told.priority,
      subject: message.subject,
      body: message.body,
      dueAtMs: event.atMs + RESOLVED_DELAY_MS,
      eventAtMs: event.atMs,
      dedupeKey: `resolved:${event.alert.id}:${event.atMs}:${told.contactId}:email`
    });
  }
  return planned;
}
