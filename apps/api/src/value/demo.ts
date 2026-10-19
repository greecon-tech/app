import { CanonicalPointName, DEMO_TENANT_ID, SiteProfile } from "@greecon/shared";
import { Principal } from "../common/principal";
import { BucketDelta } from "./energy-ledger";
import { DEFAULT_TIME_ZONE } from "./periods";

// The demo tenant is a sales and training tenant: three simulated sites that behave like real ones.
// Its numbers are a plain function of the time of day, so the history written when it is first set up
// and the readings it sends while it runs agree with each other, the energy balances exactly, and the
// same moment always gives the same picture. Everything it produces is sent as simulated and shown as
// simulated; none of it is a claim about any customer.

export const DEMO_FARM_SITE = "22222222-2222-4222-8222-222222222201";
export const DEMO_WATER_SITE = "22222222-2222-4222-8222-222222222202";
export const DEMO_BATTERY_SITE = "22222222-2222-4222-8222-222222222203";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The demo account's own sender: it may do what a gateway may do, and only inside the demo tenant. */
export const DEMO_FEED_PRINCIPAL: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "demo-feed",
  role: "operator",
  email: "demo-feed@greecon.earth",
  isPlatformAdmin: false
};

/** A repeatable number between 0 and 1 for a given whole number. */
function noise(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

interface Moment {
  /** Hours since local midnight, 0 to 24. */
  hour: number;
  /** Whole days since the epoch on the site's clock. */
  day: number;
  /** Minutes since the epoch, for noise. */
  minute: number;
}

function momentOf(tMs: number, offsetMs: number): Moment {
  const local = tMs + offsetMs;
  return { hour: (((local % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS, day: Math.floor(local / DAY_MS), minute: Math.floor(tMs / 60_000) };
}

function solarKw(m: Moment, peakKw: number): number {
  if (m.hour <= 6 || m.hour >= 19) return 0;
  // Some days are brighter than others.
  const cloud = 0.78 + 0.2 * Math.sin(m.day * 1.7) * Math.cos(m.day * 0.9);
  const shape = Math.pow(Math.sin((Math.PI * (m.hour - 6)) / 13), 1.4);
  return peakKw * shape * cloud * (1 + 0.06 * (noise(m.minute) - 0.5));
}

function consumptionKw(m: Moment): number {
  return 11 + 3 * Math.sin((2 * Math.PI * (m.hour - 19)) / 24) + 0.5 * (noise(m.minute + 7) - 0.5);
}

/** The pump runs two hours in every six. */
function pumpOn(m: Moment): boolean {
  return Math.floor(m.hour) % 6 < 2;
}

/** What each simulated reading says at a moment, or undefined for a point the demo does not drive. */
export function demoValue(siteId: string, canonicalName: CanonicalPointName, tMs: number, offsetMs: number): number | undefined {
  const m = momentOf(tMs, offsetMs);
  if (siteId === DEMO_FARM_SITE) {
    const solar = solarKw(m, 24);
    const used = consumptionKw(m);
    switch (canonicalName) {
      case "energy.solar.power.kw":
        return round(solar, 2);
      case "energy.consumption.kw":
        return round(used, 2);
      // Rounded together so the numbers a screen shows still add up.
      case "energy.grid.export.kw":
        return round(Math.max(0, round(solar, 2) - round(used, 2)), 2);
      case "energy.grid.import.kw":
        return round(Math.max(0, round(used, 2) - round(solar, 2)), 2);
      case "agri.soil.moisture.percent":
        // Held a little under the demo's irrigation limit, so the demo always has one thing to look at.
        return round(24 + 0.8 * (noise(m.minute) - 0.5), 1);
      case "agri.air.temperature.c":
        return round(19 + 9 * Math.sin((Math.PI * (m.hour - 6)) / 12) + 2 * Math.sin((2 * Math.PI * m.day) / 7), 1);
      case "agri.humidity.percent":
        return round(Math.min(85, Math.max(38, 75 - 30 * Math.sin((Math.PI * (m.hour - 6)) / 12))), 1);
      default:
        return undefined;
    }
  }
  if (siteId === DEMO_WATER_SITE) {
    const on = pumpOn(m);
    switch (canonicalName) {
      case "water.tank.level.percent":
        // Held just above the warning level, so the demo's own "approaching low threshold" alert is
        // the one thing to look at and the platform does not raise a second alert about the same tank.
        return round(37 + 1.2 * Math.sin(m.minute / 40), 1);
      case "water.flow.lpm":
        return round(on ? 11 + 3 * (noise(m.minute) - 0.5) : 0.15 + 0.1 * noise(m.minute), 2);
      case "water.pressure.bar":
        return round(on ? 2.6 + 0.6 * (noise(m.minute + 3) - 0.5) : 0.2 + 0.1 * noise(m.minute + 3), 2);
      default:
        return undefined;
    }
  }
  if (siteId === DEMO_BATTERY_SITE && canonicalName === "energy.battery.soc.percent") {
    return round(Math.min(97, Math.max(18, 55 + 22 * Math.sin((2 * Math.PI * (m.hour - 9)) / 24) + 5 * Math.sin((2 * Math.PI * m.day) / 4))), 1);
  }
  return undefined;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** How far ahead of UTC the site's clock is at a moment, found without a time zone database call per
 * sample: the demo only needs it to the hour. */
export function offsetFor(tMs: number, timeZone: string = DEFAULT_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(tMs));
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - Math.floor(tMs / 1000) * 1000;
}

const ENERGY_POINTS: ReadonlyArray<{ pointId: string; canonicalName: CanonicalPointName; siteId: string; perSecond: number }> = [
  { pointId: "55555555-5555-4555-8555-555555555501", canonicalName: "energy.solar.power.kw", siteId: DEMO_FARM_SITE, perSecond: 1 / 3600 },
  { pointId: "55555555-5555-4555-8555-555555555510", canonicalName: "energy.grid.import.kw", siteId: DEMO_FARM_SITE, perSecond: 1 / 3600 },
  { pointId: "55555555-5555-4555-8555-555555555511", canonicalName: "energy.grid.export.kw", siteId: DEMO_FARM_SITE, perSecond: 1 / 3600 },
  { pointId: "55555555-5555-4555-8555-555555555512", canonicalName: "energy.consumption.kw", siteId: DEMO_FARM_SITE, perSecond: 1 / 3600 },
  { pointId: "55555555-5555-4555-8555-555555555504", canonicalName: "water.flow.lpm", siteId: DEMO_WATER_SITE, perSecond: 1 / 60 }
];

/** Hourly totals for the days before now, as if the demo had been running: what the ledger would hold. */
export function demoHistory(nowMs: number, days: number = 30, timeZone: string = DEFAULT_TIME_ZONE): BucketDelta[] {
  const deltas: BucketDelta[] = [];
  const lastHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  for (let hourStartMs = lastHour - days * 24 * HOUR_MS; hourStartMs < lastHour; hourStartMs += HOUR_MS) {
    const offsetMs = offsetFor(hourStartMs, timeZone);
    for (const point of ENERGY_POINTS) {
      // Twelve five-minute stretches, averaging the two ends of each, exactly as the ledger does live.
      let amount = 0;
      let previous = demoValue(point.siteId, point.canonicalName, hourStartMs, offsetMs) as number;
      for (let step = 1; step <= 12; step += 1) {
        const value = demoValue(point.siteId, point.canonicalName, hourStartMs + step * 300_000, offsetMs) as number;
        amount += ((previous + value) / 2) * 300 * point.perSecond;
        previous = value;
      }
      deltas.push({ tenantId: DEMO_TENANT_ID, siteId: point.siteId, pointId: point.pointId, canonicalName: point.canonicalName, hourStartMs, amount, coveredSeconds: 3600 });
    }
  }
  return deltas;
}

/** Prices for the demo, labelled as demo values, and a baseline taken from what the demo itself bought
 * so the comparison reads as a real one would. */
export function demoProfiles(history: BucketDelta[], nowMs: number): SiteProfile[] {
  const importedKwh = history.filter((delta) => delta.canonicalName === "energy.grid.import.kw").reduce((sum, delta) => sum + delta.amount, 0);
  const waterM3 = history.filter((delta) => delta.canonicalName === "water.flow.lpm").reduce((sum, delta) => sum + delta.amount, 0) / 1000;
  const days = history.length > 0 ? new Set(history.map((delta) => Math.floor(delta.hourStartMs / DAY_MS))).size : 30;
  const monthly = (total: number): number => Math.round(((total / days) * 30.4375) / 10) * 10;
  const updatedAtUtc = new Date(nowMs).toISOString();
  return [
    {
      siteId: DEMO_FARM_SITE,
      tenantId: DEMO_TENANT_ID,
      timezone: DEFAULT_TIME_ZONE,
      currency: "EUR",
      importPricePerKwh: 0.15,
      exportPricePerKwh: 0.06,
      baselineMonthlyImportKwh: Math.round(monthly(importedKwh) * 1.6),
      baselineNote: "Demo values: not a customer's prices or bills.",
      zeroExport: false,
      updatedAtUtc
    },
    {
      siteId: DEMO_WATER_SITE,
      tenantId: DEMO_TENANT_ID,
      timezone: DEFAULT_TIME_ZONE,
      currency: "EUR",
      waterPricePerM3: 1.2,
      baselineMonthlyWaterM3: Math.round(monthly(waterM3) * 1.25),
      baselineNote: "Demo values: not a customer's prices or bills.",
      zeroExport: false,
      updatedAtUtc
    }
  ];
}
