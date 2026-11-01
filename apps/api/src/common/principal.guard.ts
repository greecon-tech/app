import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { DEMO_TENANT_ID } from "@greecon/shared";
import { sessionIsStillGood } from "./active-users";
import { hashGatewaySecret } from "./gateway-secret";
import {
  edgeDeviceIngestPrincipal,
  JwtClaims,
  jwtSecret,
  principalFromClaims,
  principalFromHeaders,
  publicRoutePrincipal,
  RequestWithPrincipal,
  SESSION_HEADER
} from "./principal";
import { DatabaseService } from "../database/database.service";

const EDGE_DEVICE_TOKEN_HEADER = "x-edge-device-token";

@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = headerValue(request.headers[SESSION_HEADER]);

    if (token) {
      // A bearer token was presented — it must verify, or the request is rejected. This never
      // falls back to trusting the x-user-role header on a bad/expired token: that would let an
      // attacker regain header-trust access just by sending garbage instead of a real token.
      const secret = jwtSecret();
      if (!secret) {
        throw new UnauthorizedException("This deployment cannot verify session tokens (JWT_SECRET is not configured).");
      }
      let claims: JwtClaims;
      try {
        claims = jwt.verify(token, secret) as JwtClaims;
      } catch {
        throw new UnauthorizedException("Session is invalid or has expired.");
      }
      // A token outlives the decision to turn the person off or to change their password, so ask whether
      // it still counts (docs/07-security-and-rbac.md). Without a database there are no accounts to ask.
      if (this.db.isConfigured() && !(await sessionIsStillGood(this.db, claims.sub, claims.iat))) {
        throw new UnauthorizedException("This session has ended. Sign in again.");
      }
      // A session opened with a temporary password can do exactly one thing: choose a new password.
      if (claims.mcp === true && !isAllowedWhilePasswordIsTemporary(request)) {
        throw new ForbiddenException({ message: "Choose a new password before you continue.", code: "PASSWORD_CHANGE_REQUIRED" });
      }
      const principal = principalFromClaims(claims);
      // Readings come from a box, with its own credential. A person who could send them (an operator can, and
      // so can the published demo login) could fill the platform's memory and disk with them, or write
      // readings that no meter made.
      if (isEdgeIngestRequest(request)) {
        throw new ForbiddenException("Readings are sent by a box with its own credential, not by a signed-in person.");
      }
      // The demo login is published, so anyone on the internet can hold it: it may look and try, and
      // nothing it does may be kept beyond a few harmless things.
      if (principal.tenantId === DEMO_TENANT_ID && !principal.isPlatformAdmin && !isAllowedInTheDemo(request)) {
        throw new ForbiddenException("The live demo is read-only: you can look and try it, but not change it. Ask Greecon for a setup of your own.");
      }
      request.principal = principal;
      return true;
    }

    // No session token. A real edge device (an industrial PC at a farm site, reachable over the
    // open internet — docs/14-edge-hardware-deployment.md) authenticates with a device secret
    // instead of a login, scoped to the few routes a box needs (EDGE_ROUTES below): the "simple
    // lock" chosen over a private tunnel for the first real pilot.
    if (isEdgeRequest(request)) {
      const deviceToken = headerValue(request.headers[EDGE_DEVICE_TOKEN_HEADER]);
      if (deviceToken) {
        // The real path: a per-gateway secret generated through the "Add gateway" form on a
        // site's own page (apps/api/src/platform/platform.service.ts's createGateway), stored only
        // as a hash — this is what lets Greecon onboard any number of clients' edge devices
        // entirely from app.greecon.earth, with no Railway configuration needed per client.
        const gatewayPrincipal = await this.principalForGatewaySecret(deviceToken);
        if (gatewayPrincipal) {
          request.principal = gatewayPrincipal;
          return true;
        }

        // Legacy fallback: a single shared secret for one fixed tenant, set as Railway env vars —
        // kept working for a deployment that configured this before per-gateway credentials
        // existed. A gateway created through the UI never needs this path. Both env vars must be
        // set together; either one missing disables this fallback entirely.
        const expectedToken = process.env.EDGE_INGEST_TOKEN;
        const expectedTenantId = process.env.EDGE_INGEST_TENANT_ID;
        // It names no gateway, so it can send readings and nothing else: a box asking for its
        // configuration or reporting its health must have a credential of its own.
        if (expectedToken && expectedTenantId && deviceToken === expectedToken && isEdgeIngestRequest(request)) {
          request.principal = edgeDeviceIngestPrincipal(expectedTenantId);
          return true;
        }
      }
    }

    // A couple of routes must work with no session at all, by definition: logging in (there is no
    // token to present yet — that's the whole point of the request) and the health check (meant to
    // be probed with no credentials at all). Left unguarded, the production lockout below rejects a
    // login attempt itself before it ever reaches AuthController, which is a much worse bug than
    // the one this lockout was meant to fix — nobody could log in at all, not just an unauthorized
    // caller.
    if (isPublicRoute(request)) {
      request.principal = publicRoutePrincipal();
      return true;
    }

    // No token of any kind. The header-based fallback (x-user-role/x-tenant-id) is trusted only
    // outside production — local dev convenience, and the static GitHub Pages export, which builds
    // by running the API locally with no public exposure at all (docs/12-deployment-github-pages.
    // md). Once this API has a public domain (Railway, so the edge device above can reach it),
    // trusting a self-asserted role header from literally anyone on the internet would let them
    // impersonate any role with zero credentials — so a real deployment (NODE_ENV=production, set
    // by both Dockerfiles) rejects outright here instead of falling back.
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Authentication required.");
    }

    request.principal = principalFromHeaders(request.headers);
    return true;
  }

  private async principalForGatewaySecret(secret: string) {
    if (!this.db.isConfigured()) return undefined;

    const result = await this.db.query<{ id: string; tenant_id: string }>("SELECT id, tenant_id FROM edge_gateways WHERE secret_hash = $1", [
      hashGatewaySecret(secret)
    ]);
    const row = result.rows[0];
    return row ? edgeDeviceIngestPrincipal(row.tenant_id, row.id) : undefined;
  }
}

const ALLOWED_WHILE_PASSWORD_IS_TEMPORARY: ReadonlyArray<{ method: string; path: string }> = [
  { method: "POST", path: "/auth/change-password" },
  { method: "GET", path: "/auth/session" }
];

function isAllowedWhilePasswordIsTemporary(request: RequestWithPrincipal): boolean {
  return ALLOWED_WHILE_PASSWORD_IS_TEMPORARY.some((route) => route.method === request.method && route.path === request.path);
}

/** What a session in the demo account may do besides looking: acknowledge an alert, arrange its own dashboard,
 * and be told why its password cannot be changed. Nothing else is written. */
function isAllowedInTheDemo(request: RequestWithPrincipal): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  if (request.method === "POST" && /^\/alerts\/[^/]+\/acknowledge$/.test(request.path)) return true;
  if (request.method === "PUT" && request.path === "/dashboard-preferences") return true;
  return request.method === "POST" && request.path === "/auth/change-password";
}

/** Sending readings, one message or many. */
function isEdgeIngestRequest(request: RequestWithPrincipal): boolean {
  return request.method === "POST" && (request.path === "/telemetry/ingest" || request.path === "/telemetry/ingest-batch");
}

/** What a box may call with its own credential: send readings, ask what to read, say how it is, say what it
 * found on the network when asked to look, and fetch its own software. Nothing that reads or changes a customer's data. */
const EDGE_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: "POST", path: "/telemetry/ingest" },
  { method: "POST", path: "/telemetry/ingest-batch" },
  { method: "GET", path: "/edge/config" },
  { method: "POST", path: "/edge/heartbeat" },
  { method: "POST", path: "/edge/discovery" },
  { method: "GET", path: "/edge/bundle" },
  { method: "GET", path: "/edge/bundle.json" }
];

function isEdgeRequest(request: RequestWithPrincipal): boolean {
  return EDGE_ROUTES.some((route) => route.method === request.method && route.path === request.path);
}

const PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: "POST", path: "/auth/login" },
  { method: "GET", path: "/health" },
  // The "Request access" form: someone who is not a user yet asking Greecon to set them up.
  { method: "POST", path: "/public/access-requests" },
  // A freshly installed box has no credential yet: it presents a one-time enrolment code and gets one.
  { method: "POST", path: "/edge/enrol" },
  { method: "GET", path: "/edge/install.sh" },
  // The software itself is fetched with a credential (a box updating) or an unused enrolment code
  // (a box being installed); the route checks which. The guard only lets the request reach it.
  { method: "GET", path: "/edge/bundle" },
  { method: "GET", path: "/edge/bundle.json" }
];

/** Public routes with a part of their own in the path: the "I have seen this" link in an alert message, which rests on its
 * signed token alone and is good for one alert (modules/alerts/acknowledge-link.controller.ts). */
const PUBLIC_ROUTE_PATTERNS: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: "GET", path: /^\/public\/acknowledge\/[^/]+$/ },
  { method: "POST", path: /^\/public\/acknowledge\/[^/]+$/ }
];

function isPublicRoute(request: RequestWithPrincipal): boolean {
  return (
    PUBLIC_ROUTES.some((route) => route.method === request.method && route.path === request.path) ||
    PUBLIC_ROUTE_PATTERNS.some((route) => route.method === request.method && route.path.test(request.path))
  );
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
