import { randomUUID } from "crypto";
import { Logger } from "@nestjs/common";
import { AlertPriority, NotificationChannel, NotificationKind } from "@greecon/shared";
import type { Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { ChainInfo, PlannedMessage, baseKeyOf, generationOfKey } from "./plan";

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
  /** When they were first told about this alert. */
  toldAtMs?: number;
}

/** A message nobody has received yet, and why: what the screens say when delivery is failing. */
export interface UndeliveredAlertMessage {
  tenantId: string;
  alertId?: string;
  contactName: string;
  channel: NotificationChannel;
  /** The reason the latest try failed. */
  error: string;
  atMs: number;
}

/** Held for as long as a round of work is going on, so that two platforms do not work at once. */
export type RoundLock = () => Promise<void>;

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
  /** Who was told about this alert (messages that were sent), the most urgent priority first. Only in this round of messages when one is given. */
  toldAbout(tenantId: string, alertId: string, generation?: number): Promise<ToldRow[]>;
  /** Whether any alert message at this priority has ever been planned for the alert, whatever became of it. */
  hasAlertMessages(tenantId: string, alertId: string, priority: AlertPriority): Promise<boolean>;
  /** How many of these kinds went out through the channel since then, only those at this priority when one is given. */
  countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[], priority?: AlertPriority): Promise<number>;
  /** The newest first. */
  recent(tenantId: string, limit: number): Promise<StoredNotification[]>;
  /** The rounds of messages that were planned for an alert (one entry for each round and priority): which, and when each began. */
  chains(tenantId: string, alertId: string): Promise<ChainInfo[]>;
  /** Which of these keys already have a message, whatever became of it. A message tried again counts under its first key. */
  existingKeys(tenantId: string, keys: readonly string[]): Promise<Set<string>>;
  /** Drops what is still waiting from rounds before this one, because a new round has started from the first person. */
  supersedeBefore(tenantId: string, alertId: string, generation: number, nowMs: number, reason: string): Promise<number>;
  /** Puts back, to be sent now or at its own time if that is later, what was dropped for this reason in this round. */
  requeueSkipped(tenantId: string, alertId: string, generation: number, reason: string, nowMs: number, note: string): Promise<number>;
  /** The alert messages whose latest try failed and which nobody has since received or called off, since then. */
  undeliveredAlertMessages(sinceMs: number, tenantId?: string): Promise<UndeliveredAlertMessage[]>;
  /** Takes the right to do a round of work, or says (undefined) that another platform has it. */
  tryLock(): Promise<RoundLock | undefined>;
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
    const toldAtMs = held?.toldAtMs === undefined || row.sentAtMs === undefined ? (held?.toldAtMs ?? row.sentAtMs) : Math.min(held.toldAtMs, row.sentAtMs);
    if (!held || priorityRank[row.priority] < priorityRank[held.priority]) byContact.set(key, { contactId: row.contactId, contactName: row.contactName, priority: row.priority, toldAtMs });
    else held.toldAtMs = toldAtMs;
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

  async toldAbout(tenantId: string, alertId: string, generation?: number): Promise<ToldRow[]> {
    return toldRows(this.rows.filter((row) => row.tenantId === tenantId && row.alertId === alertId && (generation === undefined || generationOfKey(row.dedupeKey) === generation)));
  }

  async hasAlertMessages(tenantId: string, alertId: string, priority: AlertPriority): Promise<boolean> {
    return this.rows.some((row) => row.tenantId === tenantId && row.alertId === alertId && row.priority === priority && ALERT_KINDS.includes(row.kind));
  }

  async countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[], priority?: AlertPriority): Promise<number> {
    return this.rows.filter(
      (row) =>
        row.tenantId === tenantId &&
        row.channel === channel &&
        row.status === "sent" &&
        (row.sentAtMs ?? 0) >= sinceMs &&
        kinds.includes(row.kind) &&
        (priority === undefined || row.priority === priority)
    ).length;
  }

  async recent(tenantId: string, limit: number): Promise<StoredNotification[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs || b.dueAtMs - a.dueAtMs)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async chains(tenantId: string, alertId: string): Promise<ChainInfo[]> {
    const found = new Map<string, ChainInfo>();
    for (const row of this.rows) {
      if (row.tenantId !== tenantId || row.alertId !== alertId || !ALERT_KINDS.includes(row.kind) || !row.priority) continue;
      const generation = generationOfKey(row.dedupeKey);
      const key = `${generation}:${row.priority}`;
      const startedAtMs = row.eventAtMs ?? row.createdAtMs;
      const held = found.get(key);
      if (!held || startedAtMs < held.startedAtMs) found.set(key, { generation, priority: row.priority, startedAtMs });
    }
    return [...found.values()];
  }

  async existingKeys(tenantId: string, keys: readonly string[]): Promise<Set<string>> {
    const wanted = new Set(keys);
    return new Set(this.rows.filter((row) => row.tenantId === tenantId && wanted.has(row.dedupeKey)).map((row) => row.dedupeKey));
  }

  async supersedeBefore(tenantId: string, alertId: string, generation: number, _nowMs: number, reason: string): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.tenantId !== tenantId || row.alertId !== alertId || row.status !== "planned" || !ALERT_KINDS.includes(row.kind)) continue;
      if (generationOfKey(row.dedupeKey) >= generation) continue;
      Object.assign(row, { status: "skipped", error: reason });
      count += 1;
    }
    return count;
  }

  async requeueSkipped(tenantId: string, alertId: string, generation: number, reason: string, nowMs: number, note: string): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.tenantId !== tenantId || row.alertId !== alertId || row.status !== "skipped" || row.error !== reason || !ALERT_KINDS.includes(row.kind)) continue;
      if (generationOfKey(row.dedupeKey) !== generation) continue;
      Object.assign(row, { status: "planned", dueAtMs: Math.max(row.dueAtMs, nowMs), error: note });
      count += 1;
    }
    return count;
  }

  async undeliveredAlertMessages(sinceMs: number, tenantId?: string): Promise<UndeliveredAlertMessage[]> {
    const lineages = new Map<string, StoredNotification[]>();
    for (const row of this.rows) {
      if (!ALERT_KINDS.includes(row.kind) || row.createdAtMs < sinceMs || (tenantId !== undefined && row.tenantId !== tenantId)) continue;
      const key = `${row.tenantId}\u0000${baseKeyOf(row.dedupeKey)}`;
      lineages.set(key, [...(lineages.get(key) ?? []), row]);
    }
    const found: UndeliveredAlertMessage[] = [];
    for (const rows of lineages.values()) {
      if (rows.some((row) => row.status === "sent" || row.status === "skipped")) continue;
      const failures = rows.filter((row) => row.status === "failed").sort((a, b) => b.createdAtMs - a.createdAtMs || b.dueAtMs - a.dueAtMs);
      const last = failures[0];
      if (!last) continue;
      found.push({ tenantId: last.tenantId, alertId: last.alertId, contactName: last.contactName, channel: last.channel, error: last.error ?? "It could not be sent.", atMs: last.createdAtMs });
    }
    return found;
  }

  async tryLock(): Promise<RoundLock | undefined> {
    return async () => undefined; // one process, one round at a time: the service already sees to that
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

/** The pattern of a chain step's key, for the round it belongs to (the same as generationOfKey in plan.ts). */
const CHAIN_KEY = "^chain:[^:]*:g([0-9]+):";
const ROUND_LOCK = "greecon:notifications-round";
/** Connections that already have a listener for their errors: a pooled connection is used again and again, and one listener is enough. */
const listenedTo = new WeakSet<object>();

const COLUMNS = `id, tenant_id, alert_id, contact_id, contact_name, channel, destination, kind, priority, subject, body, status, due_at, event_at, attempts, sent_at, provider_id, error, dedupe_key, created_at`;

export class PostgresOutboxStore implements OutboxStore {
  private readonly logger = new Logger(PostgresOutboxStore.name);

  constructor(private readonly db: DatabaseService) {}

  async plan(tenantId: string, messages: readonly PlannedMessage[], nowMs: number): Promise<StoredNotification[]> {
    if (messages.length === 0) return [];
    // One statement for the whole round of messages. Saved one row at a time, a database that dropped half-way left the
    // first person's step and not the others', and a chain with its later steps missing looks planned.
    const params: unknown[] = [tenantId, new Date(nowMs)];
    const tuples = messages.map((message) => {
      const at = params.length;
      params.push(
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
        message.dedupeKey
      );
      return `($1,$${at + 1},$${at + 2},$${at + 3},$${at + 4},$${at + 5},$${at + 6},$${at + 7},$${at + 8},'planned',$${at + 9},$${at + 10},$${at + 11},$2,$2)`;
    });
    const result = await this.db.query<NotificationRow>(
      `INSERT INTO notifications (tenant_id, alert_id, contact_id, contact_name, channel, kind, priority, subject, body, status, due_at, event_at, dedupe_key, created_at, updated_at)
       VALUES ${tuples.join(",")}
       ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
       RETURNING ${COLUMNS}`,
      params
    );
    return result.rows.map(mapRow);
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

  async toldAbout(tenantId: string, alertId: string, generation?: number): Promise<ToldRow[]> {
    const result = await this.db.query<NotificationRow>(
      `SELECT ${COLUMNS} FROM notifications
       WHERE tenant_id = $1 AND alert_id = $2 AND status = 'sent' AND kind IN ('alert', 'escalation')
         AND ($3::int IS NULL OR COALESCE((regexp_match(dedupe_key, '${CHAIN_KEY}'))[1]::int, 0) = $3::int)`,
      [tenantId, alertId, generation ?? null]
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

  async countSentSince(tenantId: string, channel: NotificationChannel, sinceMs: number, kinds: readonly NotificationKind[], priority?: AlertPriority): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE tenant_id = $1 AND channel = $2 AND status = 'sent' AND sent_at >= $3 AND kind = ANY($4::text[]) AND ($5::text IS NULL OR priority = $5)`,
      [tenantId, channel, new Date(sinceMs), [...kinds], priority ?? null]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async recent(tenantId: string, limit: number): Promise<StoredNotification[]> {
    const result = await this.db.query<NotificationRow>(`SELECT ${COLUMNS} FROM notifications WHERE tenant_id = $1 ORDER BY created_at DESC, due_at DESC LIMIT $2`, [tenantId, limit]);
    return result.rows.map(mapRow);
  }

  async chains(tenantId: string, alertId: string): Promise<ChainInfo[]> {
    const result = await this.db.query<{ generation: number; priority: AlertPriority; started: Date }>(
      `SELECT COALESCE((regexp_match(dedupe_key, '${CHAIN_KEY}'))[1]::int, 0) AS generation, priority, min(COALESCE(event_at, created_at)) AS started
       FROM notifications
       WHERE tenant_id = $1 AND alert_id = $2 AND kind IN ('alert', 'escalation') AND priority IS NOT NULL
       GROUP BY 1, 2`,
      [tenantId, alertId]
    );
    return result.rows.map((row) => ({ generation: Number(row.generation), priority: row.priority, startedAtMs: row.started.getTime() }));
  }

  async existingKeys(tenantId: string, keys: readonly string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const result = await this.db.query<{ dedupe_key: string }>(`SELECT dedupe_key FROM notifications WHERE tenant_id = $1 AND dedupe_key = ANY($2::text[])`, [tenantId, [...keys]]);
    return new Set(result.rows.map((row) => row.dedupe_key));
  }

  async supersedeBefore(tenantId: string, alertId: string, generation: number, nowMs: number, reason: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE notifications SET status = 'skipped', error = $4, updated_at = $5
       WHERE tenant_id = $1 AND alert_id = $2 AND status = 'planned' AND kind IN ('alert', 'escalation')
         AND COALESCE((regexp_match(dedupe_key, '${CHAIN_KEY}'))[1]::int, 0) < $3`,
      [tenantId, alertId, generation, reason, new Date(nowMs)]
    );
    return result.rowCount ?? 0;
  }

  async requeueSkipped(tenantId: string, alertId: string, generation: number, reason: string, nowMs: number, note: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE notifications SET status = 'planned', due_at = GREATEST(due_at, $5), error = $6, updated_at = $5
       WHERE tenant_id = $1 AND alert_id = $2 AND status = 'skipped' AND error = $4 AND kind IN ('alert', 'escalation')
         AND COALESCE((regexp_match(dedupe_key, '${CHAIN_KEY}'))[1]::int, 0) = $3`,
      [tenantId, alertId, generation, reason, new Date(nowMs), note]
    );
    return result.rowCount ?? 0;
  }

  async undeliveredAlertMessages(sinceMs: number, tenantId?: string): Promise<UndeliveredAlertMessage[]> {
    const result = await this.db.query<{ tenant_id: string; alert_id: string | null; contact_name: string; channel: NotificationChannel; error: string | null; at: Date }>(
      `SELECT tenant_id,
              (array_agg(alert_id ORDER BY created_at DESC, due_at DESC))[1] AS alert_id,
              (array_agg(contact_name ORDER BY created_at DESC, due_at DESC))[1] AS contact_name,
              (array_agg(channel ORDER BY created_at DESC, due_at DESC))[1] AS channel,
              (array_agg(error ORDER BY created_at DESC, due_at DESC) FILTER (WHERE status = 'failed'))[1] AS error,
              max(updated_at) FILTER (WHERE status = 'failed') AS at
       FROM (
         SELECT *, regexp_replace(dedupe_key, '#retry[0-9]+$', '') AS lineage
         FROM notifications
         WHERE kind IN ('alert', 'escalation') AND created_at >= $1 AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
       ) messages
       GROUP BY tenant_id, lineage
       HAVING bool_or(status = 'failed') AND NOT bool_or(status IN ('sent', 'skipped'))`,
      [new Date(sinceMs), tenantId ?? null]
    );
    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      alertId: row.alert_id ?? undefined,
      contactName: row.contact_name,
      channel: row.channel,
      error: row.error ?? "It could not be sent.",
      atMs: row.at.getTime()
    }));
  }

  async tryLock(): Promise<RoundLock | undefined> {
    // A session-level advisory lock belongs to one connection, so the round holds a connection of its own while it goes on.
    const pool = (this.db as unknown as { pool?: Pool }).pool;
    if (!pool) return async () => undefined;
    const client = await pool.connect();
    // The connection is out of the pool for as long as the round goes on, so nothing else is listening for it to fail, and an error
    // event with no listener ends the whole process. A database that restarts, fails over or cuts an idle connection does exactly that.
    // The lock goes with the connection, so all there is to do is to say so.
    if (!listenedTo.has(client)) {
      listenedTo.add(client);
      client.on("error", (error) => this.logger.warn(`The connection that held the round of sending was lost: ${error.message}`));
    }
    let locked = false;
    try {
      const result = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [ROUND_LOCK]);
      locked = result.rows[0]?.locked === true;
    } catch (error) {
      client.release(true);
      throw error;
    }
    if (!locked) {
      client.release();
      return undefined;
    }
    return async () => {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [ROUND_LOCK]);
        client.release();
      } catch {
        // A connection that might still hold the lock must not go back to the pool: closing it frees the lock.
        client.release(true);
      }
    };
  }
}

/** Messages go to PostgreSQL when there is one, and stay in memory when there is not (the demo and the tests). */
export function createOutboxStore(db: DatabaseService): OutboxStore {
  return db.isConfigured() ? new PostgresOutboxStore(db) : new MemoryOutboxStore();
}
