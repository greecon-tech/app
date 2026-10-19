import Link from "next/link";
import { CanonicalPointName, EdgeGateway, EnergyFlowView, HEALTH_LABELS, hasPermission, SiteHealth, SiteProfile, SiteValue, valuePoints } from "@greecon/shared";
import { Ago } from "../../../components/Ago";
import { EnergyFlow } from "../../../components/EnergyFlow";
import { HealthReasons } from "../../../components/HealthHeadline";
import { LiveRefresh } from "../../../components/LiveRefresh";
import { CreateAssetForm } from "../../../components/CreateAssetForm";
import { CreateDeviceForm } from "../../../components/CreateDeviceForm";
import { CreatePointForm } from "../../../components/CreatePointForm";
import { PointLimitsForm } from "../../../components/PointLimitsForm";
import { DataTable } from "../../../components/DataTable";
import { DeleteButton } from "../../../components/DeleteButton";
import { ManualControlPanel } from "../../../components/ManualControlPanel";
import { MetricGrid } from "../../../components/MetricGrid";
import { Section } from "../../../components/Section";
import { SensorMap } from "../../../components/SensorMap";
import { Shell } from "../../../components/Shell";
import { StatusBadge } from "../../../components/StatusBadge";
import { TimeSeriesChart } from "../../../components/TimeSeriesChart";
import { ValueSection } from "../../../components/ValueSection";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../../lib/api";
import { getSession } from "../../../lib/session";
import { groupByCanonicalName } from "../../../lib/telemetry-history";
import { priorityWord, titleCase } from "../../../lib/health";
import { CONTACT_WORDS } from "../../../lib/setup";
import { readingLabel, readingMetric, ReadingView } from "../../../lib/readings";
import { Metric } from "../../../lib/types";
import { deleteAssetAction, deleteDeviceAction, deletePointAction } from "./actions";

interface SiteDetail {
  site: { id: string; name: string; type: string; locationName: string; status: string; edgeStatus: string };
  health: SiteHealth;
  energyFlow?: EnergyFlowView;
  lastReadingAtUtc?: string;
  assets: Array<{ id: string; name: string; type: string; status: string }>;
  devices: Array<{ id: string; name: string; deviceType: string; protocol: string; health: string; lastSeenUtc?: string; positionX?: number; positionY?: number; placementNote?: string }>;
  points: Array<{ id: string; deviceId: string; label: string; unit: string; canonicalName: CanonicalPointName; capability: string; thresholdConfig?: Record<string, number> }>;
  gateways: EdgeGateway[];
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

// No generateStaticParams here — this file is only ever used for the SSR build (Railway, GCP),
// which renders each site on request. The static GitHub Pages export uses page.static.tsx
// instead (see apps/web/scripts/build-static.sh), which needs generateStaticParams to
// pre-render every site at build time; on this SSR page, merely having that function present —
// even gated to return [] — was enough to make Next.js treat the route as a static-generation
// candidate and throw DYNAMIC_SERVER_USAGE on the no-store fetch below.
//
// Manual Control now dispatches a Server Action that calls revalidatePath on this route — the
// same combination that forced automation/page.tsx to force-dynamic rendering applies here too.
export const dynamic = "force-dynamic";

export default async function SiteDetailPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { siteId } = await params;
  const period = ["day", "week", "month", "last30"].includes((await searchParams).period ?? "") ? ((await searchParams).period as string) : "month";
  const [detail, history, value, profile] = await Promise.all([
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<TelemetryReading[]>(`/telemetry/history?siteId=${siteId}&hours=${TRENDS_HOURS}`),
    apiGet<SiteValue>(`/sites/${siteId}/value?period=${period}`),
    apiGet<SiteProfile>(`/sites/${siteId}/profile`)
  ]);
  const { site } = detail;
  const metrics = buildMetrics(detail);
  const historyByCanonicalName = groupByCanonicalName(history);
  // One chart per readable point this site actually has — a write-only command point (e.g. the
  // irrigation valve toggle) has no meaningful trend to plot, and points sharing a canonical name
  // (rare — usually one device per point) share one chart rather than duplicating it.
  const trendPoints = Array.from(new Map(detail.points.filter((point) => point.capability !== "write").map((point) => [point.canonicalName, point])).values());
  // The real logged-in session's role, not the build-time DEMO_ROLE fallback (which only ever
  // reflects the caller's identity on the static export — see lib/api.ts's requestHeaders) — this
  // page previously gated Manual Control by DEMO_ROLE even on a live deployment, so every visitor
  // saw the same fixed gate regardless of who they actually were logged in as.
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canControl = hasPermission(role, "command:create");
  const canManageDevices = hasPermission(role, "device:manage");
  const canManageAssets = hasPermission(role, "asset:manage");
  const deviceName = new Map(detail.devices.map((device) => [device.id, device.name]));
  const controllableTargets = detail.points
    .filter((point) => point.capability === "write" || point.capability === "read_write")
    .map((point) => ({
      pointId: point.id,
      deviceId: point.deviceId,
      deviceName: deviceName.get(point.deviceId) ?? point.deviceId,
      siteId: site.id,
      canonicalName: point.canonicalName,
      label: point.label,
      unit: point.unit
    }));

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
          <ValueSection value={value} siteId={site.id} profile={hasPermission(role, "site:manage") ? profile : undefined} periodHref={(key) => `/sites/${site.id}?period=${key}#value`} />
        </section>
      ) : null}
      <Section title="Trends" aside={<Link href={`/analytics?siteId=${site.id}`}>Full analytics for this site →</Link>}>
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
      <Section title="Equipment" id="equipment">
        <SensorMap devices={detail.devices} points={detail.points} readings={detail.latestTelemetry} />
        {canManageAssets ? (
          <div className="stack">
            <h3>Assets</h3>
            <p className="muted">
              An asset groups related devices under one physical or logical unit — a pump station, a battery bank, an irrigation zone.
              Optional: devices work fine with no asset at all.
            </p>
            {detail.assets.length > 0 ? (
              <DataTable
                wide={false}
                rows={detail.assets}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "type", label: "Type" },
                  {
                    key: "id",
                    label: "",
                    render: (row) => <DeleteButton action={deleteAssetAction.bind(null, site.id, row.id)} confirmMessage={`Delete asset "${row.name}"? This cannot be undone.`} />
                  }
                ]}
              />
            ) : null}
            <CreateAssetForm siteId={site.id} />
          </div>
        ) : null}
        {canManageDevices ? (
          <div className="stack">
            <h3>Boxes</h3>
            <p className="muted">
              A box is the small computer at the site that reads the equipment and sends the readings here. Boxes are installed and replaced on the{" "}
              <Link href={`/sites/${site.id}/setup`}>setup page</Link>, which gives the command to run on each one.
            </p>
            {detail.gateways.length > 0 ? (
              <DataTable
                wide={false}
                rows={detail.gateways}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "contact", label: "Now", render: (row) => <StatusBadge status={CONTACT_WORDS[row.contact ?? "never"]} /> },
                  { key: "lastSeenUtc", label: "Last heard from", render: (row) => (row.lastSeenUtc ? <Ago iso={row.lastSeenUtc} /> : "never") },
                  { key: "softwareVersion", label: "Version", render: (row) => row.softwareVersion ?? "—" }
                ]}
              />
            ) : null}
            <p>
              <Link className="button-primary" href={`/sites/${site.id}/setup`}>
                Open the setup checklist
              </Link>
            </p>
            <h3>Devices</h3>
            <p className="muted">A device is the physical piece of equipment — a sensor, controller, or gateway.</p>
            {detail.devices.length > 0 ? (
              <DataTable
                wide={false}
                rows={detail.devices}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "deviceType", label: "Type" },
                  { key: "health", label: "Health", render: (row) => <StatusBadge status={row.health} /> },
                  {
                    key: "id",
                    label: "",
                    render: (row) => (
                      <DeleteButton
                        action={deleteDeviceAction.bind(null, site.id, row.id)}
                        confirmMessage={`Delete device "${row.name}"? This also removes its reading points and telemetry history. This cannot be undone.`}
                      />
                    )
                  }
                ]}
              />
            ) : null}
            <CreateDeviceForm siteId={site.id} assets={detail.assets} />
            {detail.devices.length > 0 ? (
              <>
                <h3>Reading points</h3>
                <p className="muted">A point is one specific measurement or command a device provides, e.g. its soil moisture reading.</p>
                {detail.points.length > 0 ? (
                  <DataTable
                    wide={false}
                    rows={detail.points.map((point) => ({ ...point, deviceName: deviceName.get(point.deviceId) ?? point.deviceId }))}
                    columns={[
                      { key: "label", label: "Label" },
                      { key: "deviceName", label: "Device" },
                      { key: "capability", label: "Capability" },
                      { key: "thresholdConfig", label: "Limits", render: (row) => <PointLimitsForm siteId={site.id} point={row} /> },
                      {
                        key: "id",
                        label: "",
                        render: (row) => (
                          <DeleteButton action={deletePointAction.bind(null, site.id, row.id)} confirmMessage={`Delete reading point "${row.label}"? This cannot be undone.`} />
                        )
                      }
                    ]}
                  />
                ) : null}
                <CreatePointForm siteId={site.id} devices={detail.devices} />
              </>
            ) : null}
          </div>
        ) : null}
      </Section>
      {canControl ? (
        <Section title="Manual Control" aside={<span className="muted">Simulated: nothing is sent to equipment yet</span>}>
          <ManualControlPanel targets={controllableTargets} emptyMessage="No manually controllable equipment is configured for this site." />
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
