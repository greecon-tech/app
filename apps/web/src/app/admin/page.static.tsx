import { UserRole, userRoles } from "@greecon/shared";
import { DataTable } from "../../components/DataTable";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { ROLE_WORDS, roleLabel } from "../../lib/roles";

export const metadata = { title: "People" };

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
}

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Adding people and changing roles go through real Server
// Actions that call the live API — none of that exists here, since the static build has no server to send those mutations to.
//
// Gated the same way page.tsx is: the API 403s GET /users for any role without user:manage (operator, viewer, auditor), and a
// static build bakes in one snapshot per role, so without this gate the whole export fails for those roles. Nav hides the link
// for them anyway.
export default async function PeoplePage() {
  requirePermission(DEMO_ROLE, "user:manage");

  const users = await apiGet<User[]>("/users");

  return (
    <Shell title="People" subtitle="Who can sign in to this account, and what each person may do.">
      <Section title="Everyone with a sign-in">
        <DataTable
          rows={users}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (user) => roleLabel(user.role) },
            { key: "status", label: "Can sign in", render: (user) => (user.status === "active" ? "Yes" : "No, turned off") }
          ]}
        />
        <p className="muted">Adding people and changing roles needs the live platform; this demo only shows the list.</p>
      </Section>
      <details className="panel roles-panel">
        <summary>What each role may do</summary>
        <dl className="help-list help-list--words">
          {userRoles.map((candidate) => (
            <div key={candidate} className="help-list__row">
              <dt>{ROLE_WORDS[candidate].label}</dt>
              <dd>{ROLE_WORDS[candidate].may}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Shell>
  );
}
