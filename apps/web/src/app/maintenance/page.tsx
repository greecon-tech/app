import { CreateMaintenanceTaskForm } from "../../components/CreateMaintenanceTaskForm";
import { DataTable } from "../../components/DataTable";
import { MaintenanceTaskActions } from "../../components/MaintenanceTaskActions";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { getSession } from "../../lib/session";

export const metadata = { title: "Maintenance" };

interface MaintenanceTask {
  id: string;
  siteId: string;
  title: string;
  notes?: string;
  dueAtUtc?: string;
  completedAtUtc?: string;
  completionLog?: string;
  status: "open" | "complete";
}

interface SiteOption {
  id: string;
  name: string;
}

// Real Server Actions (create/complete/reopen a task) — see page.static.tsx for the read-only
// twin used by the GitHub Pages export, and build-static.sh for the swap mechanism.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "maintenance:manage");

  const [tasks, sites] = await Promise.all([apiGet<MaintenanceTask[]>("/maintenance"), apiGet<SiteOption[]>("/sites")]);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));
  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "complete");

  return (
    <Shell title="Maintenance" subtitle="Upkeep that is due, and what has been done.">
      <Section title="Open tasks">
        {openTasks.length > 0 ? (
          <DataTable
            rows={openTasks.map((task) => ({ ...task, site: siteName.get(task.siteId) ?? task.siteId }))}
            columns={[
              { key: "title", label: "Task" },
              { key: "site", label: "Site" },
              { key: "dueAtUtc", label: "Due", render: (row) => (row.dueAtUtc ? new Date(row.dueAtUtc).toLocaleDateString() : "—") },
              { key: "notes", label: "Notes", render: (row) => row.notes ?? "—" },
              { key: "id", label: "", render: (row) => <MaintenanceTaskActions taskId={row.id} status={row.status} /> }
            ]}
          />
        ) : (
          <div className="empty-state">No open maintenance tasks.</div>
        )}
      </Section>
      <Section title="Create task">
        <CreateMaintenanceTaskForm sites={sites} />
      </Section>
      <Section title="Completed">
        {completedTasks.length > 0 ? (
          <DataTable
            rows={completedTasks.map((task) => ({ ...task, site: siteName.get(task.siteId) ?? task.siteId }))}
            columns={[
              { key: "title", label: "Task" },
              { key: "site", label: "Site" },
              { key: "completedAtUtc", label: "Completed", render: (row) => (row.completedAtUtc ? new Date(row.completedAtUtc).toLocaleDateString() : "—") },
              { key: "completionLog", label: "Note", render: (row) => row.completionLog ?? "—" },
              { key: "id", label: "", render: (row) => <MaintenanceTaskActions taskId={row.id} status={row.status} /> }
            ]}
          />
        ) : (
          <div className="empty-state">No completed tasks yet.</div>
        )}
      </Section>
    </Shell>
  );
}
