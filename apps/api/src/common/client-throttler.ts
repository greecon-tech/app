import { ExecutionContext } from "@nestjs/common";
import { ThrottlerOptions } from "@nestjs/throttler";
import jwt from "jsonwebtoken";
import { canonicalEmail } from "./email";
import { JwtClaims, jwtSecret, SESSION_HEADER } from "./principal";

// Who a rate limit counts against. @nestjs/throttler's default is req.ip, but in production every
// browser request reaches this API through the web service (server-side fetch from Next.js), so
// req.ip is the web service's address for EVERY customer: a limit of N/min then meant N/min for
// the whole platform, per endpoint. These trackers key on what actually identifies a caller.
//
// Trackers must never throw and must never hand an attacker a way to mint unlimited fresh buckets
// (an unverifiable token or a missing field falls back to the source address, not to a bucket named
// after attacker-supplied text).

type TrackerRequest = Record<string, any>;

function sourceKey(req: TrackerRequest): string {
  return `ip:${req.ip ?? "unknown"}`;
}

/** The user id from a session token that verifies against JWT_SECRET, else undefined. Verified
 * here (not just decoded) so a forged or garbage token can't select someone else's bucket or
 * spawn a fresh one. PrincipalGuard does the authoritative check later; this only picks a key. */
function verifiedUserId(req: TrackerRequest): string | undefined {
  const raw = req.headers?.[SESSION_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  const secret = jwtSecret();
  if (typeof token !== "string" || !token || !secret) return undefined;

  try {
    const claims = jwt.verify(token, secret) as Partial<JwtClaims>;
    return typeof claims.sub === "string" && claims.sub ? claims.sub : undefined;
  } catch {
    return undefined;
  }
}

/** Default tracker: a logged-in user is counted as themselves; anything else (edge devices, which
 * authenticate with a device secret and call from their own address; unauthenticated probes) is
 * counted by source address, exactly as before. */
export function sessionOrSourceTracker(req: TrackerRequest): string {
  const userId = verifiedUserId(req);
  return userId ? `user:${userId}` : sourceKey(req);
}

/** Login tracker: counts attempts at one ACCOUNT from one SOURCE. Counting an account's attempts from every
 * source together would let anyone who knew an address keep it locked for its owner by sending a few
 * attempts a minute, so each source has its own count for the account (the web service passes the visitor's
 * address on, see apps/web/src/lib/visitor.ts) and the ceiling over all sources is a separate, higher limit
 * below. The address is counted in its one canonical form (common/email.ts), so spelling it differently does
 * not start a new count. Body parsing runs before guards, so req.body is set. */
export function loginAccountTracker(req: TrackerRequest): string {
  const email = canonicalEmail(req.body?.email);
  return email ? `login:${email}|${req.ip ?? "unknown"}` : sourceKey(req);
}

/** The same account counted over every source at once: guessing a password across many addresses is
 * stopped here, at a ceiling an honest person cannot reach. */
export function loginAccountCeilingTracker(req: TrackerRequest): string {
  const email = canonicalEmail(req.body?.email);
  return email ? `login-any:${email}` : sourceKey(req);
}

export function isLoginRequest(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<TrackerRequest>();
  return request.method === "POST" && request.path === "/auth/login";
}

/** 8 attempts/min per account from one source: enough for a genuine user who mistypes a password, not enough
 * to guess one (docs/15-master-roadmap.md, Phase 0). Applied to POST /auth/login via @Throttle. */
export const LOGIN_ACCOUNT_THROTTLE = { limit: 8, ttl: 60_000, getTracker: loginAccountTracker };

/** 60 attempts/min at one account from all sources together: several people spreading guesses over many
 * addresses are still stopped, and it takes ten sources to keep an account locked. */
export const LOGIN_ACCOUNT_CEILING = 60;

/** The global throttlers. Per-account login limiting above can't stop one source trying a few
 * guesses against MANY accounts, so logins also share a ceiling per source address. That source is the
 * visitor's own address when the web service passes it on (apps/web/src/lib/visitor.ts), so one visitor
 * flooding the sign-in page cannot use up everyone else's; without it, it would be the web service
 * itself. The ceiling is far above any legitimate login rate: it is a flood breaker, not a per-user
 * limit. Skipped on every other route. */
export const LOGIN_SOURCE_LIMIT = 200;

/** POST /telemetry/ingest is called by an edge box, not a person, and the edge agent sends one
 * request per device per poll: at the example 5 s poll that is 12 requests a minute per device, so
 * 50 devices at one site need 600. The shared default of 120/min would start rejecting a site
 * with only ~10 devices. Counted per source address (an edge box has no session), so this is
 * per site once TRUST_PROXY makes the real address visible behind a proxy. */
export const INGEST_THROTTLE = { limit: 600, ttl: 60_000 };

export const throttlers: ThrottlerOptions[] = [
  { name: "default", ttl: 60_000, limit: 120, getTracker: sessionOrSourceTracker },
  { name: "login-source", ttl: 60_000, limit: LOGIN_SOURCE_LIMIT, skipIf: (context) => !isLoginRequest(context) },
  { name: "login-account", ttl: 60_000, limit: LOGIN_ACCOUNT_CEILING, getTracker: loginAccountCeilingTracker, skipIf: (context) => !isLoginRequest(context) }
];
