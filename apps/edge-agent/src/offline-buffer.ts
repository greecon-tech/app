import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readSync, renameSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { StringDecoder } from "node:string_decoder";

const CHUNK_BYTES = 1_048_576;

/** Calls `visit` for each line of a file, reading it a megabyte at a time. A backlog of several days is
 * a file of many megabytes; reading it whole, and splitting it, would need several times its size in memory on
 * a box that has very little to spare, at the one moment (a restart in the middle of an outage) that it matters. */
function forEachLine(path: string, visit: (line: string) => void): void {
  const descriptor = openSync(path, "r");
  try {
    const decoder = new StringDecoder("utf8");
    const buffer = Buffer.alloc(CHUNK_BYTES);
    let carry = "";
    for (;;) {
      const read = readSync(descriptor, buffer, 0, CHUNK_BYTES, null);
      if (read === 0) break;
      const lines = (carry + decoder.write(buffer.subarray(0, read))).split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) visit(line);
    }
    carry += decoder.end();
    if (carry) visit(carry);
  } finally {
    closeSync(descriptor);
  }
}

export interface BufferFlushResult {
  /** Delivered this flush. */
  sent: number;
  /** Still waiting (a transient failure stopped the flush, or another flush was already running). */
  retained: number;
  /** Discarded because the API permanently refused them (retrying could never succeed). */
  dropped: number;
}

/** A delivery attempt that failed. `permanent` means retrying the same item can never succeed
 * (the API understood it and refused it, e.g. an unprovisioned device); anything else is assumed
 * temporary (network down, timeout, API restarting, credentials not yet fixed) and is retried. */
export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

/** What a batch dispatch reports: what it could not deliver (a temporary failure stopped it), in order,
 * and how many it delivered and how many the API refused for good. */
export interface BatchOutcome<T> {
  remaining: T[];
  delivered: number;
  dropped: number;
}

export interface OfflineBufferOptions {
  /** Most items held. When full, the OLDEST is dropped: after a long outage the recent state of a
   * site is worth more than an hour-old reading. Memory (and the state file) stay bounded. */
  maxItems?: number;
  /** A JSON-lines file that lets the backlog survive a restart or power cut. Unset keeps it in
   * memory only. */
  persistPath?: string;
  /** Called for each item the API permanently refused, and for each item lost to the size cap. */
  onDrop?: (item: unknown, reason: string) => void;
}

const DEFAULT_MAX_ITEMS = 50_000;

/** Store-and-forward for readings the cloud could not take yet.
 *
 * Guarantees: delivery order is preserved; only one flush runs at a time (an overlapping call
 * returns immediately rather than sending the same items twice); a transient failure stops the
 * flush at that item instead of hammering a dead API once per buffered reading; a permanent
 * rejection drops that one item so a single bad message can never block the queue forever; memory
 * and disk use are capped. Delivery is at-least-once: if the API stored an item but the reply was
 * lost, it is sent again, so the receiving side must tolerate a repeated reading. */
export class OfflineBuffer<T> {
  private items: T[] = [];
  private inFlight = 0;
  /** The oldest item among those being sent right now, so the oldest waiting is known during a send too. */
  private flightHead: T | undefined;
  private flushing = false;
  private fileLines = 0;
  private readonly maxItems: number;
  private readonly persistPath?: string;
  private readonly onDrop?: (item: unknown, reason: string) => void;

  constructor(options: OfflineBufferOptions = {}) {
    this.maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);
    this.persistPath = options.persistPath;
    this.onDrop = options.onDrop;
    if (this.persistPath) this.load(this.persistPath);
  }

  append(item: T): void {
    this.items.push(item);

    if (this.items.length > this.maxItems) {
      const evicted = this.items.splice(0, this.items.length - this.maxItems);
      for (const lost of evicted) this.onDrop?.(lost, `buffer full (${this.maxItems} items); oldest reading discarded`);
    }

    if (!this.persistPath) return;
    this.appendToFile(item);
    // The file is append-only while readings pile up, so it can hold lines already evicted from
    // memory. Compact it once it is twice the cap: one rewrite per `maxItems` appends, not one per
    // reading, which keeps flash wear negligible even through a multi-day outage.
    if (this.fileLines > this.maxItems * 2) this.rewriteFile();
  }

  /** Everything not yet delivered, including the batch currently being sent. */
  size(): number {
    return this.items.length + this.inFlight;
  }

  snapshot(): T[] {
    return [...this.items];
  }

  /** The oldest item still waiting, if any, including one being sent right now. */
  oldest(): T | undefined {
    return this.flightHead ?? this.items[0];
  }

  async flush(dispatch: (item: T) => Promise<void>): Promise<BufferFlushResult> {
    if (this.flushing) return { sent: 0, retained: this.size(), dropped: 0 };
    this.flushing = true;

    let sent = 0;
    let dropped = 0;
    // Work on a private copy so readings appended while we await the network are kept, in order,
    // behind the ones still waiting.
    const batch = this.items.splice(0, this.items.length);
    this.inFlight = batch.length;
    this.flightHead = batch[0];
    const waiting: T[] = [];

    try {
      for (let index = 0; index < batch.length; index += 1) {
        const item = batch[index] as T;
        this.flightHead = item;
        try {
          await dispatch(item);
          sent += 1;
        } catch (error) {
          if (error instanceof DeliveryError && error.permanent) {
            dropped += 1;
            this.onDrop?.(item, error.message);
            continue;
          }
          // Transient: keep this item and everything after it, in order, and stop for now.
          waiting.push(...batch.slice(index));
          break;
        }
      }
    } finally {
      this.items = [...waiting, ...this.items];
      this.inFlight = 0;
      this.flightHead = undefined;
      this.flushing = false;
      if (sent > 0 || dropped > 0) this.rewriteFile();
    }

    return { sent, retained: this.size(), dropped };
  }

  /** Sends everything waiting, oldest first, a batch at a time. Same guarantees as flush(): one at a
   * time, in order, stopping at the first temporary failure, and the file is rewritten once at the end
   * rather than after every batch, so draining a long backlog is not a long run of disk writes. */
  async flushInBatches(dispatch: (items: T[]) => Promise<BatchOutcome<T>>, batchSize: number): Promise<BufferFlushResult> {
    if (this.flushing) return { sent: 0, retained: this.size(), dropped: 0 };
    this.flushing = true;

    let sent = 0;
    let dropped = 0;
    const all = this.items.splice(0, this.items.length);
    this.inFlight = all.length;
    this.flightHead = all[0];
    let waiting: T[] = [];

    try {
      for (let start = 0; start < all.length; start += batchSize) {
        const batch = all.slice(start, start + batchSize);
        let outcome: BatchOutcome<T>;
        try {
          outcome = await dispatch(batch);
        } catch {
          // The dispatcher is not meant to throw; if it does, nothing is known about this batch, so all of it stays.
          outcome = { remaining: batch, delivered: 0, dropped: 0 };
        }
        sent += outcome.delivered;
        dropped += outcome.dropped;
        if (outcome.remaining.length > 0) {
          waiting = [...outcome.remaining, ...all.slice(start + batchSize)];
          break;
        }
        // What is still to send, so the backlog is seen to shrink while a long one is being drained.
        this.inFlight = Math.max(0, all.length - (start + batch.length));
        this.flightHead = all[start + batch.length];
      }
    } finally {
      this.items = [...waiting, ...this.items];
      this.inFlight = 0;
      this.flightHead = undefined;
      this.flushing = false;
      if (sent > 0 || dropped > 0) this.rewriteFile();
    }

    return { sent, retained: this.size(), dropped };
  }

  private load(path: string): void {
    if (!existsSync(path)) return;

    // The file can hold twice as many lines as the queue may keep (it is only compacted then), and after
    // a long outage on a site with many readings each line is large. Parsing every line before keeping the
    // newest would need several times the queue's own size in memory at the moment of a restart, which on a box
    // with little to spare is a crash on every start. So the lines are counted first, and only the ones to keep
    // are parsed.
    let total = 0;
    forEachLine(path, (line) => {
      if (line.trim()) total += 1;
    });
    const skip = Math.max(0, total - this.maxItems);

    const restored: T[] = [];
    let seen = 0;
    forEachLine(path, (line) => {
      if (!line.trim()) return;
      seen += 1;
      if (seen <= skip) return;
      try {
        restored.push(JSON.parse(line) as T);
      } catch {
        // A line cut short by a power loss mid-write. Everything before it is intact.
      }
    });

    this.items = restored;
    this.fileLines = total;
    if (skip > 0) this.rewriteFile();
  }

  private appendToFile(item: T): void {
    if (!this.persistPath) return;
    try {
      this.ensureDirectory(this.persistPath);
      appendFileSync(this.persistPath, `${JSON.stringify(item)}\n`);
      this.fileLines += 1;
    } catch {
      // Disk trouble must not take down delivery; the item is still held in memory.
    }
  }

  // Replaces the file with exactly what is still pending: written beside it, then renamed, so a
  // crash can leave the old file or the new one but never a half-written one.
  private rewriteFile(): void {
    if (!this.persistPath) return;
    try {
      this.ensureDirectory(this.persistPath);
      const temporary = `${this.persistPath}.tmp`;
      // Written a megabyte at a time, for the same reason it is read that way.
      const descriptor = openSync(temporary, "w");
      try {
        let chunk = "";
        for (const item of this.items) {
          chunk += `${JSON.stringify(item)}\n`;
          if (chunk.length >= CHUNK_BYTES) {
            writeSync(descriptor, chunk);
            chunk = "";
          }
        }
        if (chunk) writeSync(descriptor, chunk);
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporary, this.persistPath);
      this.fileLines = this.items.length;
    } catch {
      // Leave the old file in place; the next flush or compaction tries again.
    }
  }

  private ensureDirectory(path: string): void {
    const directory = dirname(path);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  }
}
