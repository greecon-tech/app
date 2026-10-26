import { AlertList } from "../../components/AlertList";
import { Ago } from "../../components/Ago";
import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/api";
import { AlertRow, partitionAlerts } from "../../lib/alerts";
import { priorityWord } from "../../lib/health";

export const metadata = { title: "Alerts" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Acknowledging an alert goes through a real Server Action that
// calls the live API — none of that exists here, since the static build has no server to send it to.
export default async function AlertsPage() {
  const [allAlerts, sites] = await Promise.all([apiGet<AlertRow[]>("/alerts"), apiGet<Array<{ id: string; name: string }>>("/sites")]);
  const { active, cleared } = partitionAlerts(allAlerts);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <Shell title="Alerts" subtitle="What is wrong now, what to do first, and what has cleared.">
      <Section title="Active" aside={<span className="muted">{active.length === 0 ? "Nothing open" : `${active.length} open`}</span>}>
        {active.length === 0 ? (
          <div className="empty-state">Nothing is open. An alert appears here when a reading, or a lost connection, needs a person.</div>
        ) : (
          <AlertList alerts={active.map((alert) => ({ ...alert, siteId: alert.siteId ?? "" }))} siteNames={siteName} />
        )}
        <p className="muted">Acknowledging an alert needs the live platform; this demo only shows what is open.</p>
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
