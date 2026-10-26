import { ACCESS_REQUEST_LIMITS, AlertPriority, HEALTH_LABELS, HealthState, alertPriorityWords, describeAge } from "@greecon/shared";
import { oneLine, userText } from "../common/plain-text";

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

// Text that a person typed (a name, a site's name, the words of a request) goes into a message only as one line, without
// control or invisible characters, without a working link, and no longer than these (common/plain-text.ts). An alert's
// title and first step are the platform's own words, and are treated the same way, so nothing depends on where they come from.
const PERSON_MAX = 80;
/** A client, a site or a box. */
const PLACE_MAX = 80;
const TITLE_MAX = 120;
const STEP_MAX = 300;
/** A sentence of a reason or a note, which may hold a name or two. */
const SENTENCE_MAX = 400;

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

/** An alert's title and site, safe to put in a message. */
function safePlace<T extends Pick<AlertFacts, "title" | "siteName">>(facts: T): T {
  return { ...facts, title: userText(facts.title, TITLE_MAX), siteName: userText(facts.siteName, PLACE_MAX) };
}

/** Every piece of text of an alert's facts, safe to put in a message. */
function safeAlert(facts: AlertFacts): AlertFacts {
  return { ...safePlace(facts), action: userText(facts.action, STEP_MAX) };
}

function details(facts: AlertFacts): string[] {
  return [`Site: ${facts.siteName}`, `Raised: ${clockTime(facts.raisedAtMs, facts.timezone)} (${facts.timezone})`, `First step: ${facts.action}`];
}

/** How a person says they have seen an alert: Acknowledge in Greecon, or the link in this message, which needs no sign-in
 * (ack-link.ts). The link goes on a line of its own, with nothing after it that a mail program could take for part of it. */
function acknowledgeLines(seen: string, ack: string | undefined, after?: string): string[] {
  if (!ack) return [`${seen}, press Acknowledge there.${after ? ` ${after}` : ""}`];
  return [`${seen}, press Acknowledge there, or say so with this link, without signing in:`, ack, ...(after ? [after] : [])];
}

/** The text a link in a text message is introduced with, when it is the "I have seen this" link. */
const ACK_SMS = "Acknowledge:";

export function alertEmail(given: AlertFacts, link?: string, ack?: string): Message {
  const facts = safeAlert(given);
  return {
    subject: `${word(facts.priority)}: ${facts.title}, ${facts.siteName}`,
    body: [
      `${word(facts.priority)}: ${facts.title}.`,
      "",
      ...details(facts),
      "",
      ...(link ? [`Open the alert in Greecon: ${link}`] : []),
      ...(facts.priority === "act_now"
        ? acknowledgeLines("When you have seen it and are acting", ack, "That stops the message going on to the next person.")
        : acknowledgeLines("When you have seen it", ack)),
      "",
      SAFETY_LINE
    ].join("\n")
  };
}

/** One link only: the "I have seen this" link when there is one, else the link to the alerts in Greecon. */
export function alertSms(given: AlertFacts, link?: string, ack?: string): string {
  const facts = safeAlert(given);
  return fitSms(`${word(facts.priority)}: ${facts.title}, ${facts.siteName}, ${clockTime(facts.raisedAtMs, facts.timezone)}.`, facts.action, ack ? `${ACK_SMS} ${ack}` : link);
}

export interface PreviousContact {
  name: string;
  toldAtMs: number;
}

/** The person before, with their name safe to put in a message. */
function safePrevious(previous: PreviousContact | undefined): PreviousContact | undefined {
  return previous ? { ...previous, name: userText(previous.name, PERSON_MAX) } : undefined;
}

/** The next person on the list. The person before them is said to have "not answered" only when they were in fact told:
 * a message that failed to reach them, or that was never sent, is not an unanswered one. Without `previous`, the
 * message says only that this person is next. */
export function escalationEmail(given: AlertFacts, before: PreviousContact | undefined, link?: string, ack?: string): Message {
  const facts = safeAlert(given);
  const previous = safePrevious(before);
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
      ...(ack
        ? ["When you are acting, press Acknowledge there, or say so with this link, without signing in:", ack, "Then nobody after you is told."]
        : ["Press Acknowledge there when you are acting, so that nobody after you is told."]),
      "",
      SAFETY_LINE
    ].join("\n")
  };
}

export function escalationSms(given: AlertFacts, before: PreviousContact | undefined, link?: string, ack?: string): string {
  const facts = safeAlert(given);
  const previous = safePrevious(before);
  return fitSms(
    `${word(facts.priority)}, not acknowledged: ${facts.title}, ${facts.siteName}. ${previous ? `${previous.name} was told ${clockTime(previous.toldAtMs, facts.timezone)}. ` : ""}You are next.`,
    facts.action,
    ack ? `${ACK_SMS} ${ack}` : link
  );
}

export function acknowledgedEmail(given: Pick<AlertFacts, "title" | "siteName" | "timezone">, by: string, atMs: number, link?: string): Message {
  const facts = safePlace(given);
  return {
    subject: `Acknowledged: ${facts.title}, ${facts.siteName}`,
    body: [
      `Acknowledged by ${userText(by, PERSON_MAX)} at ${clockTime(atMs, facts.timezone)}. The message will not go on to anyone else.`,
      "",
      `Alert: ${facts.title}`,
      `Site: ${facts.siteName}`,
      ...(link ? ["", `Open it in Greecon: ${link}`] : [])
    ].join("\n")
  };
}

/** Said only after the readings have stayed clear for a while, so it never contradicts the next minute. */
export function resolvedEmail(given: Pick<AlertFacts, "title" | "siteName" | "timezone">, clearedAtMs: number, link?: string): Message {
  const facts = safePlace(given);
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
  // Greecon's own message names each site as "client: site (day N)", so the name may be two places long.
  const name = userText(site.name, 2 * PLACE_MAX + 20);
  if (site.state === "stable") return `${name}: ${label}. ${seen}`;
  const reasons = site.reasons.slice(0, 3).map((given) => {
    const reason = userText(given, SENTENCE_MAX);
    return reason.endsWith(".") ? reason : `${reason}.`;
  });
  return [`${name}: ${label}.`, ...reasons, seen].join(" ");
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
      ...(facts.notes && facts.notes.length > 0 ? ["", ...facts.notes.map((note) => userText(note, SENTENCE_MAX))] : []),
      ...(link ? ["", `Open Greecon: ${link}`] : []),
      "",
      `You get this message each morning at ${at} (${timezone}) for ${userText(facts.customer, PLACE_MAX)}. It can be turned off under Who is told in Greecon.`
    ].join("\n")
  };
}

export function testEmail(given: string, hasPhone: boolean): Message {
  const customer = userText(given, PLACE_MAX);
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
  return smsSafe(`Greecon test message for ${userText(customer, PLACE_MAX)}. If you can read this, Act now alerts reach you by text. Nothing is wrong.`);
}

/** A box at a customer's site that has gone silent, as Greecon's own team is told it. */
export interface SilentBoxFacts {
  client: string;
  site: string;
  box: string;
  /** Its last word: when it went silent. */
  lastSeenAtMs: number;
  lastReadingAtMs?: number;
  /** When the customer's own people were first told, since it went silent, that the site's readings are out of date. */
  customerToldAtMs?: number;
}

/** How many boxes a message about several lists by name; the rest are counted. */
const MOST_BOXES_LISTED = 20;
const TEAM_ONLY = "This message is for Greecon's own team. It is not sent to any customer.";

/** "14:05 on Mon 19 Oct", on the given clock. */
function moment(ms: number, timezone: string): string {
  return `${clockTime(ms, timezone)} on ${shortDate(ms, timezone)}`;
}

function customerWords(box: SilentBoxFacts, timezone: string): string {
  return box.customerToldAtMs === undefined
    ? "No customer message has been sent for this."
    : `The customer's people were told at ${clockTime(box.customerToldAtMs, timezone)} that the site's readings are out of date.`;
}

/** To Greecon's own team, the moment a customer's box goes silent: which client, which site, since when, the last reading, and
 * whether the customer has been told. Several boxes that went silent together are one message, which says what that means. */
export function silentBoxEmail(boxes: readonly SilentBoxFacts[], nowMs: number, timezone: string, link?: string): Message {
  const place = (box: SilentBoxFacts) => `${userText(box.client, PLACE_MAX)}, ${userText(box.site, PLACE_MAX)}`;
  const tail = [...(link ? [`Open Greecon: ${link}`] : []), "", TEAM_ONLY];
  const only = boxes.length === 1 ? boxes[0] : undefined;
  if (only) {
    const since = moment(only.lastSeenAtMs, timezone);
    return {
      subject: `Box silent: ${place(only)}`,
      body: [
        `The box at ${place(only)} has gone silent: it has not reported since ${since} (${timezone}), ${describeAge(Math.max(0, (nowMs - only.lastSeenAtMs) / 1000))} ago.`,
        "",
        `Client: ${userText(only.client, PLACE_MAX)}`,
        `Site: ${userText(only.site, PLACE_MAX)}`,
        `Box: ${userText(only.box, PLACE_MAX)}`,
        `Silent since: ${since} (${timezone})`,
        `Last reading: ${only.lastReadingAtMs === undefined ? "none has arrived yet" : moment(only.lastReadingAtMs, timezone)}`,
        customerWords(only, timezone),
        "",
        "First step: phone the customer before they phone you, and ask whether the power and the internet are on at the site.",
        ...tail
      ].join("\n")
    };
  }
  const first = Math.min(...boxes.map((box) => box.lastSeenAtMs));
  return {
    subject: `${boxes.length} boxes have gone silent at the same time`,
    body: [
      `${boxes.length} boxes have gone silent at the same time, the first at ${moment(first, timezone)} (${timezone}). This looks like Greecon's platform or a provider outage, not ${boxes.length} customers.`,
      "",
      ...boxes.slice(0, MOST_BOXES_LISTED).map((box) => `${place(box)}, box ${userText(box.box, PLACE_MAX)}: silent since ${clockTime(box.lastSeenAtMs, timezone)}. ${customerWords(box, timezone)}`),
      ...(boxes.length > MOST_BOXES_LISTED ? [`And ${boxes.length - MOST_BOXES_LISTED} more.`] : []),
      "",
      "First step: check that Greecon can be reached from outside (the outside uptime check), then whether these sites share an internet provider.",
      ...tail
    ].join("\n")
  };
}

/** A person asking to be set up, as Greecon's own team reads it. */
export function accessRequestEmail(request: { name: string; company: string; email: string; phone?: string; siteTypeLabel: string; message?: string }, link?: string): Message {
  // Everything here was typed by someone on the internet. The address and the number go as they are, on one line: a mail
  // program may make a link of the address, and that is the link the reader wants.
  const company = userText(request.company, ACCESS_REQUEST_LIMITS.company);
  const words = request.message ? userText(request.message, ACCESS_REQUEST_LIMITS.message) : undefined;
  return {
    subject: `New request for access: ${company}`,
    body: [
      `${userText(request.name, ACCESS_REQUEST_LIMITS.name)} of ${company} asked to be set up.`,
      "",
      `Email: ${oneLine(request.email, ACCESS_REQUEST_LIMITS.email)}`,
      `Phone: ${request.phone ? oneLine(request.phone, ACCESS_REQUEST_LIMITS.phone) : "not given"}`,
      `Kind of site: ${request.siteTypeLabel}`,
      ...(words ? ["", "Their words:", words] : []),
      ...(link ? ["", `Open the inbox: ${link}`] : []),
      "",
      "Answer within one working day."
    ].join("\n")
  };
}

/** Once an hour at most, while requests for access arrive faster than real interest does: one message instead of one each. */
export function accessRequestFloodEmail(requestsInTheLastHour: number, emailedEachHour: number, link?: string): Message {
  return {
    subject: "Many requests for access at once: all kept, not emailed one by one",
    body: [
      `${requestsInTheLastHour} requests for access have arrived in the last hour. Greecon emails the first ${emailedEachHour} of an hour one by one; it keeps every one in the inbox, and emails no more of them until the hour is over.`,
      "This may be someone filling in the form by machine. Look through the inbox for the real ones.",
      ...(link ? ["", `Open the inbox: ${link}`] : [])
    ].join("\n")
  };
}
