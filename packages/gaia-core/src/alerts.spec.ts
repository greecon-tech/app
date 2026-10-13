import { describe, expect, it } from "vitest";
import { alertConditionsFromStates, reconcileAlerts, type AlertCondition, type ReconcilableAlert } from "./alerts";

const NOW = Date.parse("2026-10-13T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const state = (stateKey: string, stateValue: boolean, severity: "info" | "watch" | "warning" | "critical" = "warning") => ({
  stateKey: stateKey as never,
  stateValue,
  severity,
  reason: ""
});

describe("alertConditionsFromStates", () => {
  it("raises nothing while every state is normal", () => {
    expect(
      alertConditionsFromStates([
        state("water.tank.critical", false, "info"),
        state("water.tank.low", false, "info"),
        state("system.communication_degraded", false, "info")
      ])
    ).toEqual([]);
  });

  it("raises one alert for a tank, the worst one: critical suppresses low", () => {
    const conditions = alertConditionsFromStates([state("water.tank.critical", true, "critical"), state("water.tank.low", true, "warning")]);
    expect(conditions.map((condition) => condition.category)).toEqual(["water_tank_critical"]);
    expect(conditions[0]?.severity).toBe("critical");
  });

  it("raises a low-tank alert on its own when the tank is low but not critical", () => {
    const conditions = alertConditionsFromStates([state("water.tank.critical", false, "info"), state("water.tank.low", true, "warning")]);
    expect(conditions.map((condition) => condition.category)).toEqual(["water_tank_low"]);
  });

  it("maps the other abnormal states to their own categories", () => {
    const conditions = alertConditionsFromStates([
      state("water.pump.dry_run_risk", true, "critical"),
      state("energy.battery.constrained", true, "warning"),
      state("system.communication_degraded", true, "warning"),
      state("system.sensor_quality_bad", true, "warning")
    ]);
    expect(conditions.map((condition) => condition.category).sort()).toEqual(
      ["battery_constrained", "communication_degraded", "pump_dry_run_risk", "sensor_quality_degradation"].sort()
    );
  });

  it("does not alarm on ordinary operation: needing irrigation or having surplus solar is not a fault", () => {
    expect(alertConditionsFromStates([state("agri.irrigation_required", true, "watch"), state("energy.surplus_available", true, "watch")])).toEqual([]);
  });

  it("writes every alert as what happened, then what to do, in plain language", () => {
    const conditions = alertConditionsFromStates([
      state("water.tank.critical", true, "critical"),
      state("system.communication_degraded", true, "warning")
    ]);
    for (const condition of conditions) {
      expect(condition.title.length).toBeGreaterThan(10);
      expect(condition.suggestedAction.length).toBeGreaterThan(20);
      expect(`${condition.title} ${condition.suggestedAction}`).not.toMatch(/!|\bGAIA\b/);
    }
  });
});

describe("reconcileAlerts", () => {
  const tankCritical: AlertCondition = {
    category: "water_tank_critical",
    severity: "critical",
    title: "Tank level is critical",
    suggestedAction: "Check the water supply."
  };
  const alert = (overrides: Partial<ReconcilableAlert> = {}): ReconcilableAlert => ({
    id: "alert-1",
    category: "water_tank_critical",
    severity: "critical",
    status: "open",
    ...overrides
  });

  it("opens an alert for a new condition", () => {
    expect(reconcileAlerts([tankCritical], [], NOW)).toEqual([{ type: "open", condition: tankCritical }]);
  });

  it("does nothing while an existing alert already covers the condition", () => {
    expect(reconcileAlerts([tankCritical], [alert()], NOW)).toEqual([]);
  });

  it("leaves an acknowledged alert acknowledged: a person already knows", () => {
    expect(reconcileAlerts([tankCritical], [alert({ status: "acknowledged" })], NOW)).toEqual([]);
  });

  it("resolves an alert when its condition has cleared", () => {
    expect(reconcileAlerts([], [alert()], NOW)).toEqual([{ type: "resolve", alertId: "alert-1" }]);
    expect(reconcileAlerts([], [alert({ status: "acknowledged" })], NOW)).toEqual([{ type: "resolve", alertId: "alert-1" }]);
  });

  it("brings back the same alert, not a new one, when a condition returns within the flap window", () => {
    const resolved = alert({ status: "resolved", resolvedAtUtc: minutesAgo(5) });
    expect(reconcileAlerts([tankCritical], [resolved], NOW)).toEqual([{ type: "reopen", alertId: "alert-1", condition: tankCritical }]);
  });

  it("opens a new alert when the condition returns long after the old one was resolved", () => {
    const resolved = alert({ status: "resolved", resolvedAtUtc: minutesAgo(120) });
    expect(reconcileAlerts([tankCritical], [resolved], NOW)).toEqual([{ type: "open", condition: tankCritical }]);
  });

  it("escalates, and re-opens an acknowledged alert, when the situation gets worse", () => {
    const lowAlert = alert({ category: "water_tank_critical", severity: "warning", status: "acknowledged" });
    expect(reconcileAlerts([tankCritical], [lowAlert], NOW)).toEqual([{ type: "escalate", alertId: "alert-1", condition: tankCritical, reopen: true }]);

    const openLow = alert({ severity: "warning", status: "open" });
    expect(reconcileAlerts([tankCritical], [openLow], NOW)).toEqual([{ type: "escalate", alertId: "alert-1", condition: tankCritical, reopen: false }]);
  });

  it("quietly lowers the severity when it improves, without disturbing anyone", () => {
    const warning: AlertCondition = { ...tankCritical, severity: "warning" };
    expect(reconcileAlerts([warning], [alert({ severity: "critical" })], NOW)).toEqual([{ type: "update", alertId: "alert-1", condition: warning }]);
  });

  it("never touches alerts it does not own, such as manually created or seeded ones", () => {
    const manual = alert({ id: "manual-1", category: "resource_threshold" as never });
    expect(reconcileAlerts([], [manual], NOW)).toEqual([]);
  });

  it("closes duplicates, keeping one, so a condition can never show twice", () => {
    const changes = reconcileAlerts([tankCritical], [alert({ id: "a" }), alert({ id: "b" })], NOW);
    expect(changes).toEqual([{ type: "resolve", alertId: "b" }]);
  });
});
