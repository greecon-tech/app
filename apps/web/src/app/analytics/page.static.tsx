import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { TrendSections } from "../../components/TrendSections";
import { apiGet } from "../../lib/api";
import { seriesByKind } from "../../lib/telemetry-history";

export const metadata = { title: "Reports" };

interface TelemetryReading {
  timestampUtc: string;
  pointId: string;
  canonicalName: string;
  value: number | boolean | string;
}

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The live page reads
// searchParams to let a real server answer a different time range/site on every request — a
// static build has no server to do that with, so this bakes in one fixed 7-day window and drops
// the range/site tabs entirely rather than shipping dead links that would all serve the same file.
export default async function AnalyticsPage() {
  const readings = await apiGet<TelemetryReading[]>("/telemetry/history?hours=168");
  const seriesOf = seriesByKind(readings);

  return (
    <Shell title="Reports" subtitle="How things have been over time: energy, water and the land, with their normal band.">
      <TrendSections seriesOf={seriesOf} rangeNote="last 7 days" />
    </Shell>
  );
}

