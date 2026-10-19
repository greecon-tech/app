import { CanonicalPointName } from "@greecon/shared";

// How much energy a site produced and used, and how much water it pumped, worked out from the power
// and flow readings it already sends: each stretch between two readings adds the average of the two
// times the length of the stretch. Totals are kept per point per hour so any period can be added up
// quickly, however long the raw history is.
//
// Honest by construction. A stretch is only counted when the two readings are close enough to say
// what happened between them (MAX_GAP_SECONDS); a longer silence adds nothing and shows up as missing
// coverage rather than as an estimate. A reading that is out of order, flagged bad or negative is
// never counted, and cuts the thread so a bad value cannot be averaged into a good one.

export type AmountUnit = "kWh" | "L";

interface Integrated {
  unit: AmountUnit;
  /** What one second at a reading of 1 adds. kW to kWh: 1/3600. Litres per minute to litres: 1/60. */
  perSecond: number;
}

const KW: Integrated = { unit: "kWh", perSecond: 1 / 3600 };

export const INTEGRATED_POINTS: Readonly<Partial<Record<CanonicalPointName, Integrated>>> = {
  "energy.solar.power.kw": KW,
  "energy.consumption.kw": KW,
  "energy.grid.import.kw": KW,
  "energy.grid.export.kw": KW,
  "water.flow.lpm": { unit: "L", perSecond: 1 / 60 }
};

/** Two readings further apart than this are not joined: nobody knows what happened in between. */
export const MAX_GAP_SECONDS = 15 * 60;

/** A reading slightly below zero is meter noise; further below is a sensor wired backwards. */
const NOISE_FLOOR = -0.05;

const HOUR_MS = 3_600_000;

export interface LedgerSample {
  tenantId: string;
  siteId: string;
  pointId: string;
  canonicalName: CanonicalPointName;
  timestampMs: number;
  value: number;
  quality: "OK" | "WARN" | "BAD";
}

/** What has been added to one point's hour since the last time totals were saved. */
export interface BucketDelta {
  tenantId: string;
  siteId: string;
  pointId: string;
  canonicalName: CanonicalPointName;
  hourStartMs: number;
  amount: number;
  coveredSeconds: number;
}

export interface BucketTotal {
  pointId: string;
  canonicalName: CanonicalPointName;
  amount: number;
  coveredSeconds: number;
  /** The start of the oldest hour held for this point in the range. */
  firstHourMs: number;
}

/** Where hourly totals are kept. Adding is additive, so saving the same delta once is exact and a
 * restart in the middle of an hour loses nothing that was already saved. */
export interface BucketStore {
  add(deltas: BucketDelta[]): Promise<void>;
  totals(siteId: string, fromMs: number, toMs: number): Promise<BucketTotal[]>;
  /** Whether anything at all is held for the site. */
  has(siteId: string): Promise<boolean>;
}

export class EnergyLedger {
  private readonly last = new Map<string, { timestampMs: number; value: number }>();
  private dirty = new Map<string, BucketDelta>();

  constructor(private readonly store: BucketStore) {}

  record(sample: LedgerSample): void {
    const spec = INTEGRATED_POINTS[sample.canonicalName];
    if (!spec) return;

    if (sample.quality === "BAD" || !Number.isFinite(sample.value) || sample.value < NOISE_FLOOR || !Number.isFinite(sample.timestampMs)) {
      this.last.delete(sample.pointId);
      return;
    }
    const value = Math.max(0, sample.value);

    const previous = this.last.get(sample.pointId);
    // Late or repeated: the newer reading already stands, and counting this one would double an interval.
    if (previous && sample.timestampMs <= previous.timestampMs) return;
    this.last.set(sample.pointId, { timestampMs: sample.timestampMs, value });
    if (!previous) return;

    const gapSeconds = (sample.timestampMs - previous.timestampMs) / 1000;
    if (gapSeconds > MAX_GAP_SECONDS) return;

    const average = (previous.value + value) / 2;
    for (let hourStart = Math.floor(previous.timestampMs / HOUR_MS) * HOUR_MS; hourStart < sample.timestampMs; hourStart += HOUR_MS) {
      const from = Math.max(previous.timestampMs, hourStart);
      const to = Math.min(sample.timestampMs, hourStart + HOUR_MS);
      const seconds = (to - from) / 1000;
      this.add(sample, hourStart, average * spec.perSecond * seconds, seconds);
    }
  }

  private add(sample: LedgerSample, hourStartMs: number, amount: number, coveredSeconds: number): void {
    const key = `${sample.pointId}|${hourStartMs}`;
    const held = this.dirty.get(key);
    if (held) {
      held.amount += amount;
      held.coveredSeconds += coveredSeconds;
      return;
    }
    this.dirty.set(key, {
      tenantId: sample.tenantId,
      siteId: sample.siteId,
      pointId: sample.pointId,
      canonicalName: sample.canonicalName,
      hourStartMs,
      amount,
      coveredSeconds
    });
  }

  /** Saves what has been counted since the last save. If saving fails nothing is lost: the counts
   * stay and are saved with the next attempt. */
  async flush(): Promise<void> {
    if (this.dirty.size === 0) return;
    const batch = this.dirty;
    this.dirty = new Map();
    try {
      await this.store.add([...batch.values()]);
    } catch (error) {
      for (const [key, delta] of batch) {
        const newer = this.dirty.get(key);
        if (newer) {
          newer.amount += delta.amount;
          newer.coveredSeconds += delta.coveredSeconds;
        } else {
          this.dirty.set(key, delta);
        }
      }
      throw error;
    }
  }

  /** Totals for a site over a range, including what has been counted but not yet saved. */
  async totals(siteId: string, fromMs: number, toMs: number): Promise<BucketTotal[]> {
    await this.flush();
    return this.store.totals(siteId, fromMs, toMs);
  }

  /** Whether any total is held for a site, so history written for the demo is only ever written once. */
  hasTotals(siteId: string): Promise<boolean> {
    return this.store.has(siteId);
  }

  /** Writes totals that were worked out elsewhere (the demo's history) straight to the store. */
  seed(deltas: BucketDelta[]): Promise<void> {
    return this.store.add(deltas);
  }

  /** Forgets the previous reading of a point, so a gap that is known (the gateway was replaced, the
   * point was re-provisioned) is not bridged. */
  forget(pointId: string): void {
    this.last.delete(pointId);
  }
}

export class MemoryBucketStore implements BucketStore {
  private readonly buckets = new Map<string, BucketDelta>();

  async add(deltas: BucketDelta[]): Promise<void> {
    for (const delta of deltas) {
      const key = `${delta.pointId}|${delta.hourStartMs}`;
      const held = this.buckets.get(key);
      if (held) {
        held.amount += delta.amount;
        held.coveredSeconds += delta.coveredSeconds;
      } else {
        this.buckets.set(key, { ...delta });
      }
    }
  }

  async totals(siteId: string, fromMs: number, toMs: number): Promise<BucketTotal[]> {
    const byPoint = new Map<string, BucketTotal>();
    for (const bucket of this.buckets.values()) {
      if (bucket.siteId !== siteId || bucket.hourStartMs < Math.floor(fromMs / HOUR_MS) * HOUR_MS || bucket.hourStartMs > toMs) continue;
      const held = byPoint.get(bucket.pointId);
      if (held) {
        held.amount += bucket.amount;
        held.coveredSeconds += bucket.coveredSeconds;
        held.firstHourMs = Math.min(held.firstHourMs, bucket.hourStartMs);
      } else {
        byPoint.set(bucket.pointId, {
          pointId: bucket.pointId,
          canonicalName: bucket.canonicalName,
          amount: bucket.amount,
          coveredSeconds: bucket.coveredSeconds,
          firstHourMs: bucket.hourStartMs
        });
      }
    }
    return [...byPoint.values()];
  }

  async has(siteId: string): Promise<boolean> {
    for (const bucket of this.buckets.values()) if (bucket.siteId === siteId) return true;
    return false;
  }
}
