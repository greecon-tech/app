import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";

const OWNER: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  role: "owner",
  email: "eridon.manuka@greecon.earth"
};

const OTHER_TENANT: Principal = {
  tenantId: "other-tenant",
  userId: "intruder-1",
  role: "owner",
  email: "intruder@example.com"
};

const VIEWER: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
  role: "viewer",
  email: "viewer@greecon.earth"
};

const PLATFORM_ADMIN: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  role: "owner",
  email: "eridon.manuka@greecon.earth",
  isPlatformAdmin: true
};

const SITE_ID = "22222222-2222-4222-8222-222222222202";
const PUMP_DEVICE_ID = "44444444-4444-4444-8444-444444444404";
const PUMP_POINT_ID = "55555555-5555-4555-8555-555555555509";

describe("PlatformService", () => {
  let platform: PlatformService;

  beforeEach(() => {
    // No DATABASE_URL in the test environment, so DatabaseService.isConfigured() is false and
    // every domain behaves exactly as the pure in-memory service these tests were written
    // against — the same fallback path the static demo and local dev without Postgres use.
    platform = new PlatformService(new DatabaseService());
  });

  describe("tenant isolation", () => {
    it("does not return another tenant's sites", () => {
      expect(platform.listSites(OTHER_TENANT)).toEqual([]);
    });

    it("blocks reading a site that belongs to a different tenant", () => {
      expect(() => platform.siteDetail(SITE_ID, OTHER_TENANT)).toThrow(ForbiddenException);
    });

    it("blocks issuing a command against a device outside the caller's tenant", async () => {
      await expect(
        platform.createCommand(
          {
            siteId: SITE_ID,
            targetDeviceId: PUMP_DEVICE_ID,
            targetPointId: PUMP_POINT_ID,
            requestedValue: "OFF",
            reason: "Cross-tenant probe"
          },
          OTHER_TENANT
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("telemetry ingestion validation", () => {
    it("rejects a telemetry message with an unrecognized quality flag", async () => {
      const message = {
        messageType: "telemetry",
        tenantId: DEMO_TENANT_ID,
        siteId: SITE_ID,
        deviceId: PUMP_DEVICE_ID,
        publishedAtUtc: new Date().toISOString(),
        correlationId: "corr-bad-quality",
        readings: [
          {
            timestampUtc: new Date().toISOString(),
            tenantId: DEMO_TENANT_ID,
            siteId: SITE_ID,
            deviceId: PUMP_DEVICE_ID,
            pointId: PUMP_POINT_ID,
            canonicalName: "water.pump.command",
            value: "ON",
            unit: "state",
            quality: "SUSPECT",
            source: "manual",
            ingestionTimestampUtc: new Date().toISOString()
          }
        ]
      } as unknown as TelemetryMessage;

      const result = await platform.ingestTelemetry(message, OWNER);
      expect(result.accepted).toBe(false);
      expect(result.errors.join(" ")).toContain("quality must be OK, WARN, or BAD");
    });

    it("rejects telemetry addressed to a different tenant than the caller", async () => {
      const message: TelemetryMessage = {
        messageType: "telemetry",
        tenantId: "other-tenant",
        siteId: SITE_ID,
        deviceId: PUMP_DEVICE_ID,
        publishedAtUtc: new Date().toISOString(),
        correlationId: "corr-cross-tenant",
        readings: []
      };

      await expect(platform.ingestTelemetry(message, OWNER)).rejects.toThrow(ForbiddenException);
    });

    it("accepts a well-formed telemetry message and updates point quality", async () => {
      const message: TelemetryMessage = {
        messageType: "telemetry",
        tenantId: DEMO_TENANT_ID,
        siteId: SITE_ID,
        deviceId: PUMP_DEVICE_ID,
        publishedAtUtc: new Date().toISOString(),
        correlationId: "corr-good",
        readings: [
          {
            timestampUtc: new Date().toISOString(),
            tenantId: DEMO_TENANT_ID,
            siteId: SITE_ID,
            deviceId: PUMP_DEVICE_ID,
            pointId: PUMP_POINT_ID,
            canonicalName: "water.pump.command",
            value: "ON",
            unit: "state",
            quality: "WARN",
            source: "manual",
            ingestionTimestampUtc: new Date().toISOString()
          }
        ]
      };

      const result = await platform.ingestTelemetry(message, OWNER);
      expect(result.accepted).toBe(true);
      expect(result.ingested).toBe(1);

      const point = platform.listPoints(OWNER, PUMP_DEVICE_ID).find((candidate) => candidate.id === PUMP_POINT_ID);
      expect(point?.quality).toBe("WARN");
    });
  });

  describe("dashboard preferences", () => {
    it("returns an empty list (no database configured) and still lets a save round-trip return what was passed in", async () => {
      expect(await platform.getDashboardPreferences(OWNER)).toEqual([]);

      const widgets = [{ key: "Solar production", visible: true, size: "large" as const }];
      const saved = await platform.saveDashboardPreferences(widgets, OWNER);
      expect(saved).toEqual(widgets);
    });
  });

  describe("telemetry history", () => {
    it("falls back to the latest snapshot when no database is configured", async () => {
      const history = await platform.telemetryHistory(OWNER, undefined, 24);
      const latest = platform.latestTelemetry(OWNER);
      expect(history).toEqual(latest);
    });

    it("blocks a history query for a site outside the caller's tenant", async () => {
      await expect(platform.telemetryHistory(OTHER_TENANT, SITE_ID, 24)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("manual override", () => {
    it("records an audit event for a manual override request", async () => {
      const before = platform.listAudit(OWNER).length;

      await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "OFF",
          reason: "Manual maintenance stop",
          manualOverride: {
            durationMinutes: 15,
            reason: "Operator manually stopping pump for inspection"
          }
        },
        OWNER
      );

      const after = platform.listAudit(OWNER);
      expect(after.length).toBe(before + 2);
      expect(after.some((event) => event.eventType === "manual_override.requested")).toBe(true);
    });

    it("blocks a manual override with an already-expired window", async () => {
      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "ON",
          reason: "Manual refill run",
          manualOverride: {
            durationMinutes: -5,
            reason: "Backdated override"
          }
        },
        OWNER
      );

      expect(record.dispatchStatus).toBe("blocked");
      expect(record.safetyEvaluation.reasons.join(" ")).toContain("expired");
    });

    it("still accepts a stop whose override window has expired: stopping needs no override", async () => {
      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "OFF",
          reason: "Manual maintenance stop",
          manualOverride: {
            durationMinutes: -5,
            reason: "Backdated override"
          }
        },
        OWNER
      );

      expect(record.dispatchStatus).toBe("simulated_dispatch");
    });
  });

  describe("what a command is in this build", () => {
    it("is always a simulation: nothing in this build can reach equipment, and the record says so", async () => {
      const allowed = await platform.createCommand(
        { siteId: SITE_ID, targetDeviceId: PUMP_DEVICE_ID, targetPointId: PUMP_POINT_ID, requestedValue: "OFF", reason: "Routine stop" },
        OWNER
      );
      const blocked = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "ON",
          reason: "Backdated",
          manualOverride: { durationMinutes: -5, reason: "Backdated override" }
        },
        OWNER
      );

      // A "live" mode is added only when the release gate in docs/23-safety-and-security-case.md is met.
      for (const record of [allowed, blocked, ...platform.listCommands(OWNER)]) expect(record.executionMode).toBe("simulated");
      expect(allowed.dispatchStatus).toBe("simulated_dispatch");
    });
  });

  describe("command acknowledgement", () => {
    it("moves a dispatched command to acknowledged on a successful ack", async () => {
      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "OFF",
          reason: "Routine shutdown"
        },
        OWNER
      );

      const acknowledged = await platform.acknowledgeCommand(
        record.id,
        {
          messageType: "command_ack",
          commandId: record.id,
          tenantId: OWNER.tenantId,
          siteId: SITE_ID,
          deviceId: PUMP_DEVICE_ID,
          status: "executed",
          acknowledgementUtc: new Date().toISOString(),
          result: "Pump stopped.",
          correlationId: "corr-ack-1"
        },
        OWNER
      );

      expect(acknowledged.dispatchStatus).toBe("acknowledged");
      expect(acknowledged.result).toBe("Pump stopped.");
    });
  });

  describe("site/asset/device/point provisioning", () => {
    it("blocks a viewer from creating a site", async () => {
      await expect(
        platform.createSite({ name: "New Site", type: "farm", locationName: "Test" }, VIEWER)
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates a site, then an asset, device, and point on it, and reads them back consistently", async () => {
      const site = await platform.createSite({ name: "Provisioning Test Site", type: "farm", locationName: "Test Field" }, OWNER);
      expect(platform.listSites(OWNER).some((candidate) => candidate.id === site.id)).toBe(true);

      const asset = await platform.createAsset({ siteId: site.id, name: "Test Pump Station", type: "PumpStation" }, OWNER);
      expect(asset.siteId).toBe(site.id);

      const device = await platform.createDevice(
        {
          siteId: site.id,
          assetId: asset.id,
          name: "Test Pump PLC",
          deviceType: "plc",
          protocol: "modbus",
          driverType: "test-driver",
          positionX: 40,
          positionY: 60,
          placementNote: "Test placement"
        },
        OWNER
      );
      expect(device.siteId).toBe(site.id);
      expect(device.positionX).toBe(40);

      const point = await platform.createPoint(
        {
          siteId: site.id,
          assetId: asset.id,
          deviceId: device.id,
          canonicalName: "water.pump.command",
          label: "Test pump command",
          unit: "state",
          capability: "write"
        },
        OWNER
      );
      expect(point.deviceId).toBe(device.id);

      const detail = platform.siteDetail(site.id, OWNER);
      expect(detail.assets.map((candidate) => candidate.id)).toContain(asset.id);
      expect(detail.devices.map((candidate) => candidate.id)).toContain(device.id);
      expect(detail.points.map((candidate) => candidate.id)).toContain(point.id);

      const updatedDevice = await platform.updateDevice(device.id, { health: "Watch", positionX: 55 }, OWNER);
      expect(updatedDevice.health).toBe("Watch");
      expect(updatedDevice.positionX).toBe(55);
      expect(updatedDevice.positionY).toBe(60);

      await platform.deletePoint(point.id, OWNER);
      expect(platform.listPoints(OWNER, device.id)).toHaveLength(0);

      await platform.deleteDevice(device.id, OWNER);
      expect(platform.listDevices(OWNER, site.id)).toHaveLength(0);

      await platform.deleteAsset(asset.id, OWNER);
      expect(platform.listAssets(OWNER, site.id)).toHaveLength(0);

      await platform.deleteSite(site.id, OWNER);
      expect(platform.listSites(OWNER).some((candidate) => candidate.id === site.id)).toBe(false);
    });

    it("refuses to delete a site that still has a registered device", async () => {
      await expect(platform.deleteSite(SITE_ID, OWNER)).rejects.toThrow(ForbiddenException);
    });

    it("blocks creating a device on a site that belongs to a different tenant", async () => {
      await expect(
        platform.createDevice(
          { siteId: SITE_ID, name: "Cross-tenant device", deviceType: "plc", protocol: "modbus", driverType: "test" },
          OTHER_TENANT
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("gateway provisioning", () => {
    it("blocks a viewer from creating a gateway", async () => {
      await expect(platform.createGateway({ siteId: SITE_ID, name: "Test Gateway" }, VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it("creates a gateway with a real one-time secret and lists it back scoped to its site", async () => {
      const { gateway, secret } = await platform.createGateway({ siteId: SITE_ID, name: "Farm Gateway" }, OWNER);

      expect(gateway.siteId).toBe(SITE_ID);
      expect(gateway.secureIdentityStatus).toBe("provisioned");
      // 32 random bytes, hex-encoded — this is the credential the edge box authenticates with,
      // never stored anywhere except as a hash (see gateway-secret.ts).
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
      expect(platform.listGateways(OWNER, SITE_ID).map((candidate) => candidate.id)).toContain(gateway.id);
    });

    it("blocks creating a gateway on a site that belongs to a different tenant", async () => {
      await expect(platform.createGateway({ siteId: SITE_ID, name: "Cross-tenant gateway" }, OTHER_TENANT)).rejects.toThrow(ForbiddenException);
    });

    it("deletes a gateway, freeing it up rather than blocking like a site with devices would", async () => {
      const { gateway } = await platform.createGateway({ siteId: SITE_ID, name: "Gateway To Remove" }, OWNER);
      expect(platform.listGateways(OWNER, SITE_ID).map((candidate) => candidate.id)).toContain(gateway.id);

      await platform.deleteGateway(gateway.id, OWNER);
      expect(platform.listGateways(OWNER, SITE_ID).map((candidate) => candidate.id)).not.toContain(gateway.id);
    });

    it("blocks a viewer from deleting a gateway", async () => {
      const { gateway } = await platform.createGateway({ siteId: SITE_ID, name: "Gateway For Viewer Test" }, OWNER);
      await expect(platform.deleteGateway(gateway.id, VIEWER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("user provisioning", () => {
    it("blocks a viewer from creating a user", async () => {
      await expect(platform.createUser({ name: "New Person", email: "new.person@greecon.earth", role: "operator" }, VIEWER)).rejects.toThrow(
        ForbiddenException
      );
    });

    it("creates a user with a real temporary password, then lets an owner change their role and status", async () => {
      const { user, temporaryPassword } = await platform.createUser({ name: "New Person", email: "New.Person@greecon.earth", role: "operator" }, OWNER);
      expect(user.email).toBe("new.person@greecon.earth");
      expect(user.status).toBe("active");
      expect(temporaryPassword.split("-")).toHaveLength(3);
      expect(platform.listUsers(OWNER).some((candidate) => candidate.id === user.id)).toBe(true);

      const promoted = await platform.updateUser(user.id, { role: "admin" }, OWNER);
      expect(promoted.role).toBe("admin");

      const disabled = await platform.updateUser(user.id, { status: "disabled" }, OWNER);
      expect(disabled.status).toBe("disabled");
    });

    it("refuses to create a second user with the same email in the same tenant", async () => {
      await platform.createUser({ name: "Dup", email: "dup@greecon.earth", role: "viewer" }, OWNER);
      await expect(platform.createUser({ name: "Dup Again", email: "dup@greecon.earth", role: "viewer" }, OWNER)).rejects.toThrow();
    });

    it("refuses to let an owner disable their own account", async () => {
      await expect(platform.updateUser(OWNER.userId, { status: "disabled" }, OWNER)).rejects.toThrow(ForbiddenException);
    });

    it("lets an owner reset another user's password to a fresh temporary one, blocked for a viewer", async () => {
      const { user } = await platform.createUser({ name: "Reset Target", email: "reset-target@greecon.earth", role: "operator" }, OWNER);

      await expect(platform.resetUserPassword(user.id, VIEWER)).rejects.toThrow(ForbiddenException);

      const { temporaryPassword } = await platform.resetUserPassword(user.id, OWNER);
      expect(temporaryPassword.split("-")).toHaveLength(3);
    });
  });

  describe("platform-admin tenant onboarding", () => {
    it("blocks a regular tenant owner (not a platform admin) from listing or creating tenants", async () => {
      expect(() => platform.listAllTenants(OWNER, {})).toThrow(ForbiddenException);
      await expect(
        platform.createTenant({ name: "New Client Farm", domain: "newclient.example", ownerName: "New Owner", ownerEmail: "owner@newclient.example" }, OWNER)
      ).rejects.toThrow(ForbiddenException);
    });

    it("lets a platform admin onboard a brand new client with its own owner account, isolated from the demo tenant", async () => {
      const { tenant, owner, temporaryPassword } = await platform.createTenant(
        { name: "New Client Farm", domain: "newclient.example", ownerName: "New Owner", ownerEmail: "Owner@NewClient.example" },
        PLATFORM_ADMIN
      );

      expect(tenant.domain).toBe("newclient.example");
      expect(owner.tenantId).toBe(tenant.id);
      expect(owner.email).toBe("owner@newclient.example");
      expect(owner.role).toBe("owner");
      expect(temporaryPassword.split("-")).toHaveLength(3);

      const allTenants = platform.listAllTenants(PLATFORM_ADMIN, { pageSize: 100 });
      const created = allTenants.tenants.find((candidate) => candidate.id === tenant.id);
      expect(created?.userCount).toBe(1);

      // The new tenant's data must stay invisible to the original demo tenant's own principals.
      expect(platform.listUsers(OWNER).some((candidate) => candidate.id === owner.id)).toBe(false);
    });

    it("refuses to onboard a second client with a domain that's already taken", async () => {
      await platform.createTenant({ name: "First", domain: "dup-client.example", ownerName: "A", ownerEmail: "a@dup-client.example" }, PLATFORM_ADMIN);
      await expect(
        platform.createTenant({ name: "Second", domain: "dup-client.example", ownerName: "B", ownerEmail: "b@dup-client.example" }, PLATFORM_ADMIN)
      ).rejects.toThrow();
    });

    it("lets a platform admin suspend and reactivate a client, blocking a non-admin from doing the same", async () => {
      const { tenant } = await platform.createTenant(
        { name: "Suspend Test Farm", domain: "suspend-test.example", ownerName: "Owner", ownerEmail: "owner@suspend-test.example" },
        PLATFORM_ADMIN
      );
      expect(platform.isTenantActive(tenant.id)).toBe(true);

      await expect(platform.updateTenantStatus(tenant.id, "suspended", OWNER)).rejects.toThrow(ForbiddenException);

      const suspended = await platform.updateTenantStatus(tenant.id, "suspended", PLATFORM_ADMIN);
      expect(suspended.status).toBe("suspended");
      expect(platform.isTenantActive(tenant.id)).toBe(false);

      const reactivated = await platform.updateTenantStatus(tenant.id, "active", PLATFORM_ADMIN);
      expect(reactivated.status).toBe("active");
      expect(platform.isTenantActive(tenant.id)).toBe(true);
    });
  });

  describe("per-site safety limits", () => {
    it("applies a tighter site-specific pressure limit instead of the global default", async () => {
      // Seed pressure for this site is 2.8 bar — comfortably under the 5.5 bar global default,
      // but over a site that's tightened its own limit down to 1 bar (e.g. thinner pipe rating).
      await platform.updateSite(SITE_ID, { safetyLimits: { maxPressureBar: 1 } }, OWNER);

      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "ON",
          reason: "Refill the tank"
        },
        OWNER
      );

      expect(record.dispatchStatus).toBe("blocked");
      expect(record.safetyEvaluation.reasons.join(" ")).toContain("exceeds limit");
    });

    it("does not let that same limit stand in the way of stopping the pump", async () => {
      // The interlock exists to stop a pump being STARTED into over-pressure. Applied to a stop it
      // would block the action that relieves the pressure.
      await platform.updateSite(SITE_ID, { safetyLimits: { maxPressureBar: 1 } }, OWNER);

      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "OFF",
          reason: "Routine shutdown"
        },
        OWNER
      );

      expect(record.dispatchStatus).toBe("simulated_dispatch");
    });

    it("falls back to the global default for any field a site hasn't overridden", async () => {
      // Only overriding maxPressureBar with a permissive value — dry-run/pump-rest/irrigation
      // limits should still come from defaultSafetyLimits, not be wiped out to undefined.
      await platform.updateSite(SITE_ID, { safetyLimits: { maxPressureBar: 100 } }, OWNER);

      const record = await platform.createCommand(
        {
          siteId: SITE_ID,
          targetDeviceId: PUMP_DEVICE_ID,
          targetPointId: PUMP_POINT_ID,
          requestedValue: "OFF",
          reason: "Routine shutdown"
        },
        OWNER
      );

      expect(record.dispatchStatus).toBe("simulated_dispatch");
    });
  });

  describe("maintenance tasks", () => {
    it("blocks a viewer from creating a maintenance task", async () => {
      await expect(platform.createMaintenanceTask({ siteId: SITE_ID, title: "Test task" }, VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it("creates a task, then marks it complete and stamps completedAtUtc", async () => {
      const task = await platform.createMaintenanceTask({ siteId: SITE_ID, title: "Inspect flow meter", notes: "Annual check" }, OWNER);
      expect(task.status).toBe("open");
      expect(task.completedAtUtc).toBeUndefined();

      const completed = await platform.updateMaintenanceTask(task.id, { status: "complete", completionLog: "Calibrated, within tolerance." }, OWNER);
      expect(completed.status).toBe("complete");
      expect(completed.completedAtUtc).toBeDefined();
      expect(completed.completionLog).toBe("Calibrated, within tolerance.");
    });
  });
});
