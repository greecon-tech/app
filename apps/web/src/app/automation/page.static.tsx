import { hasPermission } from "@greecon/shared";
import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet, DEMO_ROLE } from "../../lib/api";

interface Rule {
  id: string;
  name: string;
  priority: string;
  executionMode: string;
  approvalState: string;
  explanationTemplate: string;
}

interface AuditEvent {
  id: string;
  createdAtUtc: string;
  eventType: string;
  reason?: string;
}

// Read-only twin of page.tsx, used only for the static GitHub Pages export
// (see apps/web/scripts/build-static.sh) — a static export has no server to send rule
// mutations to, and the real page's RuleForm/RuleActions import Server Actions, which
// Next.js's static export flatly refuses to build even when they're never rendered.
export default async function AutomationPage() {
  const canManageRules = hasPermission(DEMO_ROLE, "automation:manage");

  const [rules, auditEvents] = await Promise.all([apiGet<Rule[]>("/rules"), apiGet<AuditEvent[]>("/audit", "auditor")]);
  const history = auditEvents.filter((event) => event.eventType.startsWith("command.") || event.eventType.startsWith("manual_override."));

  return (
    <Shell title="Automation" subtitle="Rules, simulations, command safety, and human-readable action history.">
      <Section title="Rules">
        <DataTable
          rows={rules}
          columns={[
            { key: "name", label: "Rule" },
            { key: "priority", label: "Priority" },
            { key: "executionMode", label: "Execution" },
            { key: "approvalState", label: "Approval", render: (row) => <StatusBadge status={row.approvalState} /> },
            { key: "explanationTemplate", label: "Explanation" }
          ]}
        />
      </Section>
      {canManageRules ? (
        <Section title="Create Rule" aside={<span className="muted">Owner / Admin only</span>}>
          <div className="panel">
            <p className="muted">
              Rule editing requires a live deployment (Railway or Google Cloud) — this build is a static snapshot with no server to save changes to. See docs/12-deployment-github-pages.md.
            </p>
          </div>
        </Section>
      ) : null}
      <div className="split">
        <Section title="Automation History">
          <DataTable
            wide={false}
            rows={history}
            columns={[
              { key: "createdAtUtc", label: "Time" },
              { key: "eventType", label: "Event" },
              { key: "reason", label: "Reason" }
            ]}
          />
        </Section>
        <Section title="Manual Control" aside={<span className="muted">Simulated: nothing is sent to equipment yet</span>}>
          <div className="panel">
            <p className="muted">
              Manual control requires a live deployment (Railway or Google Cloud) — this build is a static snapshot with no server to dispatch commands to. See docs/12-deployment-github-pages.md.
            </p>
          </div>
        </Section>
      </div>
    </Shell>
  );
}
