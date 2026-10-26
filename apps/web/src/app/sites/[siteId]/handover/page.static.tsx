import Link from "next/link";
import type { HandoverView } from "@greecon/shared";
import { Shell } from "../../../../components/Shell";
import { HandoverSheet } from "../../../../components/setup/HandoverSheet";
import { PrintButton } from "../../../../components/setup/PrintButton";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): every site's sheet is baked at
// build time, because a static export has no live API to ask later.
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function HandoverPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  // The sheet lists the account's people, so the API only gives it to those who manage sites (and users);
  // each role's export is built on its own and must not ask for what that role may not see.
  requirePermission(DEMO_ROLE, "site:manage");
  const view = await apiGet<HandoverView>(`/sites/${siteId}/handover`);

  return (
    <Shell title={`Handover: ${view.site.name}`} subtitle={view.commissioned ? "Commissioned" : "Not commissioned yet"}>
      <p className="no-print">
        <Link className="standalone-link" href={`/sites/${siteId}/setup`}>← Back to setting up</Link> <PrintButton />
      </p>
      <HandoverSheet view={view} />
    </Shell>
  );
}
