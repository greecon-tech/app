import Link from "next/link";
import { AccessRequest, requestedSiteTypeLabels } from "@greecon/shared";
import { Ago } from "../../components/Ago";
import { DataTable } from "../../components/DataTable";
import { CreateTenantForm } from "../../components/CreateTenantForm";
import { OpenForSetupButton } from "../../components/OpenForSetupButton";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePlatformAdmin } from "../../lib/access";
import { apiGet } from "../../lib/api";
import { getSession } from "../../lib/session";
import { updateAccessRequestAction, updateTenantStatusAction } from "./actions";

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

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; onboard?: string }> }) {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (search) query.set("q", search);

  const [{ tenants, total, pageSize }, requests] = await Promise.all([
    apiGet<TenantsResponse>(`/platform-admin/tenants?${query.toString()}`),
    apiGet<AccessRequest[]>("/platform-admin/access-requests")
  ]);
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const open = requests.filter((request) => request.status === "new" || request.status === "contacted");
  const onboarding = params.onboard ? requests.find((request) => request.id === params.onboard) : undefined;

  return (
    <Shell title="Clients" subtitle="Onboard and manage every Greecon client account. Visible only to Greecon platform administrators.">
      <Section title="Requests" aside={<span className="muted">{open.length} waiting</span>}>
        {open.length === 0 ? (
          <div className="empty-state">No one is waiting. Requests from the sign-in page appear here.</div>
        ) : (
          <DataTable
            rows={open}
            columns={[
              { key: "createdAtUtc", label: "Received", render: (request) => <Ago iso={request.createdAtUtc} /> },
              {
                key: "company",
                label: "Who",
                render: (request) => (
                  <>
                    <strong>{request.company}</strong>
                    <br />
                    {request.name}
                  </>
                )
              },
              {
                key: "email",
                label: "Contact",
                render: (request) => (
                  <>
                    <a href={`mailto:${request.email}`}>{request.email}</a>
                    {request.phone ? (
                      <>
                        <br />
                        <a href={`tel:${request.phone.replace(/\s+/g, "")}`}>{request.phone}</a>
                      </>
                    ) : null}
                  </>
                )
              },
              { key: "siteType", label: "Runs", render: (request) => requestedSiteTypeLabels[request.siteType] },
              { key: "message", label: "Said", render: (request) => request.message ?? "" },
              {
                key: "status",
                label: "Next",
                render: (request) => (
                  <div className="rule-actions">
                    <Link href={`/platform?onboard=${request.id}#onboard`} className="button-primary">
                      Onboard
                    </Link>
                    {request.status === "new" ? (
                      <form action={updateAccessRequestAction.bind(null, request.id, "contacted")}>
                        <button type="submit" className="button-ghost">
                          Mark contacted
                        </button>
                      </form>
                    ) : (
                      <span className="muted">Contacted</span>
                    )}
                    <form action={updateAccessRequestAction.bind(null, request.id, "declined")}>
                      <button type="submit" className="button-ghost">
                        Decline
                      </button>
                    </form>
                  </div>
                )
              }
            ]}
          />
        )}
      </Section>
      <section id="onboard" className="section">
        <div className="section__header">
          <h2>Onboard a new client</h2>
          <div>
            <span className="muted">{onboarding ? `From the request by ${onboarding.name}` : "Creates the client's account and its first owner login"}</span>
          </div>
        </div>
        <CreateTenantForm
          key={onboarding?.id ?? "blank"}
          prefill={onboarding ? { requestId: onboarding.id, name: onboarding.company, ownerName: onboarding.name, ownerEmail: onboarding.email } : undefined}
        />
      </section>
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
              key: "id",
              label: "Setup",
              render: (tenant) => <OpenForSetupButton tenantId={tenant.id} name={tenant.name} disabled={tenant.status !== "active"} />
            },
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
