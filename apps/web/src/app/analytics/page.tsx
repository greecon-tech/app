import Link from "next/link";
import { CanonicalPointName } from "@greecon/shared";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { kindCharts } from "../../components/KindCharts";
import { apiGet } from "../../lib/api";
import { seriesByKind } from "../../lib/telemetry-history";

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

interface ResourceMetric {
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
}

const ENERGY_METRICS: ResourceMetric[] = [
  { canonicalName: "energy.solar.power.kw", label: "Solar production", unit: "kW" },
  { canonicalName: "energy.consumption.kw", label: "Consumption", unit: "kW" },
  { canonicalName: "energy.grid.import.kw", label: "Grid import", unit: "kW" },
  { canonicalName: "energy.grid.export.kw", label: "Grid export", unit: "kW" },
  { canonicalName: "energy.battery.soc.percent", label: "Battery state of charge", unit: "%" }
];

const WATER_METRICS: ResourceMetric[] = [
  { canonicalName: "water.tank.level.percent", label: "Tank level", unit: "%" },
  { canonicalName: "water.flow.lpm", label: "Flow", unit: "lpm" },
  { canonicalName: "water.pressure.bar", label: "Line pressure", unit: "bar" }
];

const AGRICULTURE_METRICS: ResourceMetric[] = [
  { canonicalName: "agri.soil.moisture.percent", label: "Soil moisture", unit: "%" },
  { canonicalName: "agri.air.temperature.c", label: "Air temperature", unit: "°C" },
  { canonicalName: "agri.humidity.percent", label: "Humidity", unit: "%" }
];

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
    <Shell title="Analytics" subtitle="Real historical trends across energy, water, and agriculture — not a snapshot.">
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
      <Section title="Energy" aside={<span className="muted">Production, consumption, and grid exchange</span>}>
        <div className="chart-grid">
          {ENERGY_METRICS.flatMap((metric) => kindCharts(metric, seriesOf.get(metric.canonicalName)))}
        </div>
      </Section>
      <Section title="Water">
        <div className="chart-grid">
          {WATER_METRICS.flatMap((metric) => kindCharts(metric, seriesOf.get(metric.canonicalName)))}
        </div>
      </Section>
      <Section title="Agriculture">
        <div className="chart-grid">
          {AGRICULTURE_METRICS.flatMap((metric) => kindCharts(metric, seriesOf.get(metric.canonicalName)))}
        </div>
      </Section>
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
