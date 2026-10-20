import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { onboardClient, provisionSite, sendReadings } from "./test-support";

// What counts as low, dry or out of date belongs to the site. These specs pin that a site can set it,
// that a mistake is refused instead of silently ignored, and that a change takes effect and is recorded.
describe("a site sets its own limits", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const tankSite = () => provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
  const openAlerts = (siteId: string) => platform.listAlerts(client, siteId).filter((alert) => alert.status !== "resolved").map((alert) => alert.category);

  it("takes effect at once: the state and the alert follow the new limit without waiting for a reading", async () => {
    const provisioned = await tankSite();
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 30 }]);
    expect(openAlerts(provisioned.site.id)).toEqual(["water_tank_low"]); // 30% is below the platform's standard 35%

    await platform.updatePoint(provisioned.pointIds["water.tank.level.percent"] as string, { thresholdConfig: { warning_low: 25 } }, client);
    expect(openAlerts(provisioned.site.id)).toEqual([]);
    expect(platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "water.tank.low")?.stateValue).toBe(false);

    await platform.updatePoint(provisioned.pointIds["water.tank.level.percent"] as string, { thresholdConfig: { warning_low: 50 } }, client);
    expect(openAlerts(provisioned.site.id)).toEqual(["water_tank_low"]);
  });

  it("is what makes irrigation advice possible: none until the field has its own start-at limit", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "agri.soil.moisture.percent", unit: "%" }]);
    await sendReadings(platform, client, provisioned, [{ name: "agri.soil.moisture.percent", value: 20 }]);
    const irrigation = () => platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === "agri.irrigation_required");
    expect(irrigation()).toBeUndefined();

    await platform.updatePoint(provisioned.pointIds["agri.soil.moisture.percent"] as string, { thresholdConfig: { irrigate_below: 24 } }, client);
    expect(irrigation()?.stateValue).toBe(true);
  });

  it("refuses a limit that cannot be set on that reading, instead of ignoring it", async () => {
    const provisioned = await tankSite();
    const pointId = provisioned.pointIds["water.tank.level.percent"] as string;

    await expect(platform.updatePoint(pointId, { thresholdConfig: { irrigate_belw: 20 } }, client)).rejects.toBeInstanceOf(BadRequestException);
    await expect(platform.updatePoint(pointId, { thresholdConfig: { irrigate_below: 20 } }, client)).rejects.toThrow(/not a limit that can be set on Tank level/);
    expect(platform.listPoints(client).find((point) => point.id === pointId)?.thresholdConfig).toBeUndefined();
  });

  it("refuses values that are not numbers or are out of range", async () => {
    const provisioned = await tankSite();
    const pointId = provisioned.pointIds["water.tank.level.percent"] as string;

    await expect(platform.updatePoint(pointId, { thresholdConfig: { warning_low: "low" as unknown as number } }, client)).rejects.toThrow(/must be a number/);
    await expect(platform.updatePoint(pointId, { thresholdConfig: { warning_low: 140 } }, client)).rejects.toThrow(/between 0 and 100/);
    await expect(platform.updatePoint(pointId, { thresholdConfig: { max_age_seconds: 5 } }, client)).rejects.toThrow(/between 30 and 604800/);
  });

  it("refuses a critical level at or above the low level", async () => {
    const provisioned = await tankSite();
    await expect(
      platform.updatePoint(provisioned.pointIds["water.tank.level.percent"] as string, { thresholdConfig: { critical_low: 40, warning_low: 30 } }, client)
    ).rejects.toThrow(/Critical below must be lower than Low below/);
  });

  it("checks limits when a point is created too", async () => {
    const provisioned = await tankSite();
    await expect(
      platform.createPoint(
        {
          siteId: provisioned.site.id,
          deviceId: provisioned.device.id,
          canonicalName: "energy.consumption.kw",
          label: "Load",
          unit: "kW",
          capability: "read",
          thresholdConfig: { warning_low: 10 }
        },
        client
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records who changed which limit, from what to what", async () => {
    const provisioned = await tankSite();
    const pointId = provisioned.pointIds["water.tank.level.percent"] as string;
    await platform.updatePoint(pointId, { thresholdConfig: { warning_low: 25 } }, client);
    await platform.updatePoint(pointId, { thresholdConfig: { warning_low: 30, critical_low: 10 } }, client);

    const [latest] = platform.listAudit(client, provisioned.site.id).filter((event) => event.eventType === "point.updated");
    expect(latest).toMatchObject({
      userId: client.userId,
      entityId: pointId,
      beforeMetadata: { thresholdConfig: { warning_low: 25 } },
      afterMetadata: { thresholdConfig: { warning_low: 30, critical_low: 10 } }
    });
    expect(latest?.reason).toContain("Limits");
  });

  it("is allowed only to people who manage devices", async () => {
    const provisioned = await tankSite();
    const viewer: Principal = { ...client, role: "viewer" };
    await expect(
      platform.updatePoint(provisioned.pointIds["water.tank.level.percent"] as string, { thresholdConfig: { warning_low: 20 } }, viewer)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
