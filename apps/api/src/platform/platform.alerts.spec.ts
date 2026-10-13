import { beforeEach, describe, expect, it } from "vitest";
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

  it("leaves the demo tenant's own example alerts alone, and keeps tenants apart", async () => {
    const before = platform.listAlerts(DEMO_OWNER).map((alert) => `${alert.id}:${alert.status}`);
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    await platform.refreshAllDerivedStates(Date.now() + minutes(60));

    expect(platform.listAlerts(DEMO_OWNER).map((alert) => `${alert.id}:${alert.status}`)).toEqual(before);
    expect(platform.listAlerts(client).every((alert) => alert.tenantId === client.tenantId)).toBe(true);
  });
});
