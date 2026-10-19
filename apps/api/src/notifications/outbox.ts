import { randomUUID } from "crypto";
import { AlertPriority, NotificationChannel, NotificationKind } from "@greecon/shared";
import { DatabaseService } from "../database/database.service";
import { PlannedMessage } from "./plan";

// The plan and the log of messages, in one place. A message is stored the moment it is planned, so a
// restart loses no step of an escalation, and it stays after it is sent so that what was and was not
// sent can be shown with the reason. Taking a message to send is one atomic step ("claim"), so two
// workers cannot both send it.

export type StoredStatus = "planned" | "sending" | "sent" | "failed" | "skipped";

export interface StoredNotification {
  id: string;
  tenantId: string;
  alertId?: string;
  contactId?: string;
  contactName: string;
  channel: NotificationChannel;
  /** Where it went, or was tried: filled in when it is sent. */
  destination?: string;
  kind: NotificationKind;
  priority?: AlertPriority;
  subject?: string;
  body: string;
  status: StoredStatus;
  dueAtMs: number;
  eventAtMs?: number;
  attempts: number;
  sentAtMs?: number;
  providerId?: string;
  error?: string;
  dedupeKey: string;
  createdAtMs: number;
}

/** A person who has in fact been told about an alert, by what the log says was sent. */
export interface ToldRow {
  contactId?: string;
  contactName: string;
  priority: AlertPriority;
}

export interface OutboxStore {
  /** Saves planned messages. A message whose key is already there is left alone; the ones that were new are returned. */
  plan(tenantId: string, messages: readonly PlannedMessage[], nowMs: number): Promise<StoredNotification[]>;
  /** Takes up to `limit` messages that are due and marks them as being sent, so that no other worker takes them. */
  claimDue(nowMs: number, limit: number): Promise<StoredNotification[]>;
  /** Puts back messages taken long ago by a worker that never finished (it died mid-send). */
  recoverStuck(nowMs: number, olderThanMs: number): Promise<number>;
  markSent(id: string, nowMs: number, destination: string, providerId?: string): Promise<void>;
  markFailed(id: string, nowMs: number, error: string, destination?: string): Promise<void>;
  markSkipped(id: string, nowMs: number, reason: string): Promise<void>;
  /** After a failure that may pass: try again at `dueAtMs`. */
  retryAt(id: string, dueAtMs: number, attempts: number, error: string): Promise<void>;
  /** Who was told about this alert (messages that were sent), the most urgent priority first. */
  toldAbout(tenantId: string, alertId: string): Promise<ToldRow[]>;
  /** Whether any alert message at this priority has ever been planned for the alert, whatever became of it. */
  hasAlertMessages(tenantId: string, alertId: string, priority: AlertPriority): Promise<boolean>;
  /** How many of these kinds went out through the channel since then. */
  countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[]): Promise<number>;
  /** The newest first. */
  recent(tenantId: string, limit: number): Promise<StoredNotification[]>;
}

/** The kinds that are about an alert asking for someone, as opposed to the morning message and tests. */
export const ALERT_KINDS: readonly NotificationKind[] = ["alert", "escalation"];

const priorityRank: Record<AlertPriority, number> = { act_now: 0, check_today: 1, fyi: 2 };

function toStored(tenantId: string, message: PlannedMessage, nowMs: number): StoredNotification {
  return {
    id: randomUUID(),
    tenantId,
    alertId: message.alertId,
    contactId: message.contactId,
    contactName: message.contactName,
    channel: message.channel,
    kind: message.kind,
    priority: message.priority,
    subject: message.subject,
    body: message.body,
    status: "planned",
    dueAtMs: message.dueAtMs,
    eventAtMs: message.eventAtMs,
    attempts: 0,
    dedupeKey: message.dedupeKey,
    createdAtMs: nowMs
  };
}

function toldRows(rows: readonly StoredNotification[]): ToldRow[] {
  const byContact = new Map<string, ToldRow>();
  for (const row of rows) {
    if (row.status !== "sent" || !ALERT_KINDS.includes(row.kind) || !row.priority) continue;
    const key = row.contactId ?? `name:${row.contactName}`;
    const held = byContact.get(key);
    if (!held || priorityRank[row.priority] < priorityRank[held.priority]) byContact.set(key, { contactId: row.contactId, contactName: row.contactName, priority: row.priority });
  }
  return [...byContact.values()].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

export class MemoryOutboxStore implements OutboxStore {
  readonly rows: StoredNotification[] = [];
  private readonly takenAt = new Map<string, number>();

  async plan(tenantId: string, messages: readonly PlannedMessage[], nowMs: number): Promise<StoredNotification[]> {
    const added: StoredNotification[] = [];
    for (const message of messages) {
      if (this.rows.some((row) => row.tenantId === tenantId && row.dedupeKey === message.dedupeKey)) continue;
      const stored = toStored(tenantId, message, nowMs);
      this.rows.push(stored);
      added.push({ ...stored });
    }
    return added;
  }

  async claimDue(nowMs: number, limit: number): Promise<StoredNotification[]> {
    const due = this.rows.filter((row) => row.status === "planned" && row.dueAtMs <= nowMs).sort((a, b) => a.dueAtMs - b.dueAtMs).slice(0, limit);
    for (const row of due) {
      row.status = "sending";
      this.takenAt.set(row.id, nowMs);
    }
    return due.map((row) => ({ ...row }));
  }

  async recoverStuck(nowMs: number, olderThanMs: number): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.status === "sending" && nowMs - (this.takenAt.get(row.id) ?? 0) > olderThanMs) {
        row.status = "planned";
        count += 1;
      }
    }
    return count;
  }

  private find(id: string): StoredNotification {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`No notification ${id}.`);
    return row;
  }

  async markSent(id: string, nowMs: number, destination: string, providerId?: string): Promise<void> {
    Object.assign(this.find(id), { status: "sent", sentAtMs: nowMs, destination, providerId, error: undefined });
  }

  async markFailed(id: string, _nowMs: number, error: string, destination?: string): Promise<void> {
    Object.assign(this.find(id), { status: "failed", error, ...(destination ? { destination } : {}) });
  }

  async markSkipped(id: string, _nowMs: number, reason: string): Promise<void> {
    Object.assign(this.find(id), { status: "skipped", error: reason });
  }

  async retryAt(id: string, dueAtMs: number, attempts: number, error: string): Promise<void> {
    Object.assign(this.find(id), { status: "planned", dueAtMs, attempts, error });
  }

  async toldAbout(tenantId: string, alertId: string): Promise<ToldRow[]> {
    return toldRows(this.rows.filter((row) => row.tenantId === tenantId && row.alertId === alertId));
  }

  async hasAlertMessages(tenantId: string, alertId: string, priority: AlertPriority): Promise<boolean> {
    return this.rows.some((row) => row.tenantId === tenantId && row.alertId === alertId && row.priority === priority && ALERT_KINDS.includes(row.kind));
  }

  async countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[]): Promise<number> {
    return this.rows.filter((row) => row.tenantId === tenantId && row.channel === channel && row.status === "sent" && (row.sentAtMs ?? 0) >= sinceMs && kinds.includes(row.kind)).length;
  }

  async recent(tenantId: string, limit: number): Promise<StoredNotification[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs || b.dueAtMs - a.dueAtMs)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }
}

interface NotificationRow {
  id: string;
  tenant_id: string;
  alert_id: string | null;
  contact_id: string | null;
  contact_name: string;
  channel: NotificationChannel;
  destination: string | null;
  kind: NotificationKind;
  priority: AlertPriority | null;
  subject: string | null;
  body: string;
  status: StoredStatus;
  due_at: Date;
  event_at: Date | null;
  attempts: number;
  sent_at: Date | null;
  provider_id: string | null;
  error: string | null;
  dedupe_key: string;
  created_at: Date;
}

function mapRow(row: NotificationRow): StoredNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alertId: row.alert_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name,
    channel: row.channel,
    destination: row.destination ?? undefined,
    kind: row.kind,
    priority: row.priority ?? undefined,
    subject: row.subject ?? undefined,
    body: row.body,
    status: row.status,
    dueAtMs: row.due_at.getTime(),
    eventAtMs: row.event_at?.getTime(),
    attempts: row.attempts,
    sentAtMs: row.sent_at?.getTime(),
    providerId: row.provider_id ?? undefined,
    error: row.error ?? undefined,
    dedupeKey: row.dedupe_key,
    createdAtMs: row.created_at.getTime()
  };
}

const COLUMNS = `id, tenant_id, alert_id, contact_id, contact_name, channel, destination, kind, priority, subject, body, status, due_at, event_at, attempts, sent_at, provider_id, error, dedupe_key, created_at`;

export class PostgresOutboxStore implements OutboxStore {
  constructor(private readonly db: DatabaseService) {}

  async plan(tenantId: string, messages: readonly PlannedMessage[], nowMs: number): Promise<StoredNotification[]> {
    const added: StoredNotification[] = [];
    for (const message of messages) {
      const result = await this.db.query<NotificationRow>(
        `INSERT INTO notifications (tenant_id, alert_id, contact_id, contact_name, channel, kind, priority, subject, body, status, due_at, event_at, dedupe_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'planned',$10,$11,$12,$13,$13)
         ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
         RETURNING ${COLUMNS}`,
        [
          tenantId,
          message.alertId ?? null,
          message.contactId ?? null,
          message.contactName,
          message.channel,
          message.kind,
          message.priority ?? null,
          message.subject ?? null,
          message.body,
          new Date(message.dueAtMs),
          message.eventAtMs === undefined ? null : new Date(message.eventAtMs),
          message.dedupeKey,
          new Date(nowMs)
        ]
      );
      if (result.rows[0]) added.push(mapRow(result.rows[0]));
    }
    return added;
  }

  async claimDue(nowMs: number, limit: number): Promise<StoredNotification[]> {
    const result = await this.db.query<NotificationRow>(
      `UPDATE notifications SET status = 'sending', updated_at = $1
       WHERE id IN (
         SELECT id FROM notifications WHERE status = 'planned' AND due_at <= $1 ORDER BY due_at LIMIT $2 FOR UPDATE SKIP LOCKED
       )
       RETURNING ${COLUMNS}`,
      [new Date(nowMs), limit]
    );
    return result.rows.map(mapRow).sort((a, b) => a.dueAtMs - b.dueAtMs);
  }

  async recoverStuck(nowMs: number, olderThanMs: number): Promise<number> {
    const result = await this.db.query(`UPDATE notifications SET status = 'planned', updated_at = $1 WHERE status = 'sending' AND updated_at < $2`, [
      new Date(nowMs),
      new Date(nowMs - olderThanMs)
    ]);
    return result.rowCount ?? 0;
  }

  async markSent(id: string, nowMs: number, destination: string, providerId?: string): Promise<void> {
    await this.db.query(`UPDATE notifications SET status = 'sent', sent_at = $2, destination = $3, provider_id = $4, error = NULL, updated_at = $2 WHERE id = $1`, [
      id,
      new Date(nowMs),
      destination,
      providerId ?? null
    ]);
  }

  async markFailed(id: string, nowMs: number, error: string, destination?: string): Promise<void> {
    await this.db.query(`UPDATE notifications SET status = 'failed', error = $2, destination = COALESCE($3, destination), updated_at = $4 WHERE id = $1`, [
      id,
      error,
      destination ?? null,
      new Date(nowMs)
    ]);
  }

  async markSkipped(id: string, nowMs: number, reason: string): Promise<void> {
    await this.db.query(`UPDATE notifications SET status = 'skipped', error = $2, updated_at = $3 WHERE id = $1`, [id, reason, new Date(nowMs)]);
  }

  async retryAt(id: string, dueAtMs: number, attempts: number, error: string): Promise<void> {
    await this.db.query(`UPDATE notifications SET status = 'planned', due_at = $2, attempts = $3, error = $4, updated_at = now() WHERE id = $1`, [id, new Date(dueAtMs), attempts, error]);
  }

  async toldAbout(tenantId: string, alertId: string): Promise<ToldRow[]> {
    const result = await this.db.query<NotificationRow>(
      `SELECT ${COLUMNS} FROM notifications WHERE tenant_id = $1 AND alert_id = $2 AND status = 'sent' AND kind IN ('alert', 'escalation')`,
      [tenantId, alertId]
    );
    return toldRows(result.rows.map(mapRow));
  }

  async hasAlertMessages(tenantId: string, alertId: string, priority: AlertPriority): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM notifications WHERE tenant_id = $1 AND alert_id = $2 AND priority = $3 AND kind IN ('alert', 'escalation') LIMIT 1`,
      [tenantId, alertId, priority]
    );
    return result.rows.length > 0;
  }

  async countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[]): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications WHERE tenant_id = $1 AND channel = $2 AND status = 'sent' AND sent_at >= $3 AND kind = ANY($4::text[])`,
      [tenantId, channel, new Date(sinceMs), [...kinds]]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async recent(tenantId: string, limit: number): Promise<StoredNotification[]> {
    const result = await this.db.query<NotificationRow>(`SELECT ${COLUMNS} FROM notifications WHERE tenant_id = $1 ORDER BY created_at DESC, due_at DESC LIMIT $2`, [tenantId, limit]);
    return result.rows.map(mapRow);
  }
}

/** Messages go to PostgreSQL when there is one, and stay in memory when there is not (the demo and the tests). */
export function createOutboxStore(db: DatabaseService): OutboxStore {
  return db.isConfigured() ? new PostgresOutboxStore(db) : new MemoryOutboxStore();
}
