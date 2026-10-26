import Link from "next/link";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { requirePermission } from "../../../lib/access";
import { DEMO_ROLE } from "../../../lib/api";

export const metadata = { title: "Add a site" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): making a site calls a Server Action, and the demo has no
// server to make one on. Gated like the live page, so a role that may not add a site has no such page in its build either.
export default function NewSitePage() {
  requirePermission(DEMO_ROLE, "site:manage");
  return (
    <Shell title="Add a site" subtitle="Say what kind of place it is. Greecon prepares what that kind of site needs and opens its setup list.">
      <Section title="The site">
        <div className="panel">
          <p className="muted">Adding a site needs the live platform; this demo only shows the sites it already has.</p>
        </div>
      </Section>
      <p>
        <Link className="standalone-link" href="/sites">Back to Sites</Link>
      </p>
    </Shell>
  );
}
