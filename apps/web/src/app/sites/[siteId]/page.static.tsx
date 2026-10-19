import { EnergyFlowView, HEALTH_LABELS, hasPermission, SiteHealth, SiteValue, valuePoints } from "@greecon/shared";
import { Ago } from "../../../components/Ago";
import { EnergyFlow } from "../../../components/EnergyFlow";
import { HealthReasons } from "../../../components/HealthHeadline";
import { LiveRefresh } from "../../../components/LiveRefresh";
import { DataTable } from "../../../components/DataTable";
import { MetricGrid } from "../../../components/MetricGrid";
import { Section } from "../../../components/Section";
import { SensorMap } from "../../../components/SensorMap";
import { Shell } from "../../../components/Shell";
import { StatusBadge } from "../../../components/StatusBadge";
import { TimeSeriesChart } from "../../../components/TimeSeriesChart";
import { ValueView } from "../../../components/ValueView";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../../lib/api";
import { groupByCanonicalName } from "../../../lib/telemetry-history";
import { priorityWord, titleCase } from "../../../lib/health";
import { readingLabel, readingMetric, ReadingView } from "../../../lib/readings";
import { Metric } from "../../../lib/types";

interface SiteDetail {
  site: { id: string; name: string; type: string; locationName: string; status: string; edgeStatus: string };
  health: SiteHealth;
  energyFlow?: EnergyFlowView;
  lastReadingAtUtc?: string;
  assets: Array<{ id: string; name: string; type: string; status: string }>;
  devices: Array<{ id: string; name: string; deviceType: string; protocol: string; health: string; lastSeenUtc?: string; positionX?: number; positionY?: number; placementNote?: string }>;
  points: Array<{ id: string; deviceId: string; label: string; unit: string; canonicalName: string; capability: string; thresholdConfig?: Record<string, number> }>;
  latestTelemetry: Array<ReadingView & { pointId: string }>;
  rules: Array<{ id: string; name: string; priority: string; executionMode: string; approvalState: string }>;
  alerts: Array<{ id: string; severity: string; title: string; status: string }>;
}

interface TelemetryReading {
  timestampUtc: string;
  canonicalName: string;
  value: number | boolean | string;
}

const TRENDS_HOURS = 24 * 7;

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Only this build needs
// every site pre-rendered up front, since a static export has no live API to query at request
// time; the real SSR page renders on request and deliberately has no generateStaticParams (see
// its own comment for why that combination broke it).
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [detail, history, value] = await Promise.all([
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<TelemetryReading[]>(`/telemetry/history?siteId=${siteId}&hours=${TRENDS_HOURS}`),
    apiGet<SiteValue>(`/sites/${siteId}/value?period=month`)
  ]);
  const { site } = detail;
  const metrics = buildMetrics(detail);
  const canControl = hasPermission(DEMO_ROLE, "command:create");
  const hasControllableEquipment = detail.points.some((point) => point.capability === "write" || point.capability === "read_write");
  const historyByCanonicalName = groupByCanonicalName(history);
  const trendPoints = Array.from(new Map(detail.points.filter((point) => point.capability !== "write").map((point) => [point.canonicalName, point])).values());

  return (
    <Shell title={site.name} subtitle={`${site.type.replace(/_/g, " ")} · ${site.locationName}`}>
      <LiveRefresh enabled={!isStaticExport()} />
      <Section title="Summary" aside={<StatusBadge status={HEALTH_LABELS[detail.health.state]} />}>
        <p className="muted">
          {detail.health.reasons.length === 0 ? "All readings current. Nothing open." : null}
          {detail.lastReadingAtUtc ? (
            <>
              {detail.health.reasons.length === 0 ? " " : ""}Last reading <Ago iso={detail.lastReadingAtUtc} />.
            </>
          ) : (
            "No readings have been received from this site yet."
          )}
        </p>
        <HealthReasons reasons={detail.health.reasons} showSite={false} />
        <MetricGrid metrics={metrics} />
      </Section>
      {detail.energyFlow?.hasEnergy ? (
        <Section title="Energy flow">
          <EnergyFlow flow={detail.energyFlow} siteName={site.name} />
        </Section>
      ) : null}
      {detail.points.some((point) => (valuePoints as readonly string[]).includes(point.canonicalName)) ? (
        <section id="value" className="section">
          <div className="section__header">
            <h2>Value</h2>
          </div>
          <ValueView value={value} />
        </section>
      ) : null}
      <Section title="Trends">
        {trendPoints.length === 0 ? (
          <div className="empty-state">No trackable points configured for this site yet.</div>
        ) : (
          <div className="chart-grid">
            {trendPoints.map((point) => (
              <TimeSeriesChart key={point.id} title={point.label} unit={point.unit} data={historyByCanonicalName.get(point.canonicalName) ?? []} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Equipment">
        <SensorMap devices={detail.devices} points={detail.points} readings={detail.latestTelemetry} />
      </Section>
      {canControl && hasControllableEquipment ? (
        <Section title="Manual Control" aside={<span className="muted">Simulated: nothing is sent to equipment yet</span>}>
          <div className="panel">
            <p className="muted">
              Manual control requires a live deployment (Railway or Google Cloud) — this build is a static snapshot with no server to dispatch commands to. See docs/12-deployment-github-pages.md.
            </p>
          </div>
        </Section>
      ) : null}
      <Section title="Automation">
        <DataTable
          rows={detail.rules}
          columns={[
            { key: "name", label: "Rule" },
            { key: "priority", label: "Priority" },
            { key: "executionMode", label: "Mode" },
            { key: "approvalState", label: "State" }
          ]}
        />
      </Section>
      <Section title="Alerts">
        <DataTable
          rows={detail.alerts}
          columns={[
            { key: "severity", label: "Priority", render: (row) => <StatusBadge status={priorityWord(row.severity)} /> },
            { key: "title", label: "Alert" },
            { key: "status", label: "Status", render: (row) => titleCase(row.status) }
          ]}
        />
      </Section>
    </Shell>
  );
}

function buildMetrics(detail: SiteDetail): Metric[] {
  return detail.latestTelemetry.map((reading) =>
    readingMetric(reading, reading.timestampUtc ? <Ago iso={reading.timestampUtc} /> : "No timestamp", readingLabel(reading.canonicalName))
  );
}
