"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { messageOfBody, signInRefusal } from "../../lib/refusals";
import { SESSION_TOKEN_COOKIE, SESSION_USER_COOKIE, SessionUser } from "../../lib/session";
import { visitorHeaders } from "../../lib/visitor";

const API_BASE_URL = process.env.GREECON_API_URL ?? "http://localhost:4000";

export async function loginAction(email: string, password: string, intendedArea: "client" | "staff" = "client"): Promise<{ error?: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await visitorHeaders()) },
      body: JSON.stringify({ email, password })
    });
  } catch {
    return { error: "Greecon could not be reached just now. It is not your password. Check your connection and try again in a minute." };
  }

  if (!response.ok) {
    return { error: signInRefusal(response.status, messageOfBody(await response.text().catch(() => ""))) };
  }

  // Parsed defensively rather than a bare response.json() — an unreadable body here previously
  // surfaced as an opaque "Unexpected end of JSON input" crash with no indication of what the API
  // actually sent back, which made a real misconfiguration (e.g. the API returning an empty body)
  // impossible to diagnose from the browser alone.
  const raw = await response.text();
  let parsed: { token: string; user: SessionUser };
  try {
    parsed = JSON.parse(raw) as { token: string; user: SessionUser };
  } catch {
    return { error: `The server sent back something unreadable (status ${response.status}). Raw response: ${raw.slice(0, 300) || "(empty)"}` };
  }
  const { token, user } = parsed;

  // The credentials are real either way — this only decides which door they walked through. A
  // client account trying the "Greecon team" button is turned back here rather than silently
  // landing on the client dashboard, so the two options actually mean something.
  if (intendedArea === "staff" && !user.isPlatformAdmin) {
    return { error: "This account doesn't have Greecon team access. Use \"Client login\" instead." };
  }

  const store = await cookies();
  // Matches the API's own 12h token expiry (apps/api/src/modules/auth/auth.service.ts) — the
  // cookie should never outlive the token it holds.
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12
  };
  store.set(SESSION_TOKEN_COOKIE, token, cookieOptions);
  store.set(SESSION_USER_COOKIE, JSON.stringify(user), cookieOptions);

  // A temporary password (the one the project manager handed over) is good for choosing a new one.
  if (user.mustChangePassword) redirect("/change-password");
  redirect(intendedArea === "staff" ? "/today" : "/");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_TOKEN_COOKIE);
  store.delete(SESSION_USER_COOKIE);
  redirect("/login");
}

/** After choosing a new password the old session (opened with the temporary one) is closed, and the
 * person signs in again with the new one. */
export async function signOutAfterPasswordChangeAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_TOKEN_COOKIE);
  store.delete(SESSION_USER_COOKIE);
  redirect("/login?changed=1");
}
