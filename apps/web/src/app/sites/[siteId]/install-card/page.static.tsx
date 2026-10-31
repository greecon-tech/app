import Link from "next/link";
import { buildInstallCard } from "@greecon/shared";
import { Shell } from "../../../../components/Shell";
import { InstallCard } from "../../../../components/setup/InstallCard";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the same card, without the print button, and with generateStaticParams,
// which a dynamic route needs in a static export and must not have in the live build.
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function InstallCardPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  requirePermission(DEMO_ROLE, "device:manage");
  const [detail, setup] = await Promise.all([
    apiGet<{ site: { name: string; locationName: string }; devices: Array<{ name: string; deviceType: string; profileKey?: string }> }>(`/sites/${siteId}`),
    apiGet<{ templateKey?: string }>(`/sites/${siteId}/setup`)
  ]);
  const view = buildInstallCard({ siteName: detail.site.name, locationName: detail.site.locationName, templateKey: setup.templateKey, devices: detail.devices });
  return (
    <Shell title={`Install card: ${detail.site.name}`} subtitle="What to bring, what each device is set to, and what to send the customer">
      <p className="no-print">
        <Link className="standalone-link" href={`/sites/${siteId}/setup`}>← Back to setting up</Link>
      </p>
      <InstallCard view={view} />
    </Shell>
  );
}
