import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Throttle, ThrottlerException, ThrottlerGuard, ThrottlerOptions, ThrottlerStorageService } from "@nestjs/throttler";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOGIN_ACCOUNT_THROTTLE, loginAccountTracker, sessionOrSourceTracker, throttlers } from "./client-throttler";
import { SESSION_HEADER } from "./principal";

const SECRET = "test-secret";
const WEB_SERVICE_IP = "10.0.0.5";

function tokenFor(userId: string, secret = SECRET): string {
  return jwt.sign({ sub: userId, tenantId: "t1", role: "viewer", email: `${userId}@example.com` }, secret);
}

// Stand-in for the real controllers: the guard resolves @Throttle metadata off the handler, so the
// login handler gets the exact production override (just with a lower limit, to keep tests short).
class FakeController {
  login() {}
  other() {}
}
Throttle({ default: { ...LOGIN_ACCOUNT_THROTTLE, limit: 2 } })(FakeController.prototype, "login", Object.getOwnPropertyDescriptor(FakeController.prototype, "login")!);

interface FakeRequest {
  method: string;
  path: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

function contextFor(handler: "login" | "other", request: Partial<FakeRequest>): ExecutionContext {
  const full: FakeRequest = {
    method: handler === "login" ? "POST" : "GET",
    path: handler === "login" ? "/auth/login" : "/overview",
    ip: WEB_SERVICE_IP,
    headers: {},
    ...request
  };
  return {
    getHandler: () => FakeController.prototype[handler],
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => full, getResponse: () => ({ header: () => undefined }) })
  } as unknown as ExecutionContext;
}

// The production throttler config, with the limits scaled down so a test can exhaust them.
function scaledThrottlers(): ThrottlerOptions[] {
  return throttlers.map((throttler) => ({ ...throttler, limit: throttler.name === "default" ? 3 : 5 }));
}

describe("client throttler trackers", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  describe("sessionOrSourceTracker", () => {
    it("counts a logged-in user as themselves, not as the address they came from", () => {
      const req = { ip: WEB_SERVICE_IP, headers: { [SESSION_HEADER]: tokenFor("user-1") } };
      expect(sessionOrSourceTracker(req)).toBe("user:user-1");
    });

    it("falls back to the source address with no session (edge devices, probes)", () => {
      expect(sessionOrSourceTracker({ ip: "203.0.113.9", headers: {} })).toBe("ip:203.0.113.9");
    });

    it("never trusts an unverifiable token: forged, garbage and unconfigured-secret all use the source address", () => {
      const forged = { ip: WEB_SERVICE_IP, headers: { [SESSION_HEADER]: tokenFor("victim", "attacker-secret") } };
      const garbage = { ip: WEB_SERVICE_IP, headers: { [SESSION_HEADER]: "not-a-jwt" } };
      expect(sessionOrSourceTracker(forged)).toBe(`ip:${WEB_SERVICE_IP}`);
      expect(sessionOrSourceTracker(garbage)).toBe(`ip:${WEB_SERVICE_IP}`);

      delete process.env.JWT_SECRET;
      const valid = { ip: WEB_SERVICE_IP, headers: { [SESSION_HEADER]: tokenFor("user-1") } };
      expect(sessionOrSourceTracker(valid)).toBe(`ip:${WEB_SERVICE_IP}`);
    });

    it("accepts a repeated header and a request with no headers object", () => {
      const repeated = { ip: WEB_SERVICE_IP, headers: { [SESSION_HEADER]: [tokenFor("user-1"), "ignored"] } };
      expect(sessionOrSourceTracker(repeated)).toBe("user:user-1");
      expect(sessionOrSourceTracker({ ip: WEB_SERVICE_IP })).toBe(`ip:${WEB_SERVICE_IP}`);
    });
  });

  describe("loginAccountTracker", () => {
    it("counts attempts per account, normalising case and whitespace", () => {
      const a = loginAccountTracker({ ip: WEB_SERVICE_IP, body: { email: "Owner@Example.com" } });
      const b = loginAccountTracker({ ip: WEB_SERVICE_IP, body: { email: "  owner@example.com " } });
      expect(a).toBe("login:owner@example.com");
      expect(b).toBe(a);
    });

    it("falls back to the source address when there is no usable email", () => {
      const expected = `ip:${WEB_SERVICE_IP}`;
      expect(loginAccountTracker({ ip: WEB_SERVICE_IP })).toBe(expected);
      expect(loginAccountTracker({ ip: WEB_SERVICE_IP, body: {} })).toBe(expected);
      expect(loginAccountTracker({ ip: WEB_SERVICE_IP, body: { email: 42 } })).toBe(expected);
      expect(loginAccountTracker({ ip: WEB_SERVICE_IP, body: { email: "   " } })).toBe(expected);
    });

    it("bounds the key length so one request can't allocate an arbitrarily large bucket name", () => {
      const key = loginAccountTracker({ ip: WEB_SERVICE_IP, body: { email: "a".repeat(100_000) } });
      expect(key.length).toBeLessThanOrEqual("login:".length + 254);
    });
  });
});

describe("throttler config enforced by the real ThrottlerGuard", () => {
  const originalSecret = process.env.JWT_SECRET;
  let storage: ThrottlerStorageService;
  let guard: ThrottlerGuard;

  beforeEach(async () => {
    process.env.JWT_SECRET = SECRET;
    storage = new ThrottlerStorageService();
    guard = new ThrottlerGuard({ throttlers: scaledThrottlers() }, storage, new Reflector());
    await guard.onModuleInit();
  });

  afterEach(() => {
    storage.onApplicationShutdown();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  const authed = (userId: string, handler: "login" | "other" = "other") =>
    contextFor(handler, { headers: { [SESSION_HEADER]: tokenFor(userId) } });
  const attempt = (email: string, ip = WEB_SERVICE_IP) => contextFor("login", { ip, body: { email } });

  it("one customer exhausting their limit does not throttle another, though both arrive from the web service", async () => {
    for (let i = 0; i < 3; i++) expect(await guard.canActivate(authed("busy-user"))).toBe(true);
    await expect(guard.canActivate(authed("busy-user"))).rejects.toBeInstanceOf(ThrottlerException);

    expect(await guard.canActivate(authed("quiet-user"))).toBe(true);
  });

  it("a user is limited as one caller even across different source addresses", async () => {
    const from = (ip: string) => contextFor("other", { ip, headers: { [SESSION_HEADER]: tokenFor("roaming-user") } });
    for (let i = 0; i < 3; i++) expect(await guard.canActivate(from(`198.51.100.${i}`))).toBe(true);
    await expect(guard.canActivate(from("198.51.100.99"))).rejects.toBeInstanceOf(ThrottlerException);
  });

  it("garbage tokens cannot mint fresh buckets: they all share the source address's limit", async () => {
    const withToken = (token: string) => contextFor("other", { headers: { [SESSION_HEADER]: token } });
    for (let i = 0; i < 3; i++) expect(await guard.canActivate(withToken(`garbage-${i}`))).toBe(true);
    await expect(guard.canActivate(withToken("garbage-3"))).rejects.toBeInstanceOf(ThrottlerException);
  });

  it("unauthenticated callers such as edge devices are still limited per source address", async () => {
    const device = (ip: string) => contextFor("other", { ip });
    for (let i = 0; i < 3; i++) expect(await guard.canActivate(device("203.0.113.1"))).toBe(true);
    await expect(guard.canActivate(device("203.0.113.1"))).rejects.toBeInstanceOf(ThrottlerException);

    expect(await guard.canActivate(device("203.0.113.2"))).toBe(true);
  });

  it("limits login attempts per account, not across all customers", async () => {
    // The login handler's production override, at a limit of 2 in this test.
    expect(await guard.canActivate(attempt("target@example.com"))).toBe(true);
    expect(await guard.canActivate(attempt("TARGET@example.com "))).toBe(true);
    await expect(guard.canActivate(attempt("target@example.com"))).rejects.toBeInstanceOf(ThrottlerException);

    // Another customer logging in at the same moment, from the same web service, is unaffected.
    expect(await guard.canActivate(attempt("someone-else@example.com"))).toBe(true);
  });

  it("caps logins from one source across many accounts, without capping other routes or other sources", async () => {
    // login-source ceiling is 5 in this test; each email is a fresh account bucket.
    for (let i = 0; i < 5; i++) expect(await guard.canActivate(attempt(`victim-${i}@example.com`))).toBe(true);
    await expect(guard.canActivate(attempt("victim-5@example.com"))).rejects.toBeInstanceOf(ThrottlerException);

    // A different source is not affected by that flood...
    expect(await guard.canActivate(attempt("victim-6@example.com", "198.51.100.7"))).toBe(true);

    // ...and the ceiling only ever applies to login: ten different users on another route all pass.
    for (let i = 0; i < 10; i++) expect(await guard.canActivate(authed(`user-${i}`))).toBe(true);
  });
});
