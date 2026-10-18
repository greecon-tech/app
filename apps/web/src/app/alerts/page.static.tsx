import { IncidentStatus } from "@greecon/shared";
import { Ago } from "../../components/Ago";
import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet } from "../../lib/api";
import { AlertRow, partitionAlerts } from "../../lib/alerts";
import { titleCase } from "../../lib/health";

type Alert = AlertRow;

interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: string;
  investigationNotes?: string;
}

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Acknowledging an alert
// and changing an incident's status both go through real Server Actions that call the live API —
// none of that exists here, since the static build has no server to send those mutations to.
export default async function AlertsPage() {
  // The static export has no real session, so every per-role build shows incidents regardless of
  // which role that build represents — matching the original combined page's `session ? ... :
  // true` fallback before this file split into a live/static twin pair.
  const canReadIncidents = true;

  const [allAlerts, incidents, sites] = await Promise.all([
    apiGet<Alert[]>("/alerts"),
    canReadIncidents ? apiGet<Incident[]>("/incidents", "operator") : Promise.resolve([]),
    apiGet<Array<{ id: string; name: string }>>("/sites")
  ]);
  const { active: alerts, cleared } = partitionAlerts(allAlerts);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <Shell title="Alerts" subtitle="What is wrong now, what to do first, and what has cleared.">
      <Section title="Active Alerts">
        <DataTable
          rows={alerts}
          emptyLabel="Nothing is open. Alerts appear here when a reading or a lost connection needs attention."
          columns={[
            { key: "severity", label: "Severity", render: (row) => <StatusBadge status={titleCase(row.severity)} /> },
            { key: "title", label: "Alert" },
            { key: "siteId", label: "Site", render: (row) => siteName.get(row.siteId ?? "") ?? "" },
            { key: "status", label: "Status", render: (row) => titleCase(row.status) },
            { key: "createdAtUtc", label: "Since", render: (row) => (row.createdAtUtc ? <Ago iso={row.createdAtUtc} /> : null) },
            { key: "suggestedAction", label: "Suggested Action" }
          ]}
        />
        <p className="muted">Acknowledging an alert requires a live deployment (Railway or Google Cloud). See docs/12-deployment-github-pages.md.</p>
      </Section>
      <Section title="Recently cleared">
        <DataTable
          rows={cleared}
          emptyLabel="Nothing has cleared yet."
          columns={[
            { key: "severity", label: "Severity", render: (row) => titleCase(row.severity) },
            { key: "title", label: "Alert" },
            { key: "siteId", label: "Site", render: (row) => siteName.get(row.siteId ?? "") ?? "" },
            { key: "resolvedAtUtc", label: "Cleared", render: (row) => (row.resolvedAtUtc ? <Ago iso={row.resolvedAtUtc} /> : null) }
          ]}
        />
      </Section>
      <Section title="Incidents">
        {canReadIncidents ? (
          <DataTable
            rows={incidents}
            columns={[
              { key: "title", label: "Incident" },
              { key: "severity", label: "Severity", render: (row) => <StatusBadge status={row.severity} /> },
              { key: "status", label: "Status" },
              { key: "investigationNotes", label: "Notes" }
            ]}
          />
        ) : (
          <p className="muted">Your role does not have permission to view incidents.</p>
        )}
      </Section>
    </Shell>
  );
}
