import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayHeartbeat, Point, TelemetryMessage } from "@greecon/shared";
import { Principal, edgeDeviceIngestPrincipal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "../platform/platform.service";
import { onboardClient } from "../platform/test-support";
import { EdgeBundleService } from "./edge-bundle";
import { hashEnrolmentCode, normaliseEnrolmentCode } from "./enrolment-code";
import { MemoryEnrolmentStore } from "./enrolment-store";
import { SetupService } from "./setup.service";

const API = "https://api.greecon.example";

function bundleWith(version: string | undefined): EdgeBundleService {
  return { manifest: () => (version ? { version, sha256: "a".repeat(64), size: 10, builtAtUtc: "2026-10-19T09:00:00Z" } : undefined) } as unknown as EdgeBundleService;
}

describe("setting a site up", () => {
  let platform: PlatformService;
  let enrolments: MemoryEnrolmentStore;
  let setup: SetupService;
  let owner: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    enrolments = new MemoryEnrolmentStore();
    setup = new SetupService(platform, enrolments, bundleWith("0.2.0+new"));
    owner = await onboardClient(platform);
  });

  const hotel = (overrides: Record<string, unknown> = {}) =>
    setup.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës", ...overrides }, owner);

  describe("from a template", () => {
    it("makes the site with its assets, devices and readings, none of them addressed yet", async () => {
      const { site, setup: view } = await hotel();
      expect(site).toMatchObject({ name: "Hotel Adriatik", type: "integrated_site", locationName: "Durrës" });

      expect(platform.listAssets(owner, site.id).map((asset) => asset.name).sort()).toEqual(["Grid connection", "Solar plant", "Water supply"]);
      const devices = platform.listDevices(owner, site.id);
      expect(devices.map((device) => device.name).sort()).toEqual(["Grid meter", "Solar meter", "Water I/O module"]);
      expect(devices.every((device) => device.protocol === "modbus" && device.connection === undefined && device.gatewayId === undefined)).toBe(true);

      const points = platform.listPoints(owner).filter((point) => point.siteId === site.id);
      expect(points).toHaveLength(7);
      // A known meter arrives with its registers; the water module's readings wait for a datasheet.
      expect(points.filter((point) => point.source).map((point) => point.canonicalName).sort()).toEqual(["energy.grid.export.kw", "energy.grid.import.kw", "energy.solar.power.kw"]);
      expect(points.filter((point) => !point.source)).toHaveLength(4);

      expect(view.templateKey).toBe("hotel");
      expect(view.steps.find((step) => step.key === "box")?.status).toBe("todo");
      expect(platform.siteSetupRecord(site.id, owner).templateKey).toBe("hotel");
    });

    it("gives every reading its asset, so the site's picture groups them", async () => {
      const { site } = await hotel();
      const assets = new Map(platform.listAssets(owner, site.id).map((asset) => [asset.id, asset.name]));
      const grid = platform.listPoints(owner).find((point) => point.siteId === site.id && point.canonicalName === "energy.grid.import.kw");
      expect(assets.get(grid?.assetId as string)).toBe("Grid connection");
    });

    it("sets the site's own clock and currency when they are given", async () => {
      const { site } = await hotel({ timezone: "Europe/Tirane", currency: "ALL" });
      expect(platform.siteProfile(site.id, owner)).toMatchObject({ timezone: "Europe/Tirane", currency: "ALL" });
    });

    it("makes an empty site from the empty template, with just the box to add", async () => {
      const { site, setup: view } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      expect(platform.listDevices(owner, site.id)).toEqual([]);
      expect(view.steps.map((step) => step.key)).toEqual(["box", "commissioned"]);
    });

    it("refuses a template that does not exist, and creates nothing", async () => {
      await expect(hotel({ templateKey: "castle" })).rejects.toThrow(/no site template called "castle"/);
      expect(platform.listSites(owner)).toEqual([]);
    });

    it("is for people who manage sites, devices and assets", async () => {
      for (const role of ["operator", "viewer", "auditor"] as const) {
        await expect(setup.createSiteFromTemplate({ templateKey: "hotel", name: "x", locationName: "x" }, { ...owner, role })).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(platform.listSites(owner)).toEqual([]);
    });

    it("leaves nothing behind when a step fails half way", async () => {
      const original = platform.createPoint.bind(platform);
      let calls = 0;
      vi.spyOn(platform, "createPoint").mockImplementation(async (input, principal) => {
        calls += 1;
        if (calls === 4) throw new Error("the database went away");
        return original(input, principal);
      });
      await expect(hotel()).rejects.toThrow("the database went away");
      expect(platform.listSites(owner)).toEqual([]);
      expect(platform.listDevices(owner)).toEqual([]);
      expect(platform.listAssets(owner)).toEqual([]);
      expect(platform.listPoints(owner)).toEqual([]);
    });

    it("keeps one site apart from another made from the same template", async () => {
      const first = await hotel();
      const second = await hotel({ name: "Hotel Two" });
      expect(first.site.id).not.toBe(second.site.id);
      expect(platform.listDevices(owner, first.site.id)).toHaveLength(3);
      expect(platform.listDevices(owner, second.site.id)).toHaveLength(3);
    });
  });

  describe("adding known equipment", () => {
    it("adds a meter with its address and its registers, using the usual port and unit", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const { deviceId, setup: view } = await setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm230-load", host: "192.168.1.60" }, owner);

      const device = platform.listDevices(owner, site.id).find((candidate) => candidate.id === deviceId);
      expect(device).toMatchObject({ name: "Eastron SDM230 on the site's own consumption", deviceType: "load_meter", protocol: "modbus", connection: { host: "192.168.1.60", port: 502, unitId: 1 } });
      expect(platform.listPoints(owner, deviceId).map((point) => [point.canonicalName, point.source?.address])).toEqual([["energy.consumption.kw", 12]]);
      expect(view.steps.find((step) => step.key === "addresses")?.status).toBe("done");
    });

    it("takes a name, a unit number and a port when it is told them", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const { deviceId } = await setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid", name: "Main meter", host: "10.0.0.5", port: 4001, unitId: 3 }, owner);
      expect(platform.listDevices(owner, site.id).find((device) => device.id === deviceId)).toMatchObject({ name: "Main meter", connection: { host: "10.0.0.5", port: 4001, unitId: 3 } });
    });

    it("can be added without an address and addressed later", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const { deviceId } = await setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-solar" }, owner);
      expect(platform.listDevices(owner, site.id).find((device) => device.id === deviceId)?.connection).toBeUndefined();
    });

    it("goes to the site's box when it has exactly one", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const { gatewayId } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      const { deviceId } = await setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid", host: "192.168.1.50" }, owner);
      expect(platform.listDevices(owner, site.id).find((device) => device.id === deviceId)?.gatewayId).toBe(gatewayId);
    });

    it("refuses a profile that does not exist, and an address that cannot work, leaving nothing", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      await expect(setup.createDeviceFromProfile({ siteId: site.id, profileKey: "acme-9000" }, owner)).rejects.toThrow(/no equipment profile called "acme-9000"/);
      await expect(setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid", host: "192.168.1.999" }, owner)).rejects.toBeInstanceOf(BadRequestException);
      expect(platform.listDevices(owner, site.id)).toEqual([]);
    });

    it("takes back a device that could not be given all its readings", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const original = platform.createPoint.bind(platform);
      let calls = 0;
      vi.spyOn(platform, "createPoint").mockImplementation(async (input, principal) => {
        calls += 1;
        if (calls === 2) throw new Error("failed");
        return original(input, principal);
      });
      await expect(setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid", host: "192.168.1.50" }, owner)).rejects.toThrow("failed");
      expect(platform.listDevices(owner, site.id)).toEqual([]);
      expect(platform.listPoints(owner)).toEqual([]);
    });

    it("is for people who manage devices", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      await expect(setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid" }, { ...owner, role: "operator" })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("getting the box on the network", () => {
    async function siteWithBox() {
      const { site } = await hotel();
      const box = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      return { site, ...box };
    }

    it("gives one install command, naming the API the box will talk to", async () => {
      const { enrolment } = await siteWithBox();
      expect(enrolment.code).toMatch(/^GRC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(enrolment.installCommand).toBe(`curl -fsSL ${API}/edge/install.sh | sudo bash -s -- ${enrolment.code}`);
      expect(Date.parse(enrolment.expiresAtUtc) - Date.now()).toBeGreaterThan(6 * 24 * 3_600_000);
    });

    it("keeps only the hash of the code", async () => {
      const { enrolment } = await siteWithBox();
      const body = normaliseEnrolmentCode(enrolment.code) as string;
      expect(await enrolments.peek(hashEnrolmentCode(body), Date.now())).toBeDefined();
      expect(await enrolments.peek(body, Date.now())).toBeUndefined();
    });

    it("gives a box its credential for a code, once, and says whose box it is", async () => {
      const { site, gatewayId, enrolment } = await siteWithBox();
      const result = await setup.enrol(enrolment.code, API);
      expect(result).toMatchObject({ apiUrl: API, tenantId: owner.tenantId, siteId: site.id, gatewayId, gatewayName: "Plant room" });
      expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(platform.findGateway(gatewayId, owner.tenantId)?.secureIdentityStatus).toBe("provisioned");

      await expect(setup.enrol(enrolment.code, API)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("is forgiving about how the code was typed", async () => {
      const { enrolment } = await siteWithBox();
      const retyped = enrolment.code.toLowerCase().replace(/-/g, " ");
      await expect(setup.enrol(retyped, API)).resolves.toMatchObject({ gatewayName: "Plant room" });
    });

    it("refuses a code that is not one, a code that was never issued and a code that has expired, all alike", async () => {
      const { gatewayId } = await siteWithBox();
      await expect(setup.enrol("hello", API)).rejects.toBeInstanceOf(BadRequestException);
      await expect(setup.enrol(undefined, API)).rejects.toBeInstanceOf(BadRequestException);
      await expect(setup.enrol("GRC-AAAA-BBBB-CCCC", API)).rejects.toThrow(/already been used, has expired, or is not one of ours/);

      const fresh = await setup.issueEnrolment(gatewayId, owner, API);
      const nextWeek = Date.now() + 8 * 24 * 3_600_000;
      await expect(setup.enrol(fresh.code, API, nextWeek)).rejects.toThrow(/already been used, has expired, or is not one of ours/);
    });

    it("lets only the newest code work, so a lost one can be replaced", async () => {
      const { gatewayId, enrolment } = await siteWithBox();
      const replacement = await setup.issueEnrolment(gatewayId, owner, API);
      await expect(setup.enrol(enrolment.code, API)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(setup.enrol(replacement.code, API)).resolves.toMatchObject({ gatewayId });
    });

    it("puts the code back if the box could not be given its credential, so it can try again", async () => {
      const { enrolment } = await siteWithBox();
      const original = platform.completeGatewayEnrolment.bind(platform);
      vi.spyOn(platform, "completeGatewayEnrolment").mockRejectedValueOnce(new Error("database error"));
      await expect(setup.enrol(enrolment.code, API)).rejects.toThrow("database error");
      vi.spyOn(platform, "completeGatewayEnrolment").mockImplementation(original);
      await expect(setup.enrol(enrolment.code, API)).resolves.toBeDefined();
    });

    it("says what every other refusal says when the box's gateway has been deleted since", async () => {
      const { gatewayId, enrolment } = await siteWithBox();
      await platform.deleteGateway(gatewayId, owner);
      await expect(setup.enrol(enrolment.code, API)).rejects.toThrow(/not one of ours/);
    });

    it("gives a replacement box a new credential and ends the old one's", async () => {
      const { gatewayId, enrolment } = await siteWithBox();
      const first = await setup.enrol(enrolment.code, API);
      const second = await setup.enrol((await setup.issueEnrolment(gatewayId, owner, API)).code, API);
      expect(second.secret).not.toBe(first.secret);
      expect(second.gatewayId).toBe(first.gatewayId);
    });

    it("is for people who manage devices", async () => {
      const { site, gatewayId } = await siteWithBox();
      const viewer: Principal = { ...owner, role: "viewer" };
      await expect(setup.provisionBox({ siteId: site.id, name: "x" }, viewer, API)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(setup.issueEnrolment(gatewayId, viewer, API)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("cannot be asked for another account's box", async () => {
      const { gatewayId } = await siteWithBox();
      // The demo account's owner: another account on the same platform.
      const other: Principal = { ...owner, tenantId: "11111111-1111-4111-8111-111111111111" };
      await expect(setup.issueEnrolment(gatewayId, other, API)).rejects.toThrow(/Gateway not found/);
    });
  });

  describe("what the box asks and says", () => {
    async function enrolledBox() {
      const { site } = await hotel();
      const { gatewayId, enrolment } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      await setup.enrol(enrolment.code, API);
      const box = edgeDeviceIngestPrincipal(owner.tenantId, gatewayId);
      return { site, gatewayId, box };
    }

    const heartbeat = (overrides: Partial<GatewayHeartbeat> = {}): GatewayHeartbeat => ({
      agentVersion: "0.2.0+old",
      uptimeSeconds: 100,
      sentAtUtc: new Date().toISOString(),
      bufferDepth: 0,
      devices: [],
      ...overrides
    });

    it("is told nothing to read until the devices have addresses, then exactly what has", async () => {
      const { site, box } = await enrolledBox();
      expect(setup.edgeConfig(box).devices).toEqual([]);

      const grid = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      await platform.updateDevice(grid?.id as string, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 1 } }, owner);
      const config = setup.edgeConfig(box);
      expect(config.devices.map((device) => device.name)).toEqual(["Grid meter"]);
      expect(config.devices[0]?.points.map((point) => point.canonicalName).sort()).toEqual(["energy.grid.export.kw", "energy.grid.import.kw"]);
    });

    it("answers a heartbeat with whether its configuration changed and whether there is newer software", async () => {
      const { site, box } = await enrolledBox();
      const first = await setup.heartbeat(box, heartbeat());
      expect(first.updateAvailable).toBe(true);
      expect(first.latestAgentVersion).toBe("0.2.0+new");
      expect(first.configVersion).toBe(setup.edgeConfig(box).version);

      const grid = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      await platform.updateDevice(grid?.id as string, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 1 } }, owner);
      const second = await setup.heartbeat(box, heartbeat({ configVersion: first.configVersion, agentVersion: "0.2.0+new" }));
      expect(second.configVersion).not.toBe(first.configVersion);
      expect(second.updateAvailable).toBe(false);
    });

    it("holds every box where it is when EDGE_AUTO_UPDATE is false", async () => {
      const { box } = await enrolledBox();
      const saved = process.env.EDGE_AUTO_UPDATE;
      process.env.EDGE_AUTO_UPDATE = "false";
      try {
        const reply = await setup.heartbeat(box, heartbeat());
        expect(reply).toMatchObject({ latestAgentVersion: "0.2.0+new", updateAvailable: false });
      } finally {
        if (saved === undefined) delete process.env.EDGE_AUTO_UPDATE;
        else process.env.EDGE_AUTO_UPDATE = saved;
      }
    });

    it("does not call for an update when no software has been built", async () => {
      const bare = new SetupService(platform, enrolments, bundleWith(undefined));
      const { box } = await enrolledBox();
      const reply = await bare.heartbeat(box, heartbeat());
      expect(reply).toMatchObject({ latestAgentVersion: "0.2.0+old", updateAvailable: false });
    });

    it("reports how far the box's clock is from the platform's", async () => {
      const { box } = await enrolledBox();
      const reply = await setup.heartbeat(box, heartbeat({ sentAtUtc: new Date(Date.now() + 600_000).toISOString() }));
      expect(reply.clockSkewSeconds).toBeGreaterThanOrEqual(599);
      expect(reply.clockSkewSeconds).toBeLessThanOrEqual(601);
    });

    it("refuses a heartbeat that is not one, saying what is wrong", async () => {
      const { box } = await enrolledBox();
      await expect(setup.heartbeat(box, { agentVersion: "", devices: "none" })).rejects.toThrow(/agentVersion/);
      await expect(setup.heartbeat(box, undefined)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("is for a box with a credential of its own, not a person's session or the shared token", async () => {
      await enrolledBox();
      expect(() => setup.edgeConfig(owner)).toThrow(ForbiddenException);
      await expect(setup.heartbeat(owner, heartbeat())).rejects.toBeInstanceOf(ForbiddenException);
      const sharedToken = edgeDeviceIngestPrincipal(owner.tenantId);
      expect(() => setup.edgeConfig(sharedToken)).toThrow(ForbiddenException);
    });

    it("makes the checklist follow the box: online, then each device answering, then readings arriving", async () => {
      const { site, box } = await enrolledBox();
      const devices = platform.listDevices(owner, site.id);
      for (const [index, device] of devices.entries()) {
        await platform.updateDevice(device.id, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: index + 1 } }, owner);
      }
      // The water module's readings are mapped by hand from its datasheet.
      for (const point of platform.listPoints(owner).filter((candidate) => candidate.siteId === site.id && !candidate.source)) {
        await platform.updatePoint(point.id, { source: { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16" } }, owner);
      }

      expect(setup.setupView(site.id, owner).steps.find((step) => step.key === "box")?.status).toBe("waiting");

      await setup.heartbeat(box, heartbeat({ devices: devices.map((device) => ({ deviceId: device.id, ok: true, readingsOk: 2, readingsFailed: 0 })) }));
      let view = setup.setupView(site.id, owner);
      expect(view.steps.find((step) => step.key === "box")?.status).toBe("done");
      expect(view.steps.find((step) => step.key === "answering")?.status).toBe("done");
      expect(view.steps.find((step) => step.key === "readings")?.status).toBe("waiting");

      const now = new Date().toISOString();
      const points = platform.listPoints(owner).filter((point) => point.siteId === site.id);
      const message: TelemetryMessage = {
        messageType: "telemetry",
        tenantId: owner.tenantId,
        siteId: site.id,
        deviceId: devices[0]?.id as string,
        publishedAtUtc: now,
        correlationId: "c",
        readings: points.map((point) => reading(point, valueFor(point), now, owner.tenantId))
      };
      expect((await platform.ingestTelemetry(message, box)).accepted).toBe(true);

      view = setup.setupView(site.id, owner);
      expect(view.steps.find((step) => step.key === "readings")?.status).toBe("done");
    });
  });

  describe("who may fetch the box's software", () => {
    it("is a box with a credential, or a box with a code that has not been used", async () => {
      const { site } = await hotel();
      const { gatewayId, enrolment } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      const publicCaller = { ...owner, tenantId: "public", gatewayId: undefined };

      await expect(setup.assertMayFetchSoftware(publicCaller, enrolment.code)).resolves.toBeUndefined();
      await expect(setup.assertMayFetchSoftware(publicCaller, enrolment.code.toLowerCase())).resolves.toBeUndefined();
      await expect(setup.assertMayFetchSoftware(edgeDeviceIngestPrincipal(owner.tenantId, gatewayId), undefined)).resolves.toBeUndefined();

      // Looking at the software does not use the code up.
      await expect(setup.enrol(enrolment.code, API)).resolves.toBeDefined();
      // But once it has been used it is no longer a way to fetch it.
      await expect(setup.assertMayFetchSoftware(publicCaller, enrolment.code)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("is nobody else: not a stranger, not a code that was never issued, not an expired one, not a person's session", async () => {
      const { site } = await hotel();
      const { gatewayId } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      const publicCaller = { ...owner, tenantId: "public", gatewayId: undefined };
      const expired = await setup.issueEnrolment(gatewayId, owner, API);

      await expect(setup.assertMayFetchSoftware(publicCaller, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(setup.assertMayFetchSoftware(publicCaller, "hello")).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(setup.assertMayFetchSoftware(publicCaller, "GRC-AAAA-BBBB-CCCC")).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(setup.assertMayFetchSoftware(publicCaller, expired.code, Date.now() + 8 * 24 * 3_600_000)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(setup.assertMayFetchSoftware(owner, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("the steps a person confirms", () => {
    it("only accepts steps that are confirmed by hand", async () => {
      const { site } = await hotel();
      await expect(setup.confirmStep(site.id, "box", undefined, owner)).rejects.toThrow(/Only these steps are confirmed by hand/);
      await expect(setup.confirmStep(site.id, "__proto__", undefined, owner)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuses a step that does not apply to the site", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      await expect(setup.confirmStep(site.id, "direction", undefined, owner)).rejects.toThrow(/does not apply to this site/);
    });

    it("holds commissioning back until everything else is done", async () => {
      const { site } = await hotel();
      await expect(setup.confirmStep(site.id, "commissioned", undefined, owner)).rejects.toBeInstanceOf(ConflictException);
    });

    it("records who confirmed, when, and a tidied note", async () => {
      const { site } = await hotel();
      const view = await setup.confirmStep(site.id, "direction", "  Import   rose\nwith the kettle on  ", owner, Date.parse("2026-10-19T10:00:00Z"));
      expect(view.steps.find((step) => step.key === "direction")).toMatchObject({
        status: "done",
        confirmedBy: owner.email,
        confirmedAtUtc: "2026-10-19T10:00:00.000Z",
        note: "Import rose with the kettle on"
      });
    });

    it("keeps a note to 300 characters", async () => {
      const { site } = await hotel();
      const view = await setup.confirmStep(site.id, "limits", "x".repeat(900), owner);
      expect(view.steps.find((step) => step.key === "limits")?.note).toHaveLength(300);
    });

    it("can be reopened, and reopening an earlier step takes the commissioning back too", async () => {
      const { site } = await hotel();
      // Make the site ready to commission without a real box: everything the platform checks is satisfied.
      const view = await commissionable(site.id);
      expect(view.commissioned).toBe(true);

      const reopened = await setup.reopenStep(site.id, "direction", owner);
      expect(reopened.steps.find((step) => step.key === "direction")?.status).toBe("todo");
      expect(reopened.commissioned).toBe(false);
      expect(reopened.steps.find((step) => step.key === "limits")?.status).toBe("done");
    });

    async function commissionable(siteId: string) {
      const { gatewayId, enrolment } = await setup.provisionBox({ siteId, name: "Plant room" }, owner, API);
      await setup.enrol(enrolment.code, API);
      const box = edgeDeviceIngestPrincipal(owner.tenantId, gatewayId);
      const devices = platform.listDevices(owner, siteId);
      for (const [index, device] of devices.entries()) {
        await platform.updateDevice(device.id, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: index + 1 } }, owner);
      }
      for (const point of platform.listPoints(owner).filter((candidate) => candidate.siteId === siteId && !candidate.source)) {
        await platform.updatePoint(point.id, { source: { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16" } }, owner);
      }
      await setup.heartbeat(box, { agentVersion: "0.2.0+new", uptimeSeconds: 1, sentAtUtc: new Date().toISOString(), bufferDepth: 0, devices: devices.map((device) => ({ deviceId: device.id, ok: true, readingsOk: 2, readingsFailed: 0 })) });
      const now = new Date().toISOString();
      const points = platform.listPoints(owner).filter((point) => point.siteId === siteId);
      await platform.ingestTelemetry(
        { messageType: "telemetry", tenantId: owner.tenantId, siteId, deviceId: devices[0]?.id as string, publishedAtUtc: now, correlationId: "c", readings: points.map((point) => reading(point, valueFor(point), now, owner.tenantId)) },
        box
      );
      await setup.confirmStep(siteId, "direction", undefined, owner);
      await setup.confirmStep(siteId, "limits", undefined, owner);
      return setup.confirmStep(siteId, "commissioned", "Numbers match the meter's display", owner);
    }

    it("is for people who manage the site", async () => {
      const { site } = await hotel();
      await expect(setup.confirmStep(site.id, "direction", undefined, { ...owner, role: "operator" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(setup.reopenStep(site.id, "direction", { ...owner, role: "viewer" })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("the handover sheet", () => {
    it("lists what was installed where, how it is read, the limits in force and who checked what", async () => {
      const { site } = await hotel({ currency: "EUR" });
      const grid = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      await platform.updateDevice(grid?.id as string, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 2 } }, owner);
      const tank = platform.listPoints(owner).find((point) => point.siteId === site.id && point.canonicalName === "water.tank.level.percent") as Point;
      await platform.updatePoint(tank.id, { thresholdConfig: { critical_low: 20 } }, owner);
      await setup.confirmStep(site.id, "direction", "Checked with the kettle", owner);

      const sheet = setup.handover(site.id, owner);
      expect(sheet.customer).toBe("Client Farm Ltd");
      expect(sheet.site).toMatchObject({ name: "Hotel Adriatik", locationName: "Durrës" });
      expect(sheet.support.email).toBe("info@greecon.earth");
      expect(sheet.people.map((person) => person.email)).toContain("owner@client-farm.example");

      const gridSheet = sheet.devices.find((device) => device.name === "Grid meter");
      expect(gridSheet?.address).toBe("192.168.1.50:502, unit 2");
      expect(gridSheet?.readings.map((entry) => entry.register)).toEqual([
        "input register 52, float32, ×0.001, only when positive",
        "input register 52, float32, ×0.001, only when negative, as a positive number"
      ]);
      const water = sheet.devices.find((device) => device.name === "Water I/O module");
      expect(water?.address).toBeUndefined();
      const tankSheet = water?.readings.find((entry) => entry.label === "Tank level");
      expect(tankSheet?.limits).toEqual([
        { key: "critical_low", label: "Critical below", value: 20, standard: false },
        { key: "warning_low", label: "Low below", value: 35, standard: true }
      ]);
      expect(sheet.steps.find((step) => step.key === "direction")).toMatchObject({ status: "done", note: "Checked with the kettle" });
      expect(sheet.commissioned).toBe(false);
    });

    it("says nothing about a limit the platform would say nothing about", async () => {
      const { site } = await hotel();
      const sheet = setup.handover(site.id, owner);
      const flow = sheet.devices.flatMap((device) => device.readings).find((entry) => entry.canonicalName === "water.flow.lpm");
      expect(flow?.limits).toEqual([]);
    });
  });

  describe("one account and another", () => {
    it("never shows, changes or makes codes for another account's site", async () => {
      const { site } = await hotel();
      const { gatewayId } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);

      const intruder: Principal = { ...owner, tenantId: "11111111-1111-4111-8111-111111111111", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" };
      for (const attempt of [
        () => setup.setupView(site.id, intruder),
        () => setup.handover(site.id, intruder),
        () => setup.confirmStep(site.id, "direction", undefined, intruder),
        () => setup.reopenStep(site.id, "direction", intruder),
        () => setup.provisionBox({ siteId: site.id, name: "x" }, intruder, API),
        () => setup.issueEnrolment(gatewayId, intruder, API),
        () => setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm630-grid" }, intruder)
      ]) {
        // Refused as outside the caller's account, not failing for some other reason.
        const error = await Promise.resolve().then(attempt).then(() => undefined, (caught: unknown) => caught);
        expect(error instanceof ForbiddenException || error instanceof NotFoundException, String(error)).toBe(true);
      }
      expect(platform.listDevices(owner, site.id)).toHaveLength(3);
      expect(platform.siteSetupRecord(site.id, owner).confirmations).toEqual({});
    });
  });
});

function valueFor(point: Point): number {
  const values: Record<string, number> = { "water.tank.level.percent": 62, "water.pressure.bar": 3.1, "water.flow.lpm": 14, "water.pump.status": 1, "energy.grid.import.kw": 4.2, "energy.grid.export.kw": 0, "energy.solar.power.kw": 0 };
  return values[point.canonicalName] ?? 1;
}

function reading(point: Point, value: number, at: string, tenantId: string) {
  return {
    timestampUtc: at,
    tenantId,
    siteId: point.siteId,
    assetId: point.assetId,
    deviceId: point.deviceId,
    pointId: point.id,
    canonicalName: point.canonicalName,
    value,
    unit: point.unit,
    quality: "OK" as const,
    source: "edge" as const,
    ingestionTimestampUtc: at
  };
}
