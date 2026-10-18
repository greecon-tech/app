import { hasPermission, IncidentStatus } from "@greecon/shared";
import { AcknowledgeAlertButton } from "../../components/AcknowledgeAlertButton";
import { Ago } from "../../components/Ago";
import { DataTable } from "../../components/DataTable";
import { IncidentStatusSelect } from "../../components/IncidentStatusSelect";
import { LiveRefresh } from "../../components/LiveRefresh";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../lib/api";
import { AlertRow, partitionAlerts } from "../../lib/alerts";
import { priorityWord, titleCase } from "../../lib/health";
import { getSession } from "../../lib/session";

type Alert = AlertRow;

interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: string;
  investigationNotes?: string;
}

// This page now binds real Server Actions (acknowledging an alert, changing an incident's
// status) — see page.static.tsx for the read-only twin used by the GitHub Pages export, and
// build-static.sh for the swap mechanism (same pattern as automation/admin/sites already use).
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  // Incident data requires incident:manage, which viewer and auditor don't hold. The static
  // export still pins this to "operator" so every per-role build renders it regardless
  // (docs/12-deployment-github-pages.md); a real session instead just doesn't get this section
  // when its own role lacks the permission — see automation/page.tsx for the same pattern.
  const canReadIncidents = session ? hasPermission(role, "incident:manage") : true;
  const canAcknowledge = hasPermission(role, "alert:acknowledge");

  const [allAlerts, incidents, sites] = await Promise.all([
    apiGet<Alert[]>("/alerts"),
    canReadIncidents ? apiGet<Incident[]>("/incidents", "operator") : Promise.resolve([]),
    apiGet<Array<{ id: string; name: string }>>("/sites")
  ]);
  const { active: alerts, cleared } = partitionAlerts(allAlerts);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <Shell title="Alerts" subtitle="What is wrong now, what to do first, and what has cleared.">
      <LiveRefresh enabled={!isStaticExport()} />
      <Section title="Active Alerts">
        <DataTable
          rows={alerts}
          emptyLabel="Nothing is open. Alerts appear here when a reading or a lost connection needs attention."
          columns={[
            { key: "severity", label: "Priority", render: (row) => <StatusBadge status={priorityWord(row.severity)} /> },
            { key: "title", label: "Alert" },
            { key: "siteId", label: "Site", render: (row) => siteName.get(row.siteId ?? "") ?? "" },
            { key: "status", label: "Status", render: (row) => titleCase(row.status) },
            { key: "createdAtUtc", label: "Since", render: (row) => (row.createdAtUtc ? <Ago iso={row.createdAtUtc} /> : null) },
            { key: "suggestedAction", label: "Suggested Action" },
            ...(canAcknowledge
              ? [
                  {
                    key: "id" as const,
                    label: "",
                    render: (row: Alert) => (row.status === "acknowledged" ? null : <AcknowledgeAlertButton alertId={row.id} />)
                  }
                ]
              : [])
          ]}
        />
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
      <Section title="Incidents">
        {canReadIncidents ? (
          <DataTable
            rows={incidents}
            columns={[
              { key: "title", label: "Incident" },
              { key: "severity", label: "Severity", render: (row) => <StatusBadge status={row.severity} /> },
              { key: "status", label: "Status", render: (row) => <IncidentStatusSelect incidentId={row.id} status={row.status} /> },
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
