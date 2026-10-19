import { NextResponse } from "next/server";
import { apiErrorMessage, apiStream } from "../../../lib/api";
import { getSession } from "../../../lib/session";

// The download button's destination. The browser asks this server, which asks the API with the person's own
// session and passes the file straight through; the API decides whether they may have it. Anything that goes
// wrong sends them back to the Reports page with the reason in words, rather than showing them raw JSON.

export const dynamic = "force-dynamic";

const PATHS: Record<string, string> = {
  readings: "/exports/readings.csv",
  alerts: "/exports/alerts.csv",
  audit: "/exports/audit.csv",
  account: "/exports/account.json"
};

/** Only these are passed on to the API: it checks each of them too. */
const PASSED_ON = ["siteId", "days", "resolution", "style"];

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  const path = PATHS[kind];
  const back = (problem: string) => NextResponse.redirect(new URL(`/reports?problem=${encodeURIComponent(problem)}`, request.url), 303);
  if (!path) return back("There is no such download.");
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url), 303);

  const query = new URLSearchParams();
  const incoming = new URL(request.url).searchParams;
  for (const key of PASSED_ON) {
    const value = incoming.get(key);
    if (value) query.set(key, value);
  }

  const upstream = await apiStream(`${path}${query.size > 0 ? `?${query}` : ""}`);
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return back(apiErrorMessage(new Error(`${upstream.status} ${detail}`), "The download could not be made."));
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "attachment",
      "cache-control": "no-store"
    }
  });
}
