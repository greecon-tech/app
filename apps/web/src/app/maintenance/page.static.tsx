import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";

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

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Creating, completing, and
// reopening a task all go through real Server Actions that call the live API — none of that
// exists here, since the static build has no server to send those mutations to.
//
// Gated like page.tsx: the API 403s /maintenance for roles without maintenance:manage (viewer,
// auditor), which would otherwise fail the whole static build for those roles.
export default async function MaintenancePage() {
  requirePermission(DEMO_ROLE, "maintenance:manage");

  const [tasks, sites] = await Promise.all([apiGet<MaintenanceTask[]>("/maintenance"), apiGet<SiteOption[]>("/sites")]);
  const siteName = new Map(sites.map((site) => [site.id, site.name]));
  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "complete");

  return (
    <Shell title="Maintenance" subtitle="Scheduled and reactive upkeep for site equipment.">
      <Section title="Open tasks">
        {openTasks.length > 0 ? (
          <DataTable
            rows={openTasks.map((task) => ({ ...task, site: siteName.get(task.siteId) ?? task.siteId }))}
            columns={[
              { key: "title", label: "Task" },
              { key: "site", label: "Site" },
              { key: "dueAtUtc", label: "Due", render: (row) => (row.dueAtUtc ? new Date(row.dueAtUtc).toLocaleDateString() : "—") },
              { key: "notes", label: "Notes", render: (row) => row.notes ?? "—" }
            ]}
          />
        ) : (
          <div className="empty-state">No open maintenance tasks.</div>
        )}
        <p className="muted">Creating and completing tasks requires a live deployment (Railway or Google Cloud). See docs/12-deployment-github-pages.md.</p>
      </Section>
      <Section title="Completed">
        {completedTasks.length > 0 ? (
          <DataTable
            rows={completedTasks.map((task) => ({ ...task, site: siteName.get(task.siteId) ?? task.siteId }))}
            columns={[
              { key: "title", label: "Task" },
              { key: "site", label: "Site" },
              { key: "completedAtUtc", label: "Completed", render: (row) => (row.completedAtUtc ? new Date(row.completedAtUtc).toLocaleDateString() : "—") },
              { key: "completionLog", label: "Note", render: (row) => row.completionLog ?? "—" }
            ]}
          />
        ) : (
          <div className="empty-state">No completed tasks yet.</div>
        )}
      </Section>
      <Section title="Status">
        <div className="metric-grid">
          <div className="panel">
            <h3>{openTasks.length}</h3>
            <p className="muted">Open</p>
          </div>
          <div className="panel">
            <h3>{completedTasks.length}</h3>
            <p className="muted">Completed</p>
          </div>
        </div>
      </Section>
    </Shell>
  );
}
