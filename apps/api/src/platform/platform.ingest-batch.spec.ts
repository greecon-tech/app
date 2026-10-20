import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanonicalPointName, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { ProvisionedSite, onboardClient, provisionSite } from "./test-support";

// A box sends everything one round of reading produced in a single request, and catches up after an
// outage a hundred messages at a time. Each message is judged on its own, so one wrong reading can
// never hold up the rest of a site's data.

describe("readings from a box, many at once", () => {
  let platform: PlatformService;
  let owner: Principal;
  let site: ProvisionedSite;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    owner = await onboardClient(platform);
    site = await provisionSite(platform, owner, [
      { canonicalName: "water.tank.level.percent", unit: "%" },
      { canonicalName: "energy.grid.import.kw", unit: "kW" }
    ]);
  });

  const message = (name: CanonicalPointName, value: number, overrides: Partial<TelemetryMessage> = {}, at: Date = new Date()): TelemetryMessage => {
    const stamp = at.toISOString();
    return {
      messageType: "telemetry",
      tenantId: owner.tenantId,
      siteId: site.site.id,
      deviceId: site.device.id,
      publishedAtUtc: stamp,
      correlationId: `c-${name}`,
      readings: [
        {
          timestampUtc: stamp,
          tenantId: owner.tenantId,
          siteId: site.site.id,
          deviceId: site.device.id,
          pointId: site.pointIds[name] as string,
          canonicalName: name,
          value,
          unit: name === "water.tank.level.percent" ? "%" : "kW",
          quality: "OK",
          source: "edge",
          ingestionTimestampUtc: stamp
        }
      ],
      ...overrides
    };
  };

  it("takes every good message and says so, in the order they were sent", async () => {
    const results = await platform.ingestTelemetryBatch([message("water.tank.level.percent", 61), message("energy.grid.import.kw", 4.2)], owner);
    expect(results).toEqual([
      { accepted: true, ingested: 1, errors: [] },
      { accepted: true, ingested: 1, errors: [] }
    ]);
    const latest = platform.latestTelemetry(owner, site.site.id);
    expect(latest.find((reading) => reading.canonicalName === "water.tank.level.percent")?.value).toBe(61);
    expect(latest.find((reading) => reading.canonicalName === "energy.grid.import.kw")?.value).toBe(4.2);
  });

  it("refuses only the message that is wrong", async () => {
    const unknownDevice = message("water.tank.level.percent", 50, { deviceId: "99999999-9999-4999-8999-999999999999" });
    unknownDevice.readings[0]!.deviceId = "99999999-9999-4999-8999-999999999999";
    const futureReading = message("energy.grid.import.kw", 1, {}, new Date(Date.now() + 3 * 3_600_000));
    const results = await platform.ingestTelemetryBatch([message("water.tank.level.percent", 60), unknownDevice, futureReading, message("energy.grid.import.kw", 2)], owner);

    expect(results.map((result) => result.accepted)).toEqual([true, false, false, true]);
    expect(results[1]?.errors[0]).toMatch(/Device not found/);
    expect(results[2]?.errors.join(" ")).toMatch(/in the future/);
    expect(platform.latestTelemetry(owner, site.site.id).find((reading) => reading.canonicalName === "energy.grid.import.kw")?.value).toBe(2);
  });

  it("refuses a message addressed to another account, and takes the rest", async () => {
    const results = await platform.ingestTelemetryBatch([message("water.tank.level.percent", 60, { tenantId: "11111111-1111-4111-8111-111111111111" }), message("energy.grid.import.kw", 2)], owner);
    expect(results.map((result) => result.accepted)).toEqual([false, true]);
    expect(results[0]?.errors[0]).toMatch(/does not match request context/);
  });

  it("brings states and alerts up to date once for the site, not once per message", async () => {
    const reconcile = vi.spyOn(platform as unknown as { reconcileSiteAlerts: () => Promise<void> }, "reconcileSiteAlerts");
    await platform.ingestTelemetryBatch([message("water.tank.level.percent", 60), message("energy.grid.import.kw", 2), message("water.tank.level.percent", 59)], owner);
    expect(reconcile).toHaveBeenCalledTimes(1);

    reconcile.mockClear();
    await platform.ingestTelemetry(message("water.tank.level.percent", 58), owner);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("raises an alert from a batch the same as from a single message", async () => {
    await platform.ingestTelemetryBatch([message("water.tank.level.percent", 8)], owner);
    expect(platform.listAlerts(owner, site.site.id).some((alert) => alert.severity === "critical")).toBe(true);
  });

  it("does not touch states for a batch where nothing was accepted", async () => {
    const reconcile = vi.spyOn(platform as unknown as { reconcileSiteAlerts: () => Promise<void> }, "reconcileSiteAlerts");
    await platform.ingestTelemetryBatch([message("water.tank.level.percent", 60, { tenantId: "11111111-1111-4111-8111-111111111111" })], owner);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("lets a failure that is the platform's own fail the whole request, so the box keeps what it sent", async () => {
    vi.spyOn(platform as unknown as { applyTelemetry: () => Promise<unknown> }, "applyTelemetry").mockRejectedValueOnce(new Error("database is down"));
    await expect(platform.ingestTelemetryBatch([message("water.tank.level.percent", 60)], owner)).rejects.toThrow("database is down");
  });
});
