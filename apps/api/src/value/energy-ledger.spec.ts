import { describe, expect, it } from "vitest";
import { valuePoints } from "@greecon/shared";
import { BucketDelta, BucketStore, BucketTotal, EnergyLedger, INTEGRATED_POINTS, LedgerSample, MAX_GAP_SECONDS, MemoryBucketStore } from "./energy-ledger";

const SITE = "22222222-2222-4222-8222-222222222201";
const TENANT = "11111111-1111-4111-8111-111111111111";
const SOLAR = "55555555-5555-4555-8555-555555555501";
const MINUTE = 60_000;
const T0 = Date.parse("2026-10-16T10:00:00Z");

function sample(minutes: number, value: number, extra: Partial<LedgerSample> = {}): LedgerSample {
  return { tenantId: TENANT, siteId: SITE, pointId: SOLAR, canonicalName: "energy.solar.power.kw", timestampMs: T0 + minutes * MINUTE, value, quality: "OK", ...extra };
}

async function totalOf(ledger: EnergyLedger, name = "energy.solar.power.kw"): Promise<BucketTotal | undefined> {
  return (await ledger.totals(SITE, T0 - 24 * 3_600_000, T0 + 24 * 3_600_000)).find((total) => total.canonicalName === name);
}

describe("EnergyLedger", () => {
  it("counts exactly the readings the screens say can be given a value", () => {
    expect(Object.keys(INTEGRATED_POINTS).sort()).toEqual([...valuePoints].sort());
  });

  it("adds up energy between readings: 10 kW for half an hour is 5 kWh, and says how much time it covers", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(10, 10));
    ledger.record(sample(20, 10));
    ledger.record(sample(30, 10));

    const total = await totalOf(ledger);
    expect(total?.amount).toBeCloseTo(5, 6);
    expect(total?.coveredSeconds).toBe(1800);
  });

  it("averages the two ends of a stretch: rising from 0 to 12 kW over ten minutes is 1 kWh", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 0));
    ledger.record(sample(10, 12));
    expect((await totalOf(ledger))?.amount).toBeCloseTo(1, 6);
  });

  it("splits a stretch that crosses an hour into the hours it belongs to", async () => {
    const store = new MemoryBucketStore();
    const ledger = new EnergyLedger(store);
    ledger.record(sample(50, 6));
    ledger.record(sample(60, 6));
    ledger.record(sample(70, 6));
    await ledger.flush();

    expect((await store.totals(SITE, T0, T0 + 30 * MINUTE))[0]?.amount).toBeCloseTo(1, 6);
    expect((await store.totals(SITE, T0 + 60 * MINUTE, T0 + 90 * MINUTE))[0]?.amount).toBeCloseTo(1, 6);
    expect((await totalOf(ledger))?.amount).toBeCloseTo(2, 6);
  });

  it("does not bridge a silence: a gap longer than the limit adds nothing and leaves coverage short", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(MAX_GAP_SECONDS / 60 + 1, 10));

    const total = await totalOf(ledger);
    expect(total).toBeUndefined();
  });

  it("counts a gap exactly at the limit", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(MAX_GAP_SECONDS / 60, 10));
    expect((await totalOf(ledger))?.amount).toBeCloseTo(2.5, 6);
  });

  it("starts again after a silence: only the stretches that are close enough are counted", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(5, 10));
    ledger.record(sample(120, 10));
    ledger.record(sample(125, 10));

    const total = await totalOf(ledger);
    expect(total?.coveredSeconds).toBe(600);
    expect(total?.amount).toBeCloseTo((10 * 600) / 3600, 6);
  });

  it("ignores a reading that arrives out of order or twice, so an interval is never counted twice", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(10, 10));
    ledger.record(sample(10, 10));
    ledger.record(sample(5, 99));
    expect((await totalOf(ledger))?.amount).toBeCloseTo((10 * 600) / 3600, 6);
  });

  it("cuts the thread at a reading flagged bad, so a bad value is never averaged into a good one", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.record(sample(5, 500, { quality: "BAD" }));
    ledger.record(sample(10, 10));
    expect(await totalOf(ledger)).toBeUndefined();

    ledger.record(sample(15, 10));
    expect((await totalOf(ledger))?.coveredSeconds).toBe(300);
  });

  it("treats a small negative as meter noise (zero) and a larger one as a wiring fault that cuts the thread", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 0));
    ledger.record(sample(10, -0.02));
    expect((await totalOf(ledger))?.amount).toBe(0);

    const other = new EnergyLedger(new MemoryBucketStore());
    other.record(sample(0, 5));
    other.record(sample(5, -3));
    other.record(sample(10, 5));
    expect(await totalOf(other)).toBeUndefined();
  });

  it("adds up water the same way: 60 litres a minute for ten minutes is 600 litres", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    const flow = (minutes: number, value: number): LedgerSample => ({ ...sample(minutes, value), pointId: "flow-1", canonicalName: "water.flow.lpm" });
    ledger.record(flow(0, 60));
    ledger.record(flow(10, 60));
    expect((await totalOf(ledger, "water.flow.lpm"))?.amount).toBeCloseTo(600, 6);
  });

  it("ignores points that are not flows, such as a tank level", async () => {
    const store = new MemoryBucketStore();
    const ledger = new EnergyLedger(store);
    const level = (minutes: number): LedgerSample => ({ ...sample(minutes, 60), pointId: "tank-1", canonicalName: "water.tank.level.percent" });
    ledger.record(level(0));
    ledger.record(level(5));
    expect(await ledger.totals(SITE, T0 - 3_600_000, T0 + 3_600_000)).toEqual([]);
  });

  it("keeps each point apart, so two inverters add up and each shows its own coverage", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    for (const pointId of ["inverter-a", "inverter-b"]) {
      for (const minutes of [0, 10, 20, 30]) ledger.record(sample(minutes, 10, { pointId }));
    }
    const totals = await ledger.totals(SITE, T0 - 3_600_000, T0 + 3_600_000);
    expect(totals).toHaveLength(2);
    expect(totals.reduce((sum, total) => sum + total.amount, 0)).toBeCloseTo(10, 6);
    expect(totals.every((total) => total.coveredSeconds === 1800)).toBe(true);
  });

  it("only reports the site asked for, and only the range asked for", async () => {
    const store = new MemoryBucketStore();
    const ledger = new EnergyLedger(store);
    ledger.record(sample(0, 10));
    ledger.record(sample(10, 10));
    ledger.record(sample(0, 10, { siteId: "another-site", pointId: "p2" }));
    ledger.record(sample(10, 10, { siteId: "another-site", pointId: "p2" }));

    expect((await ledger.totals(SITE, T0, T0 + MINUTE)).map((total) => total.pointId)).toEqual([SOLAR]);
    expect(await ledger.totals(SITE, T0 + 5 * 3_600_000, T0 + 6 * 3_600_000)).toEqual([]);
  });

  it("saves counts additively, so a save in the middle of an hour and another later give the same total", async () => {
    const store = new MemoryBucketStore();
    const ledger = new EnergyLedger(store);
    ledger.record(sample(0, 10));
    ledger.record(sample(10, 10));
    await ledger.flush();
    ledger.record(sample(20, 10));
    await ledger.flush();

    expect((await store.totals(SITE, T0, T0 + 3_600_000))[0]?.amount).toBeCloseTo((10 * 1200) / 3600, 6);
  });

  it("loses nothing when saving fails: the counts wait and are saved once the store is back", async () => {
    const inner = new MemoryBucketStore();
    let failing = true;
    const flaky: BucketStore = {
      async add(deltas: BucketDelta[]) {
        if (failing) throw new Error("database is down");
        await inner.add(deltas);
      },
      totals: (site, from, to) => inner.totals(site, from, to),
      has: (site) => inner.has(site)
    };
    const ledger = new EnergyLedger(flaky);
    ledger.record(sample(0, 10));
    ledger.record(sample(10, 10));
    await expect(ledger.flush()).rejects.toThrow("database is down");

    ledger.record(sample(20, 10));
    failing = false;
    await ledger.flush();

    expect((await inner.totals(SITE, T0, T0 + 3_600_000))[0]?.amount).toBeCloseTo((10 * 1200) / 3600, 6);
    await ledger.flush();
    expect((await inner.totals(SITE, T0, T0 + 3_600_000))[0]?.amount).toBeCloseTo((10 * 1200) / 3600, 6);
  });

  it("can be told a gap is known, so it is not bridged", async () => {
    const ledger = new EnergyLedger(new MemoryBucketStore());
    ledger.record(sample(0, 10));
    ledger.forget(SOLAR);
    ledger.record(sample(5, 10));
    expect(await totalOf(ledger)).toBeUndefined();
  });
});
