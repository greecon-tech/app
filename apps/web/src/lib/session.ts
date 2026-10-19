import { cookies } from "next/headers";
import { UserRole } from "@greecon/shared";

export const SESSION_TOKEN_COOKIE = "greecon_session";
export const SESSION_USER_COOKIE = "greecon_user";

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isPlatformAdmin: boolean;
  /** True while the password is a temporary one: the only thing to do is choose a new one. */
  mustChangePassword?: boolean;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "1";

/** The static GitHub Pages export has no server, so no cookies and no real login — it keeps
 * using GREECON_DEMO_ROLE (see lib/api.ts) exactly as before. This only ever returns a session
 * on the live SSR deployment (Railway/GCP). */
export async function getSession(): Promise<Session | undefined> {
  if (isStaticExport) return undefined;

  const store = await cookies();
  const token = store.get(SESSION_TOKEN_COOKIE)?.value;
  const userRaw = store.get(SESSION_USER_COOKIE)?.value;
  if (!token || !userRaw) return undefined;

  try {
    return { token, user: JSON.parse(userRaw) as SessionUser };
  } catch {
    return undefined;
  }
}
