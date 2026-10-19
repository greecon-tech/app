import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { GatewayHeartbeat, PointSource } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { DEMO_OWNER, PLATFORM_ADMIN, onboardClient } from "./test-support";

// How equipment is described to the platform so that the box can be told what to read: a device's
// address, a reading's register, the box itself and what it reports. All of it is typed by a person at
// a site, so what is wrong is said in words, and nothing is accepted that the box could not act on.

const address = { kind: "modbus_tcp" as const, host: "192.168.1.50", port: 502, unitId: 1 };
const register: PointSource = { kind: "modbus", registerType: "input", address: 52, dataType: "float32", scale: 0.001, part: "positive" };

describe("describing equipment to the platform", () => {
  let platform: PlatformService;
  let owner: Principal;
  let siteId: string;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    owner = await onboardClient(platform);
    siteId = (await platform.createSite({ name: "Hotel", type: "integrated_site", locationName: "Durrës" }, owner)).id;
  });

  const meter = (overrides: Record<string, unknown> = {}) =>
    platform.createDevice({ siteId, name: "Grid meter", deviceType: "grid_meter", protocol: "modbus", driverType: "modbus-tcp", ...overrides } as never, owner);

  describe("a device's address", () => {
    it("is kept with the device, tidied", async () => {
      const device = await meter({ connection: { ...address, host: "  192.168.1.50 " } });
      expect(device.connection).toEqual(address);
      expect(platform.listDevices(owner)[0]?.connection).toEqual(address);
    });

    it("is refused, in words, when it cannot work", async () => {
      await expect(meter({ connection: { ...address, host: "192.168.1.999" } })).rejects.toThrow(/IP address such as 192.168.1.50/);
      await expect(meter({ connection: { ...address, port: 70000 } })).rejects.toThrow(/port must be a whole number/);
      await expect(meter({ connection: { ...address, unitId: 300 } })).rejects.toThrow(/unit ID/);
      await expect(meter({ connection: { kind: "serial" } })).rejects.toBeInstanceOf(BadRequestException);
      expect(platform.listDevices(owner)).toHaveLength(0);
    });

    it("belongs only to a Modbus device", async () => {
      await expect(meter({ protocol: "simulated", driverType: "simulator", connection: address })).rejects.toThrow(/Only a Modbus device has a network address/);
    });

    it("can be changed and taken away, and the change is on the record with the old and the new address", async () => {
      const device = await meter({ connection: address });
      await platform.updateDevice(device.id, { connection: { ...address, host: "192.168.1.51", unitId: 2 } }, owner);
      expect(platform.listDevices(owner)[0]?.connection).toMatchObject({ host: "192.168.1.51", unitId: 2 });

      const audit = platform.listAudit(owner, siteId).find((event) => event.eventType === "device.updated");
      expect(audit?.beforeMetadata).toMatchObject({ address: "192.168.1.50:502, unit 1" });
      expect(audit?.afterMetadata).toMatchObject({ address: "192.168.1.51:502, unit 2" });
      expect(audit?.reason).toBe('Address of device "Grid meter" changed.');

      await platform.updateDevice(device.id, { connection: null }, owner);
      expect(platform.listDevices(owner)[0]?.connection).toBeUndefined();
    });

    it("is left alone by an update that does not mention it", async () => {
      const device = await meter({ connection: address });
      await platform.updateDevice(device.id, { name: "Main grid meter" }, owner);
      expect(platform.listDevices(owner)[0]).toMatchObject({ name: "Main grid meter", connection: address });
    });

    it("cannot stay on a device that is changed to something that has no network address", async () => {
      const device = await meter({ connection: address });
      await expect(platform.updateDevice(device.id, { protocol: "simulated" }, owner)).rejects.toThrow(/Remove the address first/);
      await platform.updateDevice(device.id, { protocol: "simulated", connection: null }, owner);
      expect(platform.listDevices(owner)[0]?.protocol).toBe("simulated");
    });
  });

  describe("which box reads a device", () => {
    it("is the site's only box, when none is named", async () => {
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      const device = await meter({ connection: address });
      expect(device.gatewayId).toBe(box.id);
    });

    it("is nobody's when the site has two boxes, because that would be a guess", async () => {
      await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.provisionGateway({ siteId, name: "Roof" }, owner);
      expect((await meter()).gatewayId).toBeUndefined();
    });

    it("is not assigned for a device that is not Modbus", async () => {
      await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      const simulated = await meter({ protocol: "simulated", driverType: "simulator" });
      expect(simulated.gatewayId).toBeUndefined();
    });

    it("can be named, if it is a box at the same site", async () => {
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.provisionGateway({ siteId, name: "Roof" }, owner);
      expect((await meter({ gatewayId: box.id })).gatewayId).toBe(box.id);

      const otherSite = await platform.createSite({ name: "Annex", type: "farm", locationName: "x" }, owner);
      const otherBox = await platform.provisionGateway({ siteId: otherSite.id, name: "Annex box" }, owner);
      await expect(meter({ gatewayId: otherBox.id })).rejects.toThrow(/different site/);
    });

    it("cannot be a box of another account", async () => {
      const stranger = await onboardClient(new PlatformService(new DatabaseService()));
      const elsewhere = new PlatformService(new DatabaseService());
      const strangerOwner = await onboardClient(elsewhere);
      const strangerSite = await elsewhere.createSite({ name: "Theirs", type: "farm", locationName: "x" }, strangerOwner);
      const theirBox = await elsewhere.provisionGateway({ siteId: strangerSite.id, name: "Their box" }, strangerOwner);
      // The id exists, but not in this platform's account: it is not found, not accepted.
      await expect(meter({ gatewayId: theirBox.id })).rejects.toThrow();
      expect(stranger.tenantId).not.toBe(owner.tenantId);
    });
  });

  describe("a reading's register", () => {
    async function deviceWithPoint(sourceOverride?: unknown) {
      const device = await meter({ connection: address });
      const point = await platform.createPoint(
        { siteId, deviceId: device.id, canonicalName: "energy.grid.import.kw", label: "Grid import", unit: "kW", capability: "read", ...(sourceOverride === undefined ? { source: register } : { source: sourceOverride }) } as never,
        owner
      );
      return { device, point };
    }

    it("is kept with the reading, with nothing but what means something", async () => {
      const { point } = await deviceWithPoint({ ...register, somethingElse: "x" });
      expect(point.source).toEqual(register);
    });

    it("is refused, in words, when it cannot be read", async () => {
      await expect(deviceWithPoint({ ...register, address: -4 })).rejects.toThrow(/register address must be a whole number/);
      await expect(deviceWithPoint({ ...register, dataType: "float64" })).rejects.toThrow(/data type must be one of/);
      await expect(deviceWithPoint({ ...register, scale: 0 })).rejects.toThrow(/scale cannot be zero/);
      await expect(deviceWithPoint({ kind: "opc" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("belongs only to a reading of a Modbus device", async () => {
      const simulated = await meter({ name: "Sim", protocol: "simulated", driverType: "simulator" });
      await expect(
        platform.createPoint({ siteId, deviceId: simulated.id, canonicalName: "energy.grid.import.kw", label: "x", unit: "kW", capability: "read", source: register }, owner)
      ).rejects.toThrow(/Only a reading of a Modbus device has a register/);
    });

    it("is not for a command, which is written to equipment", async () => {
      const device = await meter({ name: "Pump", connection: address });
      await expect(
        platform.createPoint({ siteId, deviceId: device.id, canonicalName: "water.pump.command", label: "Pump", unit: "state", capability: "write", source: register }, owner)
      ).rejects.toThrow(/written to equipment/);
    });

    it("can be changed and taken away, and the change is on the record", async () => {
      const { point } = await deviceWithPoint();
      await platform.updatePoint(point.id, { source: { ...register, address: 54 } }, owner);
      expect(platform.listPoints(owner)[0]?.source?.address).toBe(54);

      const audit = platform.listAudit(owner, siteId).find((event) => event.eventType === "point.updated");
      expect(audit?.beforeMetadata).toMatchObject({ register: "input register 52, float32, ×0.001, only when positive" });
      expect(audit?.afterMetadata).toMatchObject({ register: "input register 54, float32, ×0.001, only when positive" });

      await platform.updatePoint(point.id, { source: null }, owner);
      expect(platform.listPoints(owner)[0]?.source).toBeUndefined();
    });

    it("is not allowed to stay on a reading that is turned into a command", async () => {
      const { point } = await deviceWithPoint();
      await expect(platform.updatePoint(point.id, { capability: "write" }, owner)).rejects.toThrow(/Remove the register first/);
    });
  });

  describe("the box", () => {
    it("starts as a gateway with no credential and no word from its box", async () => {
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      expect(box.secureIdentityStatus).toBe("placeholder");
      const listed = platform.listGateways(owner, siteId)[0];
      expect(listed).toMatchObject({ id: box.id, contact: "never", status: "Unknown" });
    });

    it("takes the site's unassigned Modbus devices when it is the site's only box, and only then", async () => {
      const first = await meter({ name: "A", connection: address });
      const simulated = await meter({ name: "B", protocol: "simulated", driverType: "simulator" });
      expect(first.gatewayId).toBeUndefined();

      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      const devices = platform.listDevices(owner, siteId);
      expect(devices.find((device) => device.id === first.id)?.gatewayId).toBe(box.id);
      expect(devices.find((device) => device.id === simulated.id)?.gatewayId).toBeUndefined();

      const second = await platform.provisionGateway({ siteId, name: "Roof" }, owner);
      await meter({ name: "C" });
      expect(platform.listDevices(owner, siteId).filter((device) => device.gatewayId === second.id)).toHaveLength(0);
    });

    it("is refused to people who may not manage devices", async () => {
      const viewer: Principal = { ...owner, role: "viewer" };
      await expect(platform.provisionGateway({ siteId, name: "x" }, viewer)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("gets its credential when it enrols, once per enrolment, and the old one is gone", async () => {
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      const first = await platform.completeGatewayEnrolment(box.id, owner.tenantId, owner.userId, Date.parse("2026-10-19T10:00:00Z"));
      expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(first.gateway).toMatchObject({ secureIdentityStatus: "provisioned", enrolledAtUtc: "2026-10-19T10:00:00.000Z" });

      const second = await platform.completeGatewayEnrolment(box.id, owner.tenantId, owner.userId);
      expect(second.secret).not.toBe(first.secret);

      const audit = platform.listAudit(owner, siteId).filter((event) => event.eventType === "gateway.enrolled");
      expect(audit).toHaveLength(2);
      expect(audit[0]?.userId).toBe(owner.userId);
    });

    it("starts again from nothing when a replacement box enrols", async () => {
      const device = await meter({ connection: address });
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.completeGatewayEnrolment(box.id, owner.tenantId, owner.userId);
      await platform.recordGatewayHeartbeat(box.id, owner.tenantId, heartbeat([device.id]));
      expect(platform.findGateway(box.id, owner.tenantId)?.softwareVersion).toBe("0.2.0");

      await platform.completeGatewayEnrolment(box.id, owner.tenantId, owner.userId);
      const fresh = platform.findGateway(box.id, owner.tenantId);
      expect(fresh?.contact).toBe("never");
      expect(fresh?.softwareVersion).toBeUndefined();
      expect(fresh?.drivers).toBeUndefined();
    });
  });

  describe("what the box says about itself", () => {
    const NOW = Date.parse("2026-10-19T10:00:00Z");

    it("is kept, and how recently it was said decides online, late or offline", async () => {
      const device = await meter({ connection: address });
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.recordGatewayHeartbeat(box.id, owner.tenantId, heartbeat([device.id], { bufferDepth: 12, oldestBufferedAgeSeconds: 340 }), NOW);

      expect(platform.listGateways(owner, siteId, NOW + 30_000)[0]).toMatchObject({
        contact: "online",
        status: "OK",
        softwareVersion: "0.2.0",
        configVersion: "cfg1",
        bufferDepth: 12,
        oldestBufferedAgeSeconds: 340
      });
      expect(platform.listGateways(owner, siteId, NOW + 5 * 60_000)[0]).toMatchObject({ contact: "late", status: "Watch" });
      expect(platform.listGateways(owner, siteId, NOW + 20 * 60_000)[0]).toMatchObject({ contact: "offline", status: "Offline" });
    });

    it("includes how far its clock is from the platform's", async () => {
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.recordGatewayHeartbeat(box.id, owner.tenantId, heartbeat([], { sentAtUtc: new Date(NOW + 90_000).toISOString() }), NOW);
      expect(platform.findGateway(box.id, owner.tenantId, NOW)?.clockSkewSeconds).toBe(90);
    });

    it("keeps what it says about its own devices, and nothing about anyone else's", async () => {
      const mine = await meter({ name: "Mine", connection: address });
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      const otherSite = await platform.createSite({ name: "Annex", type: "farm", locationName: "x" }, owner);
      const notMine = await platform.createDevice({ siteId: otherSite.id, name: "Annex meter", deviceType: "meter", protocol: "modbus", driverType: "modbus-tcp" }, owner);

      await platform.recordGatewayHeartbeat(box.id, owner.tenantId, heartbeat([mine.id, notMine.id, "11111111-1111-4111-8111-111111111111"]), NOW);
      expect(platform.findGateway(box.id, owner.tenantId, NOW)?.drivers?.map((driver) => driver.deviceId)).toEqual([mine.id]);
    });

    it("tells the setup what is wrong with a device, in the box's words", async () => {
      const device = await meter({ connection: address });
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      await platform.recordGatewayHeartbeat(
        box.id,
        owner.tenantId,
        heartbeat([device.id], { devices: [{ deviceId: device.id, ok: false, readingsOk: 0, readingsFailed: 1, lastError: "no answer from 192.168.1.50:502 (unit 1)" }] }),
        NOW
      );
      expect(platform.findGateway(box.id, owner.tenantId, NOW)?.drivers?.[0]?.lastError).toBe("no answer from 192.168.1.50:502 (unit 1)");
    });
  });

  describe("what the box is told to read", () => {
    it("follows the addresses and registers, and its version changes when they do", async () => {
      const device = await meter({ connection: address });
      const box = await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
      expect(platform.edgeConfigFor(box.id, owner.tenantId).devices).toEqual([]);

      const point = await platform.createPoint({ siteId, deviceId: device.id, canonicalName: "energy.grid.import.kw", label: "Grid import", unit: "kW", capability: "read", source: register }, owner);
      const first = platform.edgeConfigFor(box.id, owner.tenantId);
      expect(first.devices).toHaveLength(1);
      expect(first.devices[0]?.points[0]?.pointId).toBe(point.id);
      expect(first.siteId).toBe(siteId);
      expect(first.tenantId).toBe(owner.tenantId);

      await platform.updateDevice(device.id, { connection: { ...address, unitId: 5 } }, owner);
      const second = platform.edgeConfigFor(box.id, owner.tenantId);
      expect(second.devices[0]?.connection.unitId).toBe(5);
      expect(second.version).not.toBe(first.version);

      await platform.updateDevice(device.id, { connection: null }, owner);
      expect(platform.edgeConfigFor(box.id, owner.tenantId).devices).toEqual([]);
    });
  });

  describe("the steps a person confirms", () => {
    it("are empty until someone confirms one", () => {
      expect(platform.siteSetupRecord(siteId, owner)).toEqual({ siteId, tenantId: owner.tenantId, confirmations: {} });
    });

    it("are recorded with who and when, in the site's record and the audit trail, and can be taken back", async () => {
      const confirmation = { atUtc: "2026-10-19T09:00:00Z", by: owner.email, note: "Import rose with the kettle on" };
      await platform.setSetupConfirmation(siteId, "direction", confirmation, owner);
      expect(platform.siteSetupRecord(siteId, owner).confirmations.direction).toEqual(confirmation);

      const confirmed = platform.listAudit(owner, siteId).find((event) => event.eventType === "setup.step_confirmed");
      expect(confirmed?.afterMetadata).toEqual({ step: "direction", note: "Import rose with the kettle on" });

      await platform.setSetupConfirmation(siteId, "direction", null, owner);
      expect(platform.siteSetupRecord(siteId, owner).confirmations).toEqual({});
      expect(platform.listAudit(owner, siteId).some((event) => event.eventType === "setup.step_reopened")).toBe(true);
    });

    it("are for people who manage the site", async () => {
      const operator: Principal = { ...owner, role: "operator" };
      await expect(platform.setSetupConfirmation(siteId, "direction", { atUtc: new Date().toISOString(), by: "x" }, operator)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("remember which template the site came from", async () => {
      await platform.recordSiteTemplate(siteId, "hotel", owner);
      expect(platform.siteSetupRecord(siteId, owner).templateKey).toBe("hotel");
      await platform.setSetupConfirmation(siteId, "limits", { atUtc: new Date().toISOString(), by: "x" }, owner);
      expect(platform.siteSetupRecord(siteId, owner).templateKey).toBe("hotel");
    });
  });

  describe("Greecon staff opening a customer's account to set it up", () => {
    it("is recorded in the customer's own audit trail before anything is done, with the staff member's address", async () => {
      const { tenant } = await platform.beginSupportSession(owner.tenantId, PLATFORM_ADMIN);
      expect(tenant.id).toBe(owner.tenantId);
      const opened = platform.listAudit(owner).find((event) => event.eventType === "support.session_started");
      expect(opened?.reason).toBe("Greecon staff (eridon.manuka@greecon.earth) opened this account to set it up.");
      expect(opened?.actor).toBe("Greecon staff (eridon.manuka@greecon.earth)");
    });

    it("is for Greecon's platform administrators only, and not for someone already in a customer's account", async () => {
      await expect(platform.beginSupportSession(owner.tenantId, owner)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(platform.beginSupportSession(owner.tenantId, { ...PLATFORM_ADMIN, support: true })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(platform.beginSupportSession("00000000-0000-4000-8000-000000000000", PLATFORM_ADMIN)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("is not possible for an account that is suspended", async () => {
      await platform.updateTenantStatus(owner.tenantId, "suspended", PLATFORM_ADMIN);
      await expect(platform.beginSupportSession(owner.tenantId, PLATFORM_ADMIN)).rejects.toBeInstanceOf(ConflictException);
    });

    // What the session is: the staff member's own identity, as an administrator, in the customer's account.
    const inSupport = (): Principal => ({ tenantId: owner.tenantId, userId: PLATFORM_ADMIN.userId, role: "admin", email: PLATFORM_ADMIN.email, isPlatformAdmin: false, support: true });

    it("can set the account up as an administrator does, and what it does is under the staff member's name", async () => {
      const staff = inSupport();
      const site = await platform.createSite({ name: "Set up by staff", type: "farm", locationName: "x" }, staff);
      await platform.createDevice({ siteId: site.id, name: "Meter", deviceType: "meter", protocol: "modbus", driverType: "modbus-tcp" }, staff);
      const created = platform.listAudit(owner, site.id).find((event) => event.eventType === "site.created");
      expect(created?.actor).toBe("Greecon staff (eridon.manuka@greecon.earth)");
    });

    it("cannot add people to the account, change who they are, or reset their passwords", async () => {
      const staff = inSupport();
      const ownerUser = platform.listUsers(owner)[0];
      await expect(platform.createUser({ name: "New", email: "new@client-farm.example", role: "viewer" }, staff)).rejects.toThrow(/cannot add people/);
      await expect(platform.updateUser(ownerUser?.id as string, { role: "viewer" }, staff)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(platform.resetUserPassword(ownerUser?.id as string, staff)).rejects.toBeInstanceOf(ForbiddenException);
      // The account's owner still can.
      await expect(platform.createUser({ name: "New", email: "new@client-farm.example", role: "viewer" }, owner)).resolves.toBeDefined();
    });
  });

  describe("who did it, in the audit trail", () => {
    it("says a person of the account by name, Greecon staff as such, and anything else as the system", async () => {
      const mine = await platform.createSite({ name: "Mine", type: "farm", locationName: "x" }, owner);
      const staffMade = await platform.createSite({ name: "Theirs", type: "farm", locationName: "x" }, { ...owner, userId: DEMO_OWNER.userId, email: DEMO_OWNER.email, support: true });
      const gateway = await platform.provisionGateway({ siteId: mine.id, name: "Box" }, owner);
      await platform.completeGatewayEnrolment(gateway.id, owner.tenantId, undefined);

      const actors = new Map(platform.listAudit(owner).map((event) => [event.eventType + event.entityId, event.actor]));
      expect(actors.get(`site.created${mine.id}`)).toBe("Client Owner");
      expect(actors.get(`site.created${staffMade.id}`)).toBe("Greecon staff (eridon.manuka@greecon.earth)");
      expect(actors.get(`gateway.enrolled${gateway.id}`)).toBe("System");
    });
  });

  it("leaves nothing of a site behind in the working copy when the site is deleted", async () => {
    await platform.createAsset({ siteId, name: "Water", type: "PumpStation" }, owner);
    await platform.provisionGateway({ siteId, name: "Plant room" }, owner);
    await platform.recordSiteTemplate(siteId, "hotel", owner);
    await platform.deleteSite(siteId, owner);
    expect(platform.listAssets(owner)).toEqual([]);
    expect(platform.listGateways(owner)).toEqual([]);
  });
});

function heartbeat(deviceIds: string[], overrides: Partial<GatewayHeartbeat> = {}): GatewayHeartbeat {
  return {
    agentVersion: "0.2.0",
    uptimeSeconds: 3600,
    sentAtUtc: new Date().toISOString(),
    bufferDepth: 0,
    configVersion: "cfg1",
    devices: deviceIds.map((deviceId) => ({ deviceId, ok: true, readingsOk: 2, readingsFailed: 0 })),
    ...overrides
  };
}
