import Link from "next/link";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { TrendSections } from "../../components/TrendSections";
import { apiGet } from "../../lib/api";
import { seriesByKind } from "../../lib/telemetry-history";

export const metadata = { title: "Reports" };

interface TelemetryReading {
  timestampUtc: string;
  siteId: string;
  pointId: string;
  canonicalName: string;
  value: number | boolean | string;
}

interface Site {
  id: string;
  name: string;
}

const RANGES: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30, "90d": 24 * 90 };
const DEFAULT_RANGE = "7d";

// Replaces what used to be a handful of hardcoded fake percentages — every chart here is real
// telemetry_readings history, queried straight from Postgres (see PlatformService.telemetryHistory,
// added because nothing anywhere previously showed a trend over time, only instantaneous values).
// No explicit `dynamic` export needed: reading searchParams already forces per-request rendering
// on its own. This file is SSR-only — see page.static.tsx for the static GitHub Pages twin, which
// has no server to answer a different query string with different data anyway.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; siteId?: string }> }) {
  const params = await searchParams;
  const range = params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE;
  const hours = RANGES[range];

  const sites = await apiGet<Site[]>("/sites");
  // A trend is one site's. Across several sites the same kind of reading (each has a tank) would be drawn as one
  // line that jumps from one site to the next, so an account with several sites sees one at a time, the first
  // unless another is chosen.
  const siteId = sites.some((site) => site.id === params.siteId) ? params.siteId : sites.length > 1 ? sites[0]?.id : undefined;
  const readings = await apiGet<TelemetryReading[]>(`/telemetry/history?hours=${hours}${siteId ? `&siteId=${siteId}` : ""}`);

  const seriesOf = seriesByKind(readings);

  return (
    <Shell title="Reports" subtitle="How things have been over time: energy, water and the land, with their normal band.">
      <Section title="Time range">
        <div className="tabs">
          {Object.keys(RANGES).map((key) => (
            <Link key={key} href={buildHref(key, siteId)} aria-current={key === range ? "page" : undefined}>
              {rangeLabel(key)}
            </Link>
          ))}
        </div>
      </Section>
      {sites.length > 1 ? (
        <Section title="Site">
          <div className="tabs">
            {sites.map((site) => (
              <Link key={site.id} href={buildHref(range, site.id)} aria-current={siteId === site.id ? "page" : undefined}>
                {site.name}
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
      <TrendSections seriesOf={seriesOf} />
    </Shell>
  );
}

function buildHref(range: string, siteId: string | undefined): string {
  const query = new URLSearchParams({ range });
  if (siteId) query.set("siteId", siteId);
  return `/analytics?${query.toString()}`;
}

function rangeLabel(key: string): string {
  return { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "90d": "Quarter" }[key] ?? key;
}
