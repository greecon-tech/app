import type { TelemetryMessage, TelemetryReading } from "@greecon/shared";
import { BatchOutcome, OfflineBuffer } from "./offline-buffer";

// Gets the readings to the platform, in the order they were taken, and keeps them safe until it can.
//
// Order matters, not only tidiness: the platform counts energy by joining each reading to the one
// before it, and a reading that arrives after a newer one cannot be joined. So while anything is
// waiting, new readings go to the back of the queue; they are never sent ahead of it. A backlog is
// sent first, and live readings carry on behind it.

export interface OutboxLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface OutboxOptions {
  apiUrl: string;
  /** Credentials and any fixed headers; the outbox adds no identity of its own. */
  headers: Record<string, string>;
  buffer: OfflineBuffer<TelemetryMessage>;
  log: OutboxLog;
  /** Longest one request may take before it counts as a failed (temporary) attempt. */
  timeoutMs?: number;
  /** Most messages in one request. The platform accepts a hundred. */
  batchSize?: number;
  /** Most bytes of readings in one request. */
  maxBatchBytes?: number;
  /** While a backlog is building, keep one reading per point per this long. The platform keeps a
   * reading a minute in history, and counts energy well from one a minute, so nothing is lost that
   * would have been kept, and three days of outage fits where ten seconds' worth would not. */
  thinMs?: number;
  fetchImpl?: typeof fetch;
}

type Attempt = { kind: "sent"; results: Array<{ accepted: boolean; errors?: string[] }> } | { kind: "later"; reason: string } | { kind: "refused"; reason: string };

// Answers that mean "try again later, or after someone fixes the setup", not "this is wrong": request
// timeout, too early, rate limited, and the credential problems. Readings held while a credential is
// wrong are worth keeping, because fixing the credential then delivers them. A missing route (404, 405)
// is the same: it is the wrong address, not wrong readings.
const RETRY_LATER = new Set([401, 403, 404, 405, 408, 425, 429]);

export class Outbox {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly batchSize: number;
  private readonly maxBatchBytes: number;
  private readonly thinMs: number;
  /** The last reading queued for each point since the queue was last empty. */
  private readonly lastQueued = new Map<string, { ms: number; value: TelemetryReading["value"] }>();
  private turn: Promise<void> = Promise.resolve();
  private draining: Promise<void> | undefined;
  private evicted = 0;
  private lastProblem = "";

  constructor(private readonly options: OutboxOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.batchSize = Math.min(100, Math.max(1, options.batchSize ?? 100));
    this.maxBatchBytes = options.maxBatchBytes ?? 400_000;
    this.thinMs = options.thinMs ?? 60_000;
  }

  /** Readings waiting to be sent. */
  pending(): number {
    return this.options.buffer.size();
  }

  /** How old the oldest waiting message is, in seconds. */
  oldestPendingAgeSeconds(nowMs: number = Date.now()): number | undefined {
    const oldest = this.options.buffer.oldest();
    if (!oldest) return undefined;
    const published = Date.parse(oldest.publishedAtUtc);
    return Number.isFinite(published) ? Math.max(0, Math.round((nowMs - published) / 1000)) : undefined;
  }

  /** Takes one round's messages. Sends them now if nothing is waiting; otherwise they join the queue
   * and go out in turn. Returns once the messages are sent or safely queued, never waiting for a backlog. */
  submit(messages: TelemetryMessage[]): Promise<void> {
    const run = async () => {
      if (messages.length === 0) return;
      if (this.options.buffer.size() > 0 || this.draining) {
        this.enqueue(messages);
        this.startDraining();
        return;
      }
      const outcome = await this.deliver(messages);
      if (outcome.remaining.length > 0) {
        this.enqueue(outcome.remaining);
        this.startDraining();
      }
    };
    // One at a time: two rounds submitted together must not overtake each other.
    this.turn = this.turn.then(run, run);
    return this.turn;
  }

  /** Starts sending what is waiting, if anything is and nothing is already doing so. Resolves when
   * that has finished or stopped for now. */
  drain(): Promise<void> {
    return this.startDraining() ?? Promise.resolve();
  }

  private startDraining(): Promise<void> | undefined {
    if (this.draining) return this.draining;
    if (this.options.buffer.size() === 0) return undefined;
    this.draining = this.drainLoop().finally(() => {
      this.draining = undefined;
    });
    return this.draining;
  }

  private async drainLoop(): Promise<void> {
    const { buffer, log } = this.options;
    let sentTotal = 0;
    let droppedTotal = 0;
    while (buffer.size() > 0) {
      const result = await buffer.flushInBatches((batch) => this.deliver(batch), this.batchSize);
      sentTotal += result.sent;
      droppedTotal += result.dropped;
      // Nothing moved: the platform cannot be reached for now. The next round tries again.
      if (result.sent === 0 && result.dropped === 0) break;
    }
    if (buffer.size() === 0) this.lastQueued.clear();
    if (sentTotal > 0 || droppedTotal > 0) {
      log.info(`Delivered ${sentTotal} waiting message(s)${droppedTotal > 0 ? `, discarded ${droppedTotal} the platform refused` : ""}, ${buffer.size()} still waiting.`);
    }
    if (this.evicted > 0) {
      log.error(`The queue was full: discarded ${this.evicted} oldest message(s). The platform has been unreachable for a long time.`);
      this.evicted = 0;
    }
  }

  /** Called by the buffer when it has to discard the oldest to stay within its size. */
  noteEvicted(): void {
    this.evicted += 1;
  }

  private enqueue(messages: TelemetryMessage[]): void {
    for (const message of messages) {
      const kept = message.readings.filter((reading) => this.worthQueueing(reading));
      if (kept.length === 0) continue;
      this.options.buffer.append(kept.length === message.readings.length ? message : { ...message, readings: kept });
    }
  }

  private worthQueueing(reading: TelemetryReading): boolean {
    const ms = Date.parse(reading.timestampUtc);
    const last = this.lastQueued.get(reading.pointId);
    const keep =
      !last ||
      !Number.isFinite(ms) ||
      reading.quality !== "OK" ||
      (typeof reading.value !== "number" && reading.value !== last.value) ||
      ms < last.ms ||
      ms - last.ms >= this.thinMs;
    if (keep && (!last || ms >= last.ms)) this.lastQueued.set(reading.pointId, { ms, value: reading.value });
    return keep;
  }

  // ---- Sending ---------------------------------------------------------------------------------------

  /** Sends messages in order, in requests of the size the platform takes. Never throws: what could
   * not be sent for a temporary reason comes back, in order, for the caller to keep. */
  private async deliver(messages: TelemetryMessage[]): Promise<BatchOutcome<TelemetryMessage>> {
    let delivered = 0;
    let dropped = 0;
    let index = 0;
    while (index < messages.length) {
      const chunk = this.chunkFrom(messages, index);
      const outcome = await this.sendChunk(chunk);
      delivered += outcome.delivered;
      dropped += outcome.dropped;
      if (outcome.remaining.length > 0) return { remaining: [...outcome.remaining, ...messages.slice(index + chunk.length)], delivered, dropped };
      index += chunk.length;
    }
    return { remaining: [], delivered, dropped };
  }

  private chunkFrom(messages: TelemetryMessage[], start: number): TelemetryMessage[] {
    const chunk: TelemetryMessage[] = [];
    let bytes = 0;
    for (let index = start; index < messages.length && chunk.length < this.batchSize; index += 1) {
      const size = JSON.stringify(messages[index]).length;
      if (chunk.length > 0 && bytes + size > this.maxBatchBytes) break;
      chunk.push(messages[index] as TelemetryMessage);
      bytes += size;
    }
    return chunk;
  }

  private async sendChunk(chunk: TelemetryMessage[]): Promise<BatchOutcome<TelemetryMessage>> {
    const attempt = await this.post(chunk);

    if (attempt.kind === "later") {
      this.complain(attempt.reason);
      return { remaining: chunk, delivered: 0, dropped: 0 };
    }

    if (attempt.kind === "refused") {
      // Something in this request is wrong and the platform will not say what. Halving finds it: the
      // good half goes through, and what is left is one message that is refused for good.
      if (chunk.length > 1) {
        const middle = Math.ceil(chunk.length / 2);
        const first = await this.sendChunk(chunk.slice(0, middle));
        if (first.remaining.length > 0) return { remaining: [...first.remaining, ...chunk.slice(middle)], delivered: first.delivered, dropped: first.dropped };
        const second = await this.sendChunk(chunk.slice(middle));
        return { remaining: second.remaining, delivered: first.delivered + second.delivered, dropped: first.dropped + second.dropped };
      }
      this.options.log.error(`A message for device ${chunk[0]?.deviceId} was refused and discarded: ${attempt.reason}`);
      return { remaining: [], delivered: 0, dropped: 1 };
    }

    this.lastProblem = "";
    let delivered = 0;
    let dropped = 0;
    attempt.results.forEach((result, index) => {
      if (result.accepted) {
        delivered += 1;
        return;
      }
      dropped += 1;
      this.options.log.error(`A message for device ${chunk[index]?.deviceId} was refused and discarded: ${(result.errors ?? ["no reason given"]).join("; ")}`);
    });
    return { remaining: [], delivered, dropped };
  }

  private async post(chunk: TelemetryMessage[]): Promise<Attempt> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.apiUrl}/telemetry/ingest-batch`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.options.headers },
        body: JSON.stringify({ messages: chunk }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      return { kind: "later", reason: `the platform could not be reached (${error instanceof Error ? error.message : String(error)})` };
    }

    if (response.status === 401) return { kind: "later", reason: "the platform does not recognise this box's credential. Run the install command again with a new code from the site's setup page" };
    if (!response.ok) {
      if (RETRY_LATER.has(response.status) || response.status >= 500) return { kind: "later", reason: `the platform answered ${response.status}` };
      return { kind: "refused", reason: `the platform answered ${response.status}` };
    }

    const body = (await response.json().catch(() => undefined)) as { results?: Array<{ accepted: boolean; errors?: string[] }> } | undefined;
    if (!body || !Array.isArray(body.results) || body.results.length !== chunk.length) {
      // A success that is not the answer to this request: do not guess what it meant.
      return { kind: "later", reason: "the platform's answer was not the one expected" };
    }
    return { kind: "sent", results: body.results };
  }

  /** Says what is wrong once, not on every round. */
  private complain(reason: string): void {
    if (reason === this.lastProblem) return;
    this.lastProblem = reason;
    this.options.log.warn(`Keeping readings: ${reason}. ${this.options.buffer.size()} waiting.`);
  }
}
