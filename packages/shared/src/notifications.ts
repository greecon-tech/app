// Who is told when something needs a person, and how. A site has a short ordered list of people. The first
// is told first; if an Act now alert is still not acknowledged, the next is told, and so on. Email is the
// channel that always works; SMS is added for Act now because a phone in a pocket is the one thing that
// wakes someone. Both are optional on the platform: when they are not switched on, the screens say so
// instead of implying that alerts reach anyone (docs/21-communication-system.md, section 3).

export const alertPriorities = ["act_now", "check_today", "fyi"] as const;
export type AlertPriority = (typeof alertPriorities)[number];

/** What the person reads: how soon to act, never an engineering severity. */
export const alertPriorityWords: Readonly<Record<AlertPriority, string>> = {
  act_now: "Act now",
  check_today: "Check today",
  fyi: "For your information"
};

/** Critical is Act now, warning is Check today, anything lower is information that is never pushed. */
export function alertPriority(severity: string): AlertPriority {
  if (severity === "critical") return "act_now";
  if (severity === "warning") return "check_today";
  return "fyi";
}

export const notificationChannels = ["email", "sms"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

/** "box_silent" is a message to Greecon's own team, never to a customer: a customer's box has gone silent (or several at
 * once). It is in Greecon's own account's log only. */
export const notificationKinds = ["alert", "escalation", "acknowledged", "resolved", "digest", "test", "box_silent"] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** planned: waiting for its time. sent: the provider accepted it (which is not the same as read).
 * failed: it could not be sent, and why is on the entry. skipped: it was no longer needed. */
export const notificationStatuses = ["planned", "sent", "failed", "skipped"] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export const MAX_NOTIFICATION_CONTACTS = 10;

export interface NotificationContact {
  id: string;
  name: string;
  email?: string;
  /** In international form, +355691234567. */
  phone?: string;
}

export interface NotificationContactInput {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface NotificationSettings {
  /** The clock the quiet hours and the daily message are in, such as Europe/Tirane. */
  timezone: string;
  /** Between these two times only Act now is sent. HH:MM, 24 hours. Equal times mean no quiet hours. */
  quietFrom: string;
  quietTo: string;
  digestEnabled: boolean;
  /** When the daily message goes out, HH:MM in the clock above. */
  digestAt: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: Readonly<NotificationSettings> = {
  timezone: "Europe/Tirane",
  quietFrom: "22:00",
  quietTo: "07:00",
  digestEnabled: true,
  digestAt: "07:30"
};

/** One line of the delivery log: what was sent (or not), to whom, when, and why not. */
export interface NotificationLogEntry {
  id: string;
  createdAtUtc: string;
  kind: NotificationKind;
  priority?: AlertPriority;
  channel: NotificationChannel;
  contactName: string;
  /** Hidden in part: the log is for checking what happened, not for copying addresses. */
  destination: string;
  subject?: string;
  status: NotificationStatus;
  /** When it was, or will be, sent. */
  dueAtUtc: string;
  sentAtUtc?: string;
  /** In words a person can act on. */
  error?: string;
  alertId?: string;
}

export interface NotificationStatusView {
  email: { configured: boolean };
  sms: { configured: boolean };
  contacts: number;
  /** People who can be reached by email, and by SMS. */
  byEmail: number;
  bySms: number;
  /** When a test message was last accepted by the provider for this account. */
  lastTestAtUtc?: string;
  /** What this means, in plain sentences, in the order a person should read them. */
  words: string[];
}

/** "+355 69 123 4567", "00355691234567" and "+355-69-123-4567" are all +355691234567. A number without a
 * country code is refused rather than guessed: an alert sent to the wrong country is worse than none. */
export function normalisePhone(raw: string): string | undefined {
  let digits = raw.trim().replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
}

export function normaliseEmail(raw: string): string | undefined {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/.test(email) ? email : undefined;
}

export function isTimeOfDay(text: unknown): text is string {
  return typeof text === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

export function isTimezone(text: unknown): text is string {
  if (typeof text !== "string" || text.trim() === "" || text.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: text });
    return true;
  } catch {
    return false;
  }
}

/** "b••••@hotel-adriatik.example", "+355 ••• ••• 567". */
export function maskDestination(channel: NotificationChannel, destination: string): string {
  if (channel === "sms") return destination.length > 6 ? `${destination.slice(0, 4)} ••• ••• ${destination.slice(-3)}` : "•••";
  const at = destination.indexOf("@");
  if (at < 1) return "•••";
  return `${destination.slice(0, 1)}••••${destination.slice(at)}`;
}

export interface ContactsCheck {
  contacts: NotificationContactInput[];
  problems: string[];
}

/** What is wrong with a list of people, in words that say what to change, and the list tidied. */
export function checkContacts(input: unknown): ContactsCheck {
  const problems: string[] = [];
  if (!Array.isArray(input)) return { contacts: [], problems: ["Send the people as a list."] };
  if (input.length > MAX_NOTIFICATION_CONTACTS) problems.push(`At most ${MAX_NOTIFICATION_CONTACTS} people can be on the list.`);

  const contacts: NotificationContactInput[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  input.slice(0, MAX_NOTIFICATION_CONTACTS).forEach((entry: unknown, index: number) => {
    const where = `Person ${index + 1}`;
    if (typeof entry !== "object" || entry === null) return void problems.push(`${where} is not a person.`);
    const raw = entry as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim() : "";
    if (name === "" || name.length > 80) problems.push(`${where} needs a name of up to 80 characters.`);

    const emailText = typeof raw.email === "string" ? raw.email.trim() : "";
    const phoneText = typeof raw.phone === "string" ? raw.phone.trim() : "";
    if (emailText === "" && phoneText === "") problems.push(`${name || where} needs an email address or a phone number.`);

    let email: string | undefined;
    if (emailText !== "") {
      email = normaliseEmail(emailText);
      if (!email) problems.push(`${name || where}: "${emailText}" is not an email address.`);
      else if (seenEmails.has(email)) problems.push(`${email} is on the list twice.`);
      else seenEmails.add(email);
    }
    let phone: string | undefined;
    if (phoneText !== "") {
      phone = normalisePhone(phoneText);
      if (!phone) problems.push(`${name || where}: write the phone number with its country code, for example +355 69 123 4567.`);
      else if (seenPhones.has(phone)) problems.push(`${phone} is on the list twice.`);
      else seenPhones.add(phone);
    }
    const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : undefined;
    contacts.push({ ...(id ? { id } : {}), name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) });
  });
  return { contacts, problems };
}

export interface SettingsCheck {
  settings: NotificationSettings;
  problems: string[];
}

/** The settings with anything left out taken from `base`, and what is wrong with what was given. */
export function checkNotificationSettings(input: unknown, base: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS): SettingsCheck {
  const problems: string[] = [];
  if (typeof input !== "object" || input === null) return { settings: { ...base }, problems: ["Send the settings as an object."] };
  const raw = input as Record<string, unknown>;
  const settings: NotificationSettings = { ...base };

  if (raw.timezone !== undefined) {
    if (isTimezone(raw.timezone)) settings.timezone = raw.timezone;
    else problems.push(`"${String(raw.timezone).slice(0, 40)}" is not a time zone. Use a name such as Europe/Tirane.`);
  }
  for (const [key, label] of [["quietFrom", "Quiet hours start"], ["quietTo", "Quiet hours end"], ["digestAt", "The daily message time"]] as const) {
    if (raw[key] === undefined) continue;
    if (isTimeOfDay(raw[key])) settings[key] = raw[key] as string;
    else problems.push(`${label} must be a time such as 07:30, in 24 hours.`);
  }
  if (raw.digestEnabled !== undefined) {
    if (typeof raw.digestEnabled === "boolean") settings.digestEnabled = raw.digestEnabled;
    else problems.push("The daily message is either on or off.");
  }
  return { settings, problems };
}
