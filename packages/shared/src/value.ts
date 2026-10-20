// What a site's energy and water are worth, from its own readings and its own prices. The contract
// types only: how they are worked out is in the API (apps/api/src/value), and a screen just shows them.

/** The readings energy and water are counted from: power in kW and flow in litres a minute. A site that
 * has none of these has nothing to put a value on. */
export const valuePoints = ["energy.solar.power.kw", "energy.consumption.kw", "energy.grid.import.kw", "energy.grid.export.kw", "water.flow.lpm"] as const;

export const currencyCodes = ["EUR", "ALL", "USD", "GBP"] as const;
export type CurrencyCode = (typeof currencyCodes)[number];

/** What the site pays and what it used before. Every price is the site's own, from its own bill:
 * there is no default price, and without one the platform shows quantities and says what is needed. */
export interface SiteProfile {
  siteId: string;
  tenantId: string;
  /** The site's own clock, for "today" and "this month". */
  timezone: string;
  currency: CurrencyCode;
  /** Price of one kWh bought from the grid. */
  importPricePerKwh?: number;
  /** Price paid for one kWh sent to the grid, if anything is paid. */
  exportPricePerKwh?: number;
  waterPricePerM3?: number;
  /** A typical month's purchases from the grid before, from past bills. */
  baselineMonthlyImportKwh?: number;
  /** A typical month's water before. */
  baselineMonthlyWaterM3?: number;
  baselineNote?: string;
  /** The site cannot send energy to the grid (zero export), so export that is not measured is zero. */
  zeroExport: boolean;
  updatedByUserId?: string;
  updatedAtUtc?: string;
}

export type ValuePeriodKey = "day" | "week" | "month" | "last30";

export type Comparison =
  | {
      available: true;
      unit: "kWh" | "m³";
      /** What a typical month before would have come to over this period. */
      baselineAmount: number;
      actualAmount: number;
      /** Positive when less was used than before. */
      differenceAmount: number;
      differencePercent: number;
      /** The difference at the site's own price, when it has set one. */
      differenceValue?: number;
    }
  | { available: false; reason: string };

export interface SiteValue {
  siteId: string;
  period: { key: ValuePeriodKey; label: string; fromUtc: string; toUtc: string };
  /** True when the readings behind this are simulated (the demo), so a screen can say so. */
  simulated: boolean;
  /** The site's own clock, which the period's edges and any date shown are in. */
  timezone: string;
  currency: CurrencyCode;
  /** Share of the time the readings were there to be counted, 0 to 1. Gaps are never estimated. */
  coverage: { ofPeriod: number; sinceDataStart: number; dataStartUtc?: string };
  energy?: {
    producedKwh?: number;
    /** Solar produced minus what went to the grid: what stayed on site. */
    keptOnSiteKwh?: number;
    exportedKwh?: number;
    importedKwh?: number;
    consumedKwh?: number;
    /** Share of the site's use that its own solar covered. */
    solarShareOfUsePercent?: number;
    /** What the energy kept on site would have cost to buy. */
    avoidedPurchase?: number;
    exportIncome?: number;
    boughtCost?: number;
  };
  water?: { pumpedM3?: number; cost?: number };
  comparison?: { energy?: Comparison; water?: Comparison };
  prices: { importPerKwh?: number; exportPerKwh?: number; waterPerM3?: number };
  /** In plain words, what these numbers rest on. */
  assumptions: string[];
  /** What is needed to show more, and where to give it. */
  missing: Array<{ what: string; how: string }>;
}
