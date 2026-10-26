import { UserRole, userRoles } from "@greecon/shared";
import { CreateUserForm } from "../../components/CreateUserForm";
import { DataTable } from "../../components/DataTable";
import { ResetPasswordButton } from "../../components/ResetPasswordButton";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { ROLE_WORDS, roleLabel } from "../../lib/roles";
import { getSession } from "../../lib/session";
import { updateUserRoleAction, updateUserStatusAction } from "./actions";

export const metadata = { title: "People" };

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
}

// People: who can sign in to this account (docs/28-ux-definition.md, section 4.3). The path is still /admin, because the guides and
// bookmarks name it; the page is no longer where sites are made and edited (that is Sites) nor a table of roles (that is a fold-out).
// Only ever used for the SSR build: see admin/page.static.tsx for the GitHub Pages twin, and build-static.sh for why the swap exists.
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "user:manage");
  const currentUserId = session?.user.id;
  // Greecon staff setting a customer up can see the people but not add or change them: that is the customer's owner.
  const support = session?.user.support === true;

  const users = await apiGet<User[]>("/users");

  return (
    <Shell title="People" subtitle="Who can sign in to this account, and what each person may do.">
      {support ? null : (
        <Section title="Add a person" aside={<span className="muted">A temporary password is shown once</span>}>
          <CreateUserForm />
        </Section>
      )}
      <Section title="Everyone with a sign-in" aside={support ? <span className="muted">Greecon staff in a setup session see the people but do not change them</span> : <span className="muted">{users.length} {users.length === 1 ? "person" : "people"}</span>}>
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
                  roleLabel(user.role)
                ) : (
                  <form action={updateUserRoleAction.bind(null, user.id)} className="user-row-form">
                    <select name="role" defaultValue={user.role} disabled={user.id === currentUserId} aria-label={`Role of ${user.name}`}>
                      {userRoles.map((candidate) => (
                        <option key={candidate} value={candidate}>
                          {roleLabel(candidate)}
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
              label: "Can sign in",
              render: (user) =>
                support || user.id === currentUserId ? (
                  <span className="muted">
                    {user.status === "active" ? "Yes" : "No, turned off"}
                    {user.id === currentUserId ? " (you)" : ""}
                  </span>
                ) : (
                  <form action={updateUserStatusAction.bind(null, user.id, user.status === "active" ? "disabled" : "active")} className="user-row-form">
                    <span>{user.status === "active" ? "Yes" : "No, turned off"}</span>
                    <button type="submit" className="button-ghost">
                      {user.status === "active" ? "Turn off" : "Turn on"}
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
