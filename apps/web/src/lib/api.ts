import { redirect } from "next/navigation";
import { UserRole, userRoles } from "@greecon/shared";
import { isSuspendedRefusal, messageOfBody } from "./refusals";
import { getSession } from "./session";

const API_BASE_URL = process.env.GREECON_API_URL ?? "http://localhost:4000";

export type DemoRole = UserRole;

// Which role this build's pages fetch as by default when a call doesn't pin a specific role
// (see docs/12-deployment-github-pages.md) — set per build so "publish all role views" can bake
// five separate static snapshots, one per role, from the same source. Only meaningful for the
// static export: the live deployment uses the real logged-in session's role instead (see
// requestHeaders() below) and ignores this entirely.
const rawDemoRole = process.env.GREECON_DEMO_ROLE;
export const DEMO_ROLE: DemoRole = userRoles.includes(rawDemoRole as DemoRole) ? (rawDemoRole as DemoRole) : "operator";

/** True only in the GitHub Pages build (NEXT_OUTPUT_EXPORT=1, see docs/12-deployment-github-pages.md):
 * every page is baked once from whatever the API returned at build time, and nothing can be
 * re-fetched afterwards. */
export function isStaticExport(): boolean {
  return process.env.NEXT_OUTPUT_EXPORT === "1";
}

export async function apiGet<T>(path: string, role: DemoRole = DEMO_ROLE): Promise<T> {
  // A static export has no server to re-fetch on each request, so `no-store` (which Next.js's
  // static export forbids outright) doesn't apply.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: await requestHeaders(role),
    ...(isStaticExport() ? {} : { cache: "no-store" as const })
  });

  if (!response.ok) {
    // A session the API no longer accepts (the person was turned off, chose a new password, or the signing
    // secret was changed) is a signed-out person, not a fault: say so on the sign-in page.
    if (response.status === 401 && !isStaticExport()) redirect("/login?ended=1");
    const detail = await response.text().catch(() => "");
    // A client that Greecon has suspended: the person is told so, in words, and not shown a page that could not be loaded.
    if (!isStaticExport() && isSuspendedRefusal(response.status, messageOfBody(detail))) redirect("/login?suspended=1");
    throw new Error(`Greecon API request failed: ${role} ${path} -> ${response.status} ${detail.slice(0, 300)}`);
  }

  return parseJsonResponse<T>(response, role, "GET", path);
}

// Reads the body as text first rather than a bare response.json() — an empty or non-JSON body
// (e.g. a proxy/gateway error page, or a route that unexpectedly returned nothing) previously
// crashed the whole page with an opaque "Unexpected end of JSON input" and no indication of which
// request or what the server actually sent back, which made a real misconfiguration undiagnosable
// from the browser alone.
async function parseJsonResponse<T>(response: Response, role: DemoRole, method: string, path: string): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Greecon API returned an unreadable body: ${role} ${method} ${path} -> ${response.status}. Raw: ${raw.slice(0, 300) || "(empty)"}`);
  }
}

/** The API's own answer to pass on as it is, such as a file to download: authenticated like any other call,
 * and not read into memory here, so a year of readings streams through. */
export async function apiStream(path: string, role: DemoRole = DEMO_ROLE): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, { headers: await requestHeaders(role), cache: "no-store" });
}

/** Mutations only work against a live server (Railway/GCP) — the static GitHub Pages export
 * has nothing to send them to, so callers must gate this behind NEXT_OUTPUT_EXPORT themselves. */
export async function apiMutate<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown, role: DemoRole = DEMO_ROLE): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(await requestHeaders(role)) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Greecon API request failed: ${role} ${method} ${path} -> ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return parseJsonResponse<T>(response, role, method, path);
}

/** Real identity, when there is one, always wins over an explicitly-passed role — a caller
 * cannot ask to be treated as "auditor" for one call while actually logged in as "operator"; the
 * API only trusts the session it can verify itself (see apps/api/src/common/principal.guard.ts).
 * The `role` argument only still matters when there is no session at all: the static export
 * (which never has one) and any request made before a user has logged in. */
async function requestHeaders(role: DemoRole): Promise<Record<string, string>> {
  const session = isStaticExport() ? undefined : await getSession();

  return {
    ...(session ? { "x-greecon-session": session.token } : { "x-user-role": role }),
    ...(await gcpServiceAuthHeader())
  };
}

/** Cloud Run service-to-service auth — proves the web service is allowed to reach the API at
 * all on GCP's private network. Unrelated to the human user's identity above: that's why it's a
 * separate header (Authorization) from x-greecon-session, not a replacement for it. */
async function gcpServiceAuthHeader(): Promise<Record<string, string>> {
  if (!process.env.K_SERVICE) {
    return {};
  }

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(API_BASE_URL);
  const idToken = await client.idTokenProvider.fetchIdToken(API_BASE_URL);
  return { Authorization: `Bearer ${idToken}` };
}

/** The API's own explanation of a refusal ("Critical below must be lower than Low below."), when
 * it sent one, instead of the whole "request failed: ... -> 400 {json}" line. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const start = error.message.indexOf("{");
  if (start >= 0) {
    try {
      const body = JSON.parse(error.message.slice(start)) as { message?: string | string[] };
      if (typeof body.message === "string") return body.message;
      if (Array.isArray(body.message)) return body.message.join(" ");
    } catch {
      // not JSON: fall through to the plain message
    }
  }
  // The platform's own failure text ("Greecon API request failed: …") is for the log, not for a person: say what the screen would say.
  if (!error.message || error.message.startsWith("Greecon API request failed") || error.message.startsWith("Greecon API returned")) return fallback;
  return error.message;
}
