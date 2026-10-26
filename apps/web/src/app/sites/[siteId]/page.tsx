import { hasPermission, SiteProfile, SiteValue } from "@greecon/shared";
import { SiteBody, SiteDetail, TelemetryReading } from "../../../components/SiteBody";
import { Shell } from "../../../components/Shell";
import { ValueSection } from "../../../components/ValueSection";
import { LiveRefresh } from "../../../components/LiveRefresh";
import { apiGet, DEMO_ROLE, isStaticExport } from "../../../lib/api";
import { siteKindWords } from "../../../lib/equipment";
import { getSession } from "../../../lib/session";

const TRENDS_HOURS = 24 * 7;

// No generateStaticParams here — this file is only ever used for the SSR build (Railway, GCP),
// which renders each site on request. The static GitHub Pages export uses page.static.tsx
// instead (see apps/web/scripts/build-static.sh), which needs generateStaticParams to
// pre-render every site at build time; on this SSR page, merely having that function present —
// even gated to return [] — was enough to make Next.js treat the route as a static-generation
// candidate and throw DYNAMIC_SERVER_USAGE on the no-store fetch below.
//
// The value section binds a Server Action (the prices) that calls revalidatePath on this route, the same combination that
// forces dynamic rendering here. What the page says is SiteBody (docs/28-ux-definition.md, section 4.3); the machinery (assets,
// devices, readings' addresses and limits, the setup list) is one step away on the Equipment page, for those who may change it.
export const dynamic = "force-dynamic";

export default async function SiteDetailPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { siteId } = await params;
  const period = ["day", "week", "month", "last30"].includes((await searchParams).period ?? "") ? ((await searchParams).period as string) : "month";
  const [detail, history, value, profile] = await Promise.all([
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<TelemetryReading[]>(`/telemetry/history?siteId=${siteId}&hours=${TRENDS_HOURS}`),
    apiGet<SiteValue>(`/sites/${siteId}/value?period=${period}`),
    apiGet<SiteProfile>(`/sites/${siteId}/profile`)
  ]);
  const { site } = detail;
  // The real logged-in session's role, not the build-time DEMO_ROLE fallback, which only reflects the caller on the static export.
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const canSetUp = hasPermission(role, "site:manage") || hasPermission(role, "device:manage") || hasPermission(role, "asset:manage");

  return (
    <Shell title={site.name} subtitle={[site.locationName, siteKindWords(site.type)].filter(Boolean).join(" · ")}>
      <LiveRefresh enabled={!isStaticExport()} />
      <SiteBody
        detail={detail}
        history={history}
        canSetUp={canSetUp}
        canMaintain={hasPermission(role, "maintenance:manage")}
        valueBlock={<ValueSection value={value} siteId={site.id} profile={hasPermission(role, "site:manage") ? profile : undefined} periodHref={(key) => `/sites/${site.id}?period=${key}#value`} />}
      />
    </Shell>
  );
}
