import Link from "next/link";
import { CreateSiteFromTemplateForm } from "../../../components/CreateSiteFromTemplateForm";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { requirePermission } from "../../../lib/access";
import { DEMO_ROLE } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const metadata = { title: "Add a site" };

// A site is made from the Sites screen (docs/28-ux-definition.md, section 3.3); it used to be a form inside Admin. The form chooses
// what kind of place it is, and the template brings the equipment, the readings and the setup list. Only for those who may manage
// sites. It binds a Server Action: see page.static.tsx for the GitHub Pages twin.
export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const session = await getSession();
  requirePermission(session?.user.role ?? DEMO_ROLE, "site:manage");

  return (
    <Shell title="Add a site" subtitle="Say what kind of place it is. Greecon prepares what that kind of site needs and opens its setup list.">
      <Section title="The site">
        <CreateSiteFromTemplateForm />
      </Section>
      <p>
        <Link className="standalone-link" href="/sites">Back to Sites</Link>
      </p>
    </Shell>
  );
}
