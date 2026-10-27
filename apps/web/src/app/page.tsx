import Link from "next/link";
import { redirect } from "next/navigation";
import { EnergyFlowView, SiteValue, TenantHealth } from "@greecon/shared";
import { AlertItem, AlertList } from "../components/AlertList";
import { EnergyFlowSwitch } from "../components/EnergyFlowSwitch";
import { FirstRun } from "../components/FirstRun";
import { HealthHeadline } from "../components/HealthHeadline";
import { LiveRefresh } from "../components/LiveRefresh";
import { Section } from "../components/Section";
import { Shell } from "../components/Shell";
import { SiteRowData, SiteRows } from "../components/SiteRows";
import { ValueSummary } from "../components/ValueView";
import { apiGet, DEMO_ROLE, isStaticExport } from "../lib/api";
import { getSession } from "../lib/session";

// The title template in the layout does not reach the page of its own segment, so the brand is written out here.
export const metadata = { title: { absolute: "Overview · Greecon" } };

interface Overview {
  asOfUtc: string;
  health: TenantHealth;
  sites: SiteRowData[];
  energy?: Array<{ siteId: string; siteName: string; flow: EnergyFlowView }>;
  summaries: { edge: { connectedSites: number; simulatedSites: number } };
  activeAlerts: AlertItem[];
}

// The client's home (docs/28-ux-definition.md, section 4.3): is everything all right, and what needs me? The answer first, then what
// needs a person, the sites, the energy picture of one site and what the solar is worth. The wall of "latest readings" that used to
// follow is gone: it mixed readings of different sites under one heading, and each site's own page says it better.
//
// Greecon's own team has a different home (Today); a member of the team inside a customer's account is a client here.
export default async function OverviewPage() {
  const session = await getSession();
  if (session?.user.isPlatformAdmin && !session.user.support) redirect("/today");

  const [overview, valueEntries] = await Promise.all([apiGet<Overview>("/overview"), apiGet<Array<{ siteId: string; siteName: string; value: SiteValue }>>("/value/summary")]);
  const siteNames = new Map(overview.sites.map((site) => [site.id, site.name]));
  const hasSites = overview.sites.length > 0;
  const role = session?.user.role ?? DEMO_ROLE;

  return (
    <Shell title="Overview" subtitle="Is everything all right, and what needs you?">
      <LiveRefresh enabled={!isStaticExport()} />
      {hasSites ? (
        <>
          <HealthHeadline health={overview.health} asOfUtc={overview.asOfUtc} simulatedSites={overview.summaries.edge.simulatedSites} />
          {overview.activeAlerts.length > 0 ? (
            <Section title="Needs you" aside={<Link href="/alerts">Open alerts</Link>}>
              <AlertList alerts={overview.activeAlerts} siteNames={siteNames} />
            </Section>
          ) : null}
          <Section title="Sites" aside={<Link href="/sites">All sites</Link>}>
            <SiteRows sites={overview.sites} />
          </Section>
          {overview.energy && overview.energy.length > 0 ? (
            <Section title="Energy now">
              <EnergyFlowSwitch entries={overview.energy} />
            </Section>
          ) : null}
          {valueEntries.length > 0 ? (
            <Section title="Value">
              <ValueSummary entries={valueEntries} />
            </Section>
          ) : null}
        </>
      ) : (
        <Section title="No site yet">
          <FirstRun role={role} />
        </Section>
      )}
    </Shell>
  );
}
