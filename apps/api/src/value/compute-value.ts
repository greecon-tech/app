import { CanonicalPointName, Comparison, CurrencyCode, SiteProfile, SiteValue } from "@greecon/shared";
import { BucketTotal } from "./energy-ledger";
import { DEFAULT_TIME_ZONE, formatLocalDate, Period } from "./periods";

// Turns hourly totals and a site's own prices into what a screen shows. Every number is a sum of
// readings or a sum times a price the site entered. Nothing is estimated: where the readings are
// missing the totals are low and the coverage says by how much, and where a price or a reading is
// absent the figure that needs it is absent and the reply says what to provide.

const SOLAR: CanonicalPointName = "energy.solar.power.kw";
const IMPORT: CanonicalPointName = "energy.grid.import.kw";
const EXPORT: CanonicalPointName = "energy.grid.export.kw";
const CONSUMPTION: CanonicalPointName = "energy.consumption.kw";
const FLOW: CanonicalPointName = "water.flow.lpm";

/** Below this share of the period, a comparison with a typical month would flatter the result. */
export const MINIMUM_COVERAGE_FOR_COMPARISON = 0.9;

/** A month so far is only compared with a typical month once this many whole days of it have passed. A
 * typical month spread evenly over its hours is not what the first night of a month looks like, so a comparison
 * made at six o'clock on the first would show a saving that is only the hour of day. */
export const MINIMUM_DAYS_FOR_COMPARISON = 7;

export interface ComputeInput {
  siteId: string;
  period: Period;
  profile: SiteProfile | undefined;
  totals: BucketTotal[];
  simulated: boolean;
  currency?: CurrencyCode;
}

interface Quantity {
  amount: number;
  /** Mean over the quantity's points of the share of the period they were counted for. */
  coverageOfPeriod: number;
  coverageSinceStart: number;
  firstHourMs: number;
}

function quantity(name: CanonicalPointName, totals: BucketTotal[], period: Period): Quantity | undefined {
  const rows = totals.filter((row) => row.canonicalName === name);
  if (rows.length === 0) return undefined;
  const periodSeconds = Math.max(1, (period.toMs - period.fromMs) / 1000);
  let coverageOfPeriod = 0;
  let coverageSinceStart = 0;
  let firstHourMs = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    coverageOfPeriod += Math.min(1, row.coveredSeconds / periodSeconds);
    const sinceSeconds = Math.max(1, (period.toMs - Math.max(period.fromMs, row.firstHourMs)) / 1000);
    coverageSinceStart += Math.min(1, row.coveredSeconds / sinceSeconds);
    firstHourMs = Math.min(firstHourMs, row.firstHourMs);
  }
  return {
    amount: rows.reduce((sum, row) => sum + row.amount, 0),
    coverageOfPeriod: coverageOfPeriod / rows.length,
    coverageSinceStart: coverageSinceStart / rows.length,
    firstHourMs
  };
}

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function computeSiteValue(input: ComputeInput): SiteValue {
  const { period, profile, totals } = input;
  const assumptions: string[] = [];
  const missing: SiteValue["missing"] = [];
  const timezone = profile?.timezone ?? DEFAULT_TIME_ZONE;

  const solar = quantity(SOLAR, totals, period);
  const imported = quantity(IMPORT, totals, period);
  const exportedMeasured = quantity(EXPORT, totals, period);
  const consumed = quantity(CONSUMPTION, totals, period);
  const flow = quantity(FLOW, totals, period);

  const zeroExport = profile?.zeroExport === true;
  const exportedKwh = exportedMeasured?.amount ?? (zeroExport && solar ? 0 : undefined);

  const used = [solar, imported, exportedMeasured, consumed, flow].filter((item): item is Quantity => item !== undefined);
  const coverage = {
    ofPeriod: used.length > 0 ? round(Math.min(...used.map((item) => item.coverageOfPeriod)), 3) : 0,
    sinceDataStart: used.length > 0 ? round(Math.min(...used.map((item) => item.coverageSinceStart)), 3) : 0,
    dataStartUtc: used.length > 0 ? new Date(Math.max(period.fromMs, Math.min(...used.map((item) => item.firstHourMs)))).toISOString() : undefined
  };

  const prices = {
    importPerKwh: profile?.importPricePerKwh,
    exportPerKwh: profile?.exportPricePerKwh,
    waterPerM3: profile?.waterPricePerM3
  };

  const producedKwh = solar?.amount;
  const keptOnSiteKwh = producedKwh !== undefined && exportedKwh !== undefined ? Math.max(0, producedKwh - exportedKwh) : undefined;
  const importedKwh = imported?.amount;
  const consumedKwh = consumed?.amount;

  let solarShareOfUsePercent: number | undefined;
  if (keptOnSiteKwh !== undefined) {
    const useKwh = consumedKwh !== undefined ? consumedKwh : importedKwh !== undefined ? keptOnSiteKwh + importedKwh : undefined;
    if (useKwh !== undefined && useKwh > 0) solarShareOfUsePercent = round(Math.min(100, (keptOnSiteKwh / useKwh) * 100), 1);
  }

  const hasEnergy = solar !== undefined || imported !== undefined || exportedMeasured !== undefined || consumed !== undefined;
  const energy: NonNullable<SiteValue["energy"]> | undefined = hasEnergy
    ? {
        producedKwh: producedKwh !== undefined ? round(producedKwh, 1) : undefined,
        keptOnSiteKwh: keptOnSiteKwh !== undefined ? round(keptOnSiteKwh, 1) : undefined,
        exportedKwh: exportedKwh !== undefined ? round(exportedKwh, 1) : undefined,
        importedKwh: importedKwh !== undefined ? round(importedKwh, 1) : undefined,
        consumedKwh: consumedKwh !== undefined ? round(consumedKwh, 1) : undefined,
        solarShareOfUsePercent,
        avoidedPurchase: keptOnSiteKwh !== undefined && prices.importPerKwh !== undefined ? round(keptOnSiteKwh * prices.importPerKwh, 2) : undefined,
        exportIncome: exportedKwh !== undefined && prices.exportPerKwh !== undefined ? round(exportedKwh * prices.exportPerKwh, 2) : undefined,
        boughtCost: importedKwh !== undefined && prices.importPerKwh !== undefined ? round(importedKwh * prices.importPerKwh, 2) : undefined
      }
    : undefined;

  const pumpedM3 = flow ? flow.amount / 1000 : undefined;
  const water: SiteValue["water"] | undefined = flow
    ? { pumpedM3: round(pumpedM3 as number, 1), cost: prices.waterPerM3 !== undefined ? round((pumpedM3 as number) * prices.waterPerM3, 2) : undefined }
    : undefined;

  // What the numbers rest on, in the words someone would use to explain them.
  if (hasEnergy) assumptions.push("Energy is added up from the site's power readings, taking the average of one reading and the next.");
  if (used.length > 0 && coverage.sinceDataStart < 0.995) {
    assumptions.push(`Readings were there for ${percent(coverage.sinceDataStart)} of the time since data began. Gaps are not estimated, so totals can be too low but never too high.`);
  }
  if (coverage.dataStartUtc && Date.parse(coverage.dataStartUtc) > period.fromMs + 3_600_000) {
    assumptions.push(`Data for this site begins ${formatLocalDate(Date.parse(coverage.dataStartUtc), timezone)}, so this period is only partly covered.`);
  }
  if (keptOnSiteKwh !== undefined) {
    assumptions.push('"Used on site" is solar produced minus what was sent to the grid. Energy that went into a battery counts as used on site.');
  }
  if (zeroExport && !exportedMeasured && solar) assumptions.push("This site cannot send energy to the grid, so nothing is counted as exported.");
  if (solarShareOfUsePercent !== undefined) {
    assumptions.push(
      consumedKwh !== undefined
        ? "Share of use is solar used on site divided by the site's measured consumption."
        : "Consumption is not measured, so share of use is solar used on site divided by solar used on site plus what was bought."
    );
  }

  if (solar && exportedKwh === undefined) {
    missing.push({
      what: "Grid export",
      how: "Without a meter reading for what is sent to the grid, how much solar stayed on site is not known. Add the export reading, or mark the site as unable to export under Prices and baseline."
    });
  }
  const wouldUsePrice = keptOnSiteKwh !== undefined || importedKwh !== undefined;
  if (wouldUsePrice && prices.importPerKwh === undefined) {
    missing.push({ what: "Electricity price", how: "Enter the price per kWh from the latest bill under Prices and baseline to see these figures in money." });
  }
  if (flow && prices.waterPerM3 === undefined) {
    missing.push({ what: "Water price", how: "Enter the price per cubic metre under Prices and baseline to see the cost of the water." });
  }
  if (prices.importPerKwh !== undefined && wouldUsePrice) {
    const exportText = prices.exportPerKwh !== undefined ? ` and ${prices.exportPerKwh} per kWh sent to the grid` : "";
    assumptions.push(`Money uses the prices entered for this site: ${prices.importPerKwh} per kWh bought${exportText}${profile?.updatedAtUtc ? `, as of ${formatLocalDate(Date.parse(profile.updatedAtUtc), timezone)}` : ""}.`);
  }

  const comparison: NonNullable<SiteValue["comparison"]> = {};
  if (period.monthFraction !== undefined) {
    if (profile?.baselineMonthlyImportKwh !== undefined && importedKwh !== undefined) {
      comparison.energy = compare("kWh", profile.baselineMonthlyImportKwh * period.monthFraction, importedKwh, coverage.ofPeriod, period, prices.importPerKwh);
    }
    if (profile?.baselineMonthlyWaterM3 !== undefined && pumpedM3 !== undefined) {
      comparison.water = compare("m³", profile.baselineMonthlyWaterM3 * period.monthFraction, pumpedM3, flow?.coverageOfPeriod ?? 0, period, prices.waterPerM3);
    }
    if (comparison.energy?.available || comparison.water?.available) {
      assumptions.push(
        "The comparison is with a typical month before, as entered for this site. Weather, occupancy and tariff changes also move these numbers, so the difference is not all due to one thing."
      );
    }
  }

  return {
    siteId: input.siteId,
    period: { key: period.key, label: period.label, fromUtc: new Date(period.fromMs).toISOString(), toUtc: new Date(period.toMs).toISOString() },
    simulated: input.simulated,
    timezone,
    currency: profile?.currency ?? input.currency ?? "EUR",
    coverage,
    energy,
    water,
    comparison: comparison.energy || comparison.water ? comparison : undefined,
    prices,
    assumptions,
    missing
  };
}

function compare(unit: "kWh" | "m³", baseline: number, actual: number, coverageOfPeriod: number, period: Period, price: number | undefined): Comparison {
  if (period.days < MINIMUM_DAYS_FOR_COMPARISON) {
    return {
      available: false,
      reason: `Only ${Math.floor(period.days)} whole day${Math.floor(period.days) === 1 ? "" : "s"} of ${period.label.toLowerCase()} have passed. A comparison with a typical month needs at least ${MINIMUM_DAYS_FOR_COMPARISON} days, because the first hours of a month are not like an average hour of it.`
    };
  }
  if (coverageOfPeriod < MINIMUM_COVERAGE_FOR_COMPARISON) {
    return {
      available: false,
      reason: `Readings cover ${percent(coverageOfPeriod)} of ${period.label.toLowerCase()}. A comparison needs at least ${percent(MINIMUM_COVERAGE_FOR_COMPARISON)}, because a gap in the readings would look like a saving.`
    };
  }
  if (baseline <= 0) return { available: false, reason: "The baseline entered for this site is zero, so there is nothing to compare with." };
  const difference = baseline - actual;
  return {
    available: true,
    unit,
    baselineAmount: round(baseline, 1),
    actualAmount: round(actual, 1),
    differenceAmount: round(difference, 1),
    differencePercent: round((difference / baseline) * 100, 1),
    differenceValue: price !== undefined ? round(difference * price, 2) : undefined
  };
}
