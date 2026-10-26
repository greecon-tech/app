import { hasPermission, SiteValue } from "@greecon/shared";
import { LiveRefresh } from "../../../components/LiveRefresh";
import { Shell } from "../../../components/Shell";
import { SiteBody, SiteDetail, TelemetryReading } from "../../../components/SiteBody";
import { ValueView } from "../../../components/ValueView";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../../lib/api";
import { siteKindWords } from "../../../lib/equipment";

const TRENDS_HOURS = 24 * 7;

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Only this build needs
// every site pre-rendered up front, since a static export has no live API to query at request
// time; the real SSR page renders on request and deliberately has no generateStaticParams (see
// its own comment for why that combination broke it).
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [detail, history, value] = await Promise.all([
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<TelemetryReading[]>(`/telemetry/history?siteId=${siteId}&hours=${TRENDS_HOURS}`),
    apiGet<SiteValue>(`/sites/${siteId}/value?period=month`)
  ]);
  const { site } = detail;
  const canSetUp = hasPermission(DEMO_ROLE, "site:manage") || hasPermission(DEMO_ROLE, "device:manage") || hasPermission(DEMO_ROLE, "asset:manage");

  return (
    <Shell title={site.name} subtitle={[site.locationName, siteKindWords(site.type)].filter(Boolean).join(" · ")}>
      <LiveRefresh enabled={!isStaticExport()} />
      <SiteBody detail={detail} history={history} canSetUp={canSetUp} canMaintain={hasPermission(DEMO_ROLE, "maintenance:manage")} valueBlock={<ValueView value={value} />} />
    </Shell>
  );
}
