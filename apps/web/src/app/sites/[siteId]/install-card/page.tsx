import Link from "next/link";
import { HandoverView, buildInstallCard } from "@greecon/shared";
import { Shell } from "../../../../components/Shell";
import { InstallCard } from "../../../../components/setup/InstallCard";
import { PrintButton } from "../../../../components/setup/PrintButton";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { getSession } from "../../../../lib/session";

export const metadata = { title: "Install card" };

interface SiteDetail {
  site: { id: string; name: string; locationName: string };
  devices: Array<{ name: string; deviceType: string; profileKey?: string }>;
}

// Worked out from the site's equipment as it is now, so it is rendered on request. The GitHub Pages export swaps in page.static.tsx, which needs
// generateStaticParams (see apps/web/scripts/build-static.sh).
export const dynamic = "force-dynamic";

export default async function InstallCardPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await getSession();
  requirePermission(session?.user.role ?? DEMO_ROLE, "device:manage");
  const [detail, setup, handover] = await Promise.all([
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<{ templateKey?: string }>(`/sites/${siteId}/setup`),
    apiGet<HandoverView>(`/sites/${siteId}/handover`)
  ]);
  const view = buildInstallCard({
    siteName: detail.site.name,
    locationName: detail.site.locationName,
    customer: handover.customer || undefined,
    templateKey: setup.templateKey,
    devices: detail.devices
  });

  return (
    <Shell title={`Install card: ${detail.site.name}`} subtitle="What to bring, what each device is set to, and what to send the customer">
      <p className="no-print">
        <Link className="standalone-link" href={`/sites/${siteId}/setup`}>← Back to setting up</Link> <PrintButton label="Print the card" />
      </p>
      <InstallCard view={view} />
    </Shell>
  );
}
