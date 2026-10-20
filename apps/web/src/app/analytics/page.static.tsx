import { CanonicalPointName } from "@greecon/shared";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { kindCharts } from "../../components/KindCharts";
import { apiGet } from "../../lib/api";
import { seriesByKind } from "../../lib/telemetry-history";

interface TelemetryReading {
  timestampUtc: string;
  pointId: string;
  canonicalName: string;
  value: number | boolean | string;
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

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The live page reads
// searchParams to let a real server answer a different time range/site on every request — a
// static build has no server to do that with, so this bakes in one fixed 7-day window and drops
// the range/site tabs entirely rather than shipping dead links that would all serve the same file.
export default async function AnalyticsPage() {
  const readings = await apiGet<TelemetryReading[]>("/telemetry/history?hours=168");
  const seriesOf = seriesByKind(readings);

  return (
    <Shell title="Analytics" subtitle="Real historical trends across energy, water, and agriculture — not a snapshot.">
      <Section title="Energy" aside={<span className="muted">Production, consumption, and grid exchange — last 7 days</span>}>
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

