import { Ago } from "../../components/Ago";
import { LiveRefresh } from "../../components/LiveRefresh";
import { MetricGrid } from "../../components/MetricGrid";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { apiGet, isStaticExport } from "../../lib/api";
import { readingMetric, ReadingView } from "../../lib/readings";
import { Metric } from "../../lib/types";

interface MonitoredReading extends ReadingView {
  siteId: string;
}

export default async function MonitoringPage() {
  const [readings, sites] = await Promise.all([apiGet<MonitoredReading[]>("/telemetry/latest"), apiGet<Array<{ id: string; name: string }>>("/sites")]);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));
  const energy = readings.filter((reading) => reading.canonicalName.startsWith("energy."));
  const water = readings.filter((reading) => reading.canonicalName.startsWith("water."));
  const agriculture = readings.filter((reading) => reading.canonicalName.startsWith("agri."));

  return (
    <Shell title="Monitoring" subtitle="The latest reading of every point, and how old each one is.">
      <LiveRefresh enabled={!isStaticExport()} />
      <Group title="Energy" readings={energy} siteName={siteName} />
      <Group title="Water" readings={water} siteName={siteName} />
      <Group title="Agriculture" readings={agriculture} siteName={siteName} />
    </Shell>
  );
}

function Group({ title, readings, siteName }: { title: string; readings: MonitoredReading[]; siteName: ReadonlyMap<string, string> }) {
  return (
    <Section title={title}>
      {readings.length > 0 ? <MetricGrid metrics={toMetrics(readings, siteName)} /> : <p className="muted">No readings from this group yet.</p>}
    </Section>
  );
}

function toMetrics(readings: MonitoredReading[], siteName: ReadonlyMap<string, string>): Metric[] {
  return readings.map((reading) =>
    readingMetric(
      reading,
      <>
        {siteName.get(reading.siteId) ? `${siteName.get(reading.siteId)} · ` : ""}
        <Ago iso={reading.timestampUtc ?? reading.asOfUtc ?? ""} />
      </>
    )
  );
}
