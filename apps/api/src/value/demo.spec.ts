import { describe, expect, it } from "vitest";
import { DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "../platform/platform.service";
import { DEMO_OWNER } from "../platform/test-support";
import { demoHistory, demoProfiles, demoValue, DEMO_FARM_SITE, DEMO_FEED_PRINCIPAL, DEMO_WATER_SITE, offsetFor } from "./demo";
import { DemoFeedService } from "./demo-feed";
import { EnergyLedger, MemoryBucketStore } from "./energy-ledger";

const SUMMER = Date.parse("2026-07-14T00:00:00Z");
const minutes = (count: number) => count * 60_000;

describe("the demo's numbers", () => {
  it("are the same every time for the same moment", () => {
    const at = SUMMER + minutes(13 * 60 + 7);
    const offset = offsetFor(at);
    expect(demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", at, offset)).toBe(demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", at, offset));
  });

  it("add up: what the farm makes plus what it imports is what it uses plus what it exports", () => {
    for (let step = 0; step < 3 * 24 * 8; step += 1) {
      const at = SUMMER + minutes(step * 7);
      const offset = offsetFor(at);
      const solar = demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", at, offset) as number;
      const used = demoValue(DEMO_FARM_SITE, "energy.consumption.kw", at, offset) as number;
      const imported = demoValue(DEMO_FARM_SITE, "energy.grid.import.kw", at, offset) as number;
      const exported = demoValue(DEMO_FARM_SITE, "energy.grid.export.kw", at, offset) as number;
      expect(Math.abs(solar + imported - exported - used)).toBeLessThan(0.011);
      // Never importing and exporting in the same breath.
      expect(imported === 0 || exported === 0).toBe(true);
    }
  });

  it("have no sun at night and a believable plant at noon", () => {
    const night = SUMMER + minutes(2 * 60); // 04:00 local in summer
    const noon = SUMMER + minutes(10 * 60); // 12:00 local
    expect(demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", night, offsetFor(night))).toBe(0);
    const solar = demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", noon, offsetFor(noon)) as number;
    expect(solar).toBeGreaterThan(8);
    expect(solar).toBeLessThan(26);
  });

  it("keep the demo's two attention items in place: a tank just above its warning level, soil under the irrigation limit", () => {
    for (let step = 0; step < 200; step += 1) {
      const at = SUMMER + minutes(step * 11);
      const offset = offsetFor(at);
      const tank = demoValue(DEMO_WATER_SITE, "water.tank.level.percent", at, offset) as number;
      const soil = demoValue(DEMO_FARM_SITE, "agri.soil.moisture.percent", at, offset) as number;
      expect(tank).toBeGreaterThan(35);
      expect(tank).toBeLessThan(40);
      expect(soil).toBeLessThan(28);
    }
  });

  it("say nothing for a point the demo does not drive", () => {
    expect(demoValue(DEMO_FARM_SITE, "water.tank.level.percent", SUMMER, 0)).toBeUndefined();
  });
});

describe("the demo's history", () => {
  const history = demoHistory(SUMMER + minutes(5 * 60 + 20));

  it("is a full hour for every point for thirty days, and ends at the last whole hour", () => {
    expect(history).toHaveLength(30 * 24 * 5);
    expect(history.every((delta) => delta.coveredSeconds === 3600)).toBe(true);
    expect(Math.max(...history.map((delta) => delta.hourStartMs))).toBe(Date.parse("2026-07-14T04:00:00Z"));
  });

  it("balances in energy as well as in power", () => {
    const sum = (name: string) => history.filter((delta) => delta.canonicalName === name).reduce((total, delta) => total + delta.amount, 0);
    const solar = sum("energy.solar.power.kw");
    const balance = solar + sum("energy.grid.import.kw") - sum("energy.grid.export.kw") - sum("energy.consumption.kw");
    expect(solar).toBeGreaterThan(1500);
    expect(Math.abs(balance)).toBeLessThan(solar * 0.02);
  });

  it("gives the farm prices and a baseline the demo can honestly compare with, labelled as demo values", () => {
    const [farm, water] = demoProfiles(history, SUMMER);
    expect(farm).toMatchObject({ siteId: DEMO_FARM_SITE, currency: "EUR", importPricePerKwh: 0.15, exportPricePerKwh: 0.06 });
    expect(farm?.baselineMonthlyImportKwh).toBeGreaterThan(0);
    expect(farm?.baselineNote).toContain("Demo values");
    expect(water).toMatchObject({ siteId: DEMO_WATER_SITE, waterPricePerM3: 1.2 });
    expect(water?.baselineMonthlyWaterM3).toBeGreaterThan(0);
  });
});

describe("the demo tenant when the platform starts and while it runs", () => {
  async function started(): Promise<{ platform: PlatformService; feed: DemoFeedService }> {
    const platform = new PlatformService(new DatabaseService());
    await platform.onModuleInit();
    return { platform, feed: new DemoFeedService(platform) };
  }

  it("starts with a month of value to look at, in simulated terms, and a comparison that is allowed because the readings are complete", async () => {
    const { platform } = await started();
    const value = await platform.siteValue(DEMO_FARM_SITE, "last30", DEMO_OWNER);

    expect(value.simulated).toBe(true);
    expect(value.energy?.producedKwh).toBeGreaterThan(1500);
    expect(value.energy?.avoidedPurchase).toBeGreaterThan(0);
    expect(value.coverage.ofPeriod).toBeGreaterThan(0.95);
    expect(value.comparison?.energy).toMatchObject({ available: true });
    expect(value.missing).toEqual([]);
  });

  it("is written only once: starting again does not double the history", async () => {
    const platform = new PlatformService(new DatabaseService());
    await platform.onModuleInit();
    await platform.onModuleInit();
    const value = await platform.siteValue(DEMO_FARM_SITE, "last30", DEMO_OWNER);
    expect(value.energy?.producedKwh).toBeLessThan(8000);
  });

  it("reports what a real site would: current simulated readings that balance, flowing on the screen", async () => {
    const { platform, feed } = await started();
    const now = Date.now();
    await feed.tick(now);

    const farm = platform.overview(DEMO_OWNER).energy.find((entry) => entry.siteId === DEMO_FARM_SITE);
    expect(farm?.flow.state).toBe("live");
    expect(farm?.flow.simulated).toBe(true);
    expect(farm?.flow.notes).toEqual([]);
    const latest = platform.latestTelemetry(DEMO_OWNER, DEMO_FARM_SITE);
    expect(latest.every((reading) => reading.source === "simulator")).toBe(true);
    expect(latest.find((reading) => reading.canonicalName === "energy.solar.power.kw")?.value).toBe(demoValue(DEMO_FARM_SITE, "energy.solar.power.kw", now, offsetFor(now)));
  });

  it("adds what it sends to the site's value while it runs", async () => {
    const { platform, feed } = await started();
    const before = (await platform.siteValue(DEMO_FARM_SITE, "week", DEMO_OWNER)).energy?.consumedKwh as number;
    const end = Date.now();
    // Twenty minutes of the demo, a pass every fifteen seconds.
    for (let t = end - minutes(20); t <= end; t += 15_000) await feed.tick(t);

    const after = (await platform.siteValue(DEMO_FARM_SITE, "week", DEMO_OWNER)).energy?.consumedKwh as number;
    // About 11 kW for a third of an hour: a few kWh more.
    expect(after - before).toBeGreaterThan(2);
    expect(after - before).toBeLessThan(6);
  });

  it("keeps the raw history table out of it when told to, and writes it otherwise", async () => {
    const calls: string[] = [];
    const database = { isConfigured: () => true, query: async (text: string) => (calls.push(text), { rows: [], rowCount: 0 }) } as unknown as DatabaseService;
    const platform = new PlatformService(database, new EnergyLedger(new MemoryBucketStore()));
    const point = platform.listPoints(DEMO_FEED_PRINCIPAL).find((candidate) => candidate.canonicalName === "energy.solar.power.kw");
    const now = new Date().toISOString();
    const message: TelemetryMessage = {
      messageType: "telemetry",
      tenantId: DEMO_TENANT_ID,
      siteId: DEMO_FARM_SITE,
      deviceId: point?.deviceId as string,
      publishedAtUtc: now,
      correlationId: "x",
      readings: [{ timestampUtc: now, tenantId: DEMO_TENANT_ID, siteId: DEMO_FARM_SITE, deviceId: point?.deviceId as string, pointId: point?.id as string, canonicalName: "energy.solar.power.kw", value: 5, unit: "kW", quality: "OK", source: "simulator", ingestionTimestampUtc: now }]
    };

    await platform.ingestTelemetry(message, DEMO_FEED_PRINCIPAL, { persistRaw: false });
    expect(calls.some((text) => text.includes("INSERT INTO telemetry_readings"))).toBe(false);

    await platform.ingestTelemetry(message, DEMO_FEED_PRINCIPAL);
    expect(calls.some((text) => text.includes("INSERT INTO telemetry_readings"))).toBe(true);
  });
});
