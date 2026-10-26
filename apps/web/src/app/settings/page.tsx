import Link from "next/link";
import { DEMO_TENANT_ID, GREECON_COMPANY, GREECON_PUBLIC_EMAILS } from "@greecon/shared";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/api";
import { ROLE_WORDS } from "../../lib/roles";
import { getSession } from "../../lib/session";
import { logoutAction } from "../login/actions";

export const metadata = { title: "Account" };

// Account: a person's own sign-in, for every role (docs/28-ux-definition.md, section 4.3). It used to be for owners and
// administrators only, and held a dashboard table and two placeholders; nothing of that is left. Only ever used for the SSR
// build: see page.static.tsx for the GitHub Pages twin (this binds the change-password and sign-out Server Actions).
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [session, tenants] = await Promise.all([getSession(), apiGet<Array<{ name: string; domain: string }>>("/tenants")]);
  const tenant = tenants[0];
  const user = session?.user;
  // The demo account's logins are shared by everyone looking at the live demo: one visitor changing the password would lock
  // the rest out. The API refuses it too (apps/api/src/modules/auth/auth.service.ts); this keeps the control from being offered.
  const isDemoTenant = user?.tenantId === DEMO_TENANT_ID;
  // Inside a customer's account as Greecon staff, the sign-in on this page is not the customer's to change, and not the staff
  // member's either: their own is on the Greecon console.
  const support = user?.support === true;
  const role = user ? ROLE_WORDS[user.role] : undefined;
  const email = GREECON_PUBLIC_EMAILS[0];

  return (
    <Shell title="Account" subtitle="Your own sign-in.">
      <Section title="You">
        <dl className="account-list">
          <dt>Name</dt>
          <dd>{user?.name ?? "—"}</dd>
          <dt>Email</dt>
          <dd>{user?.email ?? "—"}</dd>
          <dt>Role</dt>
          <dd>
            <strong>{role?.label ?? "—"}</strong>
            {role ? <span className="muted"> {role.may}</span> : null}
          </dd>
          <dt>Account</dt>
          <dd>
            {tenant?.name ?? GREECON_COMPANY}
            <span className="muted"> To change the account&apos;s name, or for anything about it, write to <a href={`mailto:${email}`}>{email}</a>.</span>
          </dd>
        </dl>
        {support ? (
          <p className="muted">You are in this account as Greecon staff, so there is no password to change here. Your own is on the Greecon console.</p>
        ) : (
          <form action={logoutAction}>
            <button type="submit" className="button-ghost">
              Log out
            </button>
          </form>
        )}
      </Section>
      {isDemoTenant || support ? null : (
        <Section title="Change your password" aside={<span className="muted">Changes only your own sign-in</span>}>
          <ChangePasswordForm />
        </Section>
      )}
      {user && (user.role === "owner" || user.role === "admin") && !support ? (
        <p className="muted">
          People who work with you are added on <Link href="/admin">People</Link>; who hears about an alert is on <Link href="/settings/people">Who is told</Link>.
        </p>
      ) : null}
    </Shell>
  );
}
