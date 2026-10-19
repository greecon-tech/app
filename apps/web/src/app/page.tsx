import Link from "next/link";
import { canonicalPointLabels, CanonicalPointName, DashboardWidgetPreference, EnergyFlowView, hasPermission, TenantHealth } from "@greecon/shared";
import { AlertItem, AlertList } from "../components/AlertList";
import { Ago } from "../components/Ago";
import { EnergyFlows } from "../components/EnergyFlow";
import { HealthHeadline } from "../components/HealthHeadline";
import { LiveRefresh } from "../components/LiveRefresh";
import { MetricGrid } from "../components/MetricGrid";
import { Section } from "../components/Section";
import { Shell } from "../components/Shell";
import { SiteRowData, SiteRows } from "../components/SiteRows";
import { apiGet, DEMO_ROLE, isStaticExport } from "../lib/api";
import { applyDashboardPreferences } from "../lib/dashboard-preferences";
import { ReadingView, readingMetric, takenAt } from "../lib/readings";
import { getSession } from "../lib/session";
import { Metric } from "../lib/types";

interface OverviewReading extends ReadingView {
  siteId: string;
  siteName: string;
  asOfUtc: string;
}

interface Overview {
  asOfUtc: string;
  health: TenantHealth;
  sites: SiteRowData[];
  energy?: Array<{ siteId: string; siteName: string; flow: EnergyFlowView }>;
  summaries: { edge: { connectedSites: number; simulatedSites: number } };
  readings: Partial<Record<CanonicalPointName, OverviewReading>>;
  activeAlerts: AlertItem[];
}

export default async function OverviewPage() {
  const [overview, preferences] = await Promise.all([
    apiGet<Overview>("/overview"),
    apiGet<DashboardWidgetPreference[]>("/dashboard-preferences")
  ]);
  const metrics = applyDashboardPreferences(buildMetrics(overview), preferences);
  const siteNames = new Map(overview.sites.map((site) => [site.id, site.name]));
  const hasSites = overview.sites.length > 0;
  // A brand new tenant (every real client on day one) starts with zero sites. Metrics and alerts
  // would otherwise render as a wall of empty cards, so show onboarding guidance instead.
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canManageSites = hasPermission(role, "site:manage");

  return (
    <Shell title="Overview" subtitle="Is everything all right, and what needs you?">
      <LiveRefresh enabled={!isStaticExport()} />
      {hasSites ? (
        <>
          <HealthHeadline health={overview.health} asOfUtc={overview.asOfUtc} simulatedSites={overview.summaries.edge.simulatedSites} />
          {overview.activeAlerts.length > 0 ? (
            <Section title="Needs you">
              <AlertList alerts={overview.activeAlerts} siteNames={siteNames} />
            </Section>
          ) : null}
          <Section title="Sites">
            <SiteRows sites={overview.sites} />
          </Section>
          {overview.energy && overview.energy.length > 0 ? (
            <Section title="Energy">
              <EnergyFlows entries={overview.energy} />
            </Section>
          ) : null}
          <Section
            title="Latest readings"
            aside={
              <Link href="/settings#dashboard" className="button-ghost">
                Customize
              </Link>
            }
          >
            <MetricGrid metrics={metrics} />
          </Section>
        </>
      ) : (
        <Section title="Getting started">
          <ol className="getting-started">
            <li>
              <strong>Create your first site.</strong>
              <p className="muted">A site is one physical location — a farm, a pump station, a building — that holds its own devices and readings.</p>
              {canManageSites ? (
                <Link href="/admin" className="button-ghost">
                  Go to Admin → Create site
                </Link>
              ) : (
                <p className="muted">Ask a Greecon admin to create your first site.</p>
              )}
            </li>
            <li>
              <strong>Add its devices and reading points.</strong>
              <p className="muted">Once a site exists, open it to add each sensor or controller and the specific measurements it reports — right from that site's own page.</p>
            </li>
            <li>
              <strong>Connect the real hardware.</strong>
              <p className="muted">
                See <code>docs/14-edge-hardware-deployment.md</code> for wiring an actual industrial PC to start sending real readings.
              </p>
            </li>
          </ol>
        </Section>
      )}
    </Shell>
  );
}

// The cards a tenant sees, in this order. A card appears only when a site actually sends that
// reading: a fleet with no battery simply has no battery card. Each says where its value came from
// and how old it is, and carries a word only when there is something to say. Nothing here decides
// whether a value is good or bad: the rules do, and send their verdict with the reading.
const CARDS: ReadonlyArray<CanonicalPointName> = [
  "energy.solar.power.kw",
  "energy.battery.soc.percent",
  "energy.consumption.kw",
  "energy.grid.import.kw",
  "energy.grid.export.kw",
  "water.tank.level.percent",
  "water.pressure.bar",
  "agri.soil.moisture.percent"
];

function buildMetrics(overview: Overview): Metric[] {
  const metrics: Metric[] = [];

  for (const name of CARDS) {
    const reading = overview.readings[name];
    if (!reading) continue;
    metrics.push(
      readingMetric(
        { ...reading, canonicalName: name },
        <>
          {reading.siteName ? `${reading.siteName} · ` : ""}
          <Ago iso={takenAt(reading) ?? overview.asOfUtc} />
        </>,
        canonicalPointLabels[name]
      )
    );
  }

  const { connectedSites, simulatedSites } = overview.summaries.edge;
  const total = overview.sites.length;
  const offline = total - connectedSites - simulatedSites;
  const notes = [
    simulatedSites > 0 ? `${simulatedSites} simulated` : null,
    offline > 0 ? `${offline} offline` : null,
    offline === 0 && simulatedSites === 0 ? "All sites reporting" : null
  ].filter(Boolean);
  metrics.push({
    label: "Edge connectivity",
    value: `${connectedSites} / ${total}`,
    unit: "sites live",
    status: offline > 0 ? "Offline" : simulatedSites > 0 ? "Simulated" : undefined,
    note: notes.join(" · ")
  });

  return metrics;
}
