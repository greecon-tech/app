import Link from "next/link";
import { hasPermission } from "@greecon/shared";
import { LiveRefresh } from "../../components/LiveRefresh";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { SiteRowData, SiteRows } from "../../components/SiteRows";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../lib/api";
import { getSession } from "../../lib/session";

export default async function SitesPage() {
  const sites = await apiGet<SiteRowData[]>("/sites");
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canManageSites = hasPermission(role, "site:manage");

  return (
    <Shell title="Sites" subtitle="Every site, and how it is doing right now.">
      <LiveRefresh enabled={!isStaticExport()} />
      {sites.length === 0 ? (
        <Section title="No sites yet">
          <p className="muted">A site is one physical location — a farm, a pump station, a building — that holds its own devices and readings.</p>
          {canManageSites ? (
            <Link href="/admin" className="button-ghost">
              Go to Admin → Create site
            </Link>
          ) : (
            <p className="muted">Ask a Greecon admin to create your first site.</p>
          )}
        </Section>
      ) : (
        <Section
          title={`${sites.length} ${sites.length === 1 ? "site" : "sites"}`}
          aside={
            canManageSites ? (
              <Link href="/admin" className="button-ghost">
                Add a site
              </Link>
            ) : undefined
          }
        >
          <SiteRows sites={sites} />
        </Section>
      )}
    </Shell>
  );
}
