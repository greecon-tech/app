import { GREECON_PUBLIC_EMAILS } from "@greecon/shared";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { DEMO_ROLE } from "../../lib/api";
import { ROLE_WORDS } from "../../lib/roles";

export const metadata = { title: "Account" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The demo has no accounts of its own: each build is
// simply signed in as one role, so this says what that role may do and that there is no password to change.
export default function AccountPage() {
  const role = ROLE_WORDS[DEMO_ROLE];
  const email = GREECON_PUBLIC_EMAILS[0];
  return (
    <Shell title="Account" subtitle="Your own sign-in.">
      <Section title="You">
        <dl className="account-list">
          <dt>Role</dt>
          <dd>
            <strong>{role.label}</strong>
            <span className="muted"> {role.may}</span>
          </dd>
          <dt>Account</dt>
          <dd>
            Greecon demo
            <span className="muted"> The numbers in this demo are simulated. To have Greecon on your own site, write to <a href={`mailto:${email}`}>{email}</a>.</span>
          </dd>
        </dl>
        <p className="muted">This demo has no sign-in of its own, so there is no password to change.</p>
      </Section>
    </Shell>
  );
}
