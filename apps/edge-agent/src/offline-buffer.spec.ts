import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeliveryError, OfflineBuffer } from "./offline-buffer";

describe("edge agent offline buffer", () => {
  it("retains readings while the cloud API is unreachable and flushes once it recovers", async () => {
    const buffer = new OfflineBuffer<string>();
    buffer.append("reading-1");
    buffer.append("reading-2");

    const failed = await buffer.flush(async () => {
      throw new Error("api unreachable");
    });

    expect(failed.sent).toBe(0);
    expect(failed.retained).toBe(2);
    expect(buffer.size()).toBe(2);

    const sent: string[] = [];
    const flushed = await buffer.flush(async (item) => {
      sent.push(item);
    });

    expect(flushed.sent).toBe(2);
    expect(flushed.retained).toBe(0);
    expect(sent).toEqual(["reading-1", "reading-2"]);
  });

  it("stops at the first temporary failure instead of retrying every buffered reading against a dead API", async () => {
    const buffer = new OfflineBuffer<number>();
    [1, 2, 3, 4, 5].forEach((item) => buffer.append(item));

    let attempts = 0;
    const result = await buffer.flush(async () => {
      attempts += 1;
      throw new DeliveryError("API unreachable", false);
    });

    expect(attempts).toBe(1);
    expect(result).toEqual({ sent: 0, retained: 5, dropped: 0 });
  });

  it("keeps delivery order across a partial flush", async () => {
    const buffer = new OfflineBuffer<number>();
    [1, 2, 3, 4].forEach((item) => buffer.append(item));

    const delivered: number[] = [];
    await buffer.flush(async (item) => {
      if (item === 3) throw new DeliveryError("API went away", false);
      delivered.push(item);
    });
    expect(delivered).toEqual([1, 2]);
    expect(buffer.snapshot()).toEqual([3, 4]);

    await buffer.flush(async (item) => {
      delivered.push(item);
    });
    expect(delivered).toEqual([1, 2, 3, 4]);
  });

  it("drops an item the API permanently refuses, so one bad message cannot block the queue forever", async () => {
    const dropped: Array<[unknown, string]> = [];
    const buffer = new OfflineBuffer<string>({ onDrop: (item, reason) => dropped.push([item, reason]) });
    ["good-1", "bad", "good-2"].forEach((item) => buffer.append(item));

    const delivered: string[] = [];
    const result = await buffer.flush(async (item) => {
      if (item === "bad") throw new DeliveryError("unknown device", true);
      delivered.push(item);
    });

    expect(delivered).toEqual(["good-1", "good-2"]);
    expect(result).toEqual({ sent: 2, retained: 0, dropped: 1 });
    expect(dropped).toEqual([["bad", "unknown device"]]);
  });

  it("never runs two flushes at once, so nothing is sent twice", async () => {
    const buffer = new OfflineBuffer<string>();
    buffer.append("a");
    buffer.append("b");

    const sent: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = buffer.flush(async (item) => {
      await gate;
      sent.push(item);
    });
    // Called while the first is still waiting on the network, as the interval timer would.
    const second = await buffer.flush(async (item) => {
      sent.push(`duplicate-${item}`);
    });
    expect(second.sent).toBe(0);
    expect(second.retained).toBe(2);

    release();
    await first;
    expect(sent).toEqual(["a", "b"]);
  });

  it("keeps readings that arrive while a flush is in progress, behind the ones still waiting", async () => {
    const buffer = new OfflineBuffer<string>();
    buffer.append("old-1");

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const flushing = buffer.flush(async () => {
      await gate;
      throw new DeliveryError("API unreachable", false);
    });
    buffer.append("new-1");
    expect(buffer.size()).toBe(2);

    release();
    await flushing;
    expect(buffer.snapshot()).toEqual(["old-1", "new-1"]);
  });

  it("caps its size by discarding the oldest readings", () => {
    const discarded: unknown[] = [];
    const buffer = new OfflineBuffer<number>({ maxItems: 3, onDrop: (item) => discarded.push(item) });
    [1, 2, 3, 4, 5].forEach((item) => buffer.append(item));

    expect(buffer.snapshot()).toEqual([3, 4, 5]);
    expect(discarded).toEqual([1, 2]);
  });
});

describe("edge agent offline buffer persistence", () => {
  let directory: string;
  let path: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "greecon-buffer-"));
    path = join(directory, "state", "buffer.jsonl");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("survives a restart: what was waiting is waiting again", () => {
    const before = new OfflineBuffer<{ n: number }>({ persistPath: path });
    before.append({ n: 1 });
    before.append({ n: 2 });

    const after = new OfflineBuffer<{ n: number }>({ persistPath: path });
    expect(after.snapshot()).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("removes delivered readings from disk, so a restart does not send them again", async () => {
    const buffer = new OfflineBuffer<{ n: number }>({ persistPath: path });
    [1, 2, 3].forEach((n) => buffer.append({ n }));

    await buffer.flush(async (item) => {
      if (item.n === 3) throw new DeliveryError("API went away", false);
    });

    const restarted = new OfflineBuffer<{ n: number }>({ persistPath: path });
    expect(restarted.snapshot()).toEqual([{ n: 3 }]);
  });

  it("ignores a line cut short by a power loss and keeps everything before it", () => {
    const first = new OfflineBuffer<{ n: number }>({ persistPath: path });
    first.append({ n: 1 });
    first.append({ n: 2 });
    appendFileSync(path, '{"n":3');

    const restarted = new OfflineBuffer<{ n: number }>({ persistPath: path });
    expect(restarted.snapshot()).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("keeps only the newest readings when a restored backlog exceeds the cap", () => {
    mkdirIfNeeded(path);
    writeFileSync(path, [1, 2, 3, 4, 5].map((n) => `${JSON.stringify({ n })}\n`).join(""));

    const buffer = new OfflineBuffer<{ n: number }>({ persistPath: path, maxItems: 2 });
    expect(buffer.snapshot()).toEqual([{ n: 4 }, { n: 5 }]);
    // And the file was trimmed to match, so it cannot grow back to the old size on its own.
    expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("keeps the file from growing without bound during a long outage", () => {
    const buffer = new OfflineBuffer<{ n: number }>({ persistPath: path, maxItems: 5 });
    for (let n = 1; n <= 40; n += 1) buffer.append({ n });

    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines.length).toBeLessThanOrEqual(5 * 2 + 1);
    expect(buffer.snapshot().map((item) => item.n)).toEqual([36, 37, 38, 39, 40]);

    const restarted = new OfflineBuffer<{ n: number }>({ persistPath: path, maxItems: 5 });
    expect(restarted.snapshot().map((item) => item.n)).toEqual([36, 37, 38, 39, 40]);
  });

  it("reads back a file of many megabytes, with accented text across the places it is read in pieces, exactly as written", () => {
    const writing = new OfflineBuffer<{ n: number; text: string }>({ persistPath: path, maxItems: 100_000 });
    // About 4 MB: more than the megabyte the file is read in at a time, with two-byte letters throughout.
    for (let n = 0; n < 4000; n += 1) writing.append({ n, text: `Pompa në shtëpinë e ujit ${"çë".repeat(300)} ${n}` });

    const restarted = new OfflineBuffer<{ n: number; text: string }>({ persistPath: path, maxItems: 100_000 });
    expect(restarted.size()).toBe(4000);
    expect(restarted.snapshot()).toEqual(writing.snapshot());
    expect(statSync(path).size).toBeGreaterThan(3 * 1_048_576);
  });

  it("writes a large backlog back in pieces without losing or reordering any of it", async () => {
    const buffer = new OfflineBuffer<{ n: number; text: string }>({ persistPath: path, maxItems: 100_000 });
    for (let n = 0; n < 3000; n += 1) buffer.append({ n, text: "x".repeat(900) });
    await buffer.flushInBatches(async (batch) => ({ remaining: [], delivered: batch.length, dropped: 0 }), 10).then(() => undefined);

    // Everything went; nothing is left on disk.
    expect(new OfflineBuffer<unknown>({ persistPath: path }).size()).toBe(0);

    for (let n = 0; n < 3000; n += 1) buffer.append({ n, text: "y".repeat(900) });
    await buffer.flushInBatches(async (batch) => ({ remaining: batch, delivered: 0, dropped: 0 }), 1000);
    expect(buffer.size()).toBe(3000);
    // A failed send rewrites nothing worse than before: what is on disk is what is waiting, in order.
    const again = new OfflineBuffer<{ n: number }>({ persistPath: path, maxItems: 100_000 });
    expect(again.snapshot().map((item) => item.n)).toEqual(Array.from({ length: 3000 }, (_, n) => n));
  });

  it("creates its state directory and leaves no temporary file behind", async () => {
    const buffer = new OfflineBuffer<string>({ persistPath: path });
    buffer.append("x");
    await buffer.flush(async () => undefined);

    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });
});

function mkdirIfNeeded(file: string): void {
  const buffer = new OfflineBuffer<string>({ persistPath: file });
  buffer.append("seed");
  writeFileSync(file, "");
}
