import { CanonicalPointName } from "@greecon/shared";

// A monitoring system that cannot tell "the value is 12" from "the value was 12 three days ago"
// reassures people falsely. Every decision that depends on a reading therefore asks how old it is.
// These helpers are pure (no clock of their own): the caller passes "now", so the same input always
// gives the same answer and tests do not depend on wall-clock time.

export type Freshness = "fresh" | "stale" | "unknown";

export interface ReadingAge {
  freshness: Freshness;
  /** Whole seconds since the reading was taken. Absent when there is no usable timestamp. */
  ageSeconds?: number;
  /** The limit this verdict was judged against. */
  maxAgeSeconds: number;
}

// Field sensors that commonly report every 15-60 minutes (battery-powered soil probes and
// weather sensors, often over LoRa or cellular) are not "late" after five minutes the way a pump's
// flow meter polled every few seconds is. These are defaults; a point can carry its own limit.
const SLOW_REPORTING_POINTS: ReadonlySet<CanonicalPointName> = new Set([
  "agri.soil.moisture.percent",
  "agri.air.temperature.c",
  "agri.humidity.percent"
]);

export const PROCESS_READING_MAX_AGE_SECONDS = 5 * 60;
export const SLOW_READING_MAX_AGE_SECONDS = 3 * 60 * 60;

export function defaultMaxAgeSeconds(canonicalName: CanonicalPointName): number {
  return SLOW_REPORTING_POINTS.has(canonicalName) ? SLOW_READING_MAX_AGE_SECONDS : PROCESS_READING_MAX_AGE_SECONDS;
}

export function assessReadingAge(timestampUtc: string | undefined, nowMs: number, maxAgeSeconds: number): ReadingAge {
  const takenAtMs = timestampUtc ? Date.parse(timestampUtc) : Number.NaN;
  if (!Number.isFinite(takenAtMs)) return { freshness: "unknown", maxAgeSeconds };

  // A timestamp a little ahead of our clock is ordinary drift between a gateway and the server
  // (ingestion already refuses anything far in the future); it means "just now", not "negative age".
  const ageSeconds = Math.max(0, Math.round((nowMs - takenAtMs) / 1000));
  return { freshness: ageSeconds <= maxAgeSeconds ? "fresh" : "stale", ageSeconds, maxAgeSeconds };
}

/** "20 seconds", "2 minutes", "3 hours", "2 days": the largest whole unit, for messages people read. */
export function describeAge(ageSeconds: number): string {
  const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"}`;
  if (ageSeconds < 60) return plural(Math.round(ageSeconds), "second");
  if (ageSeconds < 3600) return plural(Math.floor(ageSeconds / 60), "minute");
  if (ageSeconds < 86400) return plural(Math.floor(ageSeconds / 3600), "hour");
  return plural(Math.floor(ageSeconds / 86400), "day");
}
