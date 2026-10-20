import { describe, expect, it } from "vitest";
import { SiteProfile } from "@greecon/shared";
import { computeSiteValue, MINIMUM_COVERAGE_FOR_COMPARISON, MINIMUM_DAYS_FOR_COMPARISON } from "./compute-value";
import { BucketTotal } from "./energy-ledger";
import { resolvePeriod } from "./periods";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const month = resolvePeriod("month", NOW, "Europe/Tirane");
const last30 = resolvePeriod("last30", NOW, "Europe/Tirane");
const periodSeconds = (month.toMs - month.fromMs) / 1000;

function total(canonicalName: BucketTotal["canonicalName"], amount: number, coverage = 1, pointId = canonicalName): BucketTotal {
  return { pointId, canonicalName, amount, coveredSeconds: periodSeconds * coverage, firstHourMs: month.fromMs };
}

const profile = (extra: Partial<SiteProfile> = {}): SiteProfile => ({
  siteId: "site",
  tenantId: "tenant",
  timezone: "Europe/Tirane",
  currency: "EUR",
  zeroExport: false,
  ...extra
});

const farmMonth = [total("energy.solar.power.kw", 1000), total("energy.grid.export.kw", 400), total("energy.grid.import.kw", 300), total("energy.consumption.kw", 900)];

describe("computeSiteValue", () => {
  it("shows what stayed on site and what it would have cost to buy, at the site's own price", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: profile({ importPricePerKwh: 0.15, exportPricePerKwh: 0.06 }), totals: farmMonth, simulated: false });

    expect(value.energy).toMatchObject({
      producedKwh: 1000,
      exportedKwh: 400,
      keptOnSiteKwh: 600,
      importedKwh: 300,
      consumedKwh: 900,
      avoidedPurchase: 90,
      exportIncome: 24,
      boughtCost: 45
    });
    // Solar covered 600 of the 900 kWh used.
    expect(value.energy?.solarShareOfUsePercent).toBeCloseTo(66.7, 1);
    expect(value.missing).toEqual([]);
    expect(value.currency).toBe("EUR");
    expect(value.assumptions.join(" ")).toContain("0.15 per kWh bought and 0.06 per kWh sent to the grid");
  });

  it("shows quantities and says what is needed for money when the site has not entered a price", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: undefined, totals: farmMonth, simulated: false });

    expect(value.energy?.keptOnSiteKwh).toBe(600);
    expect(value.energy?.avoidedPurchase).toBeUndefined();
    expect(value.energy?.boughtCost).toBeUndefined();
    expect(value.prices).toEqual({ importPerKwh: undefined, exportPerKwh: undefined, waterPerM3: undefined });
    expect(value.missing.map((item) => item.what)).toEqual(["Electricity price"]);
  });

  it("does not guess how much solar stayed on site when nothing measures the grid export", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: profile({ importPricePerKwh: 0.15 }), totals: [total("energy.solar.power.kw", 1000), total("energy.grid.import.kw", 300)], simulated: false });

    expect(value.energy?.producedKwh).toBe(1000);
    expect(value.energy?.keptOnSiteKwh).toBeUndefined();
    expect(value.energy?.avoidedPurchase).toBeUndefined();
    expect(value.missing.map((item) => item.what)).toContain("Grid export");
  });

  it("takes export as zero for a site that says it cannot export, and says so", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: profile({ zeroExport: true, importPricePerKwh: 0.2 }), totals: [total("energy.solar.power.kw", 500)], simulated: false });

    expect(value.energy?.exportedKwh).toBe(0);
    expect(value.energy?.keptOnSiteKwh).toBe(500);
    expect(value.energy?.avoidedPurchase).toBe(100);
    expect(value.assumptions.join(" ")).toContain("cannot send energy to the grid");
    expect(value.missing.map((item) => item.what)).not.toContain("Grid export");
  });

  it("falls back to solar plus purchases for the share of use when consumption is not measured, and says so", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile(),
      totals: [total("energy.solar.power.kw", 700), total("energy.grid.export.kw", 100), total("energy.grid.import.kw", 400)],
      simulated: false
    });
    // 600 kept; use is taken as 600 + 400.
    expect(value.energy?.solarShareOfUsePercent).toBe(60);
    expect(value.assumptions.join(" ")).toContain("Consumption is not measured");
  });

  it("never lets kept on site go below zero, whatever the meters say", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: profile(), totals: [total("energy.solar.power.kw", 100), total("energy.grid.export.kw", 130)], simulated: false });
    expect(value.energy?.keptOnSiteKwh).toBe(0);
  });

  it("adds up several inverters and reports the weakest coverage, never the best", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile(),
      totals: [total("energy.solar.power.kw", 600, 1, "a"), total("energy.solar.power.kw", 400, 0.6, "b"), total("energy.grid.export.kw", 100)],
      simulated: false
    });
    expect(value.energy?.producedKwh).toBe(1000);
    expect(value.coverage.ofPeriod).toBeCloseTo(0.8, 3);
    expect(value.assumptions.join(" ")).toContain("Gaps are not estimated");
  });

  it("compares purchases with a typical month before, prorated, and values the difference at the site's price", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile({ importPricePerKwh: 0.15, baselineMonthlyImportKwh: 1000 }),
      totals: farmMonth,
      simulated: false
    });
    const baseline = 1000 * (month.monthFraction as number);

    expect(value.comparison?.energy).toMatchObject({ available: true, unit: "kWh" });
    const energy = value.comparison?.energy;
    if (!energy?.available) throw new Error("expected a comparison");
    expect(energy.baselineAmount).toBeCloseTo(baseline, 0);
    expect(energy.actualAmount).toBe(300);
    expect(energy.differenceAmount).toBeCloseTo(baseline - 300, 0);
    expect(energy.differencePercent).toBeGreaterThan(0);
    expect(energy.differenceValue).toBeCloseTo((baseline - 300) * 0.15, 0);
    expect(value.assumptions.join(" ")).toContain("not all due to one thing");
  });

  it("refuses to compare when the readings have gaps, because a gap would look like a saving", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile({ baselineMonthlyImportKwh: 1000 }),
      totals: [total("energy.grid.import.kw", 100, MINIMUM_COVERAGE_FOR_COMPARISON - 0.2)],
      simulated: false
    });
    expect(value.comparison?.energy).toMatchObject({ available: false });
    expect((value.comparison?.energy as { reason: string }).reason).toContain("a gap in the readings would look like a saving");
  });

  it("does not compare the first days of a month with a typical month, because the hour of the day alone would look like a saving", () => {
    // Six o'clock on the first of the month: six night hours against six hours' share of a month.
    // Midnight in Tirane on 1 October is 22:00 UTC the evening before (it is UTC+2 until the end of October).
    const midnight = Date.parse("2026-09-30T22:00:00Z");
    const sixHoursIn = resolvePeriod("month", midnight + 6 * 3_600_000, "Europe/Tirane");
    expect(sixHoursIn.days).toBeLessThan(MINIMUM_DAYS_FOR_COMPARISON);
    const value = computeSiteValue({
      siteId: "site",
      period: sixHoursIn,
      profile: profile({ importPricePerKwh: 0.15, baselineMonthlyImportKwh: 1000 }),
      totals: [{ pointId: "i", canonicalName: "energy.grid.import.kw", amount: 1.2, coveredSeconds: sixHoursIn.days * 86_400, firstHourMs: sixHoursIn.fromMs }],
      simulated: false
    });
    expect(value.comparison?.energy).toMatchObject({ available: false });
    expect((value.comparison?.energy as { reason: string }).reason).toContain("needs at least 7 days");

    // From the seventh day on, it can.
    const later = resolvePeriod("month", sixHoursIn.fromMs + 7.5 * 86_400_000, "Europe/Tirane");
    const seven = computeSiteValue({
      siteId: "site",
      period: later,
      profile: profile({ importPricePerKwh: 0.15, baselineMonthlyImportKwh: 1000 }),
      totals: [{ pointId: "i", canonicalName: "energy.grid.import.kw", amount: 200, coveredSeconds: later.days * 86_400, firstHourMs: later.fromMs }],
      simulated: false
    });
    expect(seven.comparison?.energy).toMatchObject({ available: true });
  });

  it("compares only over periods where a monthly baseline is fair", () => {
    const week = computeSiteValue({ siteId: "site", period: resolvePeriod("week", NOW), profile: profile({ baselineMonthlyImportKwh: 1000 }), totals: farmMonth, simulated: false });
    expect(week.comparison).toBeUndefined();

    const thirty = computeSiteValue({
      siteId: "site",
      period: last30,
      profile: profile({ baselineMonthlyImportKwh: 1000 }),
      totals: [{ pointId: "i", canonicalName: "energy.grid.import.kw", amount: 700, coveredSeconds: 30 * 86400, firstHourMs: last30.fromMs }],
      simulated: false
    });
    expect(thirty.comparison?.energy).toMatchObject({ available: true });
  });

  it("adds up water and its cost, and compares it with a typical month", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile({ waterPricePerM3: 1.2, baselineMonthlyWaterM3: 200 }),
      totals: [total("water.flow.lpm", 60_000)],
      simulated: false
    });
    expect(value.water).toEqual({ pumpedM3: 60, cost: 72 });
    expect(value.comparison?.water).toMatchObject({ available: true, unit: "m³" });
  });

  it("says nothing about energy or water a site does not measure", () => {
    const value = computeSiteValue({ siteId: "site", period: month, profile: undefined, totals: [], simulated: false });
    expect(value.energy).toBeUndefined();
    expect(value.water).toBeUndefined();
    expect(value.coverage.ofPeriod).toBe(0);
    expect(value.missing).toEqual([]);
  });

  it("carries the simulated flag so the demo is never mistaken for a customer", () => {
    expect(computeSiteValue({ siteId: "site", period: month, profile: undefined, totals: farmMonth, simulated: true }).simulated).toBe(true);
  });

  it("says when data for the site begins part way through the period", () => {
    const value = computeSiteValue({
      siteId: "site",
      period: month,
      profile: profile(),
      totals: [{ pointId: "s", canonicalName: "energy.solar.power.kw", amount: 10, coveredSeconds: 3 * 86400, firstHourMs: month.toMs - 3 * 86400_000 }, { pointId: "e", canonicalName: "energy.grid.export.kw", amount: 1, coveredSeconds: 3 * 86400, firstHourMs: month.toMs - 3 * 86400_000 }],
      simulated: false
    });
    expect(value.assumptions.join(" ")).toContain("Data for this site begins");
    expect(value.coverage.sinceDataStart).toBeGreaterThan(0.95);
    expect(value.coverage.ofPeriod).toBeLessThan(0.5);
  });
});
