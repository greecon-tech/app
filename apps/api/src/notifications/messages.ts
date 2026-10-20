import { AlertPriority, HEALTH_LABELS, HealthState, alertPriorityWords, describeAge } from "@greecon/shared";

// The words of every message Greecon sends. They follow docs/21-communication-system.md: the fact, the
// time and the first step, in that order; urgency lives in the priority word and never in adjectives,
// capitals or exclamation marks; nothing is called resolved that the readings have not cleared; nothing
// promises more than "Greecon watches the equipment and tells you". Whole sentences, never fragments
// pasted together, so every one reads the same aloud at 2 a.m.

export interface Message {
  subject?: string;
  body: string;
}

const SAFETY_LINE = "Greecon watches your equipment and tells you. The protection built into your equipment remains the safety layer.";

/** A time on the site's own clock, 24 hours: "14:05". */
export function clockTime(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

/** "Mon 19 Oct", on the site's own clock. */
export function shortDate(ms: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" }).formatToParts(ms);
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** Text a phone can carry in the cheap alphabet: plain letters, digits and punctuation. An "ë" or "ç" would
 * make the whole message cost twice as much and split in two, so names are written without their marks
 * here. (The email carries every name exactly.) */
export function smsSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7e]/gu, "?")
    .replace(/\s+/g, " ")
    .trim();
}

/** The longest text sent as one SMS the customer pays for twice at most. */
const SMS_LIMIT = 300;

/** Fits an SMS: the action goes first if it must, and the link never does. */
function fitSms(lead: string, action: string | undefined, link: string | undefined): string {
  const tail = link ? ` ${link}` : "";
  const full = smsSafe(`${lead}${action ? ` ${action}` : ""}`) + tail;
  if (full.length <= SMS_LIMIT) return full;
  const short = smsSafe(lead) + tail;
  if (short.length <= SMS_LIMIT) return short;
  return `${smsSafe(lead).slice(0, SMS_LIMIT - tail.length - 3)}...${tail}`;
}

export interface AlertFacts {
  title: string;
  /** The first step. */
  action: string;
  siteName: string;
  priority: AlertPriority;
  raisedAtMs: number;
  timezone: string;
}

const word = (priority: AlertPriority): string => alertPriorityWords[priority];

function details(facts: AlertFacts): string[] {
  return [`Site: ${facts.siteName}`, `Raised: ${clockTime(facts.raisedAtMs, facts.timezone)} (${facts.timezone})`, `First step: ${facts.action}`];
}

export function alertEmail(facts: AlertFacts, link?: string): Message {
  return {
    subject: `${word(facts.priority)}: ${facts.title}, ${facts.siteName}`,
    body: [
      `${word(facts.priority)}: ${facts.title}.`,
      "",
      ...details(facts),
      "",
      ...(link ? [`Open the alert in Greecon: ${link}`] : []),
      facts.priority === "act_now"
        ? "When you have seen it and are acting, press Acknowledge there. That stops the message going on to the next person."
        : "When you have seen it, press Acknowledge there.",
      "",
      SAFETY_LINE
    ].join("\n")
  };
}

export function alertSms(facts: AlertFacts, link?: string): string {
  return fitSms(`${word(facts.priority)}: ${facts.title}, ${facts.siteName}, ${clockTime(facts.raisedAtMs, facts.timezone)}.`, facts.action, link);
}

export interface PreviousContact {
  name: string;
  toldAtMs: number;
}

/** The next person on the list. The person before them is said to have "not answered" only when they were in fact told:
 * a message that failed to reach them, or that was never sent, is not an unanswered one. Without `previous`, the
 * message says only that this person is next. */
export function escalationEmail(facts: AlertFacts, previous: PreviousContact | undefined, link?: string): Message {
  const lead = `${word(facts.priority)}, not acknowledged: ${facts.title}.`;
  return {
    subject: `${word(facts.priority)}, not acknowledged: ${facts.title}, ${facts.siteName}`,
    body: [
      lead,
      "",
      previous ? `${previous.name} was told at ${clockTime(previous.toldAtMs, facts.timezone)} and has not answered. You are next.` : "You are next on the list.",
      "",
      ...details(facts),
      "",
      ...(link ? [`Open the alert in Greecon: ${link}`] : []),
      "Press Acknowledge there when you are acting, so that nobody after you is told.",
      "",
      SAFETY_LINE
    ].join("\n")
  };
}

export function escalationSms(facts: AlertFacts, previous: PreviousContact | undefined, link?: string): string {
  return fitSms(
    `${word(facts.priority)}, not acknowledged: ${facts.title}, ${facts.siteName}. ${previous ? `${previous.name} was told ${clockTime(previous.toldAtMs, facts.timezone)}. ` : ""}You are next.`,
    facts.action,
    link
  );
}

export function acknowledgedEmail(facts: Pick<AlertFacts, "title" | "siteName" | "timezone">, by: string, atMs: number, link?: string): Message {
  return {
    subject: `Acknowledged: ${facts.title}, ${facts.siteName}`,
    body: [
      `Acknowledged by ${by} at ${clockTime(atMs, facts.timezone)}. The message will not go on to anyone else.`,
      "",
      `Alert: ${facts.title}`,
      `Site: ${facts.siteName}`,
      ...(link ? ["", `Open it in Greecon: ${link}`] : [])
    ].join("\n")
  };
}

/** Said only after the readings have stayed clear for a while, so it never contradicts the next minute. */
export function resolvedEmail(facts: Pick<AlertFacts, "title" | "siteName" | "timezone">, clearedAtMs: number, link?: string): Message {
  return {
    subject: `Resolved: ${facts.title}, ${facts.siteName}`,
    body: [
      `Resolved: ${facts.title}, ${facts.siteName}.`,
      "",
      `The latest readings no longer show it (since ${clockTime(clearedAtMs, facts.timezone)}). If it comes back, Greecon tells you again.`,
      ...(link ? ["", `Open Greecon: ${link}`] : [])
    ].join("\n")
  };
}

export interface DigestSite {
  name: string;
  state: HealthState;
  /** What is wrong, worst first, one plain sentence each. Empty when the site is stable. */
  reasons: string[];
  lastReadingAtUtc?: string;
}

export interface DigestFacts {
  customer: string;
  sites: DigestSite[];
  /** Whole sentences that go after the sites, for what is true of the account but not of one site. */
  notes?: string[];
}

function siteLine(site: DigestSite, nowMs: number): string {
  const label = HEALTH_LABELS[site.state];
  const seen = site.lastReadingAtUtc ? `Last reading ${describeAge(Math.max(0, (nowMs - Date.parse(site.lastReadingAtUtc)) / 1000))} ago.` : "No readings have arrived yet.";
  if (site.state === "stable") return `${site.name}: ${label}. ${seen}`;
  const reasons = site.reasons.slice(0, 3).map((reason) => (reason.endsWith(".") ? reason : `${reason}.`));
  return [`${site.name}: ${label}.`, ...reasons, seen].join(" ");
}

/** The morning message: the answer to "is everything all right?" first, then each site. */
export function digestEmail(facts: DigestFacts, nowMs: number, timezone: string, at: string, link?: string): Message {
  const worst: HealthState = facts.sites.some((site) => site.state === "action")
    ? "action"
    : facts.sites.some((site) => site.state === "attention")
      ? "attention"
      : facts.sites.some((site) => site.state === "unknown")
        ? "unknown"
        : "stable";
  const sites = facts.sites.length;
  const needing = facts.sites.filter((site) => site.state !== "stable").length;
  const headline =
    sites === 0
      ? "No sites are set up yet."
      : worst === "stable"
        ? `${HEALTH_LABELS.stable}. ${sites === 1 ? "The site is" : `All ${sites} sites are`} reporting and nothing needs doing.`
        : `${HEALTH_LABELS[worst]}. ${needing} of ${sites} ${sites === 1 ? "site needs" : "sites need"} a look.`;
  return {
    subject: `Greecon, ${shortDate(nowMs, timezone)}: ${headline}`,
    body: [
      headline,
      "",
      ...facts.sites.map((site) => siteLine(site, nowMs)),
      ...(facts.notes && facts.notes.length > 0 ? ["", ...facts.notes] : []),
      ...(link ? ["", `Open Greecon: ${link}`] : []),
      "",
      `You get this message each morning at ${at} (${timezone}) for ${facts.customer}. It can be turned off under Who is told in Greecon.`
    ].join("\n")
  };
}

export function testEmail(customer: string, hasPhone: boolean): Message {
  return {
    subject: `Greecon test message for ${customer}`,
    body: [
      `This is a test message from Greecon for ${customer}.`,
      "",
      "If you can read this, Greecon's emails reach you at this address.",
      hasPhone ? "A text message was sent to your phone as well. Act now alerts also go there." : "",
      "",
      "Nothing is wrong and you do not need to do anything. Please tell the person who set this up that it arrived."
    ]
      .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
      .join("\n")
  };
}

export function testSms(customer: string): string {
  return smsSafe(`Greecon test message for ${customer}. If you can read this, Act now alerts reach you by text. Nothing is wrong.`);
}

/** A person asking to be set up, as Greecon's own team reads it. */
export function accessRequestEmail(request: { name: string; company: string; email: string; phone?: string; siteTypeLabel: string; message?: string }, link?: string): Message {
  return {
    subject: `New request for access: ${request.company}`,
    body: [
      `${request.name} of ${request.company} asked to be set up.`,
      "",
      `Email: ${request.email}`,
      `Phone: ${request.phone ?? "not given"}`,
      `Kind of site: ${request.siteTypeLabel}`,
      ...(request.message ? ["", "Their words:", request.message] : []),
      ...(link ? ["", `Open the inbox: ${link}`] : []),
      "",
      "Answer within one working day."
    ].join("\n")
  };
}
