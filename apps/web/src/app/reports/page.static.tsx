import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Requesting an export
// goes through a real Server Action that calls the live API — nothing to send it to here, since
// the static build has no server.
//
// Gated like page.tsx: the API 403s /reports/templates for roles without report:export, which
// would otherwise fail the whole static build for those roles.
export default async function ReportsPage() {
  requirePermission(DEMO_ROLE, "report:export");

  const templates = await apiGet<string[]>("/reports/templates");
  const rows = templates.map((name) => ({ name, status: "Ready" }));

  return (
    <Shell title="Reports" subtitle="Operational, sustainability, audit, and incident evidence.">
      <Section title="Generate Report">
        <div className="panel stack">
          <label>
            Report type
            <select defaultValue={templates[0]}>
              {templates.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled>
            Request export
          </button>
          <p className="muted">Requesting an export requires a live deployment (Railway or Google Cloud). See docs/12-deployment-github-pages.md.</p>
        </div>
      </Section>
      <Section title="Available Reports">
        <DataTable rows={rows} columns={[{ key: "name", label: "Report" }, { key: "status", label: "Status" }]} />
      </Section>
    </Shell>
  );
}
