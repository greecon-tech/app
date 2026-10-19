import { describe, expect, it } from "vitest";
import { Permission, hasPermission, userRoles } from "@greecon/shared";
import { REQUIRED_PERMISSIONS } from "../../common/rbac.guard";
import { ExportsController } from "./exports.controller";

// Taking data away is a privilege, and each route says exactly which: the readings and alerts for those who may
// export reports, the audit trail also for those who may read it, and the account's setup (which holds its
// people's addresses) for those who manage the account. A route added without saying so fails here.

describe("who may take which data away", () => {
  const permissionsOf = (name: string) => Reflect.getMetadata(REQUIRED_PERMISSIONS, (ExportsController.prototype as unknown as Record<string, object>)[name]) as Permission[] | undefined;

  it("has these routes, and no others", () => {
    expect(Object.getOwnPropertyNames(ExportsController.prototype).filter((name) => name !== "constructor" && !["csv", "headers"].includes(name)).sort()).toEqual(["account", "alerts", "audit", "readings"]);
  });

  it("asks the right permission on each", () => {
    expect(permissionsOf("readings")).toEqual(["report:export"]);
    expect(permissionsOf("alerts")).toEqual(["report:export"]);
    expect(permissionsOf("audit")).toEqual(["report:export", "audit:read"]);
    expect(permissionsOf("account")).toEqual(["settings:manage"]);
  });

  it("leaves the account's setup to owners and administrators, and the audit trail to those who may read it", () => {
    const allowed = (permissions: Permission[]) => userRoles.filter((role) => permissions.every((permission) => hasPermission(role, permission))).sort();
    expect(allowed(permissionsOf("account") as Permission[])).toEqual(["admin", "owner"]);
    expect(allowed(permissionsOf("audit") as Permission[])).toEqual(["admin", "auditor", "owner"]);
    expect(allowed(permissionsOf("readings") as Permission[])).not.toContain("viewer");
  });
});
