import Link from "next/link";
import { DataTable } from "../../components/DataTable";
import { CreateTenantForm } from "../../components/CreateTenantForm";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePlatformAdmin } from "../../lib/access";
import { apiGet } from "../../lib/api";
import { getSession } from "../../lib/session";
import { updateTenantStatusAction } from "./actions";

interface TenantSummary {
  id: string;
  name: string;
  domain: string;
  status: string;
  userCount: number;
  siteCount: number;
}

interface TenantsResponse {
  tenants: TenantSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Manages Greecon's own clients (tenants) — separate from /admin, which manages users/sites
// within one client's own account. Only ever reachable by a real logged-in platform-admin session
// (see apps/api/src/common/principal.ts); this page is only used for the SSR build (Railway/GCP)
// — see platform/page.static.tsx for the static GitHub Pages twin.
//
// Search + pagination are server-side (see PlatformService.listAllTenants) — at pilot scale
// ("about to have 1600 customers or more") a plain fetch-and-render of every client was the one
// screen in the app that could not stay unpaginated.
export const dynamic = "force-dynamic";

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (search) query.set("q", search);

  const { tenants, total, pageSize } = await apiGet<TenantsResponse>(`/platform-admin/tenants?${query.toString()}`);
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <Shell title="Clients" subtitle="Onboard and manage every Greecon client account. Visible only to Greecon platform administrators.">
      <Section title="Onboard a new client" aside={<span className="muted">Creates the client's account and its first owner login</span>}>
        <CreateTenantForm />
      </Section>
      <Section title="All clients" aside={<span className="muted">{total} total</span>}>
        <form method="get" className="user-row-form" style={{ marginBottom: 12 }}>
          <input type="search" name="q" placeholder="Search by name, domain, or status" defaultValue={search} />
          <button type="submit" className="button-ghost">
            Search
          </button>
        </form>
        <DataTable
          rows={tenants}
          columns={[
            { key: "name", label: "Client" },
            { key: "domain", label: "Domain" },
            { key: "userCount", label: "Users" },
            { key: "siteCount", label: "Sites" },
            {
              key: "status",
              label: "Status",
              render: (tenant) => (
                <form action={updateTenantStatusAction.bind(null, tenant.id, tenant.status === "active" ? "suspended" : "active")}>
                  <button type="submit" className={tenant.status === "active" ? "button-ghost" : undefined}>
                    {tenant.status === "active" ? "Active — Suspend" : "Suspended — Reactivate"}
                  </button>
                </form>
              )
            }
          ]}
        />
        {lastPage > 1 ? (
          <div className="dashboard-order-controls">
            <Link href={buildHref(search, page - 1)} aria-disabled={page <= 1} className="button-ghost">
              Previous
            </Link>
            <span className="muted" style={{ alignSelf: "center" }}>
              Page {page} of {lastPage}
            </span>
            <Link href={buildHref(search, page + 1)} aria-disabled={page >= lastPage} className="button-ghost">
              Next
            </Link>
          </div>
        ) : null}
      </Section>
    </Shell>
  );
}

function buildHref(search: string, page: number): string {
  const query = new URLSearchParams({ page: String(Math.max(page, 1)) });
  if (search) query.set("q", search);
  return `/platform?${query.toString()}`;
}
