import { beforeEach, describe, expect, it } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { minutes, onboardClient, PLATFORM_ADMIN, provisionSite, sendReadings } from "./test-support";

// The energy picture is built from what a site's readings say, per site, and only for that site's
// own tenant. It must never show an old reading as still flowing.
describe("the energy flow of a site", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const energySite = () =>
    provisionSite(platform, client, [
      { canonicalName: "energy.solar.power.kw", unit: "kW" },
      { canonicalName: "energy.consumption.kw", unit: "kW" },
      { canonicalName: "energy.grid.import.kw", unit: "kW" },
      { canonicalName: "energy.grid.export.kw", unit: "kW" }
    ]);

  const reading = (name: "energy.solar.power.kw" | "energy.consumption.kw" | "energy.grid.import.kw" | "energy.grid.export.kw", value: number, extra: Record<string, unknown> = {}) => ({
    name,
    value,
    unit: "kW",
    ...extra
  });

  it("says where the energy is going, from the site's own latest readings", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, [
      reading("energy.solar.power.kw", 18.6),
      reading("energy.consumption.kw", 12),
      reading("energy.grid.import.kw", 0),
      reading("energy.grid.export.kw", 6.6)
    ]);

    const flow = platform.siteDetail(provisioned.site.id, client).energyFlow;
    expect(flow.headline).toBe("Exporting 6.6 kW to the grid.");
    expect(flow.state).toBe("live");
    expect(flow.links.solar).toMatchObject({ direction: "to_hub", kw: 18.6 });
    expect(flow.simulated).toBe(false);
  });

  it("appears on the Overview for each site that measures energy, and not for sites that do not", async () => {
    const withEnergy = await energySite();
    await sendReadings(platform, client, withEnergy, [reading("energy.solar.power.kw", 4), reading("energy.grid.import.kw", 1), reading("energy.grid.export.kw", 0)]);
    await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);

    const energy = platform.overview(client).energy;
    expect(energy.map((entry) => entry.siteId)).toEqual([withEnergy.site.id]);
    expect(energy[0]?.flow.hasEnergy).toBe(true);
  });

  it("never shows an old reading as still flowing: once the readings go quiet the flow is not known", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, [
      reading("energy.solar.power.kw", 18.6),
      reading("energy.consumption.kw", 12),
      reading("energy.grid.import.kw", 0),
      reading("energy.grid.export.kw", 6.6)
    ]);

    const later = Date.now() + minutes(30);
    const flow = platform.siteDetail(provisioned.site.id, client, later).energyFlow;

    expect(flow.state).toBe("unknown");
    expect(flow.headline).toBe("Energy flow is not known right now.");
    expect(flow.links.solar.kw).toBeUndefined();
    expect(platform.overview(client, later).energy[0]?.flow.state).toBe("unknown");
  });

  it("marks the flow simulated when the readings come from a simulator, which never goes out of date", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, [reading("energy.solar.power.kw", 5, { source: "simulator" }), reading("energy.grid.import.kw", 0, { source: "simulator" }), reading("energy.grid.export.kw", 5, { source: "simulator" })]);

    const flow = platform.siteDetail(provisioned.site.id, client, Date.now() + minutes(600)).energyFlow;
    expect(flow.simulated).toBe(true);
    expect(flow.state).toBe("live");
  });

  it("belongs to the tenant: another client's Overview has no energy from this one", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, [reading("energy.solar.power.kw", 18.6)]);
    const other = await onboardClientTwo(platform);

    expect(platform.overview(other).energy).toEqual([]);
    expect(platform.overview(client).energy).toHaveLength(1);
  });
});

async function onboardClientTwo(platform: PlatformService): Promise<Principal> {
  const { tenant, owner } = await platform.createTenant(
    { name: "Second Client", domain: "second-client.example", ownerName: "Second Owner", ownerEmail: "owner@second-client.example" },
    PLATFORM_ADMIN
  );
  return { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false };
}
