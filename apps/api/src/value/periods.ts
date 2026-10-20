// The stretches of time the value of a site is reported over, cut at the site's own midnight so
// "today" and "this month" mean what the people at the site mean by them.

export const periodKeys = ["day", "week", "month", "last30"] as const;
export type PeriodKey = (typeof periodKeys)[number];

export const DEFAULT_TIME_ZONE = "Europe/Tirane";

export interface Period {
  key: PeriodKey;
  fromMs: number;
  toMs: number;
  label: string;
  /** Length of the period so far, in days. */
  days: number;
  /** How much of a typical month this period is. Set only where a comparison with a monthly
   * baseline is fair (this month so far, and the last 30 days). */
  monthFraction?: number;
}

const DAY_MS = 86_400_000;
const AVERAGE_MONTH_DAYS = 30.4375;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

function wallClock(ms: number, timeZone: string): { year: number; month: number; day: number; asUtcMs: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  }).formatToParts(new Date(ms));
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtcMs = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return { year: value("year"), month: value("month"), day: value("day"), asUtcMs };
}

/** How far ahead of UTC the zone's clock is at that moment. */
function offsetAt(ms: number, timeZone: string): number {
  return wallClock(ms, timeZone).asUtcMs - Math.floor(ms / 1000) * 1000;
}

/** The UTC time at which a given calendar date begins in the zone. Looked up twice so a date whose
 * midnight falls on the far side of a clock change still lands on the right hour. */
function startOfLocalDate(year: number, month: number, day: number, nearMs: number, timeZone: string): number {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const first = localMidnightAsUtc - offsetAt(nearMs, timeZone);
  return localMidnightAsUtc - offsetAt(first, timeZone);
}

export function resolvePeriod(key: PeriodKey, nowMs: number, timeZone: string = DEFAULT_TIME_ZONE): Period {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const today = wallClock(nowMs, zone);
  const startOfToday = startOfLocalDate(today.year, today.month, today.day, nowMs, zone);

  switch (key) {
    case "day":
      return { key, fromMs: startOfToday, toMs: nowMs, label: "Today", days: (nowMs - startOfToday) / DAY_MS };
    case "week":
      return { key, fromMs: nowMs - 7 * DAY_MS, toMs: nowMs, label: "Last 7 days", days: 7 };
    case "last30":
      return { key, fromMs: nowMs - 30 * DAY_MS, toMs: nowMs, label: "Last 30 days", days: 30, monthFraction: 30 / AVERAGE_MONTH_DAYS };
    case "month": {
      const start = startOfLocalDate(today.year, today.month, 1, nowMs, zone);
      const nextMonth = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 };
      const end = startOfLocalDate(nextMonth.year, nextMonth.month, 1, nowMs, zone);
      const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: zone, month: "long" }).format(new Date(nowMs));
      return {
        key,
        fromMs: start,
        toMs: nowMs,
        label: `${monthName} so far`,
        days: (nowMs - start) / DAY_MS,
        monthFraction: (nowMs - start) / (end - start)
      };
    }
  }
}

/** A date as the site's own people write it ("1 Oct 2026"), in the site's own time zone. */
export function formatLocalDate(ms: number, timeZone: string = DEFAULT_TIME_ZONE): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
}
