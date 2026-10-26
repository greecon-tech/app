import { DataTable } from "../../components/DataTable";
import { LocalClock } from "../../components/LocalClock";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { auditWords } from "../../lib/audit";
import { getSession } from "../../lib/session";

export const metadata = { title: "Audit log" };

interface AuditEvent {
  id: string;
  createdAtUtc: string;
  actor: string;
  eventType: string;
  entityType: string;
  reason?: string;
}

// Who did what, and when (docs/28-ux-definition.md, section 4.3). Includes each time Greecon's team opened the account to set it up,
// under their own name (docs/launch, L19).
export default async function AuditPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "audit:read");

  const auditEvents = await apiGet<AuditEvent[]>("/audit");

  return (
    <Shell title="Audit log" subtitle="Who did what, and when.">
      <Section title="Everything recorded" aside={<span className="muted">{auditEvents.length} {auditEvents.length === 1 ? "entry" : "entries"}</span>}>
        <DataTable
          rows={auditEvents}
          emptyLabel="Nothing has been recorded yet."
          columns={[
            { key: "createdAtUtc", label: "When", render: (event) => <LocalClock iso={event.createdAtUtc} /> },
            { key: "actor", label: "Who" },
            { key: "eventType", label: "What", render: (event) => auditWords(event.eventType) },
            { key: "entityType", label: "About", render: (event) => auditWords(event.entityType) },
            { key: "reason", label: "Why", render: (event) => event.reason ?? "" }
          ]}
        />
      </Section>
    </Shell>
  );
}
