import { beforeEach, describe, expect, it, vi } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { DEMO_OWNER, minutes, onboardClient, provisionSite, sendReadings } from "./test-support";

describe("alerts follow the facts", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const alertsFor = (siteId: string) => platform.listAlerts(client, siteId);
  const tankSite = () => provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);

  it("opens an alert when a tank goes critical, and not before", async () => {
    const provisioned = await tankSite();

    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 60 }]);
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    const [alert] = alertsFor(provisioned.site.id);
    expect(alert).toMatchObject({ category: "water_tank_critical", severity: "critical", status: "open", title: "Tank level is critical" });
    expect(alert?.suggestedAction).toContain("refill");
    expect(platform.overview(client).activeAlerts.map((item) => item.id)).toContain(alert?.id);
  });

  it("keeps one alert for as long as the condition lasts", async () => {
    const provisioned = await tankSite();
    for (const value of [5, 4, 6, 3, 5]) {
      await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value }]);
    }
    expect(alertsFor(provisioned.site.id)).toHaveLength(1);
  });

  it("clears the alert by itself when the tank recovers", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 70 }]);

    const [alert] = alertsFor(provisioned.site.id);
    expect(alert?.status).toBe("resolved");
    expect(alert?.resolvedAtUtc).toBeDefined();
    expect(platform.overview(client).activeAlerts).toEqual([]);
  });

  it("does not hide a condition just because someone acknowledged it", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    const [alert] = alertsFor(provisioned.site.id);
    await platform.acknowledgeAlert(alert?.id as string, client);

    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 4 }]);
    expect(alertsFor(provisioned.site.id)).toHaveLength(1);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("acknowledged");

    // Once it clears it clears, acknowledged or not.
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 80 }]);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("resolved");
  });

  it("gives the database the time of an acknowledgement rather than letting it stamp its own, so that every clock the alert's messages use is the platform's", async () => {
    const database = new DatabaseService();
    platform = new PlatformService(database);
    client = await onboardClient(platform);
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    const [alert] = alertsFor(provisioned.site.id);

    const queries: Array<{ text: string; params: unknown[] }> = [];
    vi.spyOn(database, "isConfigured").mockReturnValue(true);
    vi.spyOn(database, "query").mockImplementation(async (text: string, params: unknown[] = []) => {
      queries.push({ text, params });
      return { rows: [], rowCount: 0 } as never;
    });
    const acknowledged = await platform.acknowledgeAlert(alert?.id as string, client);

    // After a restart the time comes back from the database; stamped there, it is on another machine's clock than the one the
    // messages' timing is kept on, and an acknowledgement a few seconds "ahead" can start a second round of messages.
    const update = queries.find((query) => query.text.includes("UPDATE alerts SET status"));
    expect(update?.text).not.toContain("now()");
    expect(update?.params.some((param) => param instanceof Date && param.toISOString() === acknowledged.acknowledgedAtUtc)).toBe(true);
  });

  it("re-opens the same alert, rather than raising a new one, when a level hovers around its limit", async () => {
    const provisioned = await tankSite();
    for (const value of [5, 40, 5, 40, 5]) {
      await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value }]);
    }
    const critical = alertsFor(provisioned.site.id).filter((alert) => alert.category === "water_tank_critical");
    expect(critical).toHaveLength(1);
    expect(critical[0]?.status).toBe("open");
  });

  it("moves from a low-tank alert to a critical one as the level falls, never showing both", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 30 }]);
    expect(alertsFor(provisioned.site.id).filter((alert) => alert.status === "open").map((alert) => alert.category)).toEqual(["water_tank_low"]);

    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 8 }]);
    expect(alertsFor(provisioned.site.id).filter((alert) => alert.status === "open").map((alert) => alert.category)).toEqual(["water_tank_critical"]);
  });

  it("tells people when a site's readings have stopped, and clears it when they resume", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 60 }]);
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    await platform.refreshAllDerivedStates(Date.now() + minutes(20));
    const [alert] = alertsFor(provisioned.site.id);
    expect(alert).toMatchObject({ category: "communication_degraded", severity: "warning", status: "open" });

    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 61 }]);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("resolved");
  });

  it("does not alert on ordinary operation, such as soil that now needs irrigating", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "agri.soil.moisture.percent", unit: "%" }]);
    await sendReadings(platform, client, provisioned, [{ name: "agri.soil.moisture.percent", value: 10 }]);
    expect(alertsFor(provisioned.site.id)).toEqual([]);
  });

  it("tells the grower when frost reaches their own limit, and says nothing about frost until they have set one", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "agri.air.temperature.c", unit: "C" }]);
    const air = provisioned.pointIds["agri.air.temperature.c"] as string;

    // -3.5 C at the field, and no frost limit: the platform says nothing, as with irrigation.
    await sendReadings(platform, client, provisioned, [{ name: "agri.air.temperature.c", value: -3.5 }]);
    expect(platform.listDerivedStates(client, provisioned.site.id).map((state) => state.stateKey)).not.toContain("agri.frost_risk");
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    // The grower's own limit is entered: frost is now true at once, but nobody is woken for a single sample.
    await platform.updatePoint(air, { thresholdConfig: { frost_below: 1 } }, client);
    await sendReadings(platform, client, provisioned, [{ name: "agri.air.temperature.c", value: -3.5 }]);
    expect(platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "agri.frost_risk")?.stateValue).toBe(true);
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    // Three minutes later it is still frost: an Act now alert, in words that say what to do.
    await platform.refreshAllDerivedStates(Date.now() + 3 * 60_000);
    const [alert] = alertsFor(provisioned.site.id);
    expect(alert).toMatchObject({ category: "frost_risk", severity: "critical", status: "open" });
    expect(alert?.suggestedAction).toContain("Protect the crop");

    // And it clears itself when the air warms.
    await sendReadings(platform, client, provisioned, [{ name: "agri.air.temperature.c", value: 6.2 }]);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("resolved");

    // A frost limit that cannot be right is refused.
    await expect(platform.updatePoint(air, { thresholdConfig: { frost_below: 99 } }, client)).rejects.toThrow(/between -30 and 15/);
  });

  it("calls a grid meter fitted the wrong way round only once energy has gone out of a dark plant for five minutes", async () => {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "energy.grid.export.kw", unit: "kW" },
      { canonicalName: "energy.solar.power.kw", unit: "kW" }
    ]);
    // Power readings go out of date after five minutes by default; these are allowed to stand for an hour, so that the test can let six minutes pass.
    for (const id of Object.values(provisioned.pointIds)) await platform.updatePoint(id as string, { thresholdConfig: { max_age_seconds: 3600 } }, client);
    const night = [
      { name: "energy.grid.export.kw" as const, value: 0.5 },
      { name: "energy.solar.power.kw" as const, value: 0 }
    ];
    await sendReadings(platform, client, provisioned, night);
    expect(platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "energy.grid.direction_suspect")?.stateValue).toBe(true);
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    // The next readings, six minutes on, say the same: a Check today alert that says what to do and why it matters.
    await sendReadings(platform, client, provisioned, night);
    await platform.refreshAllDerivedStates(Date.now() + 6 * 60_000);
    const [alert] = alertsFor(provisioned.site.id);
    expect(alert).toMatchObject({ category: "grid_direction_suspect", severity: "warning", status: "open", title: "The grid meter may be fitted the wrong way round" });
    expect(alert?.suggestedAction).toContain("turn the meter's current clamps round");

    // Turned the right way round (import at night), the suspicion and the alert go.
    await sendReadings(platform, client, provisioned, [
      { name: "energy.grid.export.kw", value: 0 },
      { name: "energy.solar.power.kw", value: 0 }
    ]);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("resolved");
  });

  it("does not call the grid meter backwards in the day, when the sun explains the export", async () => {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "energy.grid.export.kw", unit: "kW" },
      { canonicalName: "energy.solar.power.kw", unit: "kW" }
    ]);
    for (const id of Object.values(provisioned.pointIds)) await platform.updatePoint(id as string, { thresholdConfig: { max_age_seconds: 3600 } }, client);
    await sendReadings(platform, client, provisioned, [
      { name: "energy.grid.export.kw", value: 3 },
      { name: "energy.solar.power.kw", value: 7.2 }
    ]);
    await platform.refreshAllDerivedStates(Date.now() + 10 * 60_000);
    expect(alertsFor(provisioned.site.id)).toEqual([]);
  });

  it("leaves the demo tenant's own example alerts alone, and keeps tenants apart", async () => {
    const before = platform.listAlerts(DEMO_OWNER).map((alert) => `${alert.id}:${alert.status}`);
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    await platform.refreshAllDerivedStates(Date.now() + minutes(60));

    expect(platform.listAlerts(DEMO_OWNER).map((alert) => `${alert.id}:${alert.status}`)).toEqual(before);
    expect(platform.listAlerts(client).every((alert) => alert.tenantId === client.tenantId)).toBe(true);
  });

  it("waits for a pump's start-up before telling anyone it is running dry, then does", async () => {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.flow.lpm", unit: "lpm" },
      { canonicalName: "water.pump.status", unit: "state" }
    ]);
    const justStarted = [
      { name: "water.flow.lpm" as const, value: 0 },
      { name: "water.pump.status" as const, value: 1 }
    ];
    await sendReadings(platform, client, provisioned, justStarted);

    // The pump is running with no flow, but it has only just started: the state is true, nobody is paged.
    expect(platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "water.pump.dry_run_risk")?.stateValue).toBe(true);
    expect(alertsFor(provisioned.site.id)).toEqual([]);

    // Forty seconds later it is still running with no flow.
    await platform.refreshAllDerivedStates(Date.now() + 40_000);
    expect(alertsFor(provisioned.site.id)[0]).toMatchObject({ category: "pump_dry_run_risk", severity: "critical", status: "open" });

    // And it clears when flow returns.
    await sendReadings(platform, client, provisioned, [
      { name: "water.flow.lpm", value: 14 },
      { name: "water.pump.status", value: 1 }
    ]);
    expect(alertsFor(provisioned.site.id)[0]?.status).toBe("resolved");
  });

  it("tracks how long a state has held, restarting the clock when its value changes", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    const first = platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "water.tank.critical");

    await platform.refreshAllDerivedStates(Date.now() + 60_000);
    const later = platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "water.tank.critical");
    expect(later?.createdAtUtc).toBe(first?.createdAtUtc);
    expect(later?.updatedAtUtc).not.toBe(first?.updatedAtUtc);
  });

  it("keeps a critical alert open when the readings go quiet: no news is not good news", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    expect(alertsFor(provisioned.site.id).filter((alert) => alert.status === "open").map((alert) => alert.category)).toEqual(["water_tank_critical"]);

    // The gateway goes quiet. The level is no longer known, so the tank alert must NOT quietly resolve.
    await platform.refreshAllDerivedStates(Date.now() + minutes(30));
    const byCategory = (category: string) => alertsFor(provisioned.site.id).find((alert) => alert.category === category);
    expect(byCategory("water_tank_critical")?.status).toBe("open");
    expect(byCategory("communication_degraded")?.status).toBe("open");

    // A fresh reading showing recovery is what clears it.
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 80 }]);
    expect(byCategory("water_tank_critical")?.status).toBe("resolved");
    expect(byCategory("communication_degraded")?.status).toBe("resolved");
  });
});
