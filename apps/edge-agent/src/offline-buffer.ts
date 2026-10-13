import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

  async flush(dispatch: (item: T) => Promise<void>): Promise<BufferFlushResult> {
    if (this.flushing) return { sent: 0, retained: this.size(), dropped: 0 };
    this.flushing = true;

    let sent = 0;
    let dropped = 0;
    // Work on a private copy so readings appended while we await the network are kept, in order,
    // behind the ones still waiting.
    const batch = this.items.splice(0, this.items.length);
    this.inFlight = batch.length;
    const waiting: T[] = [];

    try {
      for (let index = 0; index < batch.length; index += 1) {
        const item = batch[index] as T;
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
      this.flushing = false;
      if (sent > 0 || dropped > 0) this.rewriteFile();
    }

    return { sent, retained: this.size(), dropped };
  }

  private load(path: string): void {
    if (!existsSync(path)) return;

    const restored: T[] = [];
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        restored.push(JSON.parse(line) as T);
      } catch {
        // A line cut short by a power loss mid-write. Everything before it is intact.
      }
    }

    this.items = restored.length > this.maxItems ? restored.slice(restored.length - this.maxItems) : restored;
    this.fileLines = restored.length;
    if (restored.length > this.maxItems) this.rewriteFile();
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
      writeFileSync(temporary, this.items.map((item) => `${JSON.stringify(item)}\n`).join(""));
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
