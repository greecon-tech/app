import { describe, expect, it } from "vitest";
import { assessSiteHealth, assessTenantHealth, concernForReading, HEALTH_LABELS, statusLabelFor, type SiteHealthInput } from "./health";

const site = (overrides: Partial<SiteHealthInput> = {}): SiteHealthInput => ({
  siteId: "site-1",
  siteName: "Hotel plant",
  readingCount: 6,
  communicationProblem: false,
  alerts: [],
  ...overrides
});

const alert = (severity: "info" | "watch" | "warning" | "critical", title: string, overrides: Record<string, unknown> = {}) => ({
  severity,
  title,
  category: "resource_threshold" as const,
  status: "open" as const,
  ...overrides
});

describe("assessSiteHealth", () => {
  it("is stable only on positive evidence: current readings and nothing open", () => {
    const health = assessSiteHealth(site());
    expect(health.state).toBe("stable");
    expect(health.reasons).toEqual([]);
  });

  it("is unknown, never stable, for a site that has never reported", () => {
    const health = assessSiteHealth(site({ readingCount: 0 }));
    expect(health.state).toBe("unknown");
    expect(health.reasons[0]?.message).toContain("No readings");
  });

  it("is unknown when its readings are out of date: silence is not safety", () => {
    const health = assessSiteHealth(site({ communicationProblem: true }));
    expect(health.state).toBe("unknown");
    expect(health.reasons[0]?.message).toContain("out of date");
  });

  it("needs attention for a warning or watch alert", () => {
    expect(assessSiteHealth(site({ alerts: [alert("warning", "Tank level is low")] })).state).toBe("attention");
    expect(assessSiteHealth(site({ alerts: [alert("watch", "Soil is dry")] })).state).toBe("attention");
  });

  it("requires action for a critical alert, acknowledged or not: acknowledging does not fix it", () => {
    expect(assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical")] })).state).toBe("action");
    expect(assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical", { status: "acknowledged" })] })).state).toBe("action");
  });

  it("ignores alerts that have already cleared", () => {
    expect(assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical", { status: "resolved" })] })).state).toBe("stable");
  });

  it("ranks action above unknown above attention, and keeps every reason", () => {
    const health = assessSiteHealth(
      site({
        communicationProblem: true,
        alerts: [alert("critical", "Tank level is critical"), alert("warning", "Battery charge is low")]
      })
    );
    expect(health.state).toBe("action");
    expect(health.reasons.map((reason) => reason.state)).toEqual(["action", "unknown", "attention"]);
  });

  it("does not count the 'readings out of date' alert twice: it is already the communication reason", () => {
    const health = assessSiteHealth(
      site({ communicationProblem: true, alerts: [alert("warning", "Readings from this site are out of date", { category: "communication_degraded" })] })
    );
    expect(health.reasons).toHaveLength(1);
    expect(health.state).toBe("unknown");
  });

  it("names the site on every reason", () => {
    const health = assessSiteHealth(site({ alerts: [alert("warning", "Battery charge is low")] }));
    expect(health.reasons[0]).toMatchObject({ siteId: "site-1", siteName: "Hotel plant" });
  });

  it("says what is out of date when it is told", () => {
    const health = assessSiteHealth(site({ communicationProblem: true, communicationDetail: "2 readings are out of date; the oldest was taken 5 hours ago." }));
    expect(health.reasons[0]?.message).toBe("2 readings are out of date; the oldest was taken 5 hours ago.");
  });

  it("keeps an 'out of date' alert as a reason when the site is not reported as quiet: it must never be dropped", () => {
    const health = assessSiteHealth(
      site({ communicationProblem: false, alerts: [alert("warning", "Readings from this site are out of date", { category: "communication_degraded" })] })
    );
    expect(health.state).toBe("attention");
    expect(health.reasons).toHaveLength(1);
  });

  it("records how serious each alert-based reason is", () => {
    const health = assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical"), alert("watch", "Soil is dry")] }));
    expect(health.reasons.map((reason) => reason.severity)).toEqual(["critical", "watch"]);
  });
});

describe("statusLabelFor (the older seven-word vocabulary)", () => {
  it("maps each state to one word, keeping watch and warning apart", () => {
    expect(statusLabelFor(assessSiteHealth(site()))).toBe("OK");
    expect(statusLabelFor(assessSiteHealth(site({ readingCount: 0 })))).toBe("Unknown");
    expect(statusLabelFor(assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical")] })))).toBe("Critical");
    expect(statusLabelFor(assessSiteHealth(site({ alerts: [alert("warning", "Battery charge is low")] })))).toBe("Warning");
    expect(statusLabelFor(assessSiteHealth(site({ alerts: [alert("watch", "Soil is dry")] })))).toBe("Watch");
    expect(statusLabelFor(assessSiteHealth(site({ alerts: [alert("watch", "Soil is dry"), alert("warning", "Battery charge is low")] })))).toBe("Warning");
  });
});

describe("concernForReading", () => {
  const trueStates = (...keys: string[]) => new Set(keys) as ReadonlySet<never>;

  it("flags a tank reading by how bad its state is, worst first", () => {
    expect(concernForReading("water.tank.level.percent", trueStates("water.tank.low"))).toBe("warning");
    expect(concernForReading("water.tank.level.percent", trueStates("water.tank.low", "water.tank.critical"))).toBe("critical");
    expect(concernForReading("water.tank.level.percent", trueStates())).toBeUndefined();
  });

  it("flags the battery, and the flow meter while the pump is running dry", () => {
    expect(concernForReading("energy.battery.soc.percent", trueStates("energy.battery.constrained"))).toBe("warning");
    expect(concernForReading("water.flow.lpm", trueStates("water.pump.dry_run_risk"))).toBe("critical");
  });

  it("says nothing about a reading no state judges", () => {
    expect(concernForReading("energy.consumption.kw", trueStates("water.tank.critical"))).toBeUndefined();
  });
});

describe("assessTenantHealth", () => {
  const stable = assessSiteHealth(site({ siteId: "a", siteName: "Farm" }));

  it("says everything is running normally only when every site is stable", () => {
    const health = assessTenantHealth([stable, assessSiteHealth(site({ siteId: "b", siteName: "Plant" }))]);
    expect(health.state).toBe("stable");
    expect(health.label).toBe(HEALTH_LABELS.stable);
    expect(health.headline).toBe("Everything is running normally.");
    expect(health.coverage).toEqual({ sites: 2, sitesReporting: 2 });
  });

  it("never averages a failure away: one stale site out of ten is not 'stable'", () => {
    const sites = Array.from({ length: 9 }, (_, index) => assessSiteHealth(site({ siteId: `s${index}`, siteName: `Site ${index}` })));
    sites.push(assessSiteHealth(site({ siteId: "late", siteName: "Pump station", communicationProblem: true })));

    const health = assessTenantHealth(sites);
    expect(health.state).toBe("unknown");
    expect(health.headline).toContain("can't tell");
    expect(health.reasons[0]?.siteName).toBe("Pump station");
    expect(health.coverage).toEqual({ sites: 10, sitesReporting: 9 });
  });

  it("puts action first, and counts what needs it", () => {
    const one = assessTenantHealth([assessSiteHealth(site({ alerts: [alert("critical", "Tank level is critical")] })), stable]);
    expect(one.state).toBe("action");
    expect(one.headline).toBe("Action required: Tank level is critical at Hotel plant.");

    const two = assessTenantHealth([
      assessSiteHealth(site({ siteId: "x", siteName: "A", alerts: [alert("critical", "Tank level is critical")] })),
      assessSiteHealth(site({ siteId: "y", siteName: "B", alerts: [alert("critical", "The pump is running but no water is flowing")] }))
    ]);
    expect(two.headline).toBe("2 things need action now.");
  });

  it("counts attention items plainly", () => {
    const one = assessTenantHealth([assessSiteHealth(site({ alerts: [alert("warning", "Battery charge is low")] })), stable]);
    expect(one.state).toBe("attention");
    expect(one.headline).toBe("1 thing needs attention.");

    const many = assessTenantHealth([
      assessSiteHealth(site({ siteId: "x", alerts: [alert("warning", "Battery charge is low"), alert("watch", "Soil is dry")] })),
      stable
    ]);
    expect(many.headline).toBe("2 things need attention.");
  });

  it("is unknown, with a reason, when there are no sites at all", () => {
    const health = assessTenantHealth([]);
    expect(health.state).toBe("unknown");
    expect(health.reasons[0]?.message).toContain("No sites yet");
    expect(health.coverage).toEqual({ sites: 0, sitesReporting: 0 });
  });

  it("has a distinct word for each state, never relying on colour", () => {
    expect(new Set(Object.values(HEALTH_LABELS)).size).toBe(4);
    expect(HEALTH_LABELS).toEqual({ stable: "Stable", attention: "Attention needed", action: "Action required", unknown: "Unknown" });
  });
});
