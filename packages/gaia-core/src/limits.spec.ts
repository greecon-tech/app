import { describe, expect, it } from "vitest";
import { limitsFor, pointLimitDefinitions, type PointLimitKey } from "@greecon/shared";
import { deriveOperationalStates, type SensorSnapshotValue } from "./index";

// The screens tell people what the platform uses when they set nothing ("standard 15%"). Those
// numbers are written in the shared definitions; this pins them to what the engine actually does, so
// the words and the behaviour cannot drift apart.
const NOW = Date.parse("2026-10-18T12:00:00.000Z");
const reading = (value: number, unit: string): SensorSnapshotValue => ({ value, unit, quality: "OK", timestampUtc: new Date(NOW - 1000).toISOString() });
const fallbackOf = (key: PointLimitKey, name: Parameters<typeof limitsFor>[0]) => limitsFor(name).find((definition) => definition.key === key)?.fallback;
const stateValue = (states: ReturnType<typeof deriveOperationalStates>, key: string) => states.find((state) => state.stateKey === key)?.stateValue;

describe("what the platform uses when a site sets no limit", () => {
  it("turns a tank critical just below its stated standard level", () => {
    const standard = fallbackOf("critical_low", "water.tank.level.percent") as number;
    expect(stateValue(deriveOperationalStates({ "water.tank.level.percent": reading(standard - 0.1, "%") }, { nowMs: NOW }), "water.tank.critical")).toBe(true);
    expect(stateValue(deriveOperationalStates({ "water.tank.level.percent": reading(standard, "%") }, { nowMs: NOW }), "water.tank.critical")).toBe(false);
  });

  it("calls a tank low just below its stated standard level", () => {
    const standard = fallbackOf("warning_low", "water.tank.level.percent") as number;
    expect(stateValue(deriveOperationalStates({ "water.tank.level.percent": reading(standard - 0.1, "%") }, { nowMs: NOW }), "water.tank.low")).toBe(true);
    expect(stateValue(deriveOperationalStates({ "water.tank.level.percent": reading(standard, "%") }, { nowMs: NOW }), "water.tank.low")).toBe(false);
  });

  it("calls a battery low just below its stated standard level", () => {
    const standard = fallbackOf("warning_low", "energy.battery.soc.percent") as number;
    expect(stateValue(deriveOperationalStates({ "energy.battery.soc.percent": reading(standard - 0.1, "%") }, { nowMs: NOW }), "energy.battery.constrained")).toBe(true);
    expect(stateValue(deriveOperationalStates({ "energy.battery.soc.percent": reading(standard, "%") }, { nowMs: NOW }), "energy.battery.constrained")).toBe(false);
  });

  it("calls a running pump dry at or below its stated standard flow, and never a stopped one", () => {
    const standard = fallbackOf("dry_run_lpm", "water.flow.lpm") as number;
    const pump = (state: string): SensorSnapshotValue => ({ value: state, unit: "state", quality: "OK", timestampUtc: new Date(NOW - 1000).toISOString() });
    const states = (flow: number, pumpState: string) => deriveOperationalStates({ "water.pump.status": pump(pumpState), "water.flow.lpm": reading(flow, "lpm") }, { nowMs: NOW });
    expect(typeof standard).toBe("number");
    expect(stateValue(states(standard, "ON"), "water.pump.dry_run_risk")).toBe(true);
    expect(stateValue(states(standard + 0.1, "ON"), "water.pump.dry_run_risk")).toBe(false);
    expect(stateValue(states(0, "OFF"), "water.pump.dry_run_risk")).toBe(false);
  });

  it("says nothing at all where the definitions say there is no standard", () => {
    const states = deriveOperationalStates(
      { "agri.soil.moisture.percent": reading(5, "%"), "energy.solar.power.kw": reading(9, "kW"), "energy.consumption.kw": reading(1, "kW") },
      { nowMs: NOW }
    );
    expect(fallbackOf("irrigate_below", "agri.soil.moisture.percent")).toBeNull();
    expect(fallbackOf("surplus_min_kw", "energy.solar.power.kw")).toBeNull();
    expect(states.map((state) => state.stateKey)).not.toContain("agri.irrigation_required");
    expect(states.map((state) => state.stateKey)).not.toContain("energy.surplus_available");
  });

  it("offers each limit only on readings the engine reads it from, and one that applies everywhere", () => {
    expect(limitsFor("water.tank.level.percent").map((definition) => definition.key).sort()).toEqual(["critical_low", "max_age_seconds", "warning_low"]);
    expect(limitsFor("energy.grid.import.kw").map((definition) => definition.key)).toEqual(["max_age_seconds"]);
    expect(pointLimitDefinitions.every((definition) => definition.min < definition.max)).toBe(true);
  });
});
