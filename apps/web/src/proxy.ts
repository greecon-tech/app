import { NextRequest, NextResponse } from "next/server";
import { SESSION_TOKEN_COOKIE, SESSION_USER_COOKIE } from "./lib/session";

// This only runs on the live SSR deployment — the static GitHub Pages export has no server to
// run middleware on at all (see docs/12-deployment-github-pages.md); each of its five role
// builds is "logged in" as that build's role by construction, with no login step to protect.
//
// This checks for a present, unexpired token only — it does not verify the signature (that would
// need the JWT secret available in the Edge/middleware runtime). That's an acceptable trade-off
// here: the API verifies the signature on every single request regardless
// (apps/api/src/common/principal.guard.ts) and rejects a forged token outright, so a forged
// cookie that slips past this check still can't do anything — this check only exists to redirect
// an obviously logged-out visitor to /login instead of letting every page fail with a raw 401.
function isMissingOrExpired(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof decoded.exp !== "number" || decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Someone who signed in with a temporary password can only choose a new one. The API refuses
// everything else for that session anyway (apps/api/src/common/principal.guard.ts); this just sends
// them where they can act instead of letting every page fail.
function mustChangePassword(request: NextRequest): boolean {
  try {
    const raw = request.cookies.get(SESSION_USER_COOKIE)?.value;
    return raw !== undefined && (JSON.parse(raw) as { mustChangePassword?: boolean }).mustChangePassword === true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
  if (isMissingOrExpired(token)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (mustChangePassword(request) && request.nextUrl.pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|request-access|privacy|_next/static|_next/image|favicon.ico|greecon-logo.svg|greecon_icon.svg).*)"]
};
