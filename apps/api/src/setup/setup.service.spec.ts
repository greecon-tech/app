import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryResult, GatewayHeartbeat, PROBES, Point, ProbeResult, TelemetryMessage, convertRaw, readModbusValue } from "@greecon/shared";
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
      expect(devices.map((device) => device.name).sort()).toEqual(["Grid meter", "Pump contact module (optional)", "Solar meter", "Water I/O module"]);
      expect(devices.every((device) => device.protocol === "modbus" && device.connection === undefined && device.gatewayId === undefined)).toBe(true);

      const points = platform.listPoints(owner).filter((point) => point.siteId === site.id);
      expect(points).toHaveLength(7);
      // Known equipment arrives with its registers. The 4 to 20 mA module's three readings wait for one thing only: the range on each transmitter's label.
      expect(points.filter((point) => point.source).map((point) => point.canonicalName).sort()).toEqual(["energy.grid.export.kw", "energy.grid.import.kw", "energy.solar.power.kw", "water.pump.status"]);
      expect(points.filter((point) => !point.source).map((point) => point.canonicalName).sort()).toEqual(["water.flow.lpm", "water.pressure.bar", "water.tank.level.percent"]);
      // Each device remembers which approved model it is, so the platform knows what to ask for and what to look for.
      expect(devices.map((device) => device.profileKey).sort()).toEqual(["eastron-sdm630-grid", "eastron-sdm630-solar", "waveshare-ai8-water", "waveshare-io8-pump"]);

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

    it("makes an empty site from the empty template, with the box and the equipment still to add", async () => {
      const { site, setup: view } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      expect(platform.listDevices(owner, site.id)).toEqual([]);
      expect(view.steps.map((step) => step.key)).toEqual(["paperwork", "box", "addresses", "electrician", "commissioned"]);
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
      expect(platform.listDevices(owner, first.site.id)).toHaveLength(4);
      expect(platform.listDevices(owner, second.site.id)).toHaveLength(4);
    });
  });

  describe("adding known equipment", () => {
    it("adds a meter with its address and its registers, using the usual port and unit", async () => {
      const { site } = await setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
      const { deviceId, setup: view } = await setup.createDeviceFromProfile({ siteId: site.id, profileKey: "eastron-sdm230-load", host: "192.168.1.60" }, owner);

      const device = platform.listDevices(owner, site.id).find((candidate) => candidate.id === deviceId);
      expect(device).toMatchObject({ name: "Eastron SDM230 on the site's own consumption", deviceType: "load_meter", protocol: "modbus", connection: { host: "192.168.1.60", port: 502, unitId: 4 }, profileKey: "eastron-sdm230-load" });
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

    it("says when it was Greecon staff, in a support session, who confirmed", async () => {
      const { site } = await hotel();
      const staff: Principal = { ...owner, email: "pm@greecon.earth", support: true };
      const view = await setup.confirmStep(site.id, "direction", undefined, staff);
      expect(view.steps.find((step) => step.key === "direction")?.confirmedBy).toBe("pm@greecon.earth (Greecon staff)");
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
      await setup.confirmStep(siteId, "paperwork", "Signed for the hotel by Besa Krasniqi on 19 October", owner);
      await setup.confirmStep(siteId, "direction", undefined, owner);
      await setup.confirmStep(siteId, "limits", undefined, owner);
      await setup.confirmStep(siteId, "electrician", "Arben Hoxha, licence E-1234", owner);
      return setup.confirmStep(siteId, "commissioned", "Numbers match the meter's display", owner);
    }

    it("is for people who manage the site", async () => {
      const { site } = await hotel();
      await expect(setup.confirmStep(site.id, "direction", undefined, { ...owner, role: "operator" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(setup.reopenStep(site.id, "direction", { ...owner, role: "viewer" })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("telling people, as part of setting a site up", () => {
    const people = [
      { id: "c-1", name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691111111" },
      { id: "c-2", name: "Plumber", phone: "+355693333333" }
    ];
    const summary = { emailOn: true, smsOn: true, contacts: 2, byEmail: 1, bySms: 2 as number, lastTestAtMs: undefined as number | undefined };
    let told: SetupService;

    beforeEach(() => {
      summary.lastTestAtMs = undefined;
      told = new SetupService(platform, enrolments, bundleWith("0.2.0+new"), { summary: () => ({ ...summary }), contacts: () => people });
    });

    const toldStep = (view: { steps: Array<{ key: string }> }) => view.steps.find((step) => step.key === "told") as { status: string; canConfirm?: boolean };

    it("adds the step to a site's list, between the readings and the checks a person makes", async () => {
      const { site } = await told.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës" }, owner);
      const keys = told.setupView(site.id, owner).steps.map((step) => step.key);
      expect(keys).toEqual(["paperwork", "prices", "box", "addresses", "mapping", "answering", "readings", "told", "direction", "limits", "electrician", "commissioned"]);
    });

    it("refuses to confirm it before a test message has been sent, and says what to do", async () => {
      const { site } = await told.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës" }, owner);
      expect(toldStep(told.setupView(site.id, owner)).canConfirm).toBe(false);
      await expect(told.confirmStep(site.id, "told", undefined, owner)).rejects.toThrow(/This cannot be confirmed yet\. Open Who is told and send a test message/);
    });

    it("accepts the confirmation once a test message has gone, and records who", async () => {
      const { site } = await told.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës" }, owner);
      summary.lastTestAtMs = Date.now() - 60_000;
      const view = await told.confirmStep(site.id, "told", "Besa read it on her phone", owner);
      expect(view.steps.find((step) => step.key === "told")).toMatchObject({ status: "done", confirmedBy: owner.email, note: "Besa read it on her phone" });
    });

    it("can be taken back like any other step, and takes the commissioning back with it", async () => {
      const { site } = await told.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës" }, owner);
      summary.lastTestAtMs = Date.now();
      await told.confirmStep(site.id, "told", undefined, owner);
      const view = await told.reopenStep(site.id, "told", owner);
      expect(toldStep(view).status).toBe("todo");
    });

    it("puts the people who are told on the handover sheet, in order", async () => {
      const { site } = await told.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës" }, owner);
      expect(told.handover(site.id, owner).told).toEqual([
        { name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691111111" },
        { name: "Plumber", email: undefined, phone: "+355693333333" }
      ]);
    });

    it("has an empty list on the handover where the platform has no notifications", async () => {
      const { site } = await hotel();
      expect(setup.handover(site.id, owner).told).toEqual([]);
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
      // "Smallest useful surplus" has no standard, so the platform makes no claim about surplus until a site sets one.
      const solar = sheet.devices.flatMap((device) => device.readings).find((entry) => entry.canonicalName === "energy.solar.power.kw");
      expect(solar?.limits).toEqual([]);
    });

    it("lists the no-flow limit as the standard it is, because the platform does raise an Act now alert at it", async () => {
      const { site } = await hotel();
      const sheet = setup.handover(site.id, owner);
      const flow = sheet.devices.flatMap((device) => device.readings).find((entry) => entry.canonicalName === "water.flow.lpm");
      expect(flow?.limits).toEqual([{ key: "dry_run_lpm", label: "No flow at or below", value: 0.2, standard: true }]);
    });
  });

  describe("finding the equipment on the site's network", () => {
    const heartbeat = (): GatewayHeartbeat => ({ agentVersion: "0.2.0+new", uptimeSeconds: 100, sentAtUtc: new Date().toISOString(), bufferDepth: 0, devices: [] });

    /** A hotel with a box that is online, as a project manager has it after the box step. */
    async function onlineBox() {
      const { site } = await hotel();
      const { gatewayId, enrolment } = await setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      await setup.enrol(enrolment.code, API);
      const box = edgeDeviceIngestPrincipal(owner.tenantId, gatewayId);
      await setup.heartbeat(box, heartbeat());
      return { site, gatewayId, box };
    }

    const floatWords = (value: number): number[] => {
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, value);
      return [view.getUint16(0), view.getUint16(2)];
    };
    const answers = (given: Record<string, "refused" | number[]>): ProbeResult[] =>
      PROBES.map((probe) => {
        const answer = given[probe.key] ?? "silent";
        return answer === "silent" || answer === "refused" ? { key: probe.key, outcome: answer } : { key: probe.key, outcome: "ok", words: answer };
      });
    const meter630 = (watts: number): ProbeResult[] =>
      answers({ "eastron-voltage": floatWords(231), "analog-channels": [...floatWords(231), 0], "digital-inputs": "refused", "eastron-630": floatWords(watts), "eastron-230": floatWords(watts / 3), "module-address": "refused" });
    const meter230 = (watts: number): ProbeResult[] => answers({ "eastron-voltage": floatWords(229), "analog-channels": "refused", "digital-inputs": "refused", "eastron-630": "refused", "eastron-230": floatWords(watts), "module-address": "refused" });
    const analogModule = answers({ "eastron-voltage": [12000, 8000], "analog-channels": [12000, 8000, 4000], "digital-inputs": "refused", "eastron-630": "refused", "eastron-230": "refused", "module-address": [3] });
    const digitalModule = answers({ "eastron-voltage": "refused", "analog-channels": "refused", "digital-inputs": [1, 0, 0, 0, 0, 0, 0, 0], "eastron-630": "refused", "eastron-230": "refused", "module-address": [5] });

    const kitOn = (host: string, units: Array<[number, ProbeResult[]]>): DiscoveryResult["hosts"] => [{ host, port: 502, units: units.map(([unit, probes]) => ({ unit, probes })) }];
    const resultFor = (requestId: string, hosts: DiscoveryResult["hosts"], notes: string[] = []): DiscoveryResult => ({
      requestId,
      startedAtUtc: new Date(Date.now() - 20_000).toISOString(),
      finishedAtUtc: new Date().toISOString(),
      scanned: { subnets: ["192.168.1.0/24"], hostsTried: 253, ports: [502], units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      hosts,
      notes
    });
    const fullKit = () => kitOn("192.168.1.50", [[1, meter630(1800)], [2, meter630(5200)], [3, analogModule], [5, digitalModule]]);

    /** The request the platform has put to the box, as the box hears it in its next heartbeat. */
    async function askedOf(box: Principal) {
      const reply = await setup.heartbeat(box, heartbeat());
      return reply.discovery;
    }

    it("asks the box to look when a person presses the button, and the box hears of it at its next heartbeat", async () => {
      const { site, box } = await onlineBox();
      expect(await askedOf(box)).toBeUndefined();

      const view = await setup.requestDiscovery(site.id, {}, owner);
      expect(view).toMatchObject({ state: "waiting", proposals: [], boxes: [] });
      const asked = await askedOf(box);
      expect(asked?.id).toMatch(/[0-9a-f-]{36}/);
      expect(asked?.hosts).toBeUndefined();
    });

    it("shows the person who asks again soon the search that is under way, not a second one", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const first = await askedOf(box);
      await setup.requestDiscovery(site.id, {}, owner, Date.now() + 30_000);
      expect((await askedOf(box))?.id).toBe(first?.id);
      await setup.requestDiscovery(site.id, {}, owner, Date.now() + 5 * 60_000);
      expect((await askedOf(box))?.id).not.toBe(first?.id);
    });

    it("fills in the address of everything the box found, as the person who asked, the moment the box says", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const asked = await askedOf(box);
      const outcome = await setup.recordDiscovery(box, resultFor(asked?.id as string, fullKit()));
      expect(outcome).toEqual({ recorded: true });

      const devices = platform.listDevices(owner, site.id);
      const at = (name: string) => devices.find((device) => device.name === name)?.connection;
      expect(at("Grid meter")).toEqual({ kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 1 });
      expect(at("Solar meter")).toMatchObject({ unitId: 2 });
      expect(at("Water I/O module")).toMatchObject({ unitId: 3 });
      expect(at("Pump contact module (optional)")).toMatchObject({ unitId: 5 });

      const view = setup.discoveryView(site.id, owner);
      expect(view).toMatchObject({ state: "done", toApply: 0, allSet: true, unclaimed: [], notes: [] });
      expect(view.proposals.map((proposal) => proposal.status)).toEqual(["already", "already", "already", "already"]);
      expect(view.boxes[0]).toMatchObject({ name: "Plant room", looked: "253 addresses on 192.168.1.0/24, unit numbers 1 to 10" });
      expect(setup.setupView(site.id, owner).steps.find((step) => step.key === "addresses")).toMatchObject({ status: "done" });
      // The audit trail names the person who pressed the button, not the box, and says what address each device was given.
      const changes = platform.listAudit(owner, site.id).filter((entry) => entry.eventType === "device.updated" && String(entry.reason).includes("Address of device"));
      expect(changes).toHaveLength(4);
      expect(changes.every((entry) => entry.userId === owner.userId)).toBe(true);
      expect(changes.map((entry) => entry.afterMetadata?.address).sort()).toEqual(["192.168.1.50:502, unit 1", "192.168.1.50:502, unit 2", "192.168.1.50:502, unit 3", "192.168.1.50:502, unit 5"]);
    });

    it("tells the box to stop asking once it has said", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const asked = await askedOf(box);
      await setup.recordDiscovery(box, resultFor(asked?.id as string, fullKit()));
      expect(await askedOf(box)).toBeUndefined();
    });

    it("puts the readings of what it found into the box's configuration on the next heartbeat", async () => {
      const { site, box } = await onlineBox();
      expect(setup.edgeConfig(box).devices).toEqual([]);
      await setup.requestDiscovery(site.id, {}, owner);
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, fullKit()));
      // The meters and the pump contact have their registers; the 4 to 20 mA module's readings wait for the range on each transmitter's label.
      expect(setup.edgeConfig(box).devices.map((device) => device.name).sort()).toEqual(["Grid meter", "Pump contact module (optional)", "Solar meter"]);
    });

    it("looks at the address it is given instead of the network, when a person gives one", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, { host: " 192.168.1.60 " }, owner);
      expect((await askedOf(box))?.hosts).toEqual(["192.168.1.60"]);
    });

    it("looks at another port when the converter does not use the usual one", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, { host: "192.168.1.60", port: 4001 }, owner);
      const asked = await askedOf(box);
      expect(asked).toMatchObject({ hosts: ["192.168.1.60"], ports: [4001] });
      // Asked for again, it is a new search, because it is a different question.
      await setup.requestDiscovery(site.id, { port: 8899 }, owner, Date.now() + 1000);
      expect(await askedOf(box)).toMatchObject({ ports: [8899] });
    });

    it("refuses an address that is not on a private network, a site with no box and a box that is not online", async () => {
      const { site } = await onlineBox();
      await expect(setup.requestDiscovery(site.id, { host: "8.8.8.8" }, owner)).rejects.toThrow(/not on a private network/);
      const bare = await hotel({ name: "No box here" });
      await expect(setup.requestDiscovery(bare.site.id, {}, owner)).rejects.toThrow(/no box yet/);
      const waiting = await hotel({ name: "Box not installed" });
      await setup.provisionBox({ siteId: waiting.site.id, name: "Plant room" }, owner, API);
      await expect(setup.requestDiscovery(waiting.site.id, {}, owner)).rejects.toThrow(/not online yet/);
    });

    it("is for people who manage devices, and for their own account's site only", async () => {
      const { site } = await onlineBox();
      await expect(setup.requestDiscovery(site.id, {}, { ...owner, role: "viewer" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(setup.applyDiscovery(site.id, { ...owner, role: "operator" })).rejects.toBeInstanceOf(ForbiddenException);
      const intruder: Principal = { ...owner, tenantId: "11111111-1111-4111-8111-111111111111", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" };
      for (const attempt of [() => setup.requestDiscovery(site.id, {}, intruder), () => setup.discoveryView(site.id, intruder), () => setup.applyDiscovery(site.id, intruder)]) {
        const error = await Promise.resolve().then(attempt).then(() => undefined, (caught: unknown) => caught);
        expect(error instanceof ForbiddenException || error instanceof NotFoundException, String(error)).toBe(true);
      }
    });

    it("puts aside a result for a search that has been replaced, one it did not ask for, and one already recorded", async () => {
      const { site, box } = await onlineBox();
      expect(await setup.recordDiscovery(box, resultFor("never-asked", fullKit()))).toEqual({ recorded: false });
      await setup.requestDiscovery(site.id, {}, owner);
      const first = (await askedOf(box))?.id as string;
      await setup.requestDiscovery(site.id, {}, owner, Date.now() + 5 * 60_000);
      expect(await setup.recordDiscovery(box, resultFor(first, fullKit()))).toEqual({ recorded: false });
      const second = (await askedOf(box))?.id as string;
      expect(await setup.recordDiscovery(box, resultFor(second, fullKit()))).toEqual({ recorded: true });
      expect(await setup.recordDiscovery(box, resultFor(second, kitOn("192.168.1.99", [])))).toEqual({ recorded: false });
      expect(platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter")?.connection?.host).toBe("192.168.1.50");
    });

    it("refuses a result that is not one, in words, and a person's session that is not a box", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      await expect(setup.recordDiscovery(box, { hello: "there" })).rejects.toBeInstanceOf(BadRequestException);
      await expect(setup.recordDiscovery(box, null)).rejects.toThrow(/The result is missing/);
      await expect(setup.recordDiscovery(owner, resultFor("x", []))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("leaves a device that already has an address alone until the person says to use the new one", async () => {
      const { site, box } = await onlineBox();
      const grid = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      await platform.updateDevice(grid?.id as string, { connection: { kind: "modbus_tcp", host: "192.168.1.70", port: 502, unitId: 9 } }, owner);

      await setup.requestDiscovery(site.id, {}, owner);
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, fullKit()));
      const kept = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      expect(kept?.connection).toMatchObject({ host: "192.168.1.70", unitId: 9 });
      const view = setup.discoveryView(site.id, owner);
      expect(view.toApply).toBe(1);
      expect(view.proposals[0]).toMatchObject({ name: "Grid meter", status: "found" });

      const used = await setup.applyDiscovery(site.id, owner);
      expect(used.applied).toEqual(["Grid meter"]);
      expect(platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter")?.connection).toMatchObject({ host: "192.168.1.50", unitId: 1 });
      expect(used.discovery).toMatchObject({ toApply: 0, allSet: true });
      expect(used.setup.steps.find((step) => step.key === "addresses")?.status).toBe("done");
    });

    it("reads a meter as the model that is there when it is not the one planned, by that model's registers", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const hosts = kitOn("192.168.1.50", [[1, meter230(900)], [2, meter630(5200)], [3, analogModule], [5, digitalModule]]);
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, hosts));

      const grid = platform.listDevices(owner, site.id).find((device) => device.name === "Grid meter");
      expect(grid?.profileKey).toBe("eastron-sdm230-grid");
      const points = platform.listPoints(owner, grid?.id as string);
      // Total power sits at register 12 on the SDM230, not 52.
      expect(points.map((point) => point.source?.address)).toEqual([12, 12]);
      const solar = platform.listDevices(owner, site.id).find((device) => device.name === "Solar meter");
      expect(solar?.profileKey).toBe("eastron-sdm630-solar");
      expect(platform.listPoints(owner, solar?.id as string)[0]?.source?.address).toBe(52);
    });

    it("does not guess between two meters it cannot tell apart, and says what to do", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const hosts = [...kitOn("192.168.1.50", [[1, meter630(1800)]]), ...kitOn("192.168.1.51", [[1, meter630(5200)]])];
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, hosts));
      const devices = platform.listDevices(owner, site.id);
      expect(devices.find((device) => device.name === "Grid meter")?.connection).toBeUndefined();
      expect(devices.find((device) => device.name === "Solar meter")?.connection).toBeUndefined();
      const view = setup.discoveryView(site.id, owner);
      expect(view.proposals.find((proposal) => proposal.name === "Grid meter")).toMatchObject({ status: "unsure" });
      expect(view.proposals.find((proposal) => proposal.name === "Grid meter")?.message).toContain("cannot tell which is this one");
      expect(view.allSet).toBe(false);
    });

    it("says what is missing and what the network looked like, and finds a module that was left at another unit number when it is the only one of its kind", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const hosts = kitOn("192.168.1.50", [[1, meter630(1800)], [8, digitalModule.map((probe) => (probe.key === "module-address" ? { ...probe, words: [8] } : probe))]]);
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, hosts, ["The converter at 192.168.1.50 stopped answering part way through."]));
      const view = setup.discoveryView(site.id, owner);
      expect(view.proposals.map((proposal) => [proposal.name, proposal.status])).toEqual([
        ["Grid meter", "already"],
        ["Solar meter", "missing"],
        ["Water I/O module", "missing"],
        // It was found at unit 8, not 5, and it is the only digital module and the only device that wants one: it works, and it was filled in.
        ["Pump contact module (optional)", "already"]
      ]);
      expect(platform.listDevices(owner, site.id).find((device) => device.name === "Pump contact module (optional)")?.connection).toMatchObject({ host: "192.168.1.50", unitId: 8 });
      expect(view.notes).toEqual(["The converter at 192.168.1.50 stopped answering part way through."]);
      expect(setup.setupView(site.id, owner).steps.find((step) => step.key === "addresses")).toMatchObject({ status: "todo" });
    });

    it("says nothing was asked, and that a request the box never picked up has gone unanswered", async () => {
      const { site } = await onlineBox();
      expect(setup.discoveryView(site.id, owner)).toMatchObject({ state: "idle", proposals: [], boxes: [] });
      await setup.requestDiscovery(site.id, {}, owner);
      expect(setup.discoveryView(site.id, owner, Date.now() + 60_000).state).toBe("waiting");
      expect(setup.discoveryView(site.id, owner, Date.now() + 11 * 60_000).state).toBe("expired");
    });

    it("forgets what a box found on a customer's network after a day, whether or not anyone asks again", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      await setup.recordDiscovery(box, resultFor((await askedOf(box))?.id as string, fullKit()));
      expect(setup.discoveryView(site.id, owner).boxes).toHaveLength(1);
      // A heartbeat a day and an hour later, nobody having pressed the button again, and what was found is gone.
      await setup.heartbeat(box, heartbeat(), Date.now() + 25 * 3_600_000);
      const view = setup.discoveryView(site.id, owner);
      expect(view).toMatchObject({ state: "idle", boxes: [], proposals: [], unclaimed: [] });
    });

    it("stops telling the box to look once nobody has been waiting for ten minutes", async () => {
      const { site, box } = await onlineBox();
      await setup.requestDiscovery(site.id, {}, owner);
      const later = await setup.heartbeat(box, heartbeat(), Date.now() + 11 * 60_000);
      expect(later.discovery).toBeUndefined();
    });
  });

  describe("the range on a transmitter's label", () => {
    async function hotelWithModule() {
      const { site } = await hotel();
      const module = platform.listDevices(owner, site.id).find((device) => device.name === "Water I/O module");
      return { site, moduleId: module?.id as string };
    }
    const pointsOf = (moduleId: string) => platform.listPoints(owner, moduleId);

    it("becomes the register and the scale of each reading, and the setup list stops asking for them", async () => {
      const { site, moduleId } = await hotelWithModule();
      expect(setup.setupView(site.id, owner).steps.find((step) => step.key === "mapping")?.items?.filter((item) => item.status === "todo")).toHaveLength(3);

      const { setup: view } = await setup.setRanges(
        moduleId,
        { ranges: [{ canonicalName: "water.tank.level.percent", range: 5, tankHeight: 4 }, { canonicalName: "water.pressure.bar", range: 10 }, { canonicalName: "water.flow.lpm", range: 200 }] },
        owner
      );
      expect(view.steps.find((step) => step.key === "mapping")?.status).toBe("done");

      const byName = new Map(pointsOf(moduleId).map((point) => [point.canonicalName, point]));
      const tank = byName.get("water.tank.level.percent")?.source;
      expect(tank).toMatchObject({ registerType: "input", address: 0, dataType: "uint16", linear: { rawLow: 4000, rawHigh: 20000, engLow: 0, engHigh: 125 } });
      expect(byName.get("water.pressure.bar")?.source).toMatchObject({ address: 1, linear: { engHigh: 10 } });
      expect(byName.get("water.flow.lpm")?.source).toMatchObject({ address: 2, linear: { engHigh: 200 } });
      // A full tank of 4 m in a 0 to 5 m transmitter's range is 16.8 mA, and reads 100 %.
      expect(readModbusValue([16800], tank!)).toBeCloseTo(100, 6);
      expect(convertRaw(12000, byName.get("water.pressure.bar")!.source!)).toBe(5);
    });

    it("takes a reading away when there is no such transmitter, so that nothing waits for it for ever", async () => {
      const { site, moduleId } = await hotelWithModule();
      const { setup: view } = await setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.tank.level.percent", range: 5, tankHeight: 4 }, { canonicalName: "water.pressure.bar", range: 10 }, { canonicalName: "water.flow.lpm", notFitted: true }] }, owner);
      expect(pointsOf(moduleId).map((point) => point.canonicalName).sort()).toEqual(["water.pressure.bar", "water.tank.level.percent"]);
      expect(view.steps.find((step) => step.key === "mapping")?.status).toBe("done");
      expect(site.id).toBeTruthy();
    });

    it("checks every answer before using any, and says in words what is wrong with the one that is", async () => {
      const { moduleId } = await hotelWithModule();
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.pressure.bar", range: 10 }, { canonicalName: "water.tank.level.percent", range: 3, tankHeight: 4 }] }, owner)).rejects.toThrow(/Tank level: .*cannot see the top of the water/);
      // Nothing was changed: the first answer was fine and was not used.
      expect(pointsOf(moduleId).every((point) => point.source === undefined)).toBe(true);
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.pressure.bar" }] }, owner)).rejects.toThrow(/Line pressure: Give the top of the range/);
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.tank.level.percent", range: 5 }] }, owner)).rejects.toThrow(/how tall the tank is/);
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "energy.grid.import.kw", range: 5 }] }, owner)).rejects.toThrow(/has no reading called/);
      await expect(setup.setRanges(moduleId, { ranges: [] }, owner)).rejects.toThrow(/at least one transmitter/);
      await expect(setup.setRanges(moduleId, undefined, owner)).rejects.toThrow(/at least one transmitter/);
    });

    it("is not offered for equipment Greecon does not know, nor to people who may not manage devices, nor for another account's device", async () => {
      const { site, moduleId } = await hotelWithModule();
      const stranger = await platform.createDevice({ siteId: site.id, name: "Pressure logger", deviceType: "analog_io_module", protocol: "modbus", driverType: "modbus-tcp" }, owner);
      await expect(setup.setRanges(stranger.id, { ranges: [{ canonicalName: "water.pressure.bar", range: 10 }] }, owner)).rejects.toThrow(/does not know this equipment's transmitters/);
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.pressure.bar", range: 10 }] }, { ...owner, role: "viewer" })).rejects.toBeInstanceOf(ForbiddenException);
      const intruder: Principal = { ...owner, tenantId: "11111111-1111-4111-8111-111111111111", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" };
      await expect(setup.setRanges(moduleId, { ranges: [{ canonicalName: "water.pressure.bar", range: 10 }] }, intruder)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("the papers and the electrician", () => {
    it("must say who and when, because the paper is somewhere else and this is the only record of it", async () => {
      const { site } = await hotel();
      await expect(setup.confirmStep(site.id, "paperwork", undefined, owner)).rejects.toThrow(/Write who signed for the customer/);
      await expect(setup.confirmStep(site.id, "paperwork", "  ok ", owner)).rejects.toBeInstanceOf(BadRequestException);
      await expect(setup.confirmStep(site.id, "electrician", "", owner)).rejects.toThrow(/electrician's name and licence number/);

      const view = await setup.confirmStep(site.id, "paperwork", "Signed for the hotel by Besa Krasniqi on 19 October", owner);
      expect(view.steps.find((step) => step.key === "paperwork")).toMatchObject({ status: "done", note: "Signed for the hotel by Besa Krasniqi on 19 October", confirmedBy: owner.email });
      const again = await setup.confirmStep(site.id, "electrician", "Arben Hoxha, licence E-1234", owner);
      expect(again.steps.find((step) => step.key === "electrician")?.status).toBe("done");
    });

    it("can be taken back, like any other step", async () => {
      const { site } = await hotel();
      await setup.confirmStep(site.id, "paperwork", "Signed by Besa on 19 October", owner);
      const view = await setup.reopenStep(site.id, "paperwork", owner);
      expect(view.steps.find((step) => step.key === "paperwork")?.status).toBe("todo");
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
      expect(platform.listDevices(owner, site.id)).toHaveLength(4);
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
