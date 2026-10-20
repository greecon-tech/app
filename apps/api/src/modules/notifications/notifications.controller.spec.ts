import { describe, expect, it } from "vitest";
import { Permission, hasPermission, userRoles } from "@greecon/shared";
import { REQUIRED_PERMISSIONS } from "../../common/rbac.guard";
import { NotificationsController } from "./notifications.controller";

// The people's addresses and numbers, the quiet hours and the delivery log are the account's own and only
// its owners and administrators (and Greecon staff working inside the account) may see or change them. Every
// route here says so, and a route added later without saying so fails this test.

describe("who may use the notification routes", () => {
  const handlers = Object.getOwnPropertyNames(NotificationsController.prototype).filter((name) => name !== "constructor");

  it("has routes to check", () => {
    expect(handlers.sort()).toEqual(["contacts", "log", "saveContacts", "saveSettings", "settings", "status", "test"]);
  });

  it("asks for the permission to manage the account's settings on every one of them", () => {
    for (const name of handlers) {
      const required = Reflect.getMetadata(REQUIRED_PERMISSIONS, (NotificationsController.prototype as unknown as Record<string, object>)[name]) as Permission[] | undefined;
      expect(required, name).toEqual(["settings:manage"]);
    }
  });

  it("is open to owners and administrators and to no other role", () => {
    const allowed = userRoles.filter((role) => hasPermission(role, "settings:manage"));
    expect(allowed.sort()).toEqual(["admin", "owner"]);
  });
});
