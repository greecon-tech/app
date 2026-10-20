import { DEMO_TENANT_ID, UserRole, userRoles } from "@greecon/shared";

// Session tokens travel in a dedicated header, not the standard Authorization one — on GCP,
// Authorization already carries the Cloud Run service-to-service ID token (see authHeader() in
// apps/web/src/lib/api.ts), which is infrastructure-level access control completely separate
// from a human user's identity. Reusing that header for both would silently break one or the
// other depending on deployment target.
export const SESSION_HEADER = "x-greecon-session";

export const DEMO_OWNER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const DEMO_OPERATOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
export const DEMO_AUDITOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

export interface Principal {
  tenantId: string;
  userId: string;
  role: UserRole;
  email: string;
  // Cross-tenant capability held by Greecon's own staff (docs/15-master-roadmap.md, Phase 2) —
  // orthogonal to `role`, which only ever governs what someone can do inside their own tenant.
  // Never true from principalFromHeaders(): the header fallback (static export/local dev) must
  // never grant cross-tenant access.
  isPlatformAdmin: boolean;
  /** Set when the caller is a box at a site, not a person: the gateway whose credential it presented. */
  gatewayId?: string;
  /** Set when Greecon staff have opened a customer's account to set it up (a support session): the
   * person is Greecon's, the account is the customer's, and who may sign in to it is not theirs to change. */
  support?: boolean;
}

export interface JwtClaims {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isPlatformAdmin?: boolean;
  /** Set while the account still has a temporary password: the session may only be used to choose a new one. */
  mcp?: boolean;
  /** Set on the session Greecon staff are given to set a customer's account up. */
  support?: boolean;
  /** When the token was issued, in seconds. Added by the signing library. */
  iat?: number;
}

export function jwtSecret(): string | undefined {
  return process.env.JWT_SECRET;
}

export interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;
  path: string;
  method: string;
  principal: Principal;
}

export function principalFromClaims(claims: JwtClaims): Principal {
  const role: UserRole = userRoles.includes(claims.role) ? claims.role : "viewer";
  return {
    tenantId: claims.tenantId,
    userId: claims.sub,
    role,
    email: claims.email,
    isPlatformAdmin: claims.isPlatformAdmin === true,
    ...(claims.support === true ? { support: true } : {})
  };
}

/** Header-based identity — the ONLY path before real login existed. Now used solely as a
 * fallback when no bearer token is present at all: the static GitHub Pages export (which has no
 * server to log in against) and local dev convenience. A request that presents a bearer token
 * must have it verify, or it's rejected outright (see principal.guard.ts) — this fallback never
 * overrides a bad token, only fills in for a request that never tried to authenticate. */
export function principalFromHeaders(headers: Record<string, string | string[] | undefined>): Principal {
  const role = headerValue(headers["x-user-role"]);
  const safeRole: UserRole = role && userRoles.includes(role as UserRole) ? (role as UserRole) : "operator";
  const tenantId = headerValue(headers["x-tenant-id"]) ?? process.env.GREECON_DEFAULT_TENANT_ID ?? DEMO_TENANT_ID;
  const userId = headerValue(headers["x-user-id"]) ?? userIdForRole(safeRole);
  const email = headerValue(headers["x-user-email"]) ?? emailForRole(safeRole);

  return {
    tenantId,
    userId,
    role: safeRole,
    email,
    isPlatformAdmin: false
  };
}

/** Granted only by PrincipalGuard, only for POST /telemetry/ingest, only when the caller presents
 * the shared EDGE_INGEST_TOKEN — the "simple lock" chosen for the first real farm's industrial PC
 * over a private tunnel (docs/14-edge-hardware-deployment.md). Scoped to a single fixed tenant
 * (the token isn't per-gateway yet — see docs/15-master-roadmap.md, Phase 2, "Real device identity
 * for machine traffic") and to "operator"'s permissions, which is more than telemetry:ingest alone
 * needs; the route match in PrincipalGuard is what actually keeps this narrow, not the role. */
export function edgeDeviceIngestPrincipal(tenantId: string, gatewayId?: string): Principal {
  return {
    tenantId,
    userId: "edge-device",
    role: "operator",
    email: "edge-device@greecon.earth",
    isPlatformAdmin: false,
    ...(gatewayId ? { gatewayId } : {})
  };
}

/** Granted only by PrincipalGuard, only for the couple of routes that must work with no session at
 * all — logging in (there is no token to present yet) and the health check (meant to be probed
 * with no credentials). Neither AuthController.login nor HealthController.health reads
 * request.principal at all, so this exists purely to satisfy RbacGuard/TenantStatusGuard without
 * crashing on `undefined`; isPlatformAdmin: true is what lets TenantStatusGuard's existing
 * platform-admin bypass apply here too, since neither of these two routes has a real tenant to
 * check the status of. This never grants any real authorization — it is not attached to a session,
 * not signed, and nothing checks it for a permission (RbacGuard already lets both routes through
 * before even looking at the principal, since neither has @RequirePermissions). */
export function publicRoutePrincipal(): Principal {
  return {
    tenantId: "public",
    userId: "anonymous",
    role: "viewer",
    email: "anonymous@public",
    isPlatformAdmin: true
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function userIdForRole(role: UserRole): string {
  if (role === "auditor") return DEMO_AUDITOR_ID;
  if (role === "operator") return DEMO_OPERATOR_ID;
  return DEMO_OWNER_ID;
}

function emailForRole(role: UserRole): string {
  if (role === "auditor") return "auditor@greecon.earth";
  if (role === "operator") return "operator@greecon.earth";
  return "eridon.manuka@greecon.earth";
}
