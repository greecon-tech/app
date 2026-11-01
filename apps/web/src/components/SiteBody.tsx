import Link from "next/link";
import { EnergyFlowView, GREECON_PUBLIC_EMAILS, HEALTH_LABELS, SiteHealth, valuePoints } from "@greecon/shared";
import { AlertRow, partitionAlerts } from "../lib/alerts";
import { equipmentKind } from "../lib/equipment";
import { priorityWord } from "../lib/health";
import { readingLabel, readingMetric, ReadingView } from "../lib/readings";
import { groupByPointId } from "../lib/telemetry-history";
import { Metric } from "../lib/types";
import { AlertList } from "./AlertList";
import { Ago } from "./Ago";
import { DataTable } from "./DataTable";
import { EnergyFlow } from "./EnergyFlow";
import { HealthReasons } from "./HealthHeadline";
import { MetricGrid } from "./MetricGrid";
import { Section } from "./Section";
import { StatusBadge } from "./StatusBadge";
import { TimeSeriesChart } from "./TimeSeriesChart";

export interface SiteDetail {
  site: { id: string; name: string; type: string; locationName: string; status: string; edgeStatus: string };
  health: SiteHealth;
  energyFlow?: EnergyFlowView;
  lastReadingAtUtc?: string;
  devices: Array<{ id: string; name: string; deviceType: string; health: string; lastSeenUtc?: string }>;
  points: Array<{ id: string; label: string; unit: string; canonicalName: string; capability: string }>;
  latestTelemetry: Array<ReadingView & { pointId: string }>;
  alerts: AlertRow[];
}

export interface TelemetryReading {
  timestampUtc: string;
  canonicalName: string;
  value: number | boolean | string;
}

/** A site page shows this many small charts and says where the rest are. */
const TRENDS_SHOWN = 6;
/** And this many readings before "Show every reading". */
const READINGS_SHOWN = 8;

/**
 * What a site's page says, in the order of docs/28-ux-definition.md section 4.3: the answer, what needs a person, the energy, what it
 * is worth, the readings, the trends, the equipment. The live page and the demo's page share it; they differ only in the value
 * block (the live one can save prices) and in what the person may change.
 */
export function SiteBody({
  detail,
  history,
  valueBlock,
  canSetUp,
  canMaintain
}: {
  detail: SiteDetail;
  history: readonly TelemetryReading[];
  /** The value section, or nothing. Passed in because the live page's has a form that calls a Server Action. */
  valueBlock?: React.ReactNode;
  /** Whether the person may open the equipment, setup and handover pages. */
  canSetUp: boolean;
  /** Whether the person keeps the maintenance list (an operator does, without changing equipment). */
  canMaintain: boolean;
}) {
  const { site } = detail;
  const historyByPointId = groupByPointId([...history]);
  // One chart per readable point this site actually has — a write-only command point has no meaningful trend to plot. Each point
  // has its own line: two tanks are two charts, never one that jumps between them.
  const trendPoints = detail.points.filter((point) => point.capability !== "write");
  const { active, cleared } = partitionAlerts(detail.alerts, 5);
  const siteNames = new Map([[site.id, site.name]]);
  const { shown, rest } = splitReadings(buildMetrics(detail));
  const hasValue = detail.points.some((point) => (valuePoints as readonly string[]).includes(point.canonicalName));
  // Before the first reading there is nothing to draw: the page says so once, and what happens next, instead of six empty charts.
  const waiting = detail.latestTelemetry.length === 0;

  return (
    <>
      <SiteAnswer detail={detail} />
      {waiting ? <SiteWaiting siteId={site.id} canSetUp={canSetUp} /> : null}
      {active.length > 0 ? (
        <Section title="Needs you here" aside={<Link href="/alerts">Open alerts</Link>}>
          <AlertList alerts={active.map((alert) => ({ ...alert, siteId: site.id }))} siteNames={siteNames} linkSites={false} />
        </Section>
      ) : null}
      {detail.energyFlow?.hasEnergy ? (
        <Section title="Energy now">
          <EnergyFlow flow={detail.energyFlow} siteName={site.name} />
        </Section>
      ) : null}
      {hasValue && valueBlock ? (
        <section id="value" className="section">
          <div className="section__header">
            <h2>Value</h2>
          </div>
          {valueBlock}
        </section>
      ) : null}
      <Section title="Readings now">
        {shown.length === 0 ? <div className="empty-state">No readings have arrived from this site yet.</div> : <MetricGrid metrics={shown} />}
        {rest.length > 0 ? (
          <details className="panel">
            <summary>Show every reading ({shown.length + rest.length})</summary>
            <MetricGrid metrics={rest} />
          </details>
        ) : null}
      </Section>
      <Section title="Trends" aside={<Link href={`/analytics?siteId=${site.id}`}>All trends</Link>}>
        {trendPoints.length === 0 || (waiting && history.length === 0) ? (
          <div className="empty-state">Nothing to chart yet. Charts appear when the site&apos;s readings start to arrive.</div>
        ) : (
          <>
            <div className="chart-grid">
              {trendPoints.slice(0, TRENDS_SHOWN).map((point) => (
                <TimeSeriesChart key={point.id} title={point.label} unit={point.unit} data={historyByPointId.get(point.id) ?? []} />
              ))}
            </div>
            {trendPoints.length > TRENDS_SHOWN ? (
              <p className="muted">
                {trendPoints.length - TRENDS_SHOWN} more in <Link href={`/analytics?siteId=${site.id}`}>All trends</Link>.
              </p>
            ) : null}
          </>
        )}
      </Section>
      <Section
        title="Equipment"
        id="equipment"
        aside={
          canSetUp ? (
            <Link href={`/sites/${site.id}/equipment`} className="button-ghost">
              Equipment and readings
            </Link>
          ) : undefined
        }
      >
        <DataTable
          rows={detail.devices}
          emptyLabel="No equipment is connected to this site yet."
          columns={[
            { key: "name", label: "Equipment" },
            { key: "deviceType", label: "Kind", render: (row) => equipmentKind(row.deviceType) },
            // Equipment that has never answered has not gone offline: it has not been connected yet.
            { key: "health", label: "State", render: (row) => (row.lastSeenUtc ? <StatusBadge status={row.health} /> : <StatusBadge status="Unknown" label="Not connected yet" />) },
            { key: "lastSeenUtc", label: "Last heard from", render: (row) => (row.lastSeenUtc ? <Ago iso={row.lastSeenUtc} /> : "Not yet") }
          ]}
        />
      </Section>
      {cleared.length > 0 ? (
        <Section title="Recently cleared here">
          <DataTable
            rows={cleared}
            columns={[
              { key: "severity", label: "Priority", render: (row) => priorityWord(row.severity) },
              { key: "title", label: "Alert" },
              { key: "resolvedAtUtc", label: "Cleared", render: (row) => (row.resolvedAtUtc ? <Ago iso={row.resolvedAtUtc} /> : null) }
            ]}
          />
        </Section>
      ) : null}
      {canSetUp || canMaintain ? (
        <Section title="Looking after this site">
          <p className="muted">{canSetUp ? "For the people who install and look after the equipment." : "Upkeep that is due at this site."}</p>
          <div className="rule-actions">
            {canMaintain ? (
              <Link href="/maintenance" className="button-ghost">
                Maintenance list
              </Link>
            ) : null}
            {canSetUp ? (
              <>
                <Link href={`/sites/${site.id}/setup`} className="button-ghost">
                  Setup list
                </Link>
                <Link href={`/sites/${site.id}/handover`} className="button-ghost">
                  Handover sheet
                </Link>
                <Link href={`/sites/${site.id}/equipment`} className="button-ghost">
                  Equipment and readings
                </Link>
              </>
            ) : null}
          </div>
        </Section>
      ) : null}
    </>
  );
}

/** What a site that has sent nothing yet says: that it is being set up, why the answer is Unknown, and what happens next. */
function SiteWaiting({ siteId, canSetUp }: { siteId: string; canSetUp: boolean }) {
  return (
    <Section title="Being set up">
      <div className="first-run">
        <p>
          <strong>Greecon is setting this site up.</strong> Until its box is fitted and each piece of equipment has answered, nothing has been measured, so Greecon says Unknown rather than guess.
        </p>
        <p className="muted">When the first readings arrive this page fills in by itself: how the site is doing, what needs a person, and what it is worth.</p>
        {canSetUp ? (
          <p>
            <Link href={`/sites/${siteId}/setup`} className="button-primary">
              Open the setup list
            </Link>
          </p>
        ) : (
          <p className="muted">Questions: {GREECON_PUBLIC_EMAILS[0]}.</p>
        )}
      </div>
    </Section>
  );
}

/** The answer for this one site, drawn like the account's answer on the Overview: a word and a shape, one sentence, how old the last
 * reading is, and why when it is not stable. */
function SiteAnswer({ detail }: { detail: SiteDetail }) {
  const { health, lastReadingAtUtc, site } = detail;
  const [first, ...others] = health.reasons;
  // A reason is one sentence, but not every one the platform writes ends with a full stop.
  const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);
  const headline = !first ? `${site.name} is fine. Every reading is current and nothing is open.` : `${sentence(first.message)}${others.length > 0 ? ` And ${others.length} more.` : ""}`;
  return (
    <section className={`health health--${health.state}`} aria-label="Status of this site">
      <StatusBadge status={HEALTH_LABELS[health.state]} />
      <p className="health__headline" role="status">
        {headline}
      </p>
      <p className="health__meta">{lastReadingAtUtc ? <>Last reading <Ago iso={lastReadingAtUtc} />.</> : "No reading has arrived from this site yet."}</p>
      {others.length > 0 ? <HealthReasons reasons={others} showSite={false} /> : null}
    </section>
  );
}

function buildMetrics(detail: SiteDetail): Metric[] {
  return detail.latestTelemetry.map((reading) =>
    readingMetric(reading, reading.timestampUtc ? <Ago iso={reading.timestampUtc} /> : "No timestamp", readingLabel(reading.canonicalName))
  );
}

/** The readings that have something to say (out of date, a warning) come first, so the top of the list is what matters. */
function splitReadings(metrics: Metric[]): { shown: Metric[]; rest: Metric[] } {
  const ordered = [...metrics.filter((metric) => metric.status), ...metrics.filter((metric) => !metric.status)];
  return { shown: ordered.slice(0, READINGS_SHOWN), rest: ordered.slice(READINGS_SHOWN) };
}
