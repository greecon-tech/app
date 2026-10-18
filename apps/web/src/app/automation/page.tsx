import { AutomationRule, hasPermission } from "@greecon/shared";
import { DataTable } from "../../components/DataTable";
import { ManualControlPanel, ManualControlTarget } from "../../components/ManualControlPanel";
import { RulesSection } from "../../components/RulesSection";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { getSession } from "../../lib/session";

// This page has Server Actions that mutate data (rule create/approve/disable/delete) and
// re-render it via revalidatePath — Next's static-optimization heuristics otherwise conflict
// with that combined with the no-store fetches in apiGet, producing a DYNAMIC_SERVER_USAGE
// error. Forcing fully dynamic rendering avoids the ambiguity. (The static export build never
// sees this file — see apps/web/scripts/build-static.sh.)
export const dynamic = "force-dynamic";

interface AuditEvent {
  id: string;
  createdAtUtc: string;
  eventType: string;
  reason?: string;
}

interface SiteOption {
  id: string;
  name: string;
}

interface DeviceOption {
  id: string;
  name: string;
  siteId: string;
}

interface PointOption {
  id: string;
  deviceId: string;
  siteId: string;
  label: string;
  unit: string;
  canonicalName: string;
  capability: string;
}

export default async function AutomationPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canManageRules = hasPermission(role, "automation:manage");
  const canControl = hasPermission(role, "command:create");
  // This page has no page-level permission of its own (every role can view it) — but Automation
  // History is drawn from the audit log, which not every role can read. A real session that
  // lacks audit:read simply doesn't get that section, rather than the old pinned-role workaround
  // that let any role read it regardless of what they were actually logged in as.
  const canReadAudit = hasPermission(role, "audit:read");

  const [rules, auditEvents, sites, devices, points] = await Promise.all([
    apiGet<AutomationRule[]>("/rules"),
    canReadAudit ? apiGet<AuditEvent[]>("/audit") : Promise.resolve([]),
    apiGet<SiteOption[]>("/sites"),
    apiGet<DeviceOption[]>("/devices"),
    apiGet<PointOption[]>("/points")
  ]);
  const history = auditEvents.filter((event) => event.eventType.startsWith("command.") || event.eventType.startsWith("manual_override."));

  const siteName = new Map(sites.map((site) => [site.id, site.name]));
  const deviceName = new Map(devices.map((device) => [device.id, device.name]));
  const controllableTargets: ManualControlTarget[] = points
    .filter((point) => point.capability === "write" || point.capability === "read_write")
    .map((point) => ({
      pointId: point.id,
      deviceId: point.deviceId,
      deviceName: deviceName.get(point.deviceId) ?? point.deviceId,
      siteId: point.siteId,
      siteName: siteName.get(point.siteId) ?? point.siteId,
      canonicalName: point.canonicalName,
      label: point.label,
      unit: point.unit
    }));

  return (
    <Shell title="Automation" subtitle="Rules, simulations, command safety, and human-readable action history.">
      {canManageRules ? (
        <RulesSection rules={rules} sites={sites} />
      ) : (
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
      )}
      <div className="split">
        <Section title="Automation History">
          {canReadAudit ? (
            <DataTable
              wide={false}
              rows={history}
              columns={[
                { key: "createdAtUtc", label: "Time" },
                { key: "eventType", label: "Event" },
                { key: "reason", label: "Reason" }
              ]}
            />
          ) : (
            <p className="muted">Your role does not have permission to read audit history.</p>
          )}
        </Section>
        <Section title="Manual Control" aside={<span className="muted">Simulated: nothing is sent to equipment yet</span>}>
          {canControl ? (
            <ManualControlPanel targets={controllableTargets} emptyMessage="No manually controllable equipment is configured yet." />
          ) : (
            <p className="muted">Your role does not have permission to dispatch manual commands.</p>
          )}
        </Section>
      </div>
    </Shell>
  );
}
