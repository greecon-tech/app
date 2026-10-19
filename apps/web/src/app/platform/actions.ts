"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiErrorMessage, apiMutate } from "../../lib/api";
import { ORIGIN_TOKEN_COOKIE, ORIGIN_USER_COOKIE, SESSION_TOKEN_COOKIE, SESSION_USER_COOKIE, SessionUser } from "../../lib/session";

interface CreatedTenant {
  id: string;
  name: string;
  domain: string;
  status: string;
}

interface CreatedOwner {
  id: string;
  email: string;
  name: string;
}

export async function updateTenantStatusAction(tenantId: string, nextStatus: "active" | "suspended"): Promise<void> {
  await apiMutate(`/platform-admin/tenants/${tenantId}/status`, "PATCH", { status: nextStatus });
  revalidatePath("/platform");
}

export async function createTenantAction(
  name: string,
  domain: string,
  ownerName: string,
  ownerEmail: string,
  requestId?: string
): Promise<{ error?: string; tenant?: CreatedTenant; owner?: CreatedOwner; temporaryPassword?: string }> {
  try {
    const result = await apiMutate<{ tenant: CreatedTenant; owner: CreatedOwner; temporaryPassword: string }>("/platform-admin/tenants", "POST", {
      name,
      domain: domain.trim() || undefined,
      ownerName,
      ownerEmail
    });
    // The request this account was made from is closed in the same breath, so the inbox is true.
    if (requestId) {
      await apiMutate(`/platform-admin/access-requests/${requestId}`, "PATCH", { status: "onboarded", note: `Account created for ${result.tenant.name}.` }).catch(() => undefined);
    }
    revalidatePath("/platform");
    return { tenant: result.tenant, owner: result.owner, temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to onboard client." };
  }
}

export async function updateAccessRequestAction(id: string, status: "new" | "contacted" | "onboarded" | "declined"): Promise<void> {
  await apiMutate(`/platform-admin/access-requests/${id}`, "PATCH", { status });
  revalidatePath("/platform");
}

interface SupportSession {
  token: string;
  user: SessionUser;
  customer: string;
  expiresInSeconds: number;
}

const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

/** Greecon's project manager goes into a customer's account to set it up. The session they get is a few hours long,
 * is for that account only, and is recorded under their own name in the customer's audit trail; their own session
 * is kept aside so that one click brings them back to this console. */
export async function openForSetupAction(tenantId: string): Promise<{ error?: string }> {
  let session: SupportSession;
  try {
    session = await apiMutate<SupportSession>(`/platform-admin/tenants/${tenantId}/support-session`, "POST");
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not open this account.") };
  }

  const store = await cookies();
  const own = store.get(SESSION_TOKEN_COOKIE)?.value;
  const ownUser = store.get(SESSION_USER_COOKIE)?.value;
  // Keep the staff member's own session, unless it is already a support session (one is never kept inside another).
  if (own && ownUser && !store.get(ORIGIN_TOKEN_COOKIE)) {
    store.set(ORIGIN_TOKEN_COOKIE, own, { ...cookieBase, maxAge: 60 * 60 * 12 });
    store.set(ORIGIN_USER_COOKIE, ownUser, { ...cookieBase, maxAge: 60 * 60 * 12 });
  }
  const options = { ...cookieBase, maxAge: session.expiresInSeconds };
  store.set(SESSION_TOKEN_COOKIE, session.token, options);
  store.set(SESSION_USER_COOKIE, JSON.stringify({ ...session.user, customer: session.customer }), options);
  redirect("/admin");
}

/** Back from a customer's account to Greecon's own console. */
export async function leaveSetupAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(ORIGIN_TOKEN_COOKIE)?.value;
  const user = store.get(ORIGIN_USER_COOKIE)?.value;
  store.delete(ORIGIN_TOKEN_COOKIE);
  store.delete(ORIGIN_USER_COOKIE);
  if (!token || !user) {
    // Nothing to go back to (the cookie lapsed): sign in again.
    store.delete(SESSION_TOKEN_COOKIE);
    store.delete(SESSION_USER_COOKIE);
    redirect("/login");
  }
  const options = { ...cookieBase, maxAge: 60 * 60 * 12 };
  store.set(SESSION_TOKEN_COOKIE, token, options);
  store.set(SESSION_USER_COOKIE, user, options);
  redirect("/platform");
}
