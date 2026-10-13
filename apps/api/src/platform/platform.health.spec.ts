import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { minutes, onboardClient, provisionSite, sendReadings } from "./test-support";

describe("site health follows the data, not the calendar", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const stateOf = (siteId: string, key: string) => platform.listDerivedStates(client, siteId).find((state) => state.stateKey === key);

  it("notices that a gateway has gone quiet, without any new reading arriving", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.flow.lpm", unit: "lpm" }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12 }]);

    await platform.refreshAllDerivedStates(Date.now());
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(false);

    // Ten minutes pass and nothing is ingested: the 5 minute limit for a process reading is exceeded.
    await platform.refreshAllDerivedStates(Date.now() + minutes(10));
    const degraded = stateOf(provisioned.site.id, "system.communication_degraded");
    expect(degraded?.stateValue).toBe(true);
    expect(degraded?.reason).toContain("out of date");
  });

  it("stops asserting a state it can no longer see, instead of leaving its last value in place", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);

    await platform.refreshAllDerivedStates(Date.now());
    expect(stateOf(provisioned.site.id, "water.tank.critical")?.stateValue).toBe(true);

    await platform.refreshAllDerivedStates(Date.now() + minutes(30));
    expect(stateOf(provisioned.site.id, "water.tank.critical")).toBeUndefined();
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(true);
  });

  it("recovers by itself when readings resume", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.flow.lpm", unit: "lpm" }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12 }]);
    await platform.refreshAllDerivedStates(Date.now() + minutes(30));
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(true);

    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 11 }]);
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(false);
  });

  it("never calls simulated readings out of date: they measure nothing that can go quiet", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.flow.lpm", unit: "lpm" }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12, source: "simulator" }]);

    await platform.refreshAllDerivedStates(Date.now() + 3 * 24 * 60 * minutes(1));
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(false);
  });

  it("lets a point declare how often it reports, so a slow sensor is not wrongly flagged", async () => {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.tank.level.percent", unit: "%", thresholds: { max_age_seconds: 45 * 60 } }
    ]);
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 60, minutesAgo: 20 }]);

    await platform.refreshAllDerivedStates(Date.now());
    expect(stateOf(provisioned.site.id, "system.communication_degraded")?.stateValue).toBe(false);
    expect(stateOf(provisioned.site.id, "water.tank.critical")?.stateValue).toBe(false);
  });

  it("judges a tank against the thresholds configured on its own point", async () => {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.tank.level.percent", unit: "%", thresholds: { critical_low: 30, warning_low: 50 } }
    ]);
    // 25% is above the platform default of 15% but below this tank's own 30%.
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 25 }]);

    expect(stateOf(provisioned.site.id, "water.tank.critical")?.stateValue).toBe(true);
  });

  it("judges dry-run against the site's own safety limit", async () => {
    const provisioned = await provisionSite(platform, client, [{ canonicalName: "water.flow.lpm", unit: "lpm" }]);
    await platform.updateSite(provisioned.site.id, { safetyLimits: { dryRunFlowLpm: 5 } }, client);
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 3 }]);

    expect(stateOf(provisioned.site.id, "water.pump.dry_run_risk")?.stateValue).toBe(true);
  });
});

describe("pump commands refuse to rely on a reading that is no longer current", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  async function pumpSite(flowAgeMinutes: number, pressureAgeMinutes: number) {
    const provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.flow.lpm", unit: "lpm" },
      { canonicalName: "water.pressure.bar", unit: "bar" },
      { canonicalName: "water.pump.command", unit: "state", capability: "write" }
    ]);
    await sendReadings(platform, client, provisioned, [
      { name: "water.flow.lpm", value: 12, minutesAgo: flowAgeMinutes },
      { name: "water.pressure.bar", value: 2.4, minutesAgo: pressureAgeMinutes }
    ]);
    return provisioned;
  }

  const startPump = (provisioned: Awaited<ReturnType<typeof pumpSite>>) =>
    platform.createCommand(
      {
        siteId: provisioned.site.id,
        targetDeviceId: provisioned.device.id,
        targetPointId: provisioned.pointIds["water.pump.command"] as string,
        requestedValue: "ON",
        reason: "Refill the tank during the operating window"
      },
      client
    );

  it("dispatches the start when pressure and flow are current", async () => {
    const command = await startPump(await pumpSite(1, 1));
    expect(command.dispatchStatus).toBe("simulated_dispatch");
  });

  it("blocks the start, and says why, when the pressure reading is ten minutes old", async () => {
    const command = await startPump(await pumpSite(1, 10));

    expect(command.dispatchStatus).toBe("blocked");
    expect(command.failureReason).toContain("water.pressure.bar is out of date");
    expect(command.safetyEvaluation.hardSafetyBlock).toBe(true);
  });
});

describe("the health monitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-derives every site on a schedule and stops when asked", async () => {
    const platform = new PlatformService(new DatabaseService());
    const refresh = vi.spyOn(platform, "refreshAllDerivedStates");

    platform.startHealthMonitor(1_000);
    await vi.advanceTimersByTimeAsync(3_500);
    expect(refresh).toHaveBeenCalledTimes(3);

    platform.stopHealthMonitor();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("starts only one monitor however often it is asked", () => {
    const platform = new PlatformService(new DatabaseService());
    platform.startHealthMonitor(1_000);
    platform.startHealthMonitor(1_000);
    expect(vi.getTimerCount()).toBe(1);
    platform.stopHealthMonitor();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("survives a failing pass and keeps running", async () => {
    const platform = new PlatformService(new DatabaseService());
    const refresh = vi.spyOn(platform, "refreshAllDerivedStates").mockImplementationOnce(() => {
      throw new Error("boom");
    });

    platform.startHealthMonitor(1_000);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(refresh).toHaveBeenCalledTimes(2);
    platform.stopHealthMonitor();
  });

  it("derives states at start-up and starts the monitor, and shuts it down cleanly", async () => {
    const platform = new PlatformService(new DatabaseService());
    const refresh = vi.spyOn(platform, "refreshAllDerivedStates");

    await platform.onApplicationBootstrap();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    platform.onApplicationShutdown();
    expect(vi.getTimerCount()).toBe(0);
  });
});
