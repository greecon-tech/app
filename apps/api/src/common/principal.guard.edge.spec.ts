import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrincipalGuard } from "./principal.guard";
import { RequestWithPrincipal } from "./principal";
import { DatabaseService } from "../database/database.service";

function contextFor(headers: Record<string, string>, route: { path: string; method: string }): ExecutionContext {
  const request = { headers, path: route.path, method: route.method, principal: undefined } as unknown as RequestWithPrincipal;
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

const requestOf = (context: ExecutionContext) => context.switchToHttp().getRequest<RequestWithPrincipal>();

function database(rows: Array<{ id: string; tenant_id: string }> = []): DatabaseService {
  return { isConfigured: () => true, query: vi.fn().mockResolvedValue({ rows }) } as unknown as DatabaseService;
}

// What a box at a site may do with its own credential, and what a box that has none yet may do.
describe("PrincipalGuard and the box at a site", () => {
  const saved = { env: process.env.NODE_ENV, token: process.env.EDGE_INGEST_TOKEN, tenant: process.env.EDGE_INGEST_TENANT_ID, secret: process.env.JWT_SECRET };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret";
    delete process.env.EDGE_INGEST_TOKEN;
    delete process.env.EDGE_INGEST_TENANT_ID;
  });

  afterEach(() => {
    for (const [key, value] of [
      ["NODE_ENV", saved.env],
      ["EDGE_INGEST_TOKEN", saved.token],
      ["EDGE_INGEST_TENANT_ID", saved.tenant],
      ["JWT_SECRET", saved.secret]
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const credentialed = [
    { method: "POST", path: "/telemetry/ingest" },
    { method: "POST", path: "/telemetry/ingest-batch" },
    { method: "GET", path: "/edge/config" },
    { method: "POST", path: "/edge/heartbeat" },
    { method: "POST", path: "/edge/discovery" },
    { method: "GET", path: "/edge/bundle" },
    { method: "GET", path: "/edge/bundle.json" }
  ];

  it("knows which gateway it is talking to on every route a box may call", async () => {
    for (const route of credentialed) {
      const context = contextFor({ "x-edge-device-token": "box-secret" }, route);
      await expect(new PrincipalGuard(database([{ id: "gw-7", tenant_id: "tenant-1" }])).canActivate(context), `${route.method} ${route.path}`).resolves.toBe(true);
      expect(requestOf(context).principal).toMatchObject({ tenantId: "tenant-1", gatewayId: "gw-7", userId: "edge-device", isPlatformAdmin: false });
    }
  });

  it("looks the credential up by its hash, and finds the gateway's id with the tenant", async () => {
    const db = database([{ id: "gw-7", tenant_id: "tenant-1" }]);
    await new PrincipalGuard(db).canActivate(contextFor({ "x-edge-device-token": "box-secret" }, { method: "GET", path: "/edge/config" }));
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/SELECT id, tenant_id FROM edge_gateways WHERE secret_hash/), [expect.not.stringContaining("box-secret")]);
  });

  it("turns a box with an unknown credential away from the routes that need one", async () => {
    for (const route of credentialed.filter((candidate) => !candidate.path.startsWith("/edge/bundle"))) {
      await expect(new PrincipalGuard(database([])).canActivate(contextFor({ "x-edge-device-token": "wrong" }, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
    }
  });

  it("does not let a box's credential reach anything that belongs to the customer's people", async () => {
    for (const route of [
      { method: "GET", path: "/sites" },
      { method: "GET", path: "/devices" },
      { method: "GET", path: "/telemetry/latest" },
      { method: "POST", path: "/gateways" },
      { method: "GET", path: "/sites/abc/setup" },
      { method: "POST", path: "/commands" },
      { method: "GET", path: "/edge/install.sh/../config" }
    ]) {
      await expect(new PrincipalGuard(database([{ id: "gw-7", tenant_id: "tenant-1" }])).canActivate(contextFor({ "x-edge-device-token": "box-secret" }, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
    }
  });

  it("lets the shared legacy token send readings and nothing else, because it names no gateway", async () => {
    process.env.EDGE_INGEST_TOKEN = "shared";
    process.env.EDGE_INGEST_TENANT_ID = "legacy-tenant";
    const guard = new PrincipalGuard(database([]));
    await expect(guard.canActivate(contextFor({ "x-edge-device-token": "shared" }, { method: "POST", path: "/telemetry/ingest" }))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ "x-edge-device-token": "shared" }, { method: "POST", path: "/telemetry/ingest-batch" }))).resolves.toBe(true);
    // The configuration and the heartbeat are refused outright; the software route reaches its own check.
    await expect(guard.canActivate(contextFor({ "x-edge-device-token": "shared" }, { method: "GET", path: "/edge/config" }))).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(contextFor({ "x-edge-device-token": "shared" }, { method: "POST", path: "/edge/heartbeat" }))).rejects.toThrow(UnauthorizedException);
    const bundle = contextFor({ "x-edge-device-token": "shared" }, { method: "GET", path: "/edge/bundle" });
    await expect(guard.canActivate(bundle)).resolves.toBe(true);
    expect(requestOf(bundle).principal.gatewayId).toBeUndefined();
  });

  describe("a box with no credential yet", () => {
    it("can fetch the installer and present its code, because those are how it gets one", async () => {
      for (const route of [
        { method: "GET", path: "/edge/install.sh" },
        { method: "POST", path: "/edge/enrol" }
      ]) {
        await expect(new PrincipalGuard(database([])).canActivate(contextFor({}, route)), `${route.method} ${route.path}`).resolves.toBe(true);
      }
    });

    it("reaches the software route, which then wants a credential or an unused code", async () => {
      const context = contextFor({ "x-enrolment-code": "GRC-AAAA-BBBB-CCCC" }, { method: "GET", path: "/edge/bundle" });
      await expect(new PrincipalGuard(database([])).canActivate(context)).resolves.toBe(true);
      expect(requestOf(context).principal.gatewayId).toBeUndefined();
    });

    it("cannot ask for a configuration or report health", async () => {
      for (const route of [
        { method: "GET", path: "/edge/config" },
        { method: "POST", path: "/edge/heartbeat" },
        { method: "POST", path: "/edge/discovery" }
      ]) {
        await expect(new PrincipalGuard(database([])).canActivate(contextFor({ "x-enrolment-code": "GRC-AAAA-BBBB-CCCC" }, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
      }
    });

    it("gets nothing else for the same pass", async () => {
      for (const route of [
        { method: "GET", path: "/edge/enrol" },
        { method: "POST", path: "/edge/install.sh" },
        { method: "POST", path: "/edge/bundle" }
      ]) {
        await expect(new PrincipalGuard(database([])).canActivate(contextFor({}, route)), `${route.method} ${route.path}`).rejects.toThrow(UnauthorizedException);
      }
    });
  });
});
