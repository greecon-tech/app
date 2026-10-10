import { ExecutionContext } from "@nestjs/common";
import { ThrottlerOptions } from "@nestjs/throttler";
import jwt from "jsonwebtoken";
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

const MAX_TRACKED_EMAIL_LENGTH = 254;

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

/** Login tracker: counts attempts against the ACCOUNT being tried, which is what brute-force
 * protection is actually about — and, unlike the source address, is distinct per user even though
 * every login arrives from the web service. Body parsing runs before guards, so req.body is set. */
export function loginAccountTracker(req: TrackerRequest): string {
  const email = req.body?.email;
  if (typeof email !== "string") return sourceKey(req);

  const normalized = email.trim().toLowerCase().slice(0, MAX_TRACKED_EMAIL_LENGTH);
  return normalized ? `login:${normalized}` : sourceKey(req);
}

export function isLoginRequest(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<TrackerRequest>();
  return request.method === "POST" && request.path === "/auth/login";
}

/** 8 attempts/min per account: enough for a genuine user who mistypes a password, not enough to
 * guess one (docs/15-master-roadmap.md, Phase 0). Applied to POST /auth/login via @Throttle. */
export const LOGIN_ACCOUNT_THROTTLE = { limit: 8, ttl: 60_000, getTracker: loginAccountTracker };

/** The global throttlers. Per-account login limiting above can't stop one source trying a few
 * guesses against MANY accounts, so logins also share a ceiling per source address. Behind the web
 * service that source is the web service itself, so the ceiling is deliberately far above any
 * legitimate login rate — it's a flood breaker, not a per-user limit. Skipped on every other route. */
export const LOGIN_SOURCE_LIMIT = 200;

export const throttlers: ThrottlerOptions[] = [
  { name: "default", ttl: 60_000, limit: 120, getTracker: sessionOrSourceTracker },
  { name: "login-source", ttl: 60_000, limit: LOGIN_SOURCE_LIMIT, skipIf: (context) => !isLoginRequest(context) }
];
