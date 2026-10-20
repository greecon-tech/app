import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "../../database/database.service";
import { PrincipalGuard } from "../../common/principal.guard";
import { principalFromClaims, JwtClaims, RequestWithPrincipal } from "../../common/principal";
import { AuthService, SUPPORT_SESSION_HOURS } from "./auth.service";

describe("the session Greecon staff are given to set a customer's account up", () => {
  const saved = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = "x".repeat(40);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved;
  });

  const issue = () =>
    new AuthService({} as DatabaseService).issueSupportSession({ tenantId: "tenant-1", customer: "Hotel Group", staffUserId: "staff-1", staffName: "Project Manager", staffEmail: "pm@greecon.earth" });

  it("is the staff member's own identity, as an administrator, in the customer's account only", () => {
    const session = issue();
    const claims = jwt.verify(session.token, "x".repeat(40)) as JwtClaims & { exp: number; iat: number };
    expect(claims).toMatchObject({ sub: "staff-1", tenantId: "tenant-1", role: "admin", email: "pm@greecon.earth", isPlatformAdmin: false, support: true });
    expect(session.user).toMatchObject({ id: "staff-1", tenantId: "tenant-1", name: "Project Manager", role: "admin", isPlatformAdmin: false, mustChangePassword: false, support: true });
    expect(session.customer).toBe("Hotel Group");
  });

  it("ends by itself after a few hours", () => {
    const session = issue();
    const claims = jwt.verify(session.token, "x".repeat(40)) as { exp: number; iat: number };
    expect(claims.exp - claims.iat).toBe(SUPPORT_SESSION_HOURS * 3600);
    expect(session.expiresInSeconds).toBe(SUPPORT_SESSION_HOURS * 3600);
    expect(SUPPORT_SESSION_HOURS).toBeLessThanOrEqual(8);
  });

  it("is known for what it is wherever it is used, and is not a platform administrator's", async () => {
    const guard = new PrincipalGuard({ isConfigured: () => false } as unknown as DatabaseService);
    const request = { headers: { "x-greecon-session": issue().token }, path: "/sites", method: "GET", principal: undefined } as unknown as RequestWithPrincipal;
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }) } as never)).resolves.toBe(true);
    expect(request.principal).toMatchObject({ tenantId: "tenant-1", userId: "staff-1", role: "admin", isPlatformAdmin: false, support: true });
  });

  it("does not turn an ordinary session into one", () => {
    expect(principalFromClaims({ sub: "u", tenantId: "t", role: "admin", email: "a@b.c" }).support).toBeUndefined();
    expect(principalFromClaims({ sub: "u", tenantId: "t", role: "admin", email: "a@b.c", support: false }).support).toBeUndefined();
  });

  it("will not be issued when the deployment cannot sign sessions", () => {
    delete process.env.JWT_SECRET;
    expect(issue).toThrow(/JWT_SECRET is not configured/);
  });
});
