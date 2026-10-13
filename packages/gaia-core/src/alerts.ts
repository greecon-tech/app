import { AlertMessage, SeverityLevel, StateKey } from "@greecon/shared";

// Which alerts should exist, given what is true now. Pure: it looks at the derived states and the
// alerts already on record and says what to change. Storing the changes, and telling anyone, is the
// caller's job.
//
// Principles (ISA-18.2 / EEMUA 191, see docs/20-design-and-interaction.md):
//  - An alert means something abnormal that someone should act on. Needing irrigation, or having
//    surplus solar, is ordinary operation and is NOT an alert.
//  - One alert per condition, however long it lasts or however often the value wobbles around its
//    threshold: no duplicates, and a condition that clears and returns shortly after re-opens the
//    same alert instead of paging again.
//  - An alert clears itself when the condition clears; a person acknowledging it never hides a
//    condition that gets worse.

export type AlertCategory = AlertMessage["category"];

export interface AlertCondition {
  category: AlertCategory;
  severity: SeverityLevel;
  /** What is wrong, in a sentence a non-engineer understands. No numbers: they change while the alert stands. */
  title: string;
  /** The first thing to do. */
  suggestedAction: string;
}

/** The categories this engine creates and clears. Alerts in any other category (seeded examples,
 * ones raised by hand) are never touched. */
export const MANAGED_ALERT_CATEGORIES: ReadonlySet<AlertCategory> = new Set<AlertCategory>([
  "water_tank_critical",
  "water_tank_low",
  "pump_dry_run_risk",
  "battery_constrained",
  "communication_degraded",
  "sensor_quality_degradation"
]);

/** How long after an alert clears that the same condition returning counts as the same alert. */
export const FLAP_WINDOW_SECONDS = 15 * 60;

export interface ConditionState {
  stateKey: StateKey;
  stateValue: boolean | number | string;
  severity: SeverityLevel;
}

export function alertConditionsFromStates(states: ReadonlyArray<ConditionState>): AlertCondition[] {
  const active = (key: StateKey) => states.find((state) => state.stateKey === key && state.stateValue === true);
  const conditions: AlertCondition[] = [];

  // A tank is one thing with one level: critical includes low, so only the worse alert is raised.
  const tankCritical = active("water.tank.critical");
  const tankLow = active("water.tank.low");
  if (tankCritical) {
    conditions.push({
      category: "water_tank_critical",
      severity: "critical",
      title: "Tank level is critical",
      suggestedAction: "Check the water supply and refill the tank as soon as it is safe to do so."
    });
  } else if (tankLow) {
    conditions.push({
      category: "water_tank_low",
      severity: "warning",
      title: "Tank level is low",
      suggestedAction: "Plan a refill before the level drops further."
    });
  }

  const dryRun = active("water.pump.dry_run_risk");
  if (dryRun) {
    conditions.push({
      category: "pump_dry_run_risk",
      severity: "critical",
      title: "The pump is running but no water is flowing",
      suggestedAction: "Stop the pump, then check the water source and the intake line before starting it again."
    });
  }

  if (active("energy.battery.constrained")) {
    conditions.push({
      category: "battery_constrained",
      severity: "warning",
      title: "Battery charge is low",
      suggestedAction: "Reduce non-essential load or check that the battery is charging."
    });
  }

  if (active("system.communication_degraded")) {
    conditions.push({
      category: "communication_degraded",
      severity: "warning",
      title: "Readings from this site are out of date",
      suggestedAction:
        "Check the gateway's power and network connection. Until readings resume, the values shown are the last ones received."
    });
  }

  if (active("system.sensor_quality_bad")) {
    conditions.push({
      category: "sensor_quality_degradation",
      severity: "warning",
      title: "A sensor is reporting bad data",
      suggestedAction: "Inspect the sensor and its wiring. Commands that depend on it stay blocked until it recovers."
    });
  }

  return conditions;
}

export interface ReconcilableAlert {
  id: string;
  category: AlertCategory;
  severity: SeverityLevel;
  status: "open" | "acknowledged" | "resolved";
  /** When it cleared, for alerts that have. */
  resolvedAtUtc?: string;
}

export type AlertChange =
  | { type: "open"; condition: AlertCondition }
  | { type: "reopen"; alertId: string; condition: AlertCondition }
  | { type: "escalate"; alertId: string; condition: AlertCondition; reopen: boolean }
  | { type: "update"; alertId: string; condition: AlertCondition }
  | { type: "resolve"; alertId: string };

const severityRank: Record<SeverityLevel, number> = { info: 0, watch: 1, warning: 2, critical: 3 };

/** What to change so the alerts for ONE site match what is true now. `existing` is that site's alerts. */
export function reconcileAlerts(
  desired: ReadonlyArray<AlertCondition>,
  existing: ReadonlyArray<ReconcilableAlert>,
  nowMs: number,
  flapWindowSeconds: number = FLAP_WINDOW_SECONDS
): AlertChange[] {
  const changes: AlertChange[] = [];
  const managed = existing.filter((alert) => MANAGED_ALERT_CATEGORIES.has(alert.category));
  const wanted = new Set(desired.map((condition) => condition.category));

  for (const condition of desired) {
    const live = managed.filter((alert) => alert.category === condition.category && alert.status !== "resolved");
    const keep = live[0];

    // Never two live alerts for one condition: close any extras.
    for (const duplicate of live.slice(1)) changes.push({ type: "resolve", alertId: duplicate.id });

    if (keep) {
      const worse = severityRank[condition.severity] > severityRank[keep.severity];
      const better = severityRank[condition.severity] < severityRank[keep.severity];
      if (worse) changes.push({ type: "escalate", alertId: keep.id, condition, reopen: keep.status === "acknowledged" });
      else if (better) changes.push({ type: "update", alertId: keep.id, condition });
      continue;
    }

    const recentlyCleared = managed
      .filter((alert) => alert.category === condition.category && alert.status === "resolved" && alert.resolvedAtUtc)
      .filter((alert) => nowMs - Date.parse(alert.resolvedAtUtc as string) <= flapWindowSeconds * 1000)
      .sort((a, b) => Date.parse(b.resolvedAtUtc as string) - Date.parse(a.resolvedAtUtc as string))[0];

    if (recentlyCleared) changes.push({ type: "reopen", alertId: recentlyCleared.id, condition });
    else changes.push({ type: "open", condition });
  }

  for (const alert of managed) {
    if (alert.status !== "resolved" && !wanted.has(alert.category)) changes.push({ type: "resolve", alertId: alert.id });
  }

  return changes;
}
