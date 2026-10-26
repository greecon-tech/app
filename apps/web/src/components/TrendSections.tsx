import { CanonicalPointName } from "@greecon/shared";
import { TimeSeriesPoint } from "./TimeSeriesChart";
import { kindCharts } from "./KindCharts";
import { Section } from "./Section";

interface ResourceMetric {
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
}

const GROUPS: ReadonlyArray<{ title: string; note: string; metrics: ResourceMetric[] }> = [
  {
    title: "Energy",
    note: "Production, consumption and grid exchange",
    metrics: [
      { canonicalName: "energy.solar.power.kw", label: "Solar production", unit: "kW" },
      { canonicalName: "energy.consumption.kw", label: "Consumption", unit: "kW" },
      { canonicalName: "energy.grid.import.kw", label: "Grid import", unit: "kW" },
      { canonicalName: "energy.grid.export.kw", label: "Grid export", unit: "kW" },
      { canonicalName: "energy.battery.soc.percent", label: "Battery state of charge", unit: "%" }
    ]
  },
  {
    title: "Water",
    note: "Tank, flow and pressure",
    metrics: [
      { canonicalName: "water.tank.level.percent", label: "Tank level", unit: "%" },
      { canonicalName: "water.flow.lpm", label: "Flow", unit: "lpm" },
      { canonicalName: "water.pressure.bar", label: "Line pressure", unit: "bar" }
    ]
  },
  {
    title: "The land",
    note: "Soil moisture, air temperature and humidity",
    metrics: [
      { canonicalName: "agri.soil.moisture.percent", label: "Soil moisture", unit: "%" },
      { canonicalName: "agri.air.temperature.c", label: "Air temperature", unit: "°C" },
      { canonicalName: "agri.humidity.percent", label: "Humidity", unit: "%" }
    ]
  }
];

/** The trend charts of the Reports screen, by kind of reading. Only what the site actually sends is drawn: a site with no battery has
 * no empty "Battery" chart waiting for a value that will never come, and a site with no water has no Water section. Shared by the live
 * page and its static twin. */
export function TrendSections({ seriesOf, rangeNote }: { seriesOf: ReadonlyMap<string, TimeSeriesPoint[][]>; rangeNote?: string }) {
  const present = GROUPS.map((group) => ({ ...group, metrics: group.metrics.filter((metric) => (seriesOf.get(metric.canonicalName)?.length ?? 0) > 0) })).filter((group) => group.metrics.length > 0);

  if (present.length === 0) {
    return (
      <Section title="Trends">
        <div className="empty-state">No readings in this period yet. Charts appear here as soon as the site&apos;s box has sent some.</div>
      </Section>
    );
  }
  return (
    <>
      {present.map((group) => (
        <Section key={group.title} title={group.title} aside={<span className="muted">{[group.note, rangeNote].filter(Boolean).join(" · ")}</span>}>
          <div className="chart-grid">{group.metrics.flatMap((metric) => kindCharts(metric, seriesOf.get(metric.canonicalName)))}</div>
        </Section>
      ))}
    </>
  );
}
