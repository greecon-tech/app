import Link from "next/link";
import type { HandoverView } from "@greecon/shared";
import { Shell } from "../../../../components/Shell";
import { HandoverSheet } from "../../../../components/setup/HandoverSheet";
import { PrintButton } from "../../../../components/setup/PrintButton";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { getSession } from "../../../../lib/session";

// The sheet is worked out from the site as it is now, so it is rendered on request. The GitHub Pages
// export swaps in page.static.tsx, which needs generateStaticParams (see apps/web/scripts/build-static.sh).
export const dynamic = "force-dynamic";

export default async function HandoverPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await getSession();
  requirePermission(session?.user.role ?? DEMO_ROLE, "device:manage");
  const view = await apiGet<HandoverView>(`/sites/${siteId}/handover`);

  return (
    <Shell title={`Handover: ${view.site.name}`} subtitle={view.commissioned ? "Commissioned" : "Not commissioned yet"}>
      <p className="no-print">
        <Link href={`/sites/${siteId}/setup`}>← Back to setting up</Link> <PrintButton />
      </p>
      <HandoverSheet view={view} />
    </Shell>
  );
}
