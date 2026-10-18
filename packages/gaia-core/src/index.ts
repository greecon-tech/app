import {
  AutomationRule,
  CanonicalPointName,
  CommandMessage,
  DerivedState,
  QualityFlag,
  RuleCondition,
  RulePriorityLevel,
  StateKey,
  TelemetryReading,
  UserRole,
  hasPermission
} from "@greecon/shared";
import { assessReadingAge, defaultMaxAgeSeconds, describeAge, ReadingAge } from "./freshness";

export * from "./alerts";
export * from "./freshness";
export * from "./health";

export interface SensorSnapshotValue {
  value: number | boolean | string;
  unit: string;
  quality: QualityFlag;
  /** When the measurement was taken (the source's clock), not when it reached the platform. */
  timestampUtc: string;
  /** How old this reading may be before it can no longer be trusted, when that is already known
   * (for example "never" for simulated data). Otherwise the point's `max_age_seconds` threshold, then
   * the default for its kind (see freshness.ts). */
  maxAgeSeconds?: number;
  /** The thresholds configured on the point (`critical_low`, `warning_low`, `irrigate_below`,
   * `dry_run_lpm`, `max_age_seconds`, ...). Anything unset or not a usable number falls back to the
   * platform default. */
  thresholds?: Record<string, number>;
}

function thresholdOf(sensor: SensorSnapshotValue | undefined, key: string, fallback: number): number {
  const configured = sensor?.thresholds?.[key];
  return typeof configured === "number" && Number.isFinite(configured) ? configured : fallback;
}

function maxAgeSecondsFor(name: CanonicalPointName, sensor: SensorSnapshotValue): number {
  if (sensor.maxAgeSeconds !== undefined) return sensor.maxAgeSeconds;
  const configured = sensor.thresholds?.max_age_seconds;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) return configured;
  return defaultMaxAgeSeconds(name);
}

/** How old a sensor's reading is, judged against its own limit (see freshness.ts). The one place
 * that decides "is this reading still current?", so a page and the safety rules cannot disagree. */
export function assessSensorAge(name: CanonicalPointName, sensor: SensorSnapshotValue, nowMs: number): ReadingAge {
  return assessReadingAge(sensor.timestampUtc, nowMs, maxAgeSecondsFor(name, sensor));
}

export type SensorSnapshot = Partial<Record<CanonicalPointName, SensorSnapshotValue>>;
export type StateSnapshot = Partial<Record<StateKey, DerivedState>>;

export interface SafetyLimits {
  maxPressureBar: number;
  dryRunFlowLpm: number;
  maxPumpRuntimeMinutes: number;
  minPumpRestMinutes: number;
  maxIrrigationRunMinutes: number;
}

export interface SafetyContext {
  command: CommandMessage;
  sensors: SensorSnapshot;
  states: StateSnapshot;
  limits: SafetyLimits;
  systemMode: "automatic" | "manual" | "maintenance" | "emergency_stop";
  lastPumpStartedAtUtc?: string;
  lastPumpStoppedAtUtc?: string;
}

export interface SafetyEvaluation {
  allowed: boolean;
  result: "passed" | "blocked";
  /** Why a command was refused. Empty when it was allowed. */
  reasons: string[];
  hardSafetyBlock: boolean;
  requiredAudit: boolean;
  /** Plain statements about how the command was judged, shown with the audit record (for example
   * that process checks do not apply to a stop). Never a reason to refuse. */
  notes?: string[];
}

export const defaultSafetyLimits: SafetyLimits = {
  maxPressureBar: 5.5,
  dryRunFlowLpm: 0.2,
  maxPumpRuntimeMinutes: 45,
  minPumpRestMinutes: 10,
  maxIrrigationRunMinutes: 120
};

const priorityWeight: Record<RulePriorityLevel, number> = {
  safety: 6,
  asset_protection: 5,
  compliance: 4,
  optimization: 3,
  efficiency: 2,
  advisory: 1
};

export function compareRulePriority(a: RulePriorityLevel, b: RulePriorityLevel): number {
  return priorityWeight[a] - priorityWeight[b];
}

export function requiredSensorPointsForCommand(command: CommandMessage): CanonicalPointName[] {
  if (command.target.canonicalName === "water.pump.command") {
    return ["water.flow.lpm", "water.pressure.bar"];
  }

  if (command.target.canonicalName === "agri.irrigation.command") {
    // Irrigation zones are a separate water circuit from the pump station's pressurized main —
    // they are not required to share a pressure sensor, so only soil moisture gates this command.
    return ["agri.soil.moisture.percent"];
  }

  return [];
}

// Pressure and flow are the inputs to the over-pressure and dry-run interlocks: if they cannot be
// trusted the interlock cannot be evaluated, which is a hard stop. Soil moisture only informs
// irrigation; losing it is a reason to look at the field, not a safety event.
function isProcessInterlockInput(pointName: CanonicalPointName): boolean {
  return pointName === "water.pressure.bar" || pointName === "water.flow.lpm";
}

const OFF_WORDS = new Set(["OFF", "STOP", "CLOSE", "CLOSED", "FALSE", "0"]);

/** An explicit "turn it off / close it". Anything not clearly that is treated as the hazardous
 * direction, so an unfamiliar value can only make the checks stricter, never looser. */
function isOffValue(value: number | boolean | string): boolean {
  if (value === false || value === 0) return true;
  return typeof value === "string" && OFF_WORDS.has(value.trim().toUpperCase());
}

const ACTUATOR_COMMANDS: ReadonlySet<CanonicalPointName> = new Set(["water.pump.command", "agri.irrigation.command"]);

/** Stop, close and disable move a machine toward its safe state. Process interlocks (over-pressure,
 * dry-run, bad or old data, rest time) exist to stop a dangerous START; applied to a stop they would
 * block the very action that resolves the condition, so they never apply to one. Who is asking and
 * why is still always checked. (docs/23-safety-and-security-case.md) */
export function isSafeDirectionCommand(command: CommandMessage): boolean {
  return ACTUATOR_COMMANDS.has(command.target.canonicalName) && isOffValue(command.requestedValue);
}

export function evaluateCommandSafety(context: SafetyContext): SafetyEvaluation {
  const reasons: string[] = [];
  const notes: string[] = [];
  let hardSafetyBlock = false;
  const { command, sensors, states, limits } = context;

  // Who is asking, and why: checked for every command, in either direction.
  if (!hasPermission(command.requestedByRole, "command:create")) {
    reasons.push(`Role ${command.requestedByRole} cannot issue equipment commands.`);
  }

  if (!command.reason || command.reason.trim().length < 6) {
    reasons.push("A clear operating reason is required.");
  }

  if (isSafeDirectionCommand(command)) {
    notes.push("A stop or close command is never blocked by process interlocks; only who is asking, and why, is checked.");
    const allowed = reasons.length === 0;
    return { allowed, result: allowed ? "passed" : "blocked", reasons, hardSafetyBlock: false, requiredAudit: true, notes };
  }

  // From here on the command moves toward a hazardous state (a start or open), so the process
  // interlocks apply.
  if (context.systemMode === "emergency_stop") {
    reasons.push("Emergency stop is active.");
    hardSafetyBlock = true;
  }

  if (command.manualOverride) {
    const expiresAt = Date.parse(command.manualOverride.expiresAtUtc);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      reasons.push("Manual override is expired or invalid.");
    }
    if (!["owner", "admin", "operator"].includes(command.requestedByRole)) {
      reasons.push("Manual override requires owner, admin, or operator role.");
    }
  }

  // "Now" for the purpose of judging how old a reading is: the moment the command was issued.
  const issuedAtMs = Date.parse(command.issuedAtUtc);
  const nowMs = Number.isFinite(issuedAtMs) ? issuedAtMs : Date.now();

  for (const pointName of requiredSensorPointsForCommand(command)) {
    const point = sensors[pointName];
    if (!point) {
      reasons.push(`Required sensor ${pointName} is unavailable.`);
      continue;
    }
    if (point.quality === "BAD") {
      reasons.push(`Required sensor ${pointName} has BAD quality.`);
      hardSafetyBlock = true;
    }

    // A reading can be quality OK and still be days old if the gateway stopped reporting. The last
    // known value is not the current value, so it cannot be used to decide that an action is safe.
    const age = assessSensorAge(pointName, point, nowMs);
    if (age.freshness === "unknown") {
      reasons.push(`Required sensor ${pointName} has no usable timestamp, so its reading cannot be trusted.`);
      hardSafetyBlock = hardSafetyBlock || isProcessInterlockInput(pointName);
    } else if (age.freshness === "stale") {
      reasons.push(
        `Required sensor ${pointName} is out of date: its last reading was ${describeAge(age.ageSeconds ?? 0)} ago (limit ${describeAge(age.maxAgeSeconds)}).`
      );
      hardSafetyBlock = hardSafetyBlock || isProcessInterlockInput(pointName);
    }
  }

  const pressure = numericSensor(sensors["water.pressure.bar"]);
  if (pressure !== undefined && pressure >= limits.maxPressureBar) {
    reasons.push(`Water pressure ${pressure.toFixed(2)} bar exceeds limit ${limits.maxPressureBar.toFixed(2)} bar.`);
    hardSafetyBlock = true;
  }

  // Dry-run is a condition of a pump that is RUNNING with no flow. Flow is zero before every start,
  // so it is deliberately not a condition for starting. A start is refused only when the pump is
  // already known to be running dry (stop it first).
  const dryRunState = states["water.pump.dry_run_risk"];
  if (dryRunState?.stateValue === true) {
    reasons.push("Dry-run risk is active: the pump is running without flow. Stop it before starting it again.");
    hardSafetyBlock = true;
  }

  if (command.target.canonicalName === "water.pump.command" && isOnValue(command.requestedValue)) {
    if (context.lastPumpStoppedAtUtc) {
      const minutesSinceStop = minutesBetween(context.lastPumpStoppedAtUtc, command.issuedAtUtc);
      if (minutesSinceStop < limits.minPumpRestMinutes) {
        reasons.push(`Pump rest time is ${minutesSinceStop.toFixed(1)} minutes; minimum is ${limits.minPumpRestMinutes}.`);
      }
    }
  }

  if (command.target.canonicalName === "agri.irrigation.command" && isOnValue(command.requestedValue) && command.manualOverride) {
    if (command.manualOverride.durationMinutes > limits.maxIrrigationRunMinutes) {
      reasons.push(`Irrigation run of ${command.manualOverride.durationMinutes} minutes exceeds the maximum single run of ${limits.maxIrrigationRunMinutes} minutes.`);
    }
  }

  const allowed = reasons.length === 0;
  return {
    allowed,
    result: allowed ? "passed" : "blocked",
    reasons,
    hardSafetyBlock,
    requiredAudit: true,
    notes: notes.length > 0 ? notes : undefined
  };
}

export interface DerivedStateEvaluation {
  stateKey: StateKey;
  stateValue: boolean;
  severity: "info" | "watch" | "warning" | "critical";
  confidence: number;
  reason: string;
}

export interface DeriveOptions {
  /** "Now", for judging how old each reading is. When omitted every reading is treated as current
   * (the behaviour before freshness existed); the platform always supplies it. */
  nowMs?: number;
  /** The site's own limits; anything not set falls back to defaultSafetyLimits. */
  limits?: Partial<SafetyLimits>;
}

export function deriveOperationalStates(sensors: SensorSnapshot, options: DeriveOptions = {}): DerivedStateEvaluation[] {
  const limits: SafetyLimits = { ...defaultSafetyLimits, ...options.limits };

  // A reading that has stopped being current says nothing about the present: deriving "tank not
  // critical" from a three-hour-old level would reassure falsely, deriving "critical" from it would
  // alarm falsely. Only current readings feed the states below; the rest are reported as a loss of
  // communication, which is the true statement about them.
  const stale: Array<{ name: CanonicalPointName; ageSeconds: number }> = [];
  let current: SensorSnapshot = sensors;
  if (options.nowMs !== undefined) {
    current = {};
    for (const [name, value] of Object.entries(sensors) as Array<[CanonicalPointName, SensorSnapshotValue | undefined]>) {
      if (!value) continue;
      const age = assessSensorAge(name, value, options.nowMs);
      if (age.freshness === "fresh") current[name] = value;
      else stale.push({ name, ageSeconds: age.ageSeconds ?? Number.POSITIVE_INFINITY });
    }
  }

  const tankLevel = numericSensor(current["water.tank.level.percent"]);
  const pressure = numericSensor(current["water.pressure.bar"]);
  const flow = numericSensor(current["water.flow.lpm"]);
  const solarPower = numericSensor(current["energy.solar.power.kw"]);
  const consumption = numericSensor(current["energy.consumption.kw"]);
  const batterySoc = numericSensor(current["energy.battery.soc.percent"]);
  const soilMoisture = numericSensor(current["agri.soil.moisture.percent"]);

  const states: DerivedStateEvaluation[] = [];

  if (tankLevel !== undefined) {
    const tank = current["water.tank.level.percent"];
    const criticalBelow = thresholdOf(tank, "critical_low", 15);
    const lowBelow = thresholdOf(tank, "warning_low", 35);
    states.push({
      stateKey: "water.tank.critical",
      stateValue: tankLevel < criticalBelow,
      severity: tankLevel < criticalBelow ? "critical" : "info",
      confidence: tank?.quality === "OK" ? 0.95 : 0.65,
      reason: `Tank level is ${tankLevel.toFixed(1)}%.`
    });
    states.push({
      stateKey: "water.tank.low",
      stateValue: tankLevel < lowBelow,
      severity: tankLevel < lowBelow ? "warning" : "info",
      confidence: 0.9,
      reason: `Tank low threshold evaluated at ${tankLevel.toFixed(1)}%.`
    });
  }

  // Dry-run is a pump that is RUNNING with no flow; a stopped pump has none by definition. If we
  // cannot tell whether it is running (no status point, or its reading is not current) we say
  // nothing rather than guess either way. Flow-only detection cannot tell the two apart.
  const pumpRunning = runningState(current["water.pump.status"]?.value);
  if (flow !== undefined && pumpRunning !== undefined) {
    // The meter's own setting wins over the site's limit, which wins over the platform default.
    const dryRunAt = thresholdOf(current["water.flow.lpm"], "dry_run_lpm", limits.dryRunFlowLpm);
    const dry = pumpRunning && flow <= dryRunAt;
    states.push({
      stateKey: "water.pump.dry_run_risk",
      stateValue: dry,
      severity: dry ? "critical" : "info",
      confidence: 0.9,
      reason: pumpRunning ? `The pump is running and flow is ${flow.toFixed(2)} lpm.` : "The pump is stopped, so no flow is expected."
    });
  }

  if (Object.keys(current).length > 0) {
    states.push({
      stateKey: "system.sensor_quality_bad",
      stateValue: hasBadQuality(current),
      severity: hasBadQuality(current) ? "warning" : "info",
      confidence: 1,
      reason: hasBadQuality(current) ? "One or more sensors report BAD quality." : "Sensor quality is acceptable."
    });
  }

  if (solarPower !== undefined && consumption !== undefined) {
    const surplus = solarPower - consumption;
    states.push({
      stateKey: "energy.surplus_available",
      stateValue: surplus > 1.5,
      severity: surplus > 1.5 ? "watch" : "info",
      confidence: 0.85,
      reason: `Solar surplus estimate is ${surplus.toFixed(1)} kW.`
    });
  }

  if (batterySoc !== undefined) {
    const constrainedBelow = thresholdOf(current["energy.battery.soc.percent"], "warning_low", 25);
    states.push({
      stateKey: "energy.battery.constrained",
      stateValue: batterySoc < constrainedBelow,
      severity: batterySoc < constrainedBelow ? "warning" : "info",
      confidence: 0.9,
      reason: `Battery state of charge is ${batterySoc.toFixed(1)}%.`
    });
  }

  // When to irrigate belongs to the field: the same percentage is waterlogged in sandy soil and
  // bone dry in clay, and it depends on the crop, the root depth and the sensor (FAO-56; see
  // docs/19-domain-playbook.md). So there is no platform-wide default. Without the field's own
  // start-at limit the platform does not say whether irrigation is needed, which is the honest
  // answer, rather than guessing from a number that suits no particular soil.
  const irrigateBelowConfigured = current["agri.soil.moisture.percent"]?.thresholds?.irrigate_below;
  if (soilMoisture !== undefined && typeof irrigateBelowConfigured === "number" && Number.isFinite(irrigateBelowConfigured)) {
    states.push({
      stateKey: "agri.irrigation_required",
      stateValue: soilMoisture < irrigateBelowConfigured,
      severity: soilMoisture < irrigateBelowConfigured ? "watch" : "info",
      confidence: 0.85,
      reason: `Soil moisture is ${soilMoisture.toFixed(1)}%; this field's start-at limit is ${irrigateBelowConfigured.toFixed(1)}%.`
    });
  }

  // Only meaningful when there is something to be out of date: a site with no readings at all has
  // nothing connected yet, which the platform reports separately.
  if (options.nowMs !== undefined && Object.keys(sensors).length > 0) {
    const oldest = stale.reduce((max, item) => Math.max(max, item.ageSeconds), 0);
    states.push({
      stateKey: "system.communication_degraded",
      stateValue: stale.length > 0,
      severity: stale.length > 0 ? "warning" : "info",
      confidence: 1,
      reason:
        stale.length > 0
          ? `${stale.length} ${stale.length === 1 ? "reading is" : "readings are"} out of date; the oldest was taken ${describeAge(oldest)} ago.`
          : "All readings are current."
    });
  }

  return states;
}

export interface RuleSimulationResult {
  ruleId: string;
  fired: boolean;
  simulated: boolean;
  priority: RulePriorityLevel;
  explanation: string;
  actions: string[];
  safetyNotes: string[];
}

export function simulateRule(rule: AutomationRule, sensors: SensorSnapshot, states: StateSnapshot): RuleSimulationResult {
  const conditionResults = rule.conditions.map((condition) => evaluateCondition(condition, sensors, states));
  const constraintResults = rule.constraints.map((condition) => evaluateCondition(condition, sensors, states));
  const fired = rule.enabled && conditionResults.every(Boolean) && constraintResults.every(Boolean);

  return {
    ruleId: rule.id,
    fired,
    simulated: rule.executionMode === "simulation" || rule.executionMode === "advisory",
    priority: rule.priority,
    explanation: fired ? renderExplanation(rule, sensors, states) : `Rule ${rule.name} did not fire under current state.`,
    actions: fired ? rule.actions.map((action) => action.message) : [],
    safetyNotes: fired && ["safety", "asset_protection"].includes(rule.priority)
      ? ["Safety and asset protection rules take precedence over optimization."]
      : []
  };
}

export function normalizeTelemetryTimestamp(reading: TelemetryReading): TelemetryReading {
  const timestampUtc = new Date(reading.timestampUtc).toISOString();
  return {
    ...reading,
    timestampUtc,
    ingestionTimestampUtc: reading.ingestionTimestampUtc || new Date().toISOString()
  };
}

function evaluateCondition(condition: RuleCondition, sensors: SensorSnapshot, states: StateSnapshot): boolean {
  const actual = condition.point
    ? sensors[condition.point]?.value
    : condition.stateKey
      ? states[condition.stateKey]?.stateValue
      : undefined;

  if (actual === undefined) return false;

  switch (condition.operator) {
    case "lt":
      return Number(actual) < Number(condition.value);
    case "lte":
      return Number(actual) <= Number(condition.value);
    case "gt":
      return Number(actual) > Number(condition.value);
    case "gte":
      return Number(actual) >= Number(condition.value);
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    default:
      return false;
  }
}

function renderExplanation(rule: AutomationRule, sensors: SensorSnapshot, states: StateSnapshot): string {
  const fragments = rule.conditions.map((condition) => {
    if (condition.point) {
      const value = sensors[condition.point]?.value;
      return `${condition.point} is ${String(value)}`;
    }
    if (condition.stateKey) {
      const value = states[condition.stateKey]?.stateValue;
      return `${condition.stateKey} is ${String(value)}`;
    }
    return "condition matched";
  });

  return `${rule.name}: ${fragments.join(", ")}. ${rule.explanationTemplate}`;
}

function numericSensor(sensor: SensorSnapshotValue | undefined): number | undefined {
  if (!sensor || typeof sensor.value !== "number") return undefined;
  return sensor.value;
}

function hasBadQuality(sensors: SensorSnapshot): boolean {
  return Object.values(sensors).some((sensor) => sensor?.quality === "BAD");
}

/** Whether a pump status reading says running (true), stopped (false), or neither (undefined). */
function runningState(value: number | boolean | string | undefined): boolean | undefined {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value !== "string") return undefined;

  const word = value.trim().toUpperCase();
  if (["ON", "RUN", "RUNNING", "STARTED"].includes(word)) return true;
  if (["OFF", "STOP", "STOPPED"].includes(word)) return false;
  return undefined;
}

function isOnValue(value: number | boolean | string): boolean {
  return value === true || value === 1 || String(value).toUpperCase() === "ON";
}

function minutesBetween(startUtc: string, endUtc: string): number {
  return (Date.parse(endUtc) - Date.parse(startUtc)) / 60000;
}

export function roleCanCommand(role: UserRole): boolean {
  return hasPermission(role, "command:create");
}
