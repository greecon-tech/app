import Link from "next/link";
import { AccessRequest } from "@greecon/shared";
import { ClientPeople } from "../../components/ClientPeople";
import { CreateTenantForm } from "../../components/CreateTenantForm";
import { DataTable } from "../../components/DataTable";
import { OpenForSetupButton } from "../../components/OpenForSetupButton";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { requirePlatformAdmin } from "../../lib/access";
import { apiGet } from "../../lib/api";
import { getSession } from "../../lib/session";
import { isOwnAccount } from "../../lib/team";
import { updateTenantStatusAction } from "./actions";

export const metadata = { title: "Clients" };

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

// Greecon's own clients (tenants), as a list to open from — separate from /people (/admin), which manages the people of one
// client's own account. Only ever reachable by a real logged-in platform-admin session (see apps/api/src/common/principal.ts);
// this page is only used for the SSR build (Railway/GCP) — see platform/page.static.tsx for the static GitHub Pages twin.
//
// Search + pagination are server-side (see PlatformService.listAllTenants) — at pilot scale
// ("about to have 1600 customers or more") a plain fetch-and-render of every client was the one
// screen in the app that could not stay unpaginated.
export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; onboard?: string }> }) {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (search) query.set("q", search);

  const [{ tenants, total, pageSize }, requests] = await Promise.all([
    apiGet<TenantsResponse>(`/platform-admin/tenants?${query.toString()}`),
    params.onboard && params.onboard !== "new" ? apiGet<AccessRequest[]>("/platform-admin/access-requests") : Promise.resolve([] as AccessRequest[])
  ]);
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const onboarding = params.onboard && params.onboard !== "new" ? requests.find((request) => request.id === params.onboard) : undefined;
  const clients = tenants.filter((tenant) => !isOwnAccount(tenant.domain));
  const own = tenants.filter((tenant) => isOwnAccount(tenant.domain));
  const canReset = session?.user.role === "owner";

  const columns = [
    {
      key: "name" as const,
      label: "Client",
      render: (tenant: TenantSummary) => (
        <>
          <strong>{tenant.name}</strong>
          <br />
          <span className="muted">{tenant.domain}</span>
        </>
      )
    },
    { key: "siteCount" as const, label: "Sites" },
    {
      key: "userCount" as const,
      label: "People",
      render: (tenant: TenantSummary) => (
        <>
          {tenant.userCount}
          <ClientPeople tenantId={tenant.id} clientName={tenant.name} canReset={canReset} />
        </>
      )
    },
    { key: "status" as const, label: "State", render: (tenant: TenantSummary) => <StatusBadge status={tenant.status === "active" ? "Active" : "Suspended"} /> },
    {
      key: "id" as const,
      label: "",
      render: (tenant: TenantSummary) => (
        <div className="row-actions">
          <OpenForSetupButton tenantId={tenant.id} name={tenant.name} disabled={tenant.status !== "active"} primary />
          <details className="row-menu">
            <summary>More</summary>
            <div className="row-menu__panel">
              <form action={updateTenantStatusAction.bind(null, tenant.id, tenant.status === "active" ? "suspended" : "active")}>
                <button type="submit" className="button-ghost">
                  {tenant.status === "active" ? "Suspend this client" : "Reactivate this client"}
                </button>
              </form>
              <p className="muted">{tenant.status === "active" ? "Its people cannot sign in and its box is turned away. Nothing is deleted." : "Its people can sign in again and its box reports again."}</p>
            </div>
          </details>
        </div>
      )
    }
  ];

  return (
    <Shell
      title="Clients"
      subtitle="Every customer account. Open one to set it up or to look after it."
      action={
        <Link href="/platform?onboard=new#onboard" className="button-primary">
          Onboard a client
        </Link>
      }
    >
      <details className="panel onboard" id="onboard" open={Boolean(params.onboard)}>
        <summary>
          <h2>Onboard a client</h2>
          <span className="muted">{onboarding ? `From the request by ${onboarding.name}` : "Creates the client's account and its first owner login"}</span>
        </summary>
        <CreateTenantForm
          key={onboarding?.id ?? "blank"}
          prefill={onboarding ? { requestId: onboarding.id, name: onboarding.company, ownerName: onboarding.name, ownerEmail: onboarding.email } : undefined}
        />
      </details>

      <Section title="All clients" aside={<span className="muted">{clients.length} {clients.length === 1 ? "client" : "clients"}{search ? ` matching "${search}"` : ""}</span>}>
        <form method="get" className="client-search" role="search">
          <label className="visually-hidden" htmlFor="client-search">
            Search clients
          </label>
          <input id="client-search" type="search" name="q" placeholder="Search by name or domain" defaultValue={search} />
          <button type="submit" className="button-ghost">
            Search
          </button>
        </form>
        <DataTable rows={clients} emptyLabel={search ? "No client matches that." : "No client yet. Use Onboard a client, or look at Requests."} columns={columns} />
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

      {own.length > 0 ? (
        <details className="panel own-accounts">
          <summary>Greecon's own accounts ({own.length})</summary>
          <p className="muted">The team's own account and the published demo. They are not customers.</p>
          <DataTable rows={own} columns={columns.filter((column) => column.key !== "id")} />
        </details>
      ) : null}
    </Shell>
  );
}

function buildHref(search: string, page: number): string {
  const query = new URLSearchParams({ page: String(Math.max(page, 1)) });
  if (search) query.set("q", search);
  return `/platform?${query.toString()}`;
}
