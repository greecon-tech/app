import { GREECON_COMPANY, GREECON_DOMAIN } from "@greecon/shared";
import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";

interface Site {
  id: string;
  name: string;
  type: string;
  locationName: string;
  status: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const roleScopes = [
  { role: "Owner", scope: "Tenant, billing, users, sites, rules, audit" },
  { role: "Admin", scope: "Sites, assets, devices, users, approved rules" },
  { role: "Operator", scope: "Monitoring and operation within safety policy" },
  { role: "Viewer", scope: "Read-only operational access" },
  { role: "Auditor", scope: "Reports, audit logs, automation history, compliance evidence" }
] as const;

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Creating users, changing
// roles, and creating sites all go through real Server Actions that call the live API — none of
// that exists here, since the static build has no server to send those mutations to.
//
// Gated the same way page.tsx is: the API 403s GET /users for any role without user:manage
// (operator, viewer, auditor), and a static build bakes in one snapshot per role, so without this
// gate the whole export fails for those roles. Nav hides the Admin link for them anyway.
export default async function AdminPage() {
  requirePermission(DEMO_ROLE, "user:manage");

  const [sites, users] = await Promise.all([apiGet<Site[]>("/sites"), apiGet<User[]>("/users")]);

  return (
    <Shell title="Admin" subtitle="Tenant, users, roles, devices, retention, and security settings.">
      <Section title="Tenant">
        <div className="panel">
          <strong>{GREECON_COMPANY}</strong>
          <p className="muted">{GREECON_DOMAIN}</p>
        </div>
      </Section>
      <Section title="Users">
        <DataTable
          rows={users}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status" }
          ]}
        />
        <p className="muted">Creating users and changing roles requires a live deployment (Railway or Google Cloud). See docs/12-deployment-github-pages.md.</p>
      </Section>
      <Section title="Sites">
        <DataTable
          rows={sites}
          columns={[
            { key: "name", label: "Site" },
            { key: "type", label: "Type" },
            { key: "locationName", label: "Location" },
            { key: "status", label: "Status" }
          ]}
        />
      </Section>
      <Section title="Roles">
        <DataTable rows={roleScopes} columns={[{ key: "role", label: "Role" }, { key: "scope", label: "Scope" }]} />
      </Section>
    </Shell>
  );
}
