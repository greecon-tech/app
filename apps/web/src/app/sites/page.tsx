import Link from "next/link";
import { hasPermission } from "@greecon/shared";
import { FirstRun } from "../../components/FirstRun";
import { LiveRefresh } from "../../components/LiveRefresh";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { SiteRowData, SiteRows } from "../../components/SiteRows";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../lib/api";
import { getSession } from "../../lib/session";

export const metadata = { title: "Sites" };

// Which of my sites need a look? One card each, worst first (docs/28-ux-definition.md, section 4.3). "Add a site" is the main
// action for those who may; it opens the form that makes a site from a template.
export default async function SitesPage() {
  const sites = await apiGet<SiteRowData[]>("/sites");
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canManageSites = hasPermission(role, "site:manage");
  const addSite = canManageSites ? (
    <Link href="/sites/new" className="button-primary">
      Add a site
    </Link>
  ) : undefined;

  return (
    <Shell title="Sites" subtitle="Every site, and how it is doing right now." action={sites.length > 0 ? addSite : undefined}>
      <LiveRefresh enabled={!isStaticExport()} />
      {sites.length === 0 ? (
        <Section title="No site yet">
          <FirstRun role={role} />
        </Section>
      ) : (
        <Section title={`${sites.length} ${sites.length === 1 ? "site" : "sites"}`} aside={<span className="muted">Worst first</span>}>
          <SiteRows sites={sites} />
        </Section>
      )}
    </Shell>
  );
}
