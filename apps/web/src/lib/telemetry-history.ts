import { TimeSeriesPoint } from "../components/TimeSeriesChart";

interface TelemetryReadingLike {
  timestampUtc: string;
  canonicalName: string;
  value: number | boolean | string;
  pointId?: string;
}

// Shared by every page that turns a /telemetry/history response into chart series (Analytics, its static twin, and
// each site's own Trends section). Non-numeric readings (a write-only command point's state, e.g.) have no
// meaningful line to plot, so they are dropped.

/** One series for each reading point. Two tanks, or two sites' tanks, are two lines: grouped by the kind of
 * reading alone they would be drawn as one line that jumps between them. */
export function groupByPointId(readings: readonly TelemetryReadingLike[]): Map<string, TimeSeriesPoint[]> {
  const grouped = new Map<string, TimeSeriesPoint[]>();
  for (const reading of readings) {
    if (typeof reading.value !== "number" || !reading.pointId) continue;
    const series = grouped.get(reading.pointId) ?? [];
    series.push({ timestampUtc: reading.timestampUtc, value: reading.value });
    grouped.set(reading.pointId, series);
  }
  return grouped;
}

/** For each kind of reading, one series for each point that has it, in the order the points first appear. */
export function seriesByKind(readings: readonly TelemetryReadingLike[]): Map<string, TimeSeriesPoint[][]> {
  const kinds = new Map<string, Map<string, TimeSeriesPoint[]>>();
  for (const reading of readings) {
    if (typeof reading.value !== "number") continue;
    const points = kinds.get(reading.canonicalName) ?? new Map<string, TimeSeriesPoint[]>();
    const series = points.get(reading.pointId ?? "") ?? [];
    series.push({ timestampUtc: reading.timestampUtc, value: reading.value });
    points.set(reading.pointId ?? "", series);
    kinds.set(reading.canonicalName, points);
  }
  return new Map([...kinds].map(([kind, points]) => [kind, [...points.values()]]));
}
