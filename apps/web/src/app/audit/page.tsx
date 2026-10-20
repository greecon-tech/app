import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { getSession } from "../../lib/session";

interface AuditEvent {
  id: string;
  createdAtUtc: string;
  actor: string;
  eventType: string;
  entityType: string;
  reason?: string;
}

export default async function AuditPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "audit:read");

  const auditEvents = await apiGet<AuditEvent[]>("/audit");

  return (
    <Shell title="Audit" subtitle="Access, commands, automation, rule approvals, and operational evidence.">
      <Section title="Audit Log">
        <DataTable
          rows={auditEvents}
          columns={[
            { key: "createdAtUtc", label: "Timestamp" },
            { key: "actor", label: "Who" },
            { key: "eventType", label: "Event Type" },
            { key: "entityType", label: "Entity" },
            { key: "reason", label: "Reason" }
          ]}
        />
      </Section>
    </Shell>
  );
}
