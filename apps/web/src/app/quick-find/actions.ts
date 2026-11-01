"use server";

import { AccessRequest, FindEntry, findEntries, foldForFind } from "@greecon/shared";
import type { SiteRowData } from "../../components/SiteRows";
import { apiGet } from "../../lib/api";
import { siteEntries } from "../../lib/find-entries";
import { getSession } from "../../lib/session";
import { isOwnAccount } from "../../lib/team";

// What quick find asks the server for as a person types (components/QuickFind.tsx): their sites, or, for Greecon's team, clients and
// requests. The pages and actions are known without asking. It never fails the page: whatever goes wrong, the finder keeps the pages.

const AT_MOST = 8;

interface TenantSummary {
  id: string;
  name: string;
  domain: string;
  status: string;
  siteCount: number;
}

async function sitesOf(query: string): Promise<FindEntry[]> {
  return findEntries(siteEntries(await apiGet<SiteRowData[]>("/sites")), query, AT_MOST);
}

async function clientsAndRequests(query: string): Promise<FindEntry[]> {
  // The server narrows by the first word; the rest of the words are applied here, with the same rules as the box on the screen.
  const first = foldForFind(query).split(" ")[0] ?? "";
  const params = new URLSearchParams({ page: "1", pageSize: String(AT_MOST) });
  if (first) params.set("q", first);
  const [clients, requests] = await Promise.all([
    apiGet<{ tenants: TenantSummary[] }>(`/platform-admin/tenants?${params.toString()}`),
    apiGet<AccessRequest[]>("/platform-admin/access-requests")
  ]);
  const clientEntries = clients.tenants
    .filter((tenant) => !isOwnAccount(tenant.domain))
    .map<FindEntry>((tenant) => ({
      id: `client:${tenant.id}`,
      kind: "Client",
      label: tenant.name,
      detail: [tenant.domain, `${tenant.siteCount} ${tenant.siteCount === 1 ? "site" : "sites"}`, tenant.status === "active" ? "" : "Suspended"].filter(Boolean).join(" · "),
      // The Clients page, narrowed to this one: from there "Open for setup" is a button, and opening an account is never a side effect of a search.
      href: `/platform?q=${encodeURIComponent(tenant.name)}`
    }));
  const requestEntries = requests
    .filter((request) => request.status === "new")
    .map<FindEntry>((request) => ({
      id: `request:${request.id}`,
      kind: "Request",
      label: request.company,
      detail: `${request.name} · ${request.email} · waiting`,
      href: "/platform/requests"
    }));
  return [...findEntries(clientEntries, query, AT_MOST), ...findEntries(requestEntries, query, 4)];
}

export async function quickFindAction(query: string): Promise<FindEntry[]> {
  const text = String(query ?? "").slice(0, 60);
  try {
    const session = await getSession();
    if (!session) return [];
    return session.user.isPlatformAdmin && !session.user.support ? await clientsAndRequests(text) : await sitesOf(text);
  } catch (error) {
    // A session the platform no longer accepts is sent to the sign-in page (apiGet redirects): that is not something to swallow.
    if (typeof error === "object" && error !== null && String((error as { digest?: unknown }).digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
    return [];
  }
}
