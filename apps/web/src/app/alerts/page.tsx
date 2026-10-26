import Link from "next/link";
import { hasPermission, NotificationStatusView } from "@greecon/shared";
import { AcknowledgeAlertButton } from "../../components/AcknowledgeAlertButton";
import { AlertList } from "../../components/AlertList";
import { Ago } from "../../components/Ago";
import { DataTable } from "../../components/DataTable";
import { LiveRefresh } from "../../components/LiveRefresh";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../lib/api";
import { AlertRow, partitionAlerts } from "../../lib/alerts";
import { priorityWord } from "../../lib/health";
import { getSession } from "../../lib/session";

export const metadata = { title: "Alerts" };

// What is wrong now, what to do first, and what has cleared (docs/28-ux-definition.md, section 4.3). This page binds a real Server Action
// (acknowledging an alert), so it is rendered on request: see page.static.tsx for the read-only twin used by the GitHub Pages export,
// and build-static.sh for the swap mechanism. The Incidents table that used to follow is gone: it repeated the alerts above it with a
// status menu nobody could explain, and nothing in the product reads what it holds.
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canAcknowledge = hasPermission(role, "alert:acknowledge");

  // Those who manage the account are told here, in plain words, if an alert would reach nobody.
  const canManageAccount = hasPermission(role, "settings:manage");
  const [allAlerts, sites, messaging] = await Promise.all([
    apiGet<AlertRow[]>("/alerts"),
    apiGet<Array<{ id: string; name: string }>>("/sites"),
    canManageAccount ? apiGet<NotificationStatusView>("/notifications/status") : Promise.resolve(undefined)
  ]);
  const reachesSomeone = messaging !== undefined && (messaging.email.configured || messaging.sms.configured) && messaging.contacts > 0;
  const { active, cleared } = partitionAlerts(allAlerts);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <Shell title="Alerts" subtitle="What is wrong now, what to do first, and what has cleared.">
      <LiveRefresh enabled={!isStaticExport()} />
      {messaging && !reachesSomeone ? (
        <div className="setup-guidance" role="status">
          <p>
            <strong>Alerts here are not being sent to anyone.</strong> {messaging.words[0]} {messaging.contacts === 0 ? messaging.words.find((line) => line.startsWith("Nobody")) : ""}
          </p>
          <p>
            <Link href="/settings/people">Open Who is told</Link>
          </p>
        </div>
      ) : null}
      <Section title="Active" aside={<span className="muted">{active.length === 0 ? "Nothing open" : `${active.length} open`}</span>}>
        {active.length === 0 ? (
          <div className="empty-state">Nothing is open. An alert appears here when a reading, or a lost connection, needs a person.</div>
        ) : (
          <AlertList
            alerts={active.map((alert) => ({ ...alert, siteId: alert.siteId ?? "" }))}
            siteNames={siteName}
            action={(alert) => (canAcknowledge && alert.status !== "acknowledged" ? <AcknowledgeAlertButton alertId={alert.id} /> : null)}
          />
        )}
      </Section>
      <Section title="Recently cleared">
        <DataTable
          rows={cleared}
          emptyLabel="Nothing has cleared yet."
          columns={[
            { key: "severity", label: "Priority", render: (row) => priorityWord(row.severity) },
            { key: "title", label: "Alert" },
            { key: "siteId", label: "Site", render: (row) => siteName.get(row.siteId ?? "") ?? "" },
            { key: "resolvedAtUtc", label: "Cleared", render: (row) => (row.resolvedAtUtc ? <Ago iso={row.resolvedAtUtc} /> : null) }
          ]}
        />
      </Section>
    </Shell>
  );
}
