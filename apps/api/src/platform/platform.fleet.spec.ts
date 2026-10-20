import { beforeEach, describe, expect, it } from "vitest";
import { GREECON_DOMAIN, GatewayHeartbeat } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { digestEmail } from "../notifications/messages";
import { PlatformService } from "./platform.service";
import { PLATFORM_ADMIN, ProvisionedSite, minutes, provisionSite, sendReadings } from "./test-support";

// Greecon's team has to learn that a box has gone quiet before the customer does. The fleet is every
// customer's sites in one list, worst first, and Greecon's own account is told it each morning in the
// same way a customer is told theirs.

const NOW = Date.parse("2026-10-19T09:00:00Z");
const heartbeat = (devices: GatewayHeartbeat["devices"] = []): GatewayHeartbeat => ({ agentVersion: "1.2.3", uptimeSeconds: 600, sentAtUtc: new Date(NOW).toISOString(), bufferDepth: 0, configVersion: "c1", devices });

describe("every customer's sites, at once", () => {
  let platform: PlatformService;
  const hotel = { name: "Hotel Adriatik" };
  let owner: Principal;
  let provisioned: ProvisionedSite;
  let gatewayId: string;

  async function onboard(name: string, email: string): Promise<Principal> {
    const { tenant, owner: created } = await platform.createTenant({ name, ownerName: "Owner", ownerEmail: email }, PLATFORM_ADMIN);
    return { tenantId: tenant.id, userId: created.id, role: "owner", email: created.email, isPlatformAdmin: false };
  }

  /** A site with a box that has enrolled and reported once, readings arriving, and whether it has been commissioned. */
  async function liveSite(commissioned: boolean) {
    provisioned = await provisionSite(platform, owner, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    const box = await platform.provisionGateway({ siteId: provisioned.site.id, name: "Plant room" }, owner);
    gatewayId = box.id;
    await platform.completeGatewayEnrolment(box.id, owner.tenantId, owner.userId, NOW);
    await platform.recordGatewayHeartbeat(box.id, owner.tenantId, heartbeat(), NOW);
    await sendReadings(platform, owner, provisioned, [{ name: "water.tank.level.percent", value: 62 }]);
    if (commissioned) await platform.setSetupConfirmation(provisioned.site.id, "commissioned", { atUtc: new Date(NOW - 12 * 86_400_000).toISOString(), by: "pm@greecon.earth" }, owner);
  }

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    owner = await onboard(hotel.name, "besa@hotel-adriatik.example");
  });

  it("is only for Greecon's team", () => {
    expect(() => platform.fleet(owner)).toThrow(/platform-administrator/);
    expect(() => platform.fleet({ ...PLATFORM_ADMIN, support: true })).toThrow(/platform-administrator/);
  });

  it("leaves out the demo account, which is simulated, and Greecon's own, which has no sites", async () => {
    await liveSite(true);
    await platform.createTenant({ name: "Greecon", domain: GREECON_DOMAIN, ownerName: "Founder", ownerEmail: "founder@greecon.earth" }, PLATFORM_ADMIN);
    const rows = platform.fleet(PLATFORM_ADMIN, NOW);
    expect(rows.map((row) => row.client)).toEqual(["Hotel Adriatik"]);
  });

  it("shows a live site whose box is reporting as stable, with the box and its readings", async () => {
    await liveSite(true);
    const [row] = platform.fleet(PLATFORM_ADMIN, NOW);
    expect(row).toMatchObject({ client: "Hotel Adriatik", state: "stable", reasons: [], openAlerts: { actNow: 0, checkToday: 0 } });
    expect(row?.box).toMatchObject({ status: "online", name: "Plant room", version: "1.2.3", devicesNotAnswering: 0 });
    expect(row?.commissionedAtUtc).toBe(new Date(NOW - 12 * 86_400_000).toISOString());
    expect(row?.lastReadingAtUtc).toBeDefined();
  });

  it("says in words that a live site's box has gone quiet, and puts that before everything else", async () => {
    await liveSite(true);
    const [row] = platform.fleet(PLATFORM_ADMIN, NOW + minutes(20));
    expect(row?.box.status).toBe("offline");
    expect(row?.state).toBe("attention");
    expect(row?.reasons[0]).toBe("The box has not reported for 20 minutes: it is offline. Check its power and its network.");
  });

  it("says when a box that is reporting cannot reach one of its devices", async () => {
    await liveSite(true);
    const device = platform.listDevices(owner)[0];
    await platform.updateDevice(device?.id as string, { gatewayId }, owner);
    await platform.recordGatewayHeartbeat(gatewayId, owner.tenantId, heartbeat([{ deviceId: device?.id as string, ok: false, readingsOk: 0, readingsFailed: 1, lastError: "no answer" }]), NOW);
    const [row] = platform.fleet(PLATFORM_ADMIN, NOW);
    expect(row?.box.devicesNotAnswering).toBe(1);
    expect(row?.reasons).toContain("A device does not answer the box.");
    expect(row?.state).toBe("attention");
  });

  it("does not complain about the box of a site that is still being set up", async () => {
    await liveSite(false);
    const [row] = platform.fleet(PLATFORM_ADMIN, NOW + minutes(20));
    expect(row?.box.status).toBe("offline");
    expect(row?.commissionedAtUtc).toBeUndefined();
    expect(row?.reasons.join(" ")).not.toContain("The box has not reported");
  });

  it("distinguishes a site with no box, a box not yet installed, and one installed that has never reported", async () => {
    await liveSite(true);
    const bare = await platform.createSite({ name: "Annex", type: "integrated_site", locationName: "x" }, owner);
    await platform.provisionGateway({ siteId: bare.id, name: "Annex box" }, owner);
    const second = await platform.createSite({ name: "Villa", type: "integrated_site", locationName: "x" }, owner);
    const neverBox = await platform.provisionGateway({ siteId: second.id, name: "Villa box" }, owner);
    await platform.completeGatewayEnrolment(neverBox.id, owner.tenantId, owner.userId, NOW);
    await platform.createSite({ name: "Chalet", type: "integrated_site", locationName: "x" }, owner);

    const byName = Object.fromEntries(platform.fleet(PLATFORM_ADMIN, NOW).map((row) => [row.site, row.box.status]));
    expect(byName).toMatchObject({ Annex: "waiting", Villa: "never", Chalet: "none" });
  });

  it("puts what needs doing first: action, then attention, then stable", async () => {
    await liveSite(true);
    const other = await onboard("Agro Vjosa", "owner@vjosa.example");
    const farm = await provisionSite(platform, other, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    await sendReadings(platform, other, farm, [{ name: "water.tank.level.percent", value: 3 }]);
    await platform.setSetupConfirmation(farm.site.id, "commissioned", { atUtc: new Date(NOW).toISOString(), by: "pm@greecon.earth" }, other);

    const rows = platform.fleet(PLATFORM_ADMIN);
    expect(rows[0]).toMatchObject({ client: "Agro Vjosa", state: "action" });
    expect(rows[0]?.openAlerts.actNow).toBe(1);
  });

  describe("Greecon's own morning message", () => {
    async function greecon(): Promise<string> {
      const { tenant } = await platform.createTenant({ name: "Greecon", domain: GREECON_DOMAIN, ownerName: "Founder", ownerEmail: "founder@greecon.earth" }, PLATFORM_ADMIN);
      return tenant.id;
    }

    it("is the fleet: each live site by client and site, with its day since commissioning", async () => {
      await liveSite(true);
      const facts = platform.digestOf(await greecon(), NOW);
      expect(facts.customer).toBe("Greecon");
      expect(facts.sites).toHaveLength(1);
      expect(facts.sites[0]).toMatchObject({ name: "Hotel Adriatik: " + provisioned.site.name + " (day 13)", state: "stable" });
    });

    it("names a silent box in the message, so the team hears of it before the customer calls", async () => {
      await liveSite(true);
      const later = NOW + minutes(90);
      const message = digestEmail(platform.digestOf(await greecon(), later), later, "Europe/Tirane", "07:30");
      expect(message.subject).toContain("Attention needed. 1 of 1 site needs a look.");
      expect(message.body).toContain("The box has not reported for 1 hour: it is offline.");
    });

    it("mentions sites still being set up, without counting them as problems", async () => {
      await liveSite(false);
      const facts = platform.digestOf(await greecon(), NOW + minutes(20));
      expect(facts.sites).toEqual([]);
      expect(facts.notes).toEqual([`Being set up: Hotel Adriatik: ${provisioned.site.name}.`]);
      const message = digestEmail(facts, NOW, "Europe/Tirane", "07:30");
      expect(message.body).toContain("Being set up: Hotel Adriatik");
      expect(message.subject).toContain("No sites are set up yet.");
    });

    it("is not what a customer is sent: their message is about their own sites alone", async () => {
      await liveSite(true);
      const facts = platform.digestOf(owner.tenantId, NOW);
      expect(facts.customer).toBe("Hotel Adriatik");
      expect(facts.sites.map((site) => site.name)).toEqual([provisioned.site.name]);
    });
  });
});
