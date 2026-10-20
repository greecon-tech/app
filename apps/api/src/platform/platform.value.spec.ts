import { beforeEach, describe, expect, it } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { onboardClient, provisionSite, ReadingSpec, sendReadings } from "./test-support";

// What a site's own readings are worth, at the prices that site entered, never at a price the
// platform made up. The readings go through the same ingestion path a gateway uses.
describe("the value of a site", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const energySite = () =>
    provisionSite(platform, client, [
      { canonicalName: "energy.solar.power.kw", unit: "kW" },
      { canonicalName: "energy.grid.export.kw", unit: "kW" },
      { canonicalName: "energy.grid.import.kw", unit: "kW" },
      { canonicalName: "energy.consumption.kw", unit: "kW" }
    ]);

  /** Constant power on each point, a reading every ten minutes for three hours up to now. */
  const threeHours = (levels: { solar: number; exported: number; imported: number; used: number }): ReadingSpec[] => {
    const specs: ReadingSpec[] = [];
    for (let minutesAgo = 180; minutesAgo >= 0; minutesAgo -= 10) {
      specs.push(
        { name: "energy.solar.power.kw", value: levels.solar, unit: "kW", minutesAgo },
        { name: "energy.grid.export.kw", value: levels.exported, unit: "kW", minutesAgo },
        { name: "energy.grid.import.kw", value: levels.imported, unit: "kW", minutesAgo },
        { name: "energy.consumption.kw", value: levels.used, unit: "kW", minutesAgo }
      );
    }
    return specs;
  };

  it("adds up the readings as they arrive and values what stayed on site at the price the site entered", async () => {
    const provisioned = await energySite();
    await platform.updateSiteProfile(provisioned.site.id, { importPricePerKwh: 0.2, exportPricePerKwh: 0.05 }, client);
    await sendReadings(platform, client, provisioned, threeHours({ solar: 10, exported: 4, imported: 1, used: 7 }));

    const value = await platform.siteValue(provisioned.site.id, "week", client);

    // Three hours at those powers.
    expect(value.energy).toMatchObject({ producedKwh: 30, exportedKwh: 12, importedKwh: 3, consumedKwh: 21, keptOnSiteKwh: 18 });
    expect(value.energy?.avoidedPurchase).toBeCloseTo(3.6, 2);
    expect(value.energy?.exportIncome).toBeCloseTo(0.6, 2);
    expect(value.energy?.boughtCost).toBeCloseTo(0.6, 2);
    expect(value.simulated).toBe(false);
    expect(value.missing).toEqual([]);
  });

  it("shows quantities, and asks for a price, when the site has not entered one", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, threeHours({ solar: 10, exported: 4, imported: 1, used: 7 }));

    const value = await platform.siteValue(provisioned.site.id, "week", client);

    expect(value.energy?.keptOnSiteKwh).toBe(18);
    expect(value.energy?.avoidedPurchase).toBeUndefined();
    expect(value.missing.map((item) => item.what)).toEqual(["Electricity price"]);
  });

  it("does not count a reading twice when it is sent twice, or a late one that is older than what it already has", async () => {
    const provisioned = await energySite();
    const readings = threeHours({ solar: 10, exported: 4, imported: 1, used: 7 });
    await sendReadings(platform, client, provisioned, readings);
    await sendReadings(platform, client, provisioned, readings);
    await sendReadings(platform, client, provisioned, [{ name: "energy.solar.power.kw", value: 999, unit: "kW", minutesAgo: 90 }]);

    const value = await platform.siteValue(provisioned.site.id, "week", client);
    expect(value.energy?.producedKwh).toBe(30);
  });

  it("does not bridge a silence: a three hour outage counts as missing coverage, not as an estimate", async () => {
    const provisioned = await energySite();
    // Readings for the first hour and the last hour, nothing in between.
    const specs = threeHours({ solar: 10, exported: 4, imported: 1, used: 7 }).filter((spec) => (spec.minutesAgo ?? 0) >= 120 || (spec.minutesAgo ?? 0) <= 60);
    await sendReadings(platform, client, provisioned, specs);

    const value = await platform.siteValue(provisioned.site.id, "week", client);

    // Two hours counted of the three the readings span; the hour of silence is not counted.
    expect(value.energy?.producedKwh).toBe(20);
    expect(value.coverage.sinceDataStart).toBeLessThan(0.7);
  });

  it("reports water pumped from flow readings", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.flow.lpm", unit: "lpm" }]);
    const specs: ReadingSpec[] = [];
    for (let minutesAgo = 60; minutesAgo >= 0; minutesAgo -= 10) specs.push({ name: "water.flow.lpm", value: 50, unit: "lpm", minutesAgo });
    await sendReadings(platform, client, provisioned, specs);
    await platform.updateSiteProfile(provisioned.site.id, { waterPricePerM3: 1.5 }, client);

    const value = await platform.siteValue(provisioned.site.id, "week", client);
    // 50 litres a minute for an hour is 3000 litres, 3 cubic metres.
    expect(value.water).toEqual({ pumpedM3: 3, cost: 4.5 });
  });

  it("marks the value simulated when every reading behind it is from a simulator", async () => {
    const provisioned = await energySite();
    await sendReadings(
      platform,
      client,
      provisioned,
      threeHours({ solar: 10, exported: 4, imported: 1, used: 7 }).map((spec) => ({ ...spec, source: "simulator" as const }))
    );
    expect((await platform.siteValue(provisioned.site.id, "week", client)).simulated).toBe(true);
  });

  it("summarises the sites that measure energy or water, and leaves out the rest", async () => {
    const provisioned = await energySite();
    await sendReadings(platform, client, provisioned, threeHours({ solar: 10, exported: 4, imported: 1, used: 7 }));
    await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);

    const summary = await platform.valueSummary(client);
    expect(summary.map((entry) => entry.siteId)).toEqual([provisioned.site.id]);
    expect(summary[0]?.value.period.key).toBe("month");
  });

  it("refuses a period it does not know", async () => {
    const provisioned = await energySite();
    await expect(platform.siteValue(provisioned.site.id, "decade" as never, client)).rejects.toThrow(/Period must be one of/);
  });
});

describe("a site's prices and baseline", () => {
  let platform: PlatformService;
  let owner: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    owner = await onboardClient(platform);
  });

  const site = async () => (await provisionSite(platform, owner, [{ canonicalName: "energy.solar.power.kw", unit: "kW" }])).site;

  it("has no prices until the site enters them, and says so rather than assuming", async () => {
    const created = await site();
    const profile = platform.siteProfile(created.id, owner);
    expect(profile).toMatchObject({ siteId: created.id, currency: "EUR", timezone: "Europe/Tirane", zeroExport: false });
    expect(profile.importPricePerKwh).toBeUndefined();
  });

  it("stores what the site enters, leaves out fields alone, clears with null, and records who changed what", async () => {
    const created = await site();
    await platform.updateSiteProfile(created.id, { importPricePerKwh: 0.18, baselineMonthlyImportKwh: 900, currency: "ALL" }, owner);
    const afterSecond = await platform.updateSiteProfile(created.id, { exportPricePerKwh: 0.05 }, owner);

    expect(afterSecond).toMatchObject({ importPricePerKwh: 0.18, exportPricePerKwh: 0.05, baselineMonthlyImportKwh: 900, currency: "ALL", updatedByUserId: owner.userId });

    const cleared = await platform.updateSiteProfile(created.id, { importPricePerKwh: null }, owner);
    expect(cleared.importPricePerKwh).toBeUndefined();
    expect(cleared.exportPricePerKwh).toBe(0.05);

    const audit = platform.listAudit(owner, created.id).filter((event) => event.eventType === "site.profile_updated");
    expect(audit).toHaveLength(3);
    expect(audit[0]?.beforeMetadata).toMatchObject({ importPricePerKwh: 0.18 });
    expect(audit[0]?.afterMetadata).toMatchObject({ importPricePerKwh: null });
  });

  it("refuses values that cannot be right, and says what is wrong", async () => {
    const created = await site();
    const refused = (input: Parameters<PlatformService["updateSiteProfile"]>[1]) => platform.updateSiteProfile(created.id, input, owner);

    await expect(refused({ timezone: "Mars/Olympus" })).rejects.toThrow(/not a time zone/);
    await expect(refused({ importPricePerKwh: -1 })).rejects.toThrow(/electricity price must be a number from 0 to 1000/);
    await expect(refused({ waterPricePerM3: Number.NaN })).rejects.toThrow(/water price/);
    await expect(refused({ baselineMonthlyImportKwh: 1e12 })).rejects.toThrow(/baseline for electricity/);
    await expect(refused({ baselineNote: "x".repeat(501) })).rejects.toThrow(/500 characters/);
    expect(platform.siteProfile(created.id, owner).importPricePerKwh).toBeUndefined();
  });

  it("is for owners and admins: an operator or viewer cannot change a price", async () => {
    const created = await site();
    for (const role of ["operator", "viewer", "auditor"] as const) {
      await expect(platform.updateSiteProfile(created.id, { importPricePerKwh: 0.01 }, { ...owner, role })).rejects.toThrow(/blocked by access policy/);
    }
    await expect(platform.updateSiteProfile(created.id, { importPricePerKwh: 0.3 }, { ...owner, role: "admin" })).resolves.toMatchObject({ importPricePerKwh: 0.3 });
  });

  it("uses the site's own time zone for today and this month", async () => {
    const created = await site();
    await platform.updateSiteProfile(created.id, { timezone: "America/New_York" }, owner);
    const value = await platform.siteValue(created.id, "day", owner, Date.parse("2026-07-14T13:30:00Z"));
    // 09:30 in New York on 14 July: the day began at 04:00 UTC.
    expect(value.period.fromUtc).toBe("2026-07-14T04:00:00.000Z");
  });
});
