import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetAllUsers } from "./active-users";
import { PrincipalGuard } from "./principal.guard";
import { JwtClaims, RequestWithPrincipal } from "./principal";
import { DatabaseService } from "../database/database.service";

function contextWithHeaders(
  headers: Record<string, string | string[] | undefined>,
  route: { path: string; method: string } = { path: "/", method: "GET" }
): ExecutionContext {
  const request = { headers, path: route.path, method: route.method, principal: undefined } as unknown as RequestWithPrincipal;
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

// Defaults to "no database" so every existing test exercises exactly the same header/token paths
// as before the per-gateway lookup existed — only the "gateway secret" describe block below passes
// a configured fake to actually exercise that query.
function fakeDatabase(configured: boolean, rows: Array<{ tenant_id: string }> = []): DatabaseService {
  return {
    isConfigured: () => configured,
    query: vi.fn().mockResolvedValue({ rows })
  } as unknown as DatabaseService;
}

describe("PrincipalGuard and sessions that outlive the person's access", () => {
  const ACCOUNT = "22222222-bbbb-4bbb-8bbb-222222222222";
  const original = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    forgetAllUsers();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  const sessionFor = (sub: string) => jwt.sign({ sub, tenantId: "tenant-1", role: "owner", email: "owner@client.example" } satisfies JwtClaims, "test-secret");

  it("lets a session through for an account that is still active", async () => {
    const guard = new PrincipalGuard({ isConfigured: () => true, query: vi.fn().mockResolvedValue({ rows: [{ status: "active", cut_off: null }] }) } as unknown as DatabaseService);
    await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": sessionFor(ACCOUNT) }))).resolves.toBe(true);
  });

  it("turns away a valid, unexpired token once the person has been turned off", async () => {
    const guard = new PrincipalGuard({ isConfigured: () => true, query: vi.fn().mockResolvedValue({ rows: [{ status: "disabled", cut_off: null }] }) } as unknown as DatabaseService);
    await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": sessionFor(ACCOUNT) }))).rejects.toThrow(/session has ended/);
  });

  it("turns away a token signed with the right secret for an account that does not exist", async () => {
    const guard = new PrincipalGuard({ isConfigured: () => true, query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as DatabaseService);
    await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": sessionFor(ACCOUNT) }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("PrincipalGuard", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEdgeToken = process.env.EDGE_INGEST_TOKEN;
  const originalEdgeTenant = process.env.EDGE_INGEST_TENANT_ID;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    delete process.env.NODE_ENV;
    delete process.env.EDGE_INGEST_TOKEN;
    delete process.env.EDGE_INGEST_TENANT_ID;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEdgeToken === undefined) delete process.env.EDGE_INGEST_TOKEN;
    else process.env.EDGE_INGEST_TOKEN = originalEdgeToken;
    if (originalEdgeTenant === undefined) delete process.env.EDGE_INGEST_TENANT_ID;
    else process.env.EDGE_INGEST_TENANT_ID = originalEdgeTenant;
  });

  it("falls back to header-based identity when no bearer token is present and this isn't production", async () => {
    const guard = new PrincipalGuard(fakeDatabase(false));
    const context = contextWithHeaders({ "x-user-role": "operator" });
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal.role).toBe("operator");
  });

  it("builds the principal from a valid bearer token's claims, not from any headers sent alongside it", async () => {
    const claims: JwtClaims = { sub: "user-1", tenantId: "tenant-1", role: "auditor", email: "auditor@greecon.earth" };
    const token = jwt.sign(claims, "test-secret");
    const guard = new PrincipalGuard(fakeDatabase(false));
    // A malicious/stale x-user-role header sent alongside a valid token for a different role
    // must be ignored — the token is the only thing trusted once one is present.
    const context = contextWithHeaders({ "x-greecon-session": token, "x-user-role": "owner" });
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "auditor",
      email: "auditor@greecon.earth",
      isPlatformAdmin: false
    });
  });

  it("carries isPlatformAdmin through from the token's claims when present", async () => {
    const claims: JwtClaims = { sub: "user-1", tenantId: "tenant-1", role: "owner", email: "eridon.manuka@greecon.earth", isPlatformAdmin: true };
    const token = jwt.sign(claims, "test-secret");
    const guard = new PrincipalGuard(fakeDatabase(false));
    const context = contextWithHeaders({ "x-greecon-session": token });
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal.isPlatformAdmin).toBe(true);
  });

  it("rejects a bearer token that fails verification rather than falling back to headers", async () => {
    const guard = new PrincipalGuard(fakeDatabase(false));
    const context = contextWithHeaders({ "x-greecon-session": "not-a-real-token", "x-user-role": "owner" });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a bearer token when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ sub: "user-1", tenantId: "tenant-1", role: "owner", email: "owner@greecon.earth" }, "some-secret");
    const guard = new PrincipalGuard(fakeDatabase(false));
    const context = contextWithHeaders({ "x-greecon-session": token });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  describe("production lockout", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("rejects an unauthenticated request outright instead of falling back to the role header", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-user-role": "owner" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("still verifies a real session token normally", async () => {
      const claims: JwtClaims = { sub: "user-1", tenantId: "tenant-1", role: "owner", email: "owner@greecon.earth" };
      const token = jwt.sign(claims, "test-secret");
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-greecon-session": token });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe("a session opened with a temporary password", () => {
    const temporary = () => jwt.sign({ sub: "u1", tenantId: "t1", role: "owner", email: "o@x.example", mcp: true } satisfies JwtClaims, "test-secret");

    it("may choose a new password and look at who it is, and nothing else", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      for (const route of [
        { path: "/auth/change-password", method: "POST" },
        { path: "/auth/session", method: "GET" }
      ]) {
        await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": temporary() }, route)), `${route.method} ${route.path}`).resolves.toBe(true);
      }
    });

    it("is turned away from everything else, and told why", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      for (const route of [
        { path: "/overview", method: "GET" },
        { path: "/sites", method: "GET" },
        { path: "/auth/change-password", method: "GET" },
        { path: "/commands", method: "POST" }
      ]) {
        await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": temporary() }, route)), `${route.method} ${route.path}`).rejects.toThrow(/Choose a new password/);
      }
    });

    it("is an ordinary session once the flag is gone", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const token = jwt.sign({ sub: "u1", tenantId: "t1", role: "owner", email: "o@x.example" } satisfies JwtClaims, "test-secret");
      await expect(guard.canActivate(contextWithHeaders({ "x-greecon-session": token }, { path: "/overview", method: "GET" }))).resolves.toBe(true);
    });
  });

  describe("public routes", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("lets an unauthenticated POST /auth/login through in production instead of 401ing before it reaches the controller", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({}, { path: "/auth/login", method: "POST" });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("lets an unauthenticated GET /health through in production", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({}, { path: "/health", method: "GET" });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("lets an unauthenticated POST /public/access-requests through, because the people asking are not users yet", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({}, { path: "/public/access-requests", method: "POST" });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("does not let the public form's pass reach Greecon's inbox of requests, or read anything", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      for (const route of [
        { path: "/platform-admin/access-requests", method: "GET" },
        { path: "/platform-admin/access-requests/abc", method: "PATCH" },
        { path: "/public/access-requests", method: "GET" }
      ]) {
        await expect(guard.canActivate(contextWithHeaders({}, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
      }
    });

    it("does not extend the same pass to a lookalike route", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({}, { path: "/auth/session", method: "GET" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("lets the link in an alert message be read and answered with no session, because the person may have no login", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      for (const method of ["GET", "POST"]) {
        await expect(guard.canActivate(contextWithHeaders({}, { path: "/public/acknowledge/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", method }))).resolves.toBe(true);
      }
    });

    it("does not let that pass reach anything beside the one route", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      for (const route of [
        { path: "/public/acknowledge", method: "GET" },
        { path: "/public/acknowledge/token/more", method: "GET" },
        { path: "/public/acknowledge/token", method: "PUT" },
        { path: "/alerts/abc/acknowledge", method: "POST" }
      ]) {
        await expect(guard.canActivate(contextWithHeaders({}, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
      }
    });
  });

  describe("per-gateway edge device secret", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("grants a scoped operator principal for the tenant that owns the matching gateway secret", async () => {
      const db = fakeDatabase(true, [{ tenant_id: "farm-tenant" }]);
      const guard = new PrincipalGuard(db);
      const context = contextWithHeaders({ "x-edge-device-token": "a-real-per-gateway-secret" }, { path: "/telemetry/ingest", method: "POST" });
      const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal).toEqual({
        tenantId: "farm-tenant",
        userId: "edge-device",
        role: "operator",
        email: "edge-device@greecon.earth",
        isPlatformAdmin: false
      });
      // The plaintext secret is hashed before ever reaching the database — never queried in the
      // clear, mirroring how a password is never compared against a stored value in the clear.
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("secret_hash"), [expect.not.stringMatching("a-real-per-gateway-secret")]);
    });

    it("does not extend gateway access to any other route", async () => {
      const db = fakeDatabase(true, [{ tenant_id: "farm-tenant" }]);
      const guard = new PrincipalGuard(db);
      const context = contextWithHeaders({ "x-edge-device-token": "a-real-per-gateway-secret" }, { path: "/sites", method: "GET" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("falls through to the legacy shared token when no gateway matches the secret", async () => {
      process.env.EDGE_INGEST_TOKEN = "shared-secret";
      process.env.EDGE_INGEST_TENANT_ID = "legacy-tenant";
      const db = fakeDatabase(true, []);
      const guard = new PrincipalGuard(db);
      const context = contextWithHeaders({ "x-edge-device-token": "shared-secret" }, { path: "/telemetry/ingest", method: "POST" });
      const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal.tenantId).toBe("legacy-tenant");
    });

    it("never queries the database when it isn't configured, and falls straight to the legacy path", async () => {
      process.env.EDGE_INGEST_TOKEN = "shared-secret";
      process.env.EDGE_INGEST_TENANT_ID = "legacy-tenant";
      const db = fakeDatabase(false);
      const guard = new PrincipalGuard(db);
      const context = contextWithHeaders({ "x-edge-device-token": "shared-secret" }, { path: "/telemetry/ingest", method: "POST" });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it("rejects when neither a gateway secret nor the legacy token match", async () => {
      const db = fakeDatabase(true, []);
      const guard = new PrincipalGuard(db);
      const context = contextWithHeaders({ "x-edge-device-token": "not-registered-anywhere" }, { path: "/telemetry/ingest", method: "POST" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("legacy shared edge ingest token", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
      process.env.EDGE_INGEST_TOKEN = "shared-secret";
      process.env.EDGE_INGEST_TENANT_ID = "farm-tenant";
    });

    it("grants a scoped operator principal on POST /telemetry/ingest with the right token", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-edge-device-token": "shared-secret" }, { path: "/telemetry/ingest", method: "POST" });
      const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal).toEqual({
        tenantId: "farm-tenant",
        userId: "edge-device",
        role: "operator",
        email: "edge-device@greecon.earth",
        isPlatformAdmin: false
      });
    });

    it("rejects the right token on any other route", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-edge-device-token": "shared-secret" }, { path: "/sites", method: "GET" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a wrong token on the ingest route", async () => {
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-edge-device-token": "wrong" }, { path: "/telemetry/ingest", method: "POST" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("never grants access when EDGE_INGEST_TOKEN isn't configured, even with a token header present", async () => {
      delete process.env.EDGE_INGEST_TOKEN;
      const guard = new PrincipalGuard(fakeDatabase(false));
      const context = contextWithHeaders({ "x-edge-device-token": "shared-secret" }, { path: "/telemetry/ingest", method: "POST" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});

describe("PrincipalGuard: what a signed-in person may not do", () => {
  const original = process.env.JWT_SECRET;
  const DEMO = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    forgetAllUsers();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  const session = (tenantId: string, role: JwtClaims["role"] = "operator", extra: Partial<JwtClaims> = {}) =>
    jwt.sign({ sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", tenantId, role, email: "someone@example.com", ...extra } satisfies JwtClaims, "test-secret");
  const guard = new PrincipalGuard(fakeDatabase(false));
  const call = (token: string, method: string, path: string) => guard.canActivate(contextWithHeaders({ "x-greecon-session": token }, { method, path }));

  it("may not send readings: those come from a box with its own credential", async () => {
    for (const path of ["/telemetry/ingest", "/telemetry/ingest-batch"]) {
      await expect(call(session("tenant-1", "owner"), "POST", path), path).rejects.toThrow(/sent by a box with its own credential/);
    }
    // Reading them back is still an ordinary thing to do.
    await expect(call(session("tenant-1", "viewer"), "GET", "/telemetry/latest")).resolves.toBe(true);
  });

  it("is read-only in the demo account, which is published and so held by anyone: no tasks, commands, rules or people", async () => {
    const demo = session(DEMO, "operator");
    for (const [method, path] of [["POST", "/maintenance"], ["POST", "/commands"], ["POST", "/rules"], ["PATCH", "/sites/s1"], ["DELETE", "/devices/d1"], ["POST", "/users"], ["POST", "/gateways"]] as const) {
      await expect(call(demo, method, path), `${method} ${path}`).rejects.toThrow(/live demo is read-only/);
    }
  });

  it("lets the demo account look, acknowledge an alert, arrange its dashboard and be told its password cannot change", async () => {
    const demo = session(DEMO, "operator");
    for (const [method, path] of [["GET", "/overview"], ["GET", "/sites/s1"], ["POST", "/alerts/a1/acknowledge"], ["PUT", "/dashboard-preferences"], ["POST", "/auth/change-password"]] as const) {
      await expect(call(demo, method, path), `${method} ${path}`).resolves.toBe(true);
    }
    // Only an alert's own acknowledge route, not something that merely starts like it.
    await expect(call(demo, "POST", "/alerts/a1/acknowledge/extra")).rejects.toThrow(/live demo is read-only/);
  });

  it("does not make any other account read-only", async () => {
    await expect(call(session("tenant-1", "operator"), "POST", "/maintenance")).resolves.toBe(true);
    await expect(call(session("tenant-1", "owner"), "PATCH", "/sites/s1")).resolves.toBe(true);
  });
});
