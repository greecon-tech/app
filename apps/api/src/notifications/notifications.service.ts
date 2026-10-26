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
import { ACK_LINK_LIFETIME_MS, ackToken } from "./ack-link";
import { AlertFacts, DigestFacts, Message, SilentBoxFacts, alertEmail, alertSms, digestEmail, escalationEmail, escalationSms, silentBoxEmail, testEmail, testSms } from "./messages";
import { ALERT_KINDS, OutboxStore, StoredNotification, UndeliveredAlertMessage } from "./outbox";
import { NEWLY_SILENT_WITHIN_MS, QuietBox, SilenceToTell, isTogetherKey, silenceKey, silenceOfKey, silencesToTell, togetherKey } from "./silent-boxes";
import {
  AlertEvent,
  AlertSummary,
  ChainInfo,
  DIGEST_LATE_AFTER_MS,
  PlanContext,
  PlannedMessage,
  RESOLVED_DELAY_MS,
  ToldContact,
  digestWindow,
  generationFor,
  generationOfKey,
  inQuietHours,
  latestChain,
  planAlertEvent,
  quietHoursEnd,
  retryCountOf,
  retryKeyOf
} from "./plan";

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
  /** Whether the account may be told anything. A suspended customer (one who has left, or stopped paying) is sent
   * nothing: its box is turned away, so it would otherwise be told about a silence nobody can fix. A source with
   * no accounts of its own (a test) leaves this out, which means every account is active. */
  isTenantActive?(tenantId: string): boolean;
  /** Greecon's own account, whose morning message also names the customers whose alert messages are failing to arrive. */
  isOperatorTenant?(tenantId: string): boolean;
  /** When the grace after the platform's own start ends, while it lasts (platform/restart-grace.ts): boxes are still
   * reconnecting, so nothing about missing data is said until then. A source without it has no grace. */
  restartGraceUntil?(nowMs: number): number | undefined;
  /** Boxes at customers' live sites that have stopped reporting, late or silent (silent-boxes.ts). A source without it has none. */
  quietBoxes?(nowMs: number): QuietBox[];
}

export interface NotificationOptions {
  /** The address of the web app, for the link in each message (PUBLIC_WEB_URL). */
  webUrl?: string;
  /** The key that signs the "I have seen this" link in an alert message (ack-link.ts). Without it, or without `webUrl`,
   * messages carry no such link. */
  ackLinkKey?: Buffer;
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
const HOUR_MS = 3_600_000;
/** What one account may be sent in an hour of everything that is not Act now: Check today, and the notes that
 * someone acknowledged an alert or that it cleared. A flood breaker, not a delivery policy: a condition flapping
 * all day must not become a thousand texts. A message past it is dropped, with the reason in the log. */
const HOURLY_LIMIT: Record<NotificationChannel, number> = { email: 60, sms: 20 };
/** The same breaker for Act now, counted on its own so that nothing else can use it up, and far above anything a
 * real site produces. An Act now message past it is never dropped: it is held and sent as soon as the hour allows. */
const ACT_NOW_HOURLY_LIMIT: Record<NotificationChannel, number> = { email: 120, sms: 60 };
/** How long a held Act now message waits before it asks again whether the hour allows it. */
const HOLD_STEP_MS = 2 * 60_000;
/** A step that finds its alert cleared a moment ago waits this long and looks again: the condition may be about to come back. */
const HOLD_WHILE_CLEARED_MS = 60_000;
/** An alert message that could not be delivered is tried again, as a new line in the log, every five minutes for the first
 * twelve tries (an hour), and every half hour after that, for as long as the alert stands unacknowledged: a key or an
 * address can be mended while it is still open. Never more than twelve tries an hour. */
const ALERT_RETRY_FAST_MS = 5 * 60_000;
const ALERT_RETRY_FAST_TRIES = 12;
const ALERT_RETRY_SLOW_MS = 30 * 60_000;
/** A way of sending that is not set up on the platform at all will not mend itself from one try to the next, so it is tried once an
 * hour: setting it up while the alert is still open still reaches the people, and the log does not fill with a line every five minutes. */
const ALERT_RETRY_NOT_SET_UP_MS = HOUR_MS;
/** The team's own message about a silent box that could not be delivered is tried again every five minutes for six hours: a
 * provider that is down, or out of its allowance for the day, must not mean that nobody ever hears of this silence (a silence is
 * told once, and a line in the log, even a failed one, stands for it). A try that falls in the team's quiet hours is held to their
 * end, like the first. After that the morning message and the screens say it. */
const BOX_SILENT_RETRY_MS = 5 * 60_000;
const BOX_SILENT_TRIES = 72;
/** A box on a poor connection can go silent and come back again and again, and each is a new silence. The team is told of the same
 * box this many times in a day; after that it is left to the screens and the morning message, so that one box cannot fill the
 * team's inboxes or use up the email allowance that alert messages share. */
const SILENCES_TOLD_PER_BOX_PER_DAY = 3;
/** How far back the screens look for alert messages that did not arrive. */
const UNDELIVERED_WINDOW_MS = 24 * HOUR_MS;
/** How many people are sent to at once. One person's steps still go in order. */
const SEND_CONCURRENCY = 4;
/** When another platform has the round (a deploy overlapping), skip it, but never more than this many times running. */
const ROUNDS_SKIPPED_AT_MOST = 2;

const CLEARED = "The condition cleared before this was sent.";
const SUSPENDED = "The account is suspended, so nothing is sent for it.";
const STARTED_AGAIN = "The condition came back after someone had acknowledged it, so the messages started again from the first person.";
const BOX_BACK = "The box reported again before this was sent.";
/** How far back in Greecon's own log the lines kept for each box of a message about several are looked for. */
const TOLD_TOGETHER_LOOKBACK = 1_000;

type Outcome = "sent" | "failed" | "skipped" | "retried";
/** Whether a message has stopped being wanted (skip it), or should wait and be looked at again (hold it), at a time of its own when it has one. */
type Verdict = { skip: string } | { hold: string; until?: number } | undefined;
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
  /** One warning in the log for an account and a way of sending, per hour, however many messages are held. */
  private readonly warnedAboutLimit = new Set<string>();
  /** What is being sent right now, per account, way and kind of limit, so that people sent to at once cannot together pass a limit. */
  private readonly sending = new Map<string, number>();
  /** When the team was last told of a silence of each box, for the last day (SILENCES_TOLD_PER_BOX_PER_DAY). */
  private readonly toldAboutBox = new Map<string, number[]>();
  private roundsSkipped = 0;
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

  private isActive(tenantId: string): boolean {
    return this.source.isTenantActive?.(tenantId) ?? true;
  }

  /** Plans what the events call for. True if any of it is due now. One event that cannot be planned never stops the others. */
  private async planEvents(events: readonly AlertEvent[], nowMs: number): Promise<boolean> {
    let anyDue = false;
    for (const event of events) {
      try {
        if (await this.planEvent(event, nowMs)) anyDue = true;
      } catch (error) {
        this.logger.error(`Could not plan messages for an alert change (${event.type}, alert ${event.alert.id}): ${describe(error)}`);
      }
    }
    return anyDue;
  }

  private async planEvent(event: AlertEvent, nowMs: number): Promise<boolean> {
    const tenantId = event.alert.tenantId;
    if (!this.isActive(tenantId)) return false;
    const contacts = this.config.contacts(tenantId);
    const context = { contacts, settings: this.config.settings(tenantId), link: this.link("/alerts") };

    if (event.type === "acknowledged" || event.type === "resolved") {
      const told: ToldContact[] = [];
      for (const row of await this.outbox.toldAbout(tenantId, event.alert.id)) {
        const contact = contacts.find((candidate) => candidate.id === row.contactId);
        if (contact) told.push({ contactId: contact.id, contactName: contact.name, email: contact.email, priority: row.priority });
      }
      return this.planAndCheckDue(tenantId, planAlertEvent(event, { ...context, told }), nowMs);
    }

    const chains = await this.outbox.chains(tenantId, event.alert.id);
    if (event.type === "reopened") {
      const newest = latestChain(chains);
      if (!newest) return false; // nothing was ever planned for it: the next round plans it, as for any open alert
      if (acknowledgedSince(event.alert, newest)) return this.startAgain(event.alert, event.siteName, event.atMs, newest.generation + 1, context, nowMs);
      // The same alert came back inside the flap window: nobody is paged twice, and a step that was dropped as cleared is sent after all.
      const requeued = await this.outbox.requeueSkipped(tenantId, event.alert.id, newest.generation, CLEARED, nowMs, "The condition came back, so this is sent after all.");
      return requeued > 0;
    }

    const generation = generationFor(chains, alertPriority(event.alert.severity));
    return this.planAndCheckDue(tenantId, planAlertEvent(event, { ...context, generation }), nowMs);
  }

  private async planAndCheckDue(tenantId: string, planned: PlannedMessage[], nowMs: number): Promise<boolean> {
    if (planned.length === 0) return false;
    await this.outbox.plan(tenantId, planned, nowMs);
    return planned.some((message) => message.dueAtMs <= nowMs);
  }

  /** A new round of messages for an alert that has come back after someone acknowledged it: they hear of it again, from the first
   * person on, and what was still waiting from the earlier round is dropped, so nobody is told "has not answered" of a person who did. */
  private async startAgain(alert: AlertSummary, siteName: string, atMs: number, generation: number, context: PlanContext, nowMs: number): Promise<boolean> {
    await this.outbox.supersedeBefore(alert.tenantId, alert.id, generation, nowMs, STARTED_AGAIN);
    return this.planAndCheckDue(alert.tenantId, planAlertEvent({ type: "opened", atMs, alert, siteName }, { ...context, generation }), nowMs);
  }

  private link(path: string): string | undefined {
    return this.webUrl ? `${this.webUrl}${path}` : undefined;
  }

  /** The "I have seen this" link for the person this message goes to, working for ACK_LINK_LIFETIME_MS from the moment it is
   * sent. None without the web app's address or a key to sign it with: a message never carries a link that cannot work. */
  private ackLink(row: StoredNotification, nowMs: number): string | undefined {
    const key = this.options.ackLinkKey;
    if (!key || !row.alertId) return undefined;
    const token = ackToken(key, { alertId: row.alertId, tenantId: row.tenantId, contactId: row.contactId }, nowMs + ACK_LINK_LIFETIME_MS);
    return token ? this.link(`/ack/${token}`) : undefined;
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
    // Two platforms starting together (a deploy) must not both work: one takes the round, the other waits for the next. A
    // platform that finds the round taken again and again goes ahead anyway, so a lock that is never let go cannot keep
    // an alert from being sent; a message is still claimed by one platform only.
    let release = await this.outbox.tryLock();
    if (!release) {
      this.roundsSkipped += 1;
      if (this.roundsSkipped <= ROUNDS_SKIPPED_AT_MOST) return counts;
      this.logger.warn(`Another platform has held the round of sending for ${this.roundsSkipped} rounds running; going ahead.`);
      release = async () => undefined;
    }
    this.roundsSkipped = 0;
    try {
      await this.outbox.recoverStuck(nowMs, STUCK_AFTER_MS);
      // Planning must never stand between a due message and its sender: whatever cannot be planned is said in the log and the
      // sending goes on.
      await this.planMissed(nowMs).catch((error) => this.logger.error(`Could not plan the alerts that were missed: ${describe(error)}`));
      await this.planDigests(nowMs).catch((error) => this.logger.error(`Could not plan the morning messages: ${describe(error)}`));
      await this.planSilentBoxes(nowMs).catch((error) => this.logger.error(`Could not plan the messages about silent boxes: ${describe(error)}`));

      for (;;) {
        const batch = await this.outbox.claimDue(nowMs, BATCH);
        if (batch.length === 0) break;
        await this.deliverAll(batch, nowMs, counts);
      }
      return counts;
    } finally {
      await release().catch((error) => this.logger.warn(`Could not let go of the round of sending: ${describe(error)}`));
    }
  }

  /** Sends what was claimed, a few people at a time, so that a provider that hangs on one message does not hold up everyone
   * else's. One person's messages stay in order. */
  private async deliverAll(batch: readonly StoredNotification[], nowMs: number, counts: Record<Outcome, number>): Promise<void> {
    const people = new Map<string, StoredNotification[]>();
    for (const row of batch) {
      const key = `${row.tenantId}:${row.contactId ?? row.contactName}`;
      people.set(key, [...(people.get(key) ?? []), row]);
    }
    const queue = [...people.values()];
    const worker = async (): Promise<void> => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        for (const row of next) counts[await this.deliverSafely(row, nowMs)] += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, queue.length) }, worker));
  }

  /** One message that goes wrong in a way nobody foresaw is put back to be looked at again, and never stops the rest. */
  private async deliverSafely(row: StoredNotification, nowMs: number): Promise<Outcome> {
    try {
      return await this.deliver(row, nowMs);
    } catch (error) {
      this.logger.error(`A ${row.kind} message to ${row.contactName} could not be handled: ${describe(error)}`);
      await this.outbox.retryAt(row.id, nowMs + HOLD_STEP_MS, row.attempts, `Not sent yet: ${describe(error)}`).catch(() => undefined);
      return "retried";
    }
  }

  /** An open alert needs its chain of messages to be whole: what a round would plan for it now, less what is already there.
   * That covers an alert whose plan was lost in a moment that never finished (the process died, the database dropped part
   * way), one that was opened before anyone was on the list, and a person added to the list since. A message that exists
   * counts whatever became of it, so what failed or was dropped is not planned a second time. */
  private async planMissed(nowMs: number): Promise<void> {
    for (const { alert, siteName } of this.source.openAlertsAcrossTenants()) {
      try {
        await this.planMissedFor(alert, siteName, nowMs);
      } catch (error) {
        this.logger.error(`Could not check the messages for alert ${alert.id}: ${describe(error)}`);
      }
    }
  }

  private async planMissedFor(alert: AlertView, siteName: string, nowMs: number): Promise<void> {
    if (alert.status !== "open" || !this.isActive(alert.tenantId)) return;
    const priority = alertPriority(alert.severity);
    const contacts = this.config.contacts(alert.tenantId);
    if (priority === "fyi" || contacts.length === 0) return;

    const chains = await this.outbox.chains(alert.tenantId, alert.id);
    const context = { contacts, settings: this.config.settings(alert.tenantId), link: this.link("/alerts") };
    // That an acknowledged alert has come back is announced once. If the announcement was lost (the platform was restarting, or the
    // database dropped at that moment) the alert itself still says it: open, and acknowledged after its messages began.
    const newest = latestChain(chains);
    if (newest && acknowledgedSince(alert, newest)) {
      await this.startAgain(alert, siteName, nowMs, newest.generation + 1, context, nowMs);
      return;
    }
    const generation = generationFor(chains, priority);
    const began = chains.find((chain) => chain.generation === generation && chain.priority === priority)?.startedAtMs ?? nowMs;
    // The steps are timed from when the round began, not from now, so a step that was lost keeps its place in the order.
    const owed = planAlertEvent({ type: "opened", atMs: began, alert, siteName }, { ...context, generation });
    if (owed.length === 0) return;
    const there = await this.outbox.existingKeys(alert.tenantId, owed.map((message) => message.dedupeKey));
    const missing = owed.filter((message) => !there.has(message.dedupeKey));
    if (missing.length > 0) await this.outbox.plan(alert.tenantId, missing, nowMs);
  }

  private async planDigests(nowMs: number): Promise<void> {
    // A morning message due just after the platform started waits for the grace to end (it may be sent up to three hours
    // late), so that it reports boxes that have had their chance to reconnect, not ones that are still reconnecting.
    if (this.source.restartGraceUntil?.(nowMs) !== undefined) return;
    for (const tenantId of this.config.tenantsWithContacts()) {
      try {
        await this.planDigestFor(tenantId, nowMs);
      } catch (error) {
        this.logger.error(`Could not plan the morning message for account ${tenantId}: ${describe(error)}`);
      }
    }
  }

  private async planDigestFor(tenantId: string, nowMs: number): Promise<void> {
    if (!this.isActive(tenantId)) return;
    const settings = this.config.settings(tenantId);
    if (!settings.digestEnabled) return;
    const window = digestWindow(nowMs, settings);
    if (window.state !== "due" || this.digestedOn.get(tenantId) === window.localDate) return;
    const recipients = this.config.contacts(tenantId).filter((contact) => contact.email);
    if (recipients.length === 0) return;

    const facts = this.source.digestOf(tenantId, nowMs);
    // Greecon's own account is also told which customers' alert messages are not arriving: its own team can do something about it.
    const failing = this.source.isOperatorTenant?.(tenantId) ? (await this.outbox.undeliveredAlertMessages(nowMs - UNDELIVERED_WINDOW_MS)).filter(failedToArrive) : [];
    const notes = [...(facts.notes ?? []), ...this.deliveryNotes(failing)];
    const message = digestEmail({ ...facts, ...(notes.length > 0 ? { notes } : {}) }, nowMs, settings.timezone, settings.digestAt, this.link("/"));
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

  /** Greecon's own account, when it has anyone on its list: the people who are told when a customer's box goes silent. */
  private teamAccount(): string | undefined {
    return this.config.tenantsWithContacts().find((tenantId) => this.source.isOperatorTenant?.(tenantId) === true && this.isActive(tenantId));
  }

  /** Tells Greecon's own team, at once, of each customer's box that has newly gone silent (silent-boxes.ts): the people on
   * Greecon's own list who have an email address, the same who get its morning message, and never a customer's. Each silence
   * once, whatever restarts in between: its last word names it, and a line is kept in the log under that name. Several that
   * went silent together are one message. Held through the team's quiet hours, like everything that is not Act now. */
  private async planSilentBoxes(nowMs: number): Promise<void> {
    const team = this.teamAccount();
    if (!team || !this.source.quietBoxes) return;
    const recipients = this.config.contacts(team).filter((contact) => contact.email);
    if (recipients.length === 0) return;
    const quiet = this.source.quietBoxes(nowMs);
    const newly = quiet.filter((box) => box.status === "offline" && nowMs - Date.parse(box.lastSeenUtc) <= NEWLY_SILENT_WITHIN_MS);
    if (newly.length === 0) return;
    const told = await this.outbox.existingKeys(team, newly.map(silenceKey));
    const settings = this.config.settings(team);
    const planned: PlannedMessage[] = [];
    const untold = newly.filter((box) => !told.has(silenceKey(box)) && this.mayTellAboutBox(box.gatewayId, nowMs));
    for (const telling of silencesToTell(untold, quiet, nowMs)) {
      planned.push(...(await this.silenceMessages(telling, recipients, settings.timezone, quietHoursEnd(nowMs, settings), nowMs)));
      for (const box of telling.boxes) this.toldAboutBox.set(box.gatewayId, [...(this.toldAboutBox.get(box.gatewayId) ?? []), nowMs]);
    }
    if (planned.length > 0) await this.outbox.plan(team, planned, nowMs);
  }

  /** Whether the team may still be told today of another silence of this box (SILENCES_TOLD_PER_BOX_PER_DAY). Kept in memory:
   * after a restart a box that flaps is told of a few more times, and no silence is ever told twice (the log keeps those). */
  private mayTellAboutBox(gatewayId: string, nowMs: number): boolean {
    const recent = (this.toldAboutBox.get(gatewayId) ?? []).filter((at) => nowMs - at < 24 * HOUR_MS);
    if (recent.length === 0) this.toldAboutBox.delete(gatewayId);
    else this.toldAboutBox.set(gatewayId, recent);
    return recent.length < SILENCES_TOLD_PER_BOX_PER_DAY;
  }

  /** The messages for one telling. The first person's message about a single box is keyed by the silence itself, so that it
   * stands for it in the log; a message about several keeps, for each box, a line in the log keyed by its silence, saying it
   * was told together with the others. */
  private async silenceMessages(telling: SilenceToTell, recipients: readonly NotificationContact[], timezone: string, dueAtMs: number, nowMs: number): Promise<PlannedMessage[]> {
    const link = this.link("/today");
    const first = telling.boxes[0] as QuietBox;
    const words = silentBoxEmail(await this.silentBoxFacts(telling.boxes), nowMs, timezone, link);
    const message = (contact: NotificationContact, dedupeKey: string, said: Message = words, skipped?: string): PlannedMessage => ({
      contactId: contact.id,
      contactName: contact.name,
      channel: "email",
      kind: "box_silent",
      subject: said.subject,
      body: said.body,
      dueAtMs,
      eventAtMs: Date.parse(first.lastSeenUtc),
      dedupeKey,
      ...(skipped ? { skipped } : {})
    });
    if (!telling.together) return recipients.map((contact, index) => message(contact, index === 0 ? silenceKey(first) : `${silenceKey(first)}:${contact.id}`));
    const lead = recipients[0] as NotificationContact;
    const lines: PlannedMessage[] = [];
    for (const box of telling.boxes) {
      const alone = silentBoxEmail(await this.silentBoxFacts([box]), nowMs, timezone, link);
      lines.push(message(lead, silenceKey(box), alone, `Told in one message about the ${telling.boxes.length} boxes that went silent at the same time.`));
    }
    return [...recipients.map((contact) => message(contact, togetherKey(first, contact.id))), ...lines];
  }

  /** What the team is told of these boxes, as things stand: each box's last word and the site's last reading, and whether the
   * customer's own people have been told, since it went silent, that the site's readings are out of date. */
  private async silentBoxFacts(boxes: readonly QuietBox[]): Promise<SilentBoxFacts[]> {
    const facts: SilentBoxFacts[] = [];
    for (const box of boxes) {
      const lastSeenAtMs = Date.parse(box.lastSeenUtc);
      let customerToldAtMs: number | undefined;
      for (const alertId of box.outOfDateAlertIds) {
        for (const told of await this.outbox.toldAbout(box.tenantId, alertId)) {
          if (told.toldAtMs !== undefined && told.toldAtMs >= lastSeenAtMs) customerToldAtMs = Math.min(customerToldAtMs ?? told.toldAtMs, told.toldAtMs);
        }
      }
      facts.push({
        client: box.client,
        site: box.site,
        box: box.box,
        lastSeenAtMs,
        ...(box.lastReadingAtUtc ? { lastReadingAtMs: Date.parse(box.lastReadingAtUtc) } : {}),
        ...(customerToldAtMs !== undefined ? { customerToldAtMs } : {})
      });
    }
    return facts;
  }

  /** A message to the team about silent boxes, as they stand now: about those of its boxes that are still silent, and undefined
   * once every one of them has reported again. */
  private async silenceAsItStands(row: StoredNotification, nowMs: number): Promise<Message | undefined> {
    const about = isTogetherKey(row.dedupeKey) ? await this.boxesToldTogether(row) : [silenceOfKey(row.dedupeKey)];
    const still = (this.source.quietBoxes?.(nowMs) ?? []).filter((box) =>
      about.some((silence) => silence !== undefined && silence.gatewayId === box.gatewayId && silence.lastSeenMs === Date.parse(box.lastSeenUtc))
    );
    if (still.length === 0) return undefined;
    return silentBoxEmail(await this.silentBoxFacts(still), nowMs, this.config.settings(row.tenantId).timezone, this.link("/today"));
  }

  /** The boxes a message about several is about: the lines kept for each of them, planned in the same moment and named after the same first box. */
  private async boxesToldTogether(row: StoredNotification): Promise<Array<{ gatewayId: string; lastSeenMs: number } | undefined>> {
    const log = await this.outbox.recent(row.tenantId, TOLD_TOGETHER_LOOKBACK);
    return log
      .filter((entry) => entry.kind === "box_silent" && entry.status === "skipped" && entry.createdAtMs === row.createdAtMs && entry.eventAtMs === row.eventAtMs && !isTogetherKey(entry.dedupeKey))
      .map((entry) => silenceOfKey(entry.dedupeKey));
  }

  /** One sentence per customer whose alert messages did not arrive, for the morning message of Greecon's own account. */
  private deliveryNotes(failing: readonly UndeliveredAlertMessage[]): string[] {
    const alertsStillOpen = failing.filter((message) => message.alertId && this.source.alertById(message.tenantId, message.alertId)?.status === "open");
    const byCustomer = new Map<string, UndeliveredAlertMessage[]>();
    for (const message of alertsStillOpen) byCustomer.set(message.tenantId, [...(byCustomer.get(message.tenantId) ?? []), message]);
    return [...byCustomer.entries()].map(([tenantId, messages]) => {
      const last = [...messages].sort((a, b) => b.atMs - a.atMs)[0] as UndeliveredAlertMessage;
      return `${this.source.tenantNameOf(tenantId) || "A customer"}: ${messages.length} alert ${messages.length === 1 ? "message" : "messages"} could not be delivered, the last because: ${last.error}`;
    });
  }

  // ---- Sending one message --------------------------------------------------------------------------------

  /** Whether this message has stopped being wanted since it was planned, and why: to be dropped, or to wait and be looked at again. */
  private noLongerNeeded(row: StoredNotification, nowMs: number): Verdict {
    if (!this.isActive(row.tenantId)) return { skip: SUSPENDED };
    switch (row.kind) {
      case "alert":
      case "escalation": {
        const alert = row.alertId ? this.source.alertById(row.tenantId, row.alertId) : undefined;
        if (!alert) return { skip: "The alert no longer exists." };
        if (alert.status === "acknowledged") return { skip: "Someone acknowledged the alert before this was sent." };
        if (alert.status === "resolved") {
          // A condition that clears and returns inside the flap window is the same alert, and nobody has yet been told about it
          // as they should be: a step that falls due in that gap waits, and is dropped as cleared only once the window has passed.
          const clearedAtMs = Date.parse(alert.resolvedAtUtc ?? "");
          if (Number.isFinite(clearedAtMs) && nowMs - clearedAtMs < RESOLVED_DELAY_MS) return { hold: "Held: the condition cleared a moment ago and may come back. This is sent if it does." };
          return { skip: CLEARED };
        }
        if (alertPriority(alert.severity) !== row.priority) return { skip: "The alert changed priority before this was sent." };
        // Check today is held through the quiet hours whatever delayed it to this moment (a platform that was down until the
        // evening, a database that dropped, a try again): it is kept where it is sent, not only where it is planned.
        if (row.kind === "alert" && row.priority === "check_today") {
          const settings = this.config.settings(row.tenantId);
          if (inQuietHours(nowMs, settings)) return { hold: "Held until the quiet hours end.", until: quietHoursEnd(nowMs, settings) };
        }
        return undefined;
      }
      case "resolved": {
        const alert = row.alertId ? this.source.alertById(row.tenantId, row.alertId) : undefined;
        if (!alert || alert.status !== "resolved" || Date.parse(alert.resolvedAtUtc ?? "") !== row.eventAtMs) return { skip: "The condition came back before this was sent." };
        return undefined;
      }
      case "digest": {
        if (!this.config.settings(row.tenantId).digestEnabled) return { skip: "The morning message was turned off before this was sent." };
        if (nowMs - row.dueAtMs > DIGEST_LATE_AFTER_MS) return { skip: "It was too late in the day to send the morning message." };
        return undefined;
      }
      case "box_silent": {
        // Right after a start the platform cannot tell a box that is reconnecting from a silent one: it waits to see. And a
        // message to the team is held through its quiet hours, wherever it was delayed, like everything that is not Act now.
        const graceUntil = this.source.restartGraceUntil?.(nowMs);
        if (graceUntil !== undefined) return { hold: "Held: Greecon was just restarted, and boxes are reconnecting.", until: graceUntil };
        const settings = this.config.settings(row.tenantId);
        if (inQuietHours(nowMs, settings)) return { hold: "Held until the quiet hours end.", until: quietHoursEnd(nowMs, settings) };
        return undefined;
      }
      default:
        return undefined;
    }
  }

  private async deliver(row: StoredNotification, nowMs: number): Promise<Outcome> {
    const verdict = this.noLongerNeeded(row, nowMs);
    if (verdict && "skip" in verdict) {
      await this.outbox.markSkipped(row.id, nowMs, verdict.skip);
      return "skipped";
    }
    if (verdict && "hold" in verdict) {
      await this.outbox.retryAt(row.id, verdict.until ?? nowMs + HOLD_WHILE_CLEARED_MS, row.attempts, verdict.hold);
      return "retried";
    }
    // A message to the team about silent boxes says how they stand now, and is not sent once every one has reported again.
    const silence = row.kind === "box_silent" ? await this.silenceAsItStands(row, nowMs) : undefined;
    if (row.kind === "box_silent" && !silence) {
      await this.outbox.markSkipped(row.id, nowMs, BOX_BACK);
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
      this.logger.warn(`A ${row.kind} message to ${row.contactName} could not be sent: ${NOT_SET_UP[row.channel]}`);
      return this.failed(row, nowMs, NOT_SET_UP[row.channel], destination, false);
    }

    // Tests, the morning message and the team's own messages about silent boxes (one for each silence, many as one) are not
    // what the hourly limits are for: a flood of a customer's alert messages.
    const counted = row.kind !== "test" && row.kind !== "digest" && row.kind !== "box_silent";
    const actNow = isActNow(row);
    const reservation = `${row.tenantId}:${row.channel}:${actNow}`;
    if (counted) {
      const sent = (await this.sentInTheLastHour(row, actNow, nowMs)) + (this.sending.get(reservation) ?? 0);
      const limit = (actNow ? ACT_NOW_HOURLY_LIMIT : HOURLY_LIMIT)[row.channel];
      if (sent >= limit) {
        const what = row.channel === "email" ? "emails" : "text messages";
        const window = `${new Date(nowMs).toISOString().slice(0, 13)}:${reservation}`;
        if (!this.warnedAboutLimit.has(window)) {
          this.warnedAboutLimit.add(window);
          if (this.warnedAboutLimit.size > 1_000) this.warnedAboutLimit.clear();
          this.logger.warn(`Tenant ${row.tenantId} reached its hourly ${row.channel} limit${actNow ? " for Act now messages, which are held, not dropped" : ""}.`);
        }
        if (actNow) {
          // Someone must still be told: it waits, without using up its tries, and asks again shortly.
          await this.outbox.retryAt(row.id, nowMs + HOLD_STEP_MS, row.attempts, `Held: this account has already been sent ${limit} Act now ${what} in the last hour. It is sent as soon as the hour allows.`);
          return "retried";
        }
        await this.outbox.markFailed(row.id, nowMs, `Not sent: this account has already been sent ${limit} ${what} in the last hour.`, destination);
        return "failed";
      }
      this.sending.set(reservation, (this.sending.get(reservation) ?? 0) + 1);
    }

    try {
      // The words of an alert message are said as things stand now, not as they were when it was planned: an escalation says
      // who was told before this person and has not answered, and each carries an "I have seen this" link made for this
      // person at this moment, so a message tried again days later does not carry a link that has stopped working.
      // The first message about an alert never waits on that: if the alert cannot be looked at now, it goes as it was planned.
      const words =
        row.kind === "escalation" ? await this.alertAsItStands(row, nowMs) : row.kind === "alert" ? await this.alertAsItStands(row, nowMs).catch(() => undefined) : silence;
      const subject = words?.subject ?? row.subject ?? "Greecon";
      const body = words?.body ?? row.body;
      const result =
        row.channel === "email"
          ? await this.channels.email?.send({ to: destination, subject, body, idempotencyKey: row.id })
          : await this.channels.sms?.send({ to: destination, body });
      if (!result) return await this.failed(row, nowMs, NOT_SET_UP[row.channel], destination, false);
      if (result.ok) {
        await this.outbox.markSent(row.id, nowMs, destination, result.providerId);
        if (row.kind === "test") await this.config.recordTest(row.tenantId, nowMs);
        return "sent";
      }
      return await this.failed(row, nowMs, result.error, destination, result.transient);
    } finally {
      if (counted) this.sending.set(reservation, Math.max(0, (this.sending.get(reservation) ?? 1) - 1));
    }
  }

  /** What follows a message that did not go. An alert or escalation is never given up while its alert stands: the failure
   * stays in the log as a line of its own, with its reason, and the same message is planned again for a few minutes on, because
   * a key, an address or the provider can be mended while the alert is still open. Everything else is tried a few times
   * (when the trouble may pass) and then left as failed. */
  private async failed(row: StoredNotification, nowMs: number, error: string, destination: string, transient: boolean): Promise<Outcome> {
    if (row.kind === "alert" || row.kind === "escalation") {
      // The next try is saved before the failure is written down. A database that drops between the two then leaves, at worst, a
      // message that is sent twice; written the other way round, it would leave one that nobody ever tries again.
      const verdict = this.noLongerNeeded(row, nowMs);
      if (!(verdict && "skip" in verdict)) {
        const tries = retryCountOf(row.dedupeKey) + 1;
        await this.outbox.plan(
          row.tenantId,
          [
            {
              alertId: row.alertId,
              contactId: row.contactId,
              contactName: row.contactName,
              channel: row.channel,
              kind: row.kind,
              priority: row.priority,
              subject: row.subject,
              body: row.body,
              dueAtMs: this.nextTryAt(row, nowMs, tries, error),
              eventAtMs: row.eventAtMs,
              dedupeKey: retryKeyOf(row.dedupeKey, tries)
            }
          ],
          nowMs
        );
      }
      await this.outbox.markFailed(row.id, nowMs, error, destination);
      this.logger.warn(`A ${row.kind} message to ${row.contactName} failed: ${error}`);
      return "failed";
    }
    if (row.kind === "box_silent" && row.attempts + 1 < BOX_SILENT_TRIES && (transient || error === NOT_SET_UP[row.channel])) {
      await this.outbox.retryAt(row.id, nowMs + BOX_SILENT_RETRY_MS, row.attempts + 1, error);
      return "retried";
    }
    if (transient && row.attempts + 1 < MAX_ATTEMPTS) {
      const wait = RETRY_DELAY_MS[Math.min(row.attempts, RETRY_DELAY_MS.length - 1)] as number;
      await this.outbox.retryAt(row.id, nowMs + wait, row.attempts + 1, error);
      return "retried";
    }
    await this.outbox.markFailed(row.id, nowMs, error, destination);
    if (row.channel && error !== NOT_SET_UP[row.channel]) this.logger.warn(`A ${row.kind} message to ${row.contactName} failed: ${error}`);
    return "failed";
  }

  /** When an alert message that did not go is tried again: soon, then less often, and once an hour for a way of sending that is not
   * set up at all. Only Act now ignores the quiet hours: a Check today email whose tries run into them waits for the morning. */
  private nextTryAt(row: StoredNotification, nowMs: number, tries: number, error: string): number {
    const wait = error === NOT_SET_UP[row.channel] ? ALERT_RETRY_NOT_SET_UP_MS : tries < ALERT_RETRY_FAST_TRIES ? ALERT_RETRY_FAST_MS : ALERT_RETRY_SLOW_MS;
    const at = nowMs + wait;
    return row.priority === "check_today" ? quietHoursEnd(at, this.config.settings(row.tenantId)) : at;
  }

  /** An alert message, or a step of its escalation, as it stands when it is sent, with the "I have seen this" link for its
   * person. Whoever is before this person on the list is said to have been told, and not to have answered, only if they were
   * told: a first person whose messages failed, or were dropped, is not an unanswered one. */
  private async alertAsItStands(row: StoredNotification, nowMs: number): Promise<{ subject?: string; body: string } | undefined> {
    const alertId = row.alertId;
    const alert = alertId ? this.source.alertById(row.tenantId, alertId) : undefined;
    if (!alert || !alertId) return undefined;
    const siteName = this.source.openAlertsAcrossTenants().find((candidate) => candidate.alert.id === alertId)?.siteName;
    if (!siteName) return undefined;
    const facts: AlertFacts = {
      title: alert.title,
      action: alert.suggestedAction,
      siteName,
      priority: row.kind === "escalation" ? "act_now" : (row.priority ?? alertPriority(alert.severity)),
      raisedAtMs: Date.parse(alert.createdAtUtc),
      timezone: this.config.settings(row.tenantId).timezone
    };
    const link = this.link("/alerts");
    const ack = this.ackLink(row, nowMs);
    if (row.kind === "alert") return row.channel === "email" ? alertEmail(facts, link, ack) : { body: alertSms(facts, link, ack) };

    const contacts = this.config.contacts(row.tenantId);
    const index = contacts.findIndex((candidate) => candidate.id === row.contactId);
    const before = index > 0 ? contacts[index - 1] : undefined;
    // Told in this round of messages: a person who acknowledged an earlier round and was told again is not "told at" the first time.
    // Nobody before this person on the list now (the list changed since): nobody is said to have been told.
    const told = before ? (await this.outbox.toldAbout(row.tenantId, alertId, generationOfKey(row.dedupeKey))).find((candidate) => candidate.contactId === before.id && candidate.priority === "act_now") : undefined;
    const previous = before && told?.toldAtMs !== undefined ? { name: before.name, toldAtMs: told.toldAtMs } : undefined;
    return row.channel === "email" ? escalationEmail(facts, previous, link, ack) : { body: escalationSms(facts, previous, link, ack) };
  }

  /** What this account has been sent through this channel in the last hour that counts against the same limit as this
   * message: Act now against Act now, and everything else (Check today, acknowledged, resolved) against each other, so
   * that a run of notes can never use up what an urgent message needs. */
  private async sentInTheLastHour(row: StoredNotification, actNow: boolean, nowMs: number): Promise<number> {
    const since = nowMs - HOUR_MS;
    const urgent = await this.outbox.countSentSince(row.tenantId, row.channel, since, ALERT_KINDS, "act_now");
    if (actNow) return urgent;
    const all = await this.outbox.countSentSince(row.tenantId, row.channel, since, [...ALERT_KINDS, "acknowledged", "resolved"]);
    return all - urgent;
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

  async status(tenantId: string, nowMs: number = Date.now()): Promise<NotificationStatusView> {
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
    // Alert messages that did not arrive are said here, so that a screen cannot show a tidy list while the people on it hear nothing.
    const undelivered = await this.undeliveredFor(tenantId, nowMs);
    const latest = [...undelivered].sort((a, b) => b.atMs - a.atMs)[0];
    if (latest) {
      words.push(`${undelivered.length} alert ${undelivered.length === 1 ? "message" : "messages"} could not be delivered, the last because: ${latest.error} Greecon keeps trying while the alert is open.`);
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

  /** The alert messages of this account that did not arrive and whose alert is still open. */
  private async undeliveredFor(tenantId: string, nowMs: number): Promise<UndeliveredAlertMessage[]> {
    const found = await this.outbox.undeliveredAlertMessages(nowMs - UNDELIVERED_WINDOW_MS, tenantId);
    return found.filter(failedToArrive).filter((message) => message.alertId !== undefined && this.source.alertById(tenantId, message.alertId)?.status === "open");
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

/** A message that was refused, or that the provider could not take: a failure to put right. A way of sending the platform has not set up at all is
 * not that. It is in the log as not sent, and the screen says once that it is off; calling every Act now alert on an email-only platform "a message
 * that could not be delivered" would alarm people about a choice nobody has made a mistake in. */
function failedToArrive(message: UndeliveredAlertMessage): boolean {
  return message.error !== NOT_SET_UP.email && message.error !== NOT_SET_UP.sms;
}

/** Whether someone acknowledged the alert after its newest round of messages began. Open again, that means it has come back. */
function acknowledgedSince(alert: AlertSummary, round: ChainInfo): boolean {
  const acknowledgedAtMs = Date.parse(alert.acknowledgedAtUtc ?? "");
  return Number.isFinite(acknowledgedAtMs) && acknowledgedAtMs > round.startedAtMs;
}

/** The first message about an Act now alert, or a step of its escalation: the ones nobody may be left without. A note
 * that someone acknowledged an alert, or that it cleared, carries the alert's priority but is not one of them. */
function isActNow(row: StoredNotification): boolean {
  return (row.kind === "alert" || row.kind === "escalation") && row.priority === "act_now";
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

