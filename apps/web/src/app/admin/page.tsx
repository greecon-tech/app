import { GREECON_COMPANY, GREECON_DOMAIN, hasPermission, UserRole, userRoles } from "@greecon/shared";
import { DataTable } from "../../components/DataTable";
import { CreateSiteFromTemplateForm } from "../../components/CreateSiteFromTemplateForm";
import { CreateUserForm } from "../../components/CreateUserForm";
import { EditableSiteRow } from "../../components/EditableSiteRow";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { getSession } from "../../lib/session";
import { ResetPasswordButton } from "../../components/ResetPasswordButton";
import { updateUserRoleAction, updateUserStatusAction } from "./actions";

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
  role: UserRole;
  status: string;
}

const roleScopes = [
  { role: "Owner", scope: "Tenant, billing, users, sites, rules, audit" },
  { role: "Admin", scope: "Sites, assets, devices, users, approved rules" },
  { role: "Operator", scope: "Monitoring and operation within the site's operating limits" },
  { role: "Viewer", scope: "Read-only operational access" },
  { role: "Auditor", scope: "Reports, audit logs, automation history, compliance evidence" }
] as const;

// This page is only ever used for the SSR build (Railway/GCP) — see admin/page.static.tsx for
// the static GitHub Pages twin, and build-static.sh for why the swap exists at all.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "user:manage");
  const currentUserId = session?.user.id;
  const canManageSites = hasPermission(role, "site:manage");
  // Greecon staff setting a customer up can see the people but not add or change them: that is the customer's owner.
  const support = session?.user.support === true;

  const [sites, users, tenants] = await Promise.all([apiGet<Site[]>("/sites"), apiGet<User[]>("/users"), apiGet<Array<{ name: string; domain: string }>>("/tenants")]);
  // The account this page is about: the customer's own, also while Greecon staff are inside it.
  const tenant = tenants[0];

  return (
    <Shell title="Admin" subtitle="Tenant, users, roles, devices, retention, and security settings.">
      <Section title="Tenant">
        <div className="panel">
          <strong>{tenant?.name ?? GREECON_COMPANY}</strong>
          <p className="muted">{tenant?.domain ?? GREECON_DOMAIN}</p>
        </div>
      </Section>
      {support ? null : (
        <Section title="Create user" aside={<span className="muted">Generates a one-time temporary password</span>}>
          <CreateUserForm />
        </Section>
      )}
      <Section title="Users" aside={support ? <span className="muted">Staff in a setup session see the people but do not change them</span> : undefined}>
        <DataTable
          rows={users}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            {
              key: "role",
              label: "Role",
              render: (user) =>
                support ? (
                  user.role
                ) : (
                  <form action={updateUserRoleAction.bind(null, user.id)} className="user-row-form">
                    <select name="role" defaultValue={user.role} disabled={user.id === currentUserId}>
                      {userRoles.map((candidate) => (
                        <option key={candidate} value={candidate}>
                          {candidate.charAt(0).toUpperCase() + candidate.slice(1)}
                        </option>
                      ))}
                    </select>
                    {user.id === currentUserId ? null : (
                      <button type="submit" className="button-ghost">
                        Save
                      </button>
                    )}
                  </form>
                )
            },
            {
              key: "status",
              label: "Status",
              render: (user) =>
                support || user.id === currentUserId ? (
                  <span className="muted">
                    {user.status}
                    {user.id === currentUserId ? " (you)" : ""}
                  </span>
                ) : (
                  <form action={updateUserStatusAction.bind(null, user.id, user.status === "active" ? "disabled" : "active")}>
                    <button type="submit" className="button-ghost">
                      {user.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </form>
                )
            },
            {
              key: "id",
              label: "Password",
              render: (user) => (support ? "" : <ResetPasswordButton userId={user.id} />)
            }
          ]}
        />
      </Section>
      <Section title="Sites">
        {sites.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  {canManageSites ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <EditableSiteRow key={site.id} site={site} canManage={canManageSites} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No records available</div>
        )}
        {canManageSites ? <CreateSiteFromTemplateForm /> : null}
      </Section>
      <Section title="Roles">
        <DataTable rows={roleScopes} columns={[{ key: "role", label: "Role" }, { key: "scope", label: "Scope" }]} />
      </Section>
    </Shell>
  );
}
