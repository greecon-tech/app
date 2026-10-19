import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import {
  NotificationChannel,
  NotificationContact,
  NotificationContactInput,
  NotificationKind,
  NotificationLogEntry,
  NotificationSettings,
  NotificationStatusView,
  alertPriority,
  checkContacts,
  checkNotificationSettings,
  maskDestination
} from "@greecon/shared";
import { Channels, NOTIFICATION_CHANNELS } from "./channels";
import { NotificationConfig } from "./config";
import { DigestFacts, digestEmail, testEmail, testSms } from "./messages";
import { OutboxStore, StoredNotification } from "./outbox";
import { AlertEvent, AlertSummary, DIGEST_LATE_AFTER_MS, PlannedMessage, ToldContact, digestWindow, planAlertEvent } from "./plan";

export const OUTBOX_STORE = "OUTBOX_STORE";
export const NOTIFICATION_OPTIONS = "NOTIFICATION_OPTIONS";

/** An alert as it stands now. */
export interface AlertView extends AlertSummary {
  status: "open" | "acknowledged" | "resolved";
  resolvedAtUtc?: string;
}

/** What the platform tells this service. PlatformService is the one implementation; tests use a small fake. */
export interface AlertSource {
  alertById(tenantId: string, alertId: string): AlertView | undefined;
  openAlertsAcrossTenants(): Array<{ alert: AlertView; siteName: string }>;
  tenantNameOf(tenantId: string): string;
  digestOf(tenantId: string, nowMs: number): DigestFacts;
  setAlertListener(listener: ((events: AlertEvent[]) => void) | undefined): void;
}

export interface NotificationOptions {
  /** The address of the web app, for the link in each message (PUBLIC_WEB_URL). */
  webUrl?: string;
  /** How often to look for messages that are due. */
  tickMs?: number;
  /** Send at once when a message is due the moment it is planned. On unless a test wants to drive the rounds itself. */
  autoSend?: boolean;
}

/** What the setup checklist needs to know, without waiting on a database. */
export interface NotificationsSummary {
  emailOn: boolean;
  smsOn: boolean;
  contacts: number;
  byEmail: number;
  bySms: number;
  lastTestAtMs?: number;
}

const DEFAULT_TICK_MS = 30_000;
/** A message claimed this long ago and never finished belongs to a worker that died. */
const STUCK_AFTER_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = [60_000, 120_000, 240_000, 480_000];
/** What one account may be sent in an hour. A condition flapping all day must not become a thousand texts. */
const HOURLY_LIMIT: Record<NotificationChannel, number> = { email: 60, sms: 20 };
const TEST_LIMIT_PER_HOUR = 6;
const BATCH = 25;

const NOT_SET_UP: Record<NotificationChannel, string> = {
  email: "Not sent: email is not set up on this Greecon platform.",
  sms: "Not sent: text messages are not set up on this Greecon platform."
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> | undefined;
  private readonly digestedOn = new Map<string, string>();
  private readonly webUrl: string | undefined;

  constructor(
    @Inject("ALERT_SOURCE") private readonly source: AlertSource,
    private readonly config: NotificationConfig,
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: Channels,
    @Optional() @Inject(NOTIFICATION_OPTIONS) private readonly options: NotificationOptions = {}
  ) {
    this.webUrl = options.webUrl?.replace(/\/+$/, "") || undefined;
  }

  onModuleInit(): void {
    for (const problem of this.channels.problems) this.logger.error(problem);
    if (!this.channels.email && !this.channels.sms) {
      this.logger.warn("Alert messages are OFF: neither email nor text messages are set up (RESEND_API_KEY, TWILIO_*). Alerts show in Greecon and nobody is sent a message.");
    } else {
      this.logger.log(`Alert messages: email ${this.channels.email ? "on" : "off"}, text messages ${this.channels.sms ? "on" : "off"}.`);
    }
    this.source.setAlertListener((events) => this.handle(events));
    this.timer = setInterval(() => void this.tick().catch((error) => this.logger.error(`A round of sending failed: ${describe(error)}`)), this.options.tickMs ?? DEFAULT_TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.source.setAlertListener(undefined);
  }

  // ---- What the platform tells us ---------------------------------------------------------------------

  /** Called as alerts change. Never waits and never throws: telling people must not slow or break reading the site. */
  private handle(events: AlertEvent[]): void {
    void this.onAlertEvents(events).catch((error) => this.logger.error(`Could not plan messages for an alert change: ${describe(error)}`));
  }

  async onAlertEvents(events: readonly AlertEvent[], nowMs: number = Date.now()): Promise<void> {
    const anyDue = await this.planEvents(events, nowMs);
    if (anyDue && this.options.autoSend !== false) void this.tick(nowMs).catch((error) => this.logger.error(`A round of sending failed: ${describe(error)}`));
  }

  /** Plans what the events call for. True if any of it is due now. */
  private async planEvents(events: readonly AlertEvent[], nowMs: number): Promise<boolean> {
    let anyDue = false;
    for (const event of events) {
      const tenantId = event.alert.tenantId;
      const contacts = this.config.contacts(tenantId);
      const told: ToldContact[] = [];
      if (event.type === "acknowledged" || event.type === "resolved") {
        for (const row of await this.outbox.toldAbout(tenantId, event.alert.id)) {
          const contact = contacts.find((candidate) => candidate.id === row.contactId);
          if (contact) told.push({ contactId: contact.id, contactName: contact.name, email: contact.email, priority: row.priority });
        }
      }
      const planned = planAlertEvent(event, { contacts, settings: this.config.settings(tenantId), link: this.link("/alerts"), told });
      if (planned.length === 0) continue;
      await this.outbox.plan(tenantId, planned, nowMs);
      if (planned.some((message) => message.dueAtMs <= nowMs)) anyDue = true;
    }
    return anyDue;
  }

  private link(path: string): string | undefined {
    return this.webUrl ? `${this.webUrl}${path}` : undefined;
  }

  // ---- A round of work ----------------------------------------------------------------------------------

  /** Plans what has been missed, plans the morning messages, and sends what is due. One round at a time. */
  async tick(nowMs: number = Date.now()): Promise<{ sent: number; failed: number; skipped: number; retried: number }> {
    while (this.running) await this.running.catch(() => undefined);
    const round = this.round(nowMs);
    this.running = round;
    try {
      return await round;
    } finally {
      this.running = undefined;
    }
  }

  private async round(nowMs: number): Promise<{ sent: number; failed: number; skipped: number; retried: number }> {
    const counts = { sent: 0, failed: 0, skipped: 0, retried: 0 };
    await this.outbox.recoverStuck(nowMs, STUCK_AFTER_MS);
    await this.planMissed(nowMs);
    await this.planDigests(nowMs);

    for (;;) {
      const batch = await this.outbox.claimDue(nowMs, BATCH);
      if (batch.length === 0) break;
      for (const row of batch) {
        const outcome = await this.deliver(row, nowMs);
        counts[outcome] += 1;
      }
    }
    return counts;
  }

  /** An open alert that has no message at its priority was either planned in a moment that was lost (the process died
   * between the alert changing and the plan being saved), or opened before anyone was on the list. Either way,
   * someone should hear of it now. An alert already planned for is never planned twice, whatever became of its messages. */
  private async planMissed(nowMs: number): Promise<void> {
    for (const { alert, siteName } of this.source.openAlertsAcrossTenants()) {
      if (alert.status !== "open") continue;
      const priority = alertPriority(alert.severity);
      if (priority === "fyi" || this.config.contacts(alert.tenantId).length === 0) continue;
      if (await this.outbox.hasAlertMessages(alert.tenantId, alert.id, priority)) continue;
      await this.planEvents([{ type: "opened", atMs: nowMs, alert, siteName }], nowMs);
    }
  }

  private async planDigests(nowMs: number): Promise<void> {
    for (const tenantId of this.config.tenantsWithContacts()) {
      const settings = this.config.settings(tenantId);
      if (!settings.digestEnabled) continue;
      const window = digestWindow(nowMs, settings);
      if (window.state !== "due" || this.digestedOn.get(tenantId) === window.localDate) continue;
      const recipients = this.config.contacts(tenantId).filter((contact) => contact.email);
      if (recipients.length === 0) continue;

      const message = digestEmail(this.source.digestOf(tenantId, nowMs), nowMs, settings.timezone, settings.digestAt, this.link("/"));
      const planned: PlannedMessage[] = recipients.map((contact) => ({
        contactId: contact.id,
        contactName: contact.name,
        channel: "email",
        kind: "digest",
        subject: message.subject,
        body: message.body,
        dueAtMs: nowMs,
        eventAtMs: nowMs,
        dedupeKey: `digest:${tenantId}:${window.localDate}:${contact.id}`
      }));
      await this.outbox.plan(tenantId, planned, nowMs);
      this.digestedOn.set(tenantId, window.localDate);
    }
  }

  // ---- Sending one message --------------------------------------------------------------------------------

  /** Whether this message has stopped being wanted since it was planned, and why. */
  private noLongerNeeded(row: StoredNotification, nowMs: number): string | undefined {
    switch (row.kind) {
      case "alert":
      case "escalation": {
        const alert = row.alertId ? this.source.alertById(row.tenantId, row.alertId) : undefined;
        if (!alert) return "The alert no longer exists.";
        if (alert.status === "acknowledged") return "Someone acknowledged the alert before this was sent.";
        if (alert.status === "resolved") return "The condition cleared before this was sent.";
        if (alertPriority(alert.severity) !== row.priority) return "The alert changed priority before this was sent.";
        return undefined;
      }
      case "resolved": {
        const alert = row.alertId ? this.source.alertById(row.tenantId, row.alertId) : undefined;
        if (!alert || alert.status !== "resolved" || Date.parse(alert.resolvedAtUtc ?? "") !== row.eventAtMs) return "The condition came back before this was sent.";
        return undefined;
      }
      case "digest": {
        if (!this.config.settings(row.tenantId).digestEnabled) return "The morning message was turned off before this was sent.";
        if (nowMs - row.dueAtMs > DIGEST_LATE_AFTER_MS) return "It was too late in the day to send the morning message.";
        return undefined;
      }
      default:
        return undefined;
    }
  }

  private async deliver(row: StoredNotification, nowMs: number): Promise<"sent" | "failed" | "skipped" | "retried"> {
    const reason = this.noLongerNeeded(row, nowMs);
    if (reason) {
      await this.outbox.markSkipped(row.id, nowMs, reason);
      return "skipped";
    }

    const contact = row.contactId ? this.config.contacts(row.tenantId).find((candidate) => candidate.id === row.contactId) : undefined;
    if (!contact) {
      await this.outbox.markSkipped(row.id, nowMs, `${row.contactName} is no longer on the list.`);
      return "skipped";
    }
    const destination = row.channel === "email" ? contact.email : contact.phone;
    if (!destination) {
      await this.outbox.markSkipped(row.id, nowMs, `${contact.name} no longer has ${row.channel === "email" ? "an email address" : "a phone number"} on the list.`);
      return "skipped";
    }

    const channel = row.channel === "email" ? this.channels.email : this.channels.sms;
    if (!channel) {
      await this.outbox.markFailed(row.id, nowMs, NOT_SET_UP[row.channel], destination);
      this.logger.warn(`A ${row.kind} message to ${row.contactName} could not be sent: ${NOT_SET_UP[row.channel]}`);
      return "failed";
    }

    if (row.kind !== "test" && row.kind !== "digest") {
      const sent = await this.outbox.countSentSince(row.tenantId, row.channel, nowMs - 3_600_000, ["alert", "escalation", "acknowledged", "resolved"]);
      if (sent >= HOURLY_LIMIT[row.channel]) {
        await this.outbox.markFailed(row.id, nowMs, `Not sent: this account has already been sent ${HOURLY_LIMIT[row.channel]} ${row.channel === "email" ? "emails" : "text messages"} in the last hour.`, destination);
        this.logger.warn(`Tenant ${row.tenantId} reached its hourly ${row.channel} limit.`);
        return "failed";
      }
    }

    const result =
      row.channel === "email"
        ? await this.channels.email?.send({ to: destination, subject: row.subject ?? "Greecon", body: row.body, idempotencyKey: row.id })
        : await this.channels.sms?.send({ to: destination, body: row.body });
    if (!result) {
      await this.outbox.markFailed(row.id, nowMs, NOT_SET_UP[row.channel], destination);
      return "failed";
    }
    if (result.ok) {
      await this.outbox.markSent(row.id, nowMs, destination, result.providerId);
      if (row.kind === "test") await this.config.recordTest(row.tenantId, nowMs);
      return "sent";
    }
    if (result.transient && row.attempts + 1 < MAX_ATTEMPTS) {
      const wait = RETRY_DELAY_MS[Math.min(row.attempts, RETRY_DELAY_MS.length - 1)] as number;
      await this.outbox.retryAt(row.id, nowMs + wait, row.attempts + 1, result.error);
      return "retried";
    }
    await this.outbox.markFailed(row.id, nowMs, result.error, destination);
    this.logger.warn(`A ${row.kind} message to ${row.contactName} failed: ${result.error}`);
    return "failed";
  }

  // ---- For the screens ---------------------------------------------------------------------------------------

  summary(tenantId: string): NotificationsSummary {
    const contacts = this.config.contacts(tenantId);
    return {
      emailOn: this.channels.email !== undefined,
      smsOn: this.channels.sms !== undefined,
      contacts: contacts.length,
      byEmail: contacts.filter((contact) => contact.email).length,
      bySms: contacts.filter((contact) => contact.phone).length,
      lastTestAtMs: this.config.lastTestAtMs(tenantId)
    };
  }

  status(tenantId: string): NotificationStatusView {
    const summary = this.summary(tenantId);
    const words: string[] = [];
    if (!summary.emailOn && !summary.smsOn) {
      words.push("Alert messages are off on this Greecon platform. Alerts show in Greecon, but nobody is sent a message.");
    } else {
      words.push(summary.emailOn ? "Email is on." : "Email is off on this Greecon platform.");
      words.push(summary.smsOn ? "Text messages are on." : "Text messages are off, so Act now alerts reach people by email only.");
    }
    if (summary.contacts === 0) {
      words.push("Nobody is on the list yet. Add the people who should hear first, in the order they should be told.");
    } else {
      if (summary.emailOn && summary.byEmail === 0) words.push("Nobody on the list has an email address.");
      if (!summary.emailOn && summary.smsOn && summary.bySms === 0) words.push("Nobody on the list has a phone number.");
      words.push(
        summary.lastTestAtMs
          ? `A test message was last sent on ${new Date(summary.lastTestAtMs).toISOString().slice(0, 16).replace("T", " ")} UTC. Ask the person whether it arrived.`
          : "No test message has been sent yet. Send one to each person and ask them to confirm it arrived."
      );
    }
    return {
      email: { configured: summary.emailOn },
      sms: { configured: summary.smsOn },
      contacts: summary.contacts,
      byEmail: summary.byEmail,
      bySms: summary.bySms,
      ...(summary.lastTestAtMs ? { lastTestAtUtc: new Date(summary.lastTestAtMs).toISOString() } : {}),
      words
    };
  }

  contacts(tenantId: string): NotificationContact[] {
    return this.config.contacts(tenantId);
  }

  async saveContacts(tenantId: string, input: unknown): Promise<NotificationContact[]> {
    const { contacts, problems } = checkContacts(input);
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
    return this.config.setContacts(tenantId, contacts as NotificationContactInput[]);
  }

  settings(tenantId: string): NotificationSettings {
    return this.config.settings(tenantId);
  }

  async saveSettings(tenantId: string, input: unknown): Promise<NotificationSettings> {
    const { settings, problems } = checkNotificationSettings(input, this.config.settings(tenantId));
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
    return this.config.setSettings(tenantId, settings);
  }

  /** Sends a test message to one person on every way it can reach them, now, and says what happened to each. */
  async sendTest(tenantId: string, contactId: string, nowMs: number = Date.now()): Promise<NotificationLogEntry[]> {
    const contact = this.config.contacts(tenantId).find((candidate) => candidate.id === contactId);
    if (!contact) throw new NotFoundException("That person is not on the list.");

    // Each test is up to two messages, one by each way of reaching the person.
    const recentTests = (await this.outbox.recent(tenantId, 100)).filter((row) => row.kind === "test" && nowMs - row.createdAtMs < 3_600_000).length;
    if (recentTests >= TEST_LIMIT_PER_HOUR * 2) {
      throw new HttpException(`Test messages are limited to ${TEST_LIMIT_PER_HOUR} an hour. Try again later.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const customer = this.source.tenantNameOf(tenantId);
    const planned: PlannedMessage[] = [];
    const stamp = nowMs;
    if (contact.email) {
      const message = testEmail(customer, contact.phone !== undefined);
      planned.push({ contactId: contact.id, contactName: contact.name, channel: "email", kind: "test", subject: message.subject, body: message.body, dueAtMs: nowMs, dedupeKey: `test:${contact.id}:email:${stamp}` });
    }
    if (contact.phone) {
      planned.push({ contactId: contact.id, contactName: contact.name, channel: "sms", kind: "test", body: testSms(customer), dueAtMs: nowMs, dedupeKey: `test:${contact.id}:sms:${stamp}` });
    }
    const stored = await this.outbox.plan(tenantId, planned, nowMs);
    await this.tick(nowMs);
    const ids = new Set(stored.map((row) => row.id));
    return (await this.outbox.recent(tenantId, 100)).filter((row) => ids.has(row.id)).map(toLogEntry);
  }

  async log(tenantId: string, limit: number): Promise<NotificationLogEntry[]> {
    return (await this.outbox.recent(tenantId, Math.min(Math.max(limit, 1), 200))).map(toLogEntry);
  }
}

function toLogEntry(row: StoredNotification): NotificationLogEntry {
  return {
    id: row.id,
    createdAtUtc: new Date(row.createdAtMs).toISOString(),
    kind: row.kind as NotificationKind,
    ...(row.priority ? { priority: row.priority } : {}),
    channel: row.channel,
    contactName: row.contactName,
    destination: row.destination ? maskDestination(row.channel, row.destination) : "",
    ...(row.subject ? { subject: row.subject } : {}),
    // "sending" is a moment inside the service; to a person it is still waiting its turn.
    status: row.status === "sending" ? "planned" : row.status,
    dueAtUtc: new Date(row.dueAtMs).toISOString(),
    ...(row.sentAtMs ? { sentAtUtc: new Date(row.sentAtMs).toISOString() } : {}),
    ...(row.error ? { error: row.error } : {}),
    ...(row.alertId ? { alertId: row.alertId } : {})
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

