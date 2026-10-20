import { describe, expect, it } from "vitest";
import { defaultSafetyLimits, deriveOperationalStates, type SensorSnapshot } from "./index";

const NOW = Date.parse("2026-10-13T12:00:00.000Z");
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const reading = (value: number, unit: string, minutesAgo: number, quality: "OK" | "WARN" | "BAD" = "OK") => ({
  value,
  unit,
  quality,
  timestampUtc: at(minutesAgo)
});

describe("derived states and data freshness", () => {
  it("reports communication as healthy when every reading is current", () => {
    const states = deriveOperationalStates(
      { "water.tank.level.percent": reading(60, "%", 1), "water.flow.lpm": reading(12, "lpm", 1) },
      { nowMs: NOW }
    );
    const communication = states.find((state) => state.stateKey === "system.communication_degraded");
    expect(communication?.stateValue).toBe(false);
    expect(communication?.severity).toBe("info");
  });

  it("flags degraded communication, with how much and how old, when readings stop arriving", () => {
    const states = deriveOperationalStates(
      {
        "water.tank.level.percent": reading(60, "%", 1),
        "agri.soil.moisture.percent": reading(20, "%", 300), // 5 hours: past the 3 hour slow-sensor limit
        "water.flow.lpm": reading(12, "lpm", 45) // 45 minutes: far past the 5 minute process limit
      },
      { nowMs: NOW }
    );

    const communication = states.find((state) => state.stateKey === "system.communication_degraded");
    expect(communication?.stateValue).toBe(true);
    expect(communication?.severity).toBe("warning");
    expect(communication?.reason).toContain("2 readings");
    expect(communication?.reason).toContain("5 hours");
  });

  it("does not derive a reassuring or alarming state from a reading it cannot trust", () => {
    const states = deriveOperationalStates(
      {
        // A tank level of 5% from three hours ago must not raise 'tank critical' as if it were current,
        // and a stale 60% must not clear it either: no state is derived from either.
        "water.tank.level.percent": reading(5, "%", 180),
        "agri.soil.moisture.percent": reading(10, "%", 300)
      },
      { nowMs: NOW }
    );

    const keys = states.map((state) => state.stateKey);
    expect(keys).not.toContain("water.tank.critical");
    expect(keys).not.toContain("water.tank.low");
    expect(keys).not.toContain("agri.irrigation_required");
    expect(states.find((state) => state.stateKey === "system.communication_degraded")?.stateValue).toBe(true);
  });

  it("derives from a current reading even while another is stale", () => {
    const states = deriveOperationalStates(
      { "water.tank.level.percent": reading(10, "%", 1), "agri.soil.moisture.percent": reading(20, "%", 300) },
      { nowMs: NOW }
    );
    expect(states.find((state) => state.stateKey === "water.tank.critical")?.stateValue).toBe(true);
  });

  it("honours a limit set on the point itself", () => {
    const states = deriveOperationalStates(
      { "water.tank.level.percent": { ...reading(60, "%", 20), maxAgeSeconds: 30 * 60 } },
      { nowMs: NOW }
    );
    // 20 minutes old would be stale by the default 5 minutes, but this tank sensor reports every 15-20 minutes.
    expect(states.find((state) => state.stateKey === "system.communication_degraded")?.stateValue).toBe(false);
    expect(states.find((state) => state.stateKey === "water.tank.critical")?.stateValue).toBe(false);
  });

  it("produces no communication state when there are no readings at all (that is a different question: nothing is connected yet)", () => {
    expect(deriveOperationalStates({}, { nowMs: NOW })).toEqual([]);
  });

  it("behaves as before when the caller does not supply a clock", () => {
    const states = deriveOperationalStates({ "water.tank.level.percent": reading(5, "%", 9999) });
    expect(states.find((state) => state.stateKey === "water.tank.critical")?.stateValue).toBe(true);
    expect(states.some((state) => state.stateKey === "system.communication_degraded")).toBe(false);
  });

  it("judges dry-run against the site's own limit, not only the platform default", () => {
    const sensors: SensorSnapshot = {
      "water.pump.status": { value: "ON", unit: "state", quality: "OK", timestampUtc: at(1) },
      "water.flow.lpm": reading(1.5, "lpm", 1)
    };
    const withDefault = deriveOperationalStates(sensors, { nowMs: NOW });
    expect(withDefault.find((state) => state.stateKey === "water.pump.dry_run_risk")?.stateValue).toBe(false);

    const strictSite = deriveOperationalStates(sensors, { nowMs: NOW, limits: { dryRunFlowLpm: 2 } });
    expect(strictSite.find((state) => state.stateKey === "water.pump.dry_run_risk")?.stateValue).toBe(true);
    expect(defaultSafetyLimits.dryRunFlowLpm).toBeLessThan(1.5);
  });
});

describe("derived states use the thresholds configured on the point", () => {
  const withThresholds = (value: number, unit: string, thresholds: Record<string, number>) => ({
    value,
    unit,
    quality: "OK" as const,
    timestampUtc: at(1),
    thresholds
  });
  const stateOf = (states: ReturnType<typeof deriveOperationalStates>, key: string) => states.find((state) => state.stateKey === key);

  it("does not call solar surplus available or constrained until the site says what a useful surplus is", () => {
    const energy = (thresholds: Record<string, number>) => ({
      "energy.solar.power.kw": withThresholds(6, "kW", thresholds),
      "energy.consumption.kw": withThresholds(4, "kW", {})
    });

    // 2 kW spare is plenty for a small load and nothing for a pump that needs 4: only the site knows.
    expect(deriveOperationalStates(energy({}), { nowMs: NOW }).map((state) => state.stateKey)).not.toContain("energy.surplus_available");
    expect(stateOf(deriveOperationalStates(energy({ surplus_min_kw: 1.5 }), { nowMs: NOW }), "energy.surplus_available")?.stateValue).toBe(true);
    expect(stateOf(deriveOperationalStates(energy({ surplus_min_kw: 4 }), { nowMs: NOW }), "energy.surplus_available")?.stateValue).toBe(false);
  });

  it("does not say whether irrigation is needed until the field has its own limit", () => {
    const soil = (thresholds?: Record<string, number>) => ({ "agri.soil.moisture.percent": withThresholds(10, "%", thresholds ?? {}) });

    // 10% is dry in some soils and fine in others. With no limit set for this field, say nothing.
    expect(deriveOperationalStates(soil(), { nowMs: NOW }).map((state) => state.stateKey)).not.toContain("agri.irrigation_required");
    expect(stateOf(deriveOperationalStates(soil({ irrigate_below: 14 }), { nowMs: NOW }), "agri.irrigation_required")?.stateValue).toBe(true);
    expect(stateOf(deriveOperationalStates(soil({ irrigate_below: 8 }), { nowMs: NOW }), "agri.irrigation_required")?.stateValue).toBe(false);
  });

  it("applies a tank's own critical and low levels instead of the platform defaults", () => {
    const configured = { critical_low: 25, warning_low: 50 };

    const critical = deriveOperationalStates({ "water.tank.level.percent": withThresholds(20, "%", configured) }, { nowMs: NOW });
    expect(stateOf(critical, "water.tank.critical")?.stateValue).toBe(true); // 20% is above the default 15%, below this tank's 25%

    const low = deriveOperationalStates({ "water.tank.level.percent": withThresholds(40, "%", configured) }, { nowMs: NOW });
    expect(stateOf(low, "water.tank.critical")?.stateValue).toBe(false);
    expect(stateOf(low, "water.tank.low")?.stateValue).toBe(true); // 40% is above the default 35%, below this tank's 50%

    const fine = deriveOperationalStates({ "water.tank.level.percent": withThresholds(60, "%", configured) }, { nowMs: NOW });
    expect(stateOf(fine, "water.tank.low")?.stateValue).toBe(false);
  });

  it("falls back to the defaults when a point sets no threshold", () => {
    const states = deriveOperationalStates({ "water.tank.level.percent": withThresholds(20, "%", {}) }, { nowMs: NOW });
    expect(stateOf(states, "water.tank.critical")?.stateValue).toBe(false);
    expect(stateOf(states, "water.tank.low")?.stateValue).toBe(true);
  });

  it("applies the field's own irrigation trigger", () => {
    const states = deriveOperationalStates({ "agri.soil.moisture.percent": withThresholds(30, "%", { irrigate_below: 35 }) }, { nowMs: NOW });
    expect(stateOf(states, "agri.irrigation_required")?.stateValue).toBe(true);
  });

  it("applies the battery's own low-charge level", () => {
    const states = deriveOperationalStates({ "energy.battery.soc.percent": withThresholds(35, "%", { warning_low: 40 }) }, { nowMs: NOW });
    expect(stateOf(states, "energy.battery.constrained")?.stateValue).toBe(true);
  });

  it("lets the flow meter's own dry-run level take precedence over the site's limit", () => {
    const states = deriveOperationalStates(
      {
        "water.pump.status": { value: "ON", unit: "state", quality: "OK", timestampUtc: at(1) },
        "water.flow.lpm": withThresholds(1, "lpm", { dry_run_lpm: 3 })
      },
      { nowMs: NOW, limits: { dryRunFlowLpm: 0.2 } }
    );
    expect(stateOf(states, "water.pump.dry_run_risk")?.stateValue).toBe(true);
  });

  it("ignores a threshold that is not a usable number", () => {
    const states = deriveOperationalStates(
      { "water.tank.level.percent": withThresholds(20, "%", { critical_low: Number.NaN, warning_low: Number.POSITIVE_INFINITY }) },
      { nowMs: NOW }
    );
    expect(stateOf(states, "water.tank.critical")?.stateValue).toBe(false); // default 15
    expect(stateOf(states, "water.tank.low")?.stateValue).toBe(true); // default 35
  });

  it("lets a point set its own freshness limit with max_age_seconds", () => {
    const states = deriveOperationalStates(
      { "water.tank.level.percent": { ...withThresholds(60, "%", { max_age_seconds: 1800 }), timestampUtc: at(20) } },
      { nowMs: NOW }
    );
    expect(stateOf(states, "system.communication_degraded")?.stateValue).toBe(false);
  });
});

describe("dry-run risk means a pump that is running with no flow", () => {
  const pump = (value: string | boolean | number, minutesAgo = 1) => ({
    value: value as never,
    unit: "state",
    quality: "OK" as const,
    timestampUtc: at(minutesAgo)
  });
  const dryRun = (states: ReturnType<typeof deriveOperationalStates>) => states.find((state) => state.stateKey === "water.pump.dry_run_risk");

  it("is raised when the pump is running and flow is below the limit", () => {
    for (const running of ["ON", "RUNNING", "run", true, 1]) {
      const states = deriveOperationalStates({ "water.pump.status": pump(running), "water.flow.lpm": reading(0, "lpm", 1) }, { nowMs: NOW });
      expect(dryRun(states)?.stateValue).toBe(true);
      expect(dryRun(states)?.severity).toBe("critical");
    }
  });

  it("is NOT raised for a stopped pump, whose flow is zero by definition", () => {
    for (const stopped of ["OFF", "STOPPED", false, 0]) {
      const states = deriveOperationalStates({ "water.pump.status": pump(stopped), "water.flow.lpm": reading(0, "lpm", 1) }, { nowMs: NOW });
      expect(dryRun(states)?.stateValue).toBe(false);
    }
  });

  it("is NOT raised for a running pump that is moving water", () => {
    const states = deriveOperationalStates({ "water.pump.status": pump("ON"), "water.flow.lpm": reading(12, "lpm", 1) }, { nowMs: NOW });
    expect(dryRun(states)?.stateValue).toBe(false);
  });

  it("says nothing when it cannot tell whether the pump is running: unknown is not 'fine', and not 'dry'", () => {
    expect(dryRun(deriveOperationalStates({ "water.flow.lpm": reading(0, "lpm", 1) }, { nowMs: NOW }))).toBeUndefined();
    expect(dryRun(deriveOperationalStates({ "water.pump.status": pump("???"), "water.flow.lpm": reading(0, "lpm", 1) }, { nowMs: NOW }))).toBeUndefined();
  });

  it("does not act on a pump status or a flow reading that is out of date", () => {
    expect(dryRun(deriveOperationalStates({ "water.pump.status": pump("ON", 60), "water.flow.lpm": reading(0, "lpm", 1) }, { nowMs: NOW }))).toBeUndefined();
    expect(dryRun(deriveOperationalStates({ "water.pump.status": pump("ON"), "water.flow.lpm": reading(0, "lpm", 60) }, { nowMs: NOW }))).toBeUndefined();
  });
});
