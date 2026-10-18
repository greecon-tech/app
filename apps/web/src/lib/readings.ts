import { ReactNode } from "react";
import { canonicalPointLabels, CanonicalPointName } from "@greecon/shared";
import { Metric } from "./types";

/** A latest reading as the API sends it. The Overview and the per-site list name the time
 * differently (`asOfUtc` and `timestampUtc`); either is accepted. */
export interface ReadingView {
  canonicalName: string;
  value: number | boolean | string;
  unit: string;
  quality: string;
  asOfUtc?: string;
  timestampUtc?: string;
  /** "out_of_date" once the reading is too old to rely on. Absent from older API responses. */
  freshness?: "current" | "out_of_date";
  /** Set when the platform's rules judge a current reading abnormal. */
  concern?: "warning" | "critical";
}

export function readingLabel(canonicalName: string): string {
  return canonicalPointLabels[canonicalName as CanonicalPointName] ?? canonicalName;
}

export function takenAt(reading: ReadingView): string | undefined {
  return reading.asOfUtc ?? reading.timestampUtc;
}

export function formatValue(value: number | boolean | string): string {
  return typeof value === "number" ? value.toFixed(1) : String(value);
}

/** The word to show beside a reading, if it needs one. Out of date outranks everything: what the
 * rules concluded from an old value is no longer about the present. A reading with nothing to say
 * gets no word at all, rather than "OK". */
export function readingStatus(reading: Pick<ReadingView, "quality" | "freshness" | "concern">): string | undefined {
  if (reading.freshness === "out_of_date") return "Out of date";
  if (reading.concern === "critical") return "Critical";
  if (reading.concern === "warning") return "Warning";
  if (reading.quality === "BAD") return "Bad data";
  if (reading.quality === "WARN") return "Uncertain";
  return undefined;
}

export function readingMetric(reading: ReadingView, note: ReactNode, label: string = readingLabel(reading.canonicalName)): Metric {
  return {
    label,
    value: formatValue(reading.value),
    unit: reading.unit || undefined,
    status: readingStatus(reading),
    stale: reading.freshness === "out_of_date",
    note
  };
}
