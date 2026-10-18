import { beforeEach, describe, expect, it } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { DEMO_OWNER, minutes, onboardClient, provisionSite, sendReadings } from "./test-support";

// What the platform says about a site must follow from evidence it holds, not from a label somebody
// typed once. These specs pin that: nothing is called "OK" because nobody said otherwise.
describe("status is computed from the facts", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  const tank = (value: number, extra: Record<string, unknown> = {}) => ({ name: "water.tank.level.percent" as const, value, unit: "%", ...extra });
  const tankSite = () => provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);

  describe("a site", () => {
    it("is Unknown, not OK, before it has ever reported", async () => {
      const { site } = await tankSite();

      const [listed] = platform.listSites(client);
      expect(listed).toMatchObject({ id: site.id, status: "Unknown", edgeStatus: "Offline" });
      expect(platform.siteDetail(site.id, client).health).toMatchObject({ state: "unknown" });
      expect(platform.siteDetail(site.id, client).health.reasons[0]?.message).toContain("No readings");
    });

    it("is OK, and online, once it reports current readings and nothing is wrong", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);

      const [listed] = platform.listSites(client);
      expect(listed).toMatchObject({ status: "OK", edgeStatus: "OK" });
      expect(platform.siteDetail(provisioned.site.id, client).health).toMatchObject({ state: "stable", reasons: [] });
    });

    it("is Critical while a critical alert stands, and Warning for a warning", async () => {
      const provisioned = await tankSite();

      await sendReadings(platform, client, provisioned, [tank(30)]);
      expect(platform.listSites(client)[0]?.status).toBe("Warning");

      await sendReadings(platform, client, provisioned, [tank(5)]);
      expect(platform.listSites(client)[0]?.status).toBe("Critical");
      expect(platform.siteDetail(provisioned.site.id, client).health).toMatchObject({ state: "action" });
    });

    it("goes Unknown and Offline when its readings stop, and comes back when they resume", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);

      const later = Date.now() + minutes(30);
      expect(platform.listSites(client, later)[0]).toMatchObject({ status: "Unknown", edgeStatus: "Offline" });
      const health = platform.siteDetail(provisioned.site.id, client, later).health;
      expect(health.state).toBe("unknown");
      expect(health.reasons[0]?.message).toContain("out of date");

      await sendReadings(platform, client, provisioned, [tank(61)]);
      expect(platform.listSites(client)[0]).toMatchObject({ status: "OK", edgeStatus: "OK" });
    });

    it("is Simulated, not OK, when every reading comes from a simulator", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60, { source: "simulator" })]);

      expect(platform.listSites(client)[0]).toMatchObject({ edgeStatus: "Simulated" });
      expect(platform.overview(client).summaries.edge).toEqual({ connectedSites: 0, simulatedSites: 1 });
    });

    it("keeps an open critical alert in front when the site also goes quiet", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(5)]);
      await platform.refreshAllDerivedStates(Date.now() + minutes(30));

      const health = platform.siteDetail(provisioned.site.id, client, Date.now() + minutes(30)).health;
      expect(health.state).toBe("action");
      expect(health.reasons.map((reason) => reason.state)).toEqual(["action", "unknown"]);
    });
  });

  describe("a device", () => {
    it("is Offline until it has been heard from, then reports when that was", async () => {
      const provisioned = await tankSite();
      expect(platform.listDevices(client)[0]).toMatchObject({ health: "Offline", lastSeenUtc: undefined });

      await sendReadings(platform, client, provisioned, [tank(60, { minutesAgo: 2 })]);
      const [device] = platform.listDevices(client);
      expect(device?.health).toBe("OK");
      expect(Date.parse(device?.lastSeenUtc as string)).toBeLessThanOrEqual(Date.now() - 119_000);
      expect(platform.siteDetail(provisioned.site.id, client).devices[0]?.health).toBe("OK");
    });

    it("goes Offline when its readings stop, but still says when it was last heard", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);

      const [device] = platform.listDevices(client, undefined, Date.now() + minutes(30));
      expect(device?.health).toBe("Offline");
      expect(device?.lastSeenUtc).toBeDefined();
    });

    it("is Simulated when what it reports comes from a simulator", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60, { source: "simulator" })]);
      expect(platform.listDevices(client)[0]?.health).toBe("Simulated");
    });
  });

  describe("the account", () => {
    it("answers 'is everything all right?' with one state, one sentence, and what it rests on", async () => {
      const first = await tankSite();
      await sendReadings(platform, client, first, [tank(60)]);

      const { health } = platform.overview(client);
      expect(health).toMatchObject({
        state: "stable",
        label: "Stable",
        headline: "Everything is running normally.",
        coverage: { sites: 1, sitesReporting: 1 }
      });
    });

    it("is not stable while any site cannot be verified: a failure is never averaged away", async () => {
      const reporting = await tankSite();
      await sendReadings(platform, client, reporting, [tank(60)]);
      await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]); // never reports

      const { health } = platform.overview(client);
      expect(health.state).toBe("unknown");
      expect(health.coverage).toEqual({ sites: 2, sitesReporting: 1 });
      expect(health.headline).toContain("can't tell");
    });

    it("puts the thing that needs doing in the sentence", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(5)]);

      const { health } = platform.overview(client);
      expect(health.state).toBe("action");
      expect(health.headline).toBe(`Action required: Tank level is critical at ${provisioned.site.name}.`);
    });

    it("carries each site's own answer, so the page needs no logic of its own", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);

      const [site] = platform.overview(client).sites;
      expect(site).toMatchObject({ id: provisioned.site.id, health: { state: "stable" }, status: "OK" });
    });

    it("says there is nothing to report on, rather than 'all clear', when there are no sites", () => {
      const { health } = platform.overview(client);
      expect(health.state).toBe("unknown");
      expect(health.coverage).toEqual({ sites: 0, sitesReporting: 0 });
    });

    it("keeps the older one-line status in step with the answer", async () => {
      expect(platform.overview(client).status).toBe("Status unknown");

      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);
      expect(platform.overview(client).status).toBe("System stable");

      await sendReadings(platform, client, provisioned, [tank(5)]);
      expect(platform.overview(client).status).toBe("Action required");
    });

    it("tells when each site last reported", async () => {
      const provisioned = await tankSite();
      expect(platform.overview(client).sites[0]?.lastReadingAtUtc).toBeUndefined();

      await sendReadings(platform, client, provisioned, [tank(60, { minutesAgo: 3 })]);
      const last = platform.overview(client).sites[0]?.lastReadingAtUtc;
      expect(Date.parse(last as string)).toBeLessThanOrEqual(Date.now() - 179_000);
      expect(platform.listSites(client)[0]?.lastReadingAtUtc).toBe(last);
    });

    it("keeps an acknowledged critical alert in the active list: acknowledging it did not fix it", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(5)]);
      const [alert] = platform.listAlerts(client);
      await platform.acknowledgeAlert(alert?.id as string, client);

      const { activeAlerts, health } = platform.overview(client);
      expect(activeAlerts.map((item) => item.id)).toEqual([alert?.id]);
      expect(health.state).toBe("action");

      // Once the tank recovers the alert resolves itself and leaves the list.
      await sendReadings(platform, client, provisioned, [tank(80)]);
      expect(platform.overview(client).activeAlerts).toEqual([]);
    });

    it("never lets another account's sites change this account's answer", async () => {
      const mine = await tankSite();
      await sendReadings(platform, client, mine, [tank(60)]);

      // The demo account has example alerts of its own; none of them are this account's business.
      expect(platform.overview(DEMO_OWNER).activeAlerts.length).toBeGreaterThan(0);
      expect(platform.overview(client).health.state).toBe("stable");
    });
  });

  describe("each reading says how old it is", () => {
    it("carries its value, where it came from and when it was taken", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(62.5, { minutesAgo: 2 })]);

      const reading = platform.overview(client).readings["water.tank.level.percent"];
      expect(reading).toMatchObject({ value: 62.5, unit: "%", siteId: provisioned.site.id, siteName: provisioned.site.name, freshness: "current", quality: "OK" });
      expect(reading?.ageSeconds).toBeGreaterThanOrEqual(120);
      expect(reading?.ageSeconds).toBeLessThan(130);
      expect(Date.parse(reading?.asOfUtc as string)).toBeLessThanOrEqual(Date.now() - 119_000);
    });

    it("is marked out of date once it is too old to rely on, and keeps its last value", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(62.5)]);

      const reading = platform.overview(client, Date.now() + minutes(30)).readings["water.tank.level.percent"];
      expect(reading).toMatchObject({ value: 62.5, freshness: "out_of_date" });
      expect(reading?.ageSeconds).toBeGreaterThanOrEqual(1800);
    });

    it("gives slow field sensors hours, not minutes", async () => {
      const provisioned = await provisionSite(platform, client, [{ canonicalName: "agri.soil.moisture.percent", unit: "%" }]);
      await sendReadings(platform, client, provisioned, [{ name: "agri.soil.moisture.percent", value: 31 }]);

      expect(platform.overview(client, Date.now() + minutes(60)).readings["agri.soil.moisture.percent"]?.freshness).toBe("current");
      expect(platform.overview(client, Date.now() + minutes(4 * 60)).readings["agri.soil.moisture.percent"]?.freshness).toBe("out_of_date");
    });

    it("never marks simulated readings out of date: nothing they measure can go quiet", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60, { source: "simulator" })]);

      expect(platform.overview(client, Date.now() + minutes(600)).readings["water.tank.level.percent"]?.freshness).toBe("current");
    });

    it("shows the newest reading when several sites measure the same thing", async () => {
      const first = await tankSite();
      const second = await tankSite();
      await sendReadings(platform, client, first, [tank(40, { minutesAgo: 3 })]);
      await sendReadings(platform, client, second, [tank(70, { minutesAgo: 1 })]);

      expect(platform.overview(client).readings["water.tank.level.percent"]).toMatchObject({ value: 70, siteId: second.site.id });
    });

    it("flags a reading the platform itself judges abnormal, from the site's own thresholds", async () => {
      const provisioned = await tankSite();
      const concernOf = () => platform.overview(client).readings["water.tank.level.percent"]?.concern;

      await sendReadings(platform, client, provisioned, [tank(60)]);
      expect(concernOf()).toBeUndefined();

      await sendReadings(platform, client, provisioned, [tank(30)]);
      expect(concernOf()).toBe("warning");

      await sendReadings(platform, client, provisioned, [tank(5)]);
      expect(concernOf()).toBe("critical");
    });

    it("stamps the latest readings of a site with their age too, so every page can say so", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(62.5, { minutesAgo: 1 })]);

      const [now] = platform.latestTelemetry(client, provisioned.site.id);
      expect(now).toMatchObject({ canonicalName: "water.tank.level.percent", value: 62.5, freshness: "current" });
      expect(now?.ageSeconds).toBeGreaterThanOrEqual(60);

      const [later] = platform.latestTelemetry(client, provisioned.site.id, Date.now() + minutes(30));
      expect(later).toMatchObject({ value: 62.5, freshness: "out_of_date" });
      expect(platform.siteDetail(provisioned.site.id, client, Date.now() + minutes(30)).latestTelemetry[0]?.freshness).toBe("out_of_date");
    });

    it("flags the same abnormal readings on every list, not only on the Overview", async () => {
      const provisioned = await tankSite();
      const concernOf = (siteId?: string) => platform.latestTelemetry(client, siteId)[0]?.concern;

      await sendReadings(platform, client, provisioned, [tank(60)]);
      expect(concernOf(provisioned.site.id)).toBeUndefined();

      await sendReadings(platform, client, provisioned, [tank(5)]);
      expect(concernOf(provisioned.site.id)).toBe("critical");
      expect(platform.siteDetail(provisioned.site.id, client).latestTelemetry[0]?.concern).toBe("critical");

      // A reading that has gone out of date is flagged as that instead: what the rules concluded
      // from it is no longer about the present.
      expect(platform.latestTelemetry(client, provisioned.site.id, Date.now() + minutes(30))[0]).toMatchObject({ freshness: "out_of_date", concern: undefined });
    });

    it("calls surplus solar 'Available' or 'Constrained' only when it can actually tell", async () => {
      const provisioned = await provisionSite(platform, client, [
        { canonicalName: "energy.solar.power.kw", unit: "kW" },
        { canonicalName: "energy.consumption.kw", unit: "kW" }
      ]);
      const surplus = () => platform.overview(client).summaries.energy.surplusState;

      await sendReadings(platform, client, provisioned, [{ name: "energy.solar.power.kw", value: 8, unit: "kW" }]);
      expect(surplus()).toBeUndefined(); // no consumption reading: cannot judge

      await sendReadings(platform, client, provisioned, [
        { name: "energy.solar.power.kw", value: 8, unit: "kW" },
        { name: "energy.consumption.kw", value: 2, unit: "kW" }
      ]);
      expect(surplus()).toBe("Available");

      await sendReadings(platform, client, provisioned, [
        { name: "energy.solar.power.kw", value: 2, unit: "kW" },
        { name: "energy.consumption.kw", value: 3, unit: "kW" }
      ]);
      expect(surplus()).toBe("Constrained");

      // Once the readings go quiet it cannot be judged again, rather than keeping its last answer.
      await platform.refreshAllDerivedStates(Date.now() + minutes(30));
      expect(surplus()).toBeUndefined();
    });

    it("leaves out readings that were never sent, rather than showing a blank card", async () => {
      const provisioned = await tankSite();
      await sendReadings(platform, client, provisioned, [tank(60)]);

      expect(Object.keys(platform.overview(client).readings)).toEqual(["water.tank.level.percent"]);
    });
  });
});
