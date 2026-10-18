import { describe, expect, it } from "vitest";
import { AutomationRule, CommandMessage, DEMO_TENANT_ID } from "@greecon/shared";
import {
  defaultSafetyLimits,
  deriveOperationalStates,
  evaluateCommandSafety,
  simulateRule,
  type SafetyContext,
  type SensorSnapshot,
  type SensorSnapshotValue
} from "./index";

const command: CommandMessage = {
  messageType: "command",
  commandId: "cmd-1",
  tenantId: DEMO_TENANT_ID,
  siteId: "site-1",
  target: {
    deviceId: "pump-1",
    pointId: "point-command",
    canonicalName: "water.pump.command"
  },
  requestedValue: "ON",
  requestedBy: "operator-1",
  requestedByRole: "operator",
  reason: "Refill tank during operating window",
  issuedAtUtc: "2026-04-29T10:00:00.000Z",
  correlationId: "corr-1"
};

const healthySensors: SensorSnapshot = {
  "water.flow.lpm": { value: 12, unit: "lpm", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" },
  "water.pressure.bar": { value: 2.4, unit: "bar", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" },
  "water.tank.level.percent": { value: 42, unit: "%", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" },
  "energy.solar.power.kw": { value: 8.4, unit: "kW", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" },
  "energy.consumption.kw": { value: 4.1, unit: "kW", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" }
};

function context(overrides: Partial<SafetyContext> = {}): SafetyContext {
  return {
    command,
    sensors: healthySensors,
    states: {},
    limits: defaultSafetyLimits,
    systemMode: "automatic",
    ...overrides
  };
}

describe("GAIA safety primitives", () => {
  it("allows a command when role, quality, pressure, and interlocks are valid", () => {
    const result = evaluateCommandSafety(context());
    expect(result.allowed).toBe(true);
    expect(result.result).toBe("passed");
  });

  it("blocks viewers from issuing commands", () => {
    const result = evaluateCommandSafety(
      context({
        command: { ...command, requestedByRole: "viewer" }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("viewer");
  });

  it("blocks commands when a required sensor has BAD quality", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          "water.flow.lpm": { value: 11, unit: "lpm", quality: "BAD", timestampUtc: "2026-04-29T09:59:00.000Z" }
        }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.hardSafetyBlock).toBe(true);
  });

  it("does not refuse a pump start because flow is zero: a stopped pump has no flow", () => {
    // Flow is zero before every start. Gating a start on discharge flow would make it impossible to
    // ever start a pump remotely; dry-run is a condition of a pump that is RUNNING (see derived states).
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          "water.flow.lpm": { value: 0, unit: "lpm", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" }
        }
      })
    );
    expect(result.allowed).toBe(true);
  });

  it("refuses to start a pump that is already running without flow", () => {
    const result = evaluateCommandSafety(
      context({
        states: {
          "water.pump.dry_run_risk": {
            id: "state-1",
            tenantId: DEMO_TENANT_ID,
            siteId: "site-1",
            stateKey: "water.pump.dry_run_risk",
            stateValue: true,
            severity: "critical",
            confidence: 0.9,
            reason: "The pump is running and flow is 0.00 lpm.",
            createdAtUtc: "2026-04-29T09:59:00.000Z",
            updatedAtUtc: "2026-04-29T09:59:00.000Z"
          }
        }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.hardSafetyBlock).toBe(true);
    expect(result.reasons.join(" ")).toContain("Dry-run risk");
  });

  it("blocks overpressure", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          "water.pressure.bar": { value: 6.1, unit: "bar", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" }
        }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("exceeds limit");
  });

  it("allows a manual irrigation command with only a soil moisture reading and no pressure sensor", () => {
    const irrigationCommand: CommandMessage = {
      ...command,
      target: { deviceId: "irrigation-1", pointId: "point-irrigation", canonicalName: "agri.irrigation.command" },
      manualOverride: { durationMinutes: 30, expiresAtUtc: "2099-01-01T00:00:00.000Z" }
    };

    const result = evaluateCommandSafety(
      context({
        command: irrigationCommand,
        // Irrigation zones have no water.pressure.bar sensor at all — this must not be required.
        sensors: { "agri.soil.moisture.percent": { value: 22, unit: "%", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" } }
      })
    );

    expect(result.allowed).toBe(true);
  });

  it("blocks a manual irrigation run that exceeds the maximum single-run duration", () => {
    const irrigationCommand: CommandMessage = {
      ...command,
      target: { deviceId: "irrigation-1", pointId: "point-irrigation", canonicalName: "agri.irrigation.command" },
      manualOverride: { durationMinutes: 200, expiresAtUtc: "2099-01-01T00:00:00.000Z" }
    };

    const result = evaluateCommandSafety(
      context({
        command: irrigationCommand,
        sensors: { "agri.soil.moisture.percent": { value: 22, unit: "%", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z" } }
      })
    );

    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("exceeds the maximum single run");
  });

  it("derives irrigation and energy surplus states from normalized telemetry", () => {
    const states = deriveOperationalStates({
      ...healthySensors,
      "energy.solar.power.kw": { ...(healthySensors["energy.solar.power.kw"] as SensorSnapshotValue), thresholds: { surplus_min_kw: 1.5 } },
      "agri.soil.moisture.percent": { value: 21, unit: "%", quality: "OK", timestampUtc: "2026-04-29T09:59:00.000Z", thresholds: { irrigate_below: 28 } }
    });
    expect(states.find((state) => state.stateKey === "agri.irrigation_required")?.stateValue).toBe(true);
    expect(states.find((state) => state.stateKey === "energy.surplus_available")?.stateValue).toBe(true);
  });

  it("simulates an advisory rule without actuation", () => {
    const rule: AutomationRule = {
      id: "rule-advisory",
      tenantId: DEMO_TENANT_ID,
      name: "Advisory: reduce irrigation if rain forecast placeholder is true",
      priority: "advisory",
      triggerType: "forecast",
      conditions: [{ stateKey: "agri.irrigation_required", operator: "eq", value: true }],
      constraints: [],
      actions: [{ type: "recommendation", message: "Review forecast before irrigation." }],
      executionMode: "simulation",
      explanationTemplate: "Forecast-aware irrigation remains in advisory mode for MVP.",
      rollbackBehavior: "No physical action is dispatched.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "system",
      updatedBy: "system"
    };

    const result = simulateRule(rule, healthySensors, {
      "agri.irrigation_required": {
        id: "state-1",
        tenantId: DEMO_TENANT_ID,
        siteId: "site-1",
        stateKey: "agri.irrigation_required",
        stateValue: true,
        severity: "watch",
        confidence: 0.9,
        reason: "Soil moisture below threshold.",
        createdAtUtc: "2026-04-29T09:59:00.000Z",
        updatedAtUtc: "2026-04-29T09:59:00.000Z"
      }
    });

    expect(result.fired).toBe(true);
    expect(result.simulated).toBe(true);
  });
});

describe("GAIA safety: data freshness", () => {
  // The command in this file is issued at 2026-04-29T10:00:00Z.
  const at = (minutesBeforeCommand: number) => new Date(Date.parse("2026-04-29T10:00:00.000Z") - minutesBeforeCommand * 60_000).toISOString();

  it("blocks a pump start when a required sensor's last reading is too old to trust", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          // The gateway went quiet: the last reading still says 2.4 bar, quality OK, ten minutes ago.
          "water.pressure.bar": { value: 2.4, unit: "bar", quality: "OK", timestampUtc: at(10) }
        }
      })
    );

    expect(result.allowed).toBe(false);
    expect(result.hardSafetyBlock).toBe(true);
    expect(result.reasons.join(" ")).toContain("water.pressure.bar is out of date");
    expect(result.reasons.join(" ")).toContain("10 minutes");
  });

  it("still allows the start when every required reading is within its limit", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          "water.pressure.bar": { value: 2.4, unit: "bar", quality: "OK", timestampUtc: at(4) },
          "water.flow.lpm": { value: 12, unit: "lpm", quality: "OK", timestampUtc: at(4) }
        }
      })
    );
    expect(result.allowed).toBe(true);
  });

  it("gives a slow field sensor hours, not minutes, before calling it out of date", () => {
    const irrigation: CommandMessage = {
      ...command,
      target: { deviceId: "valve-1", pointId: "point-irrigation", canonicalName: "agri.irrigation.command" }
    };

    const twoHoursOld = evaluateCommandSafety(
      context({
        command: irrigation,
        sensors: { "agri.soil.moisture.percent": { value: 22, unit: "%", quality: "OK", timestampUtc: at(120) } }
      })
    );
    expect(twoHoursOld.allowed).toBe(true);

    const fiveHoursOld = evaluateCommandSafety(
      context({
        command: irrigation,
        sensors: { "agri.soil.moisture.percent": { value: 22, unit: "%", quality: "OK", timestampUtc: at(300) } }
      })
    );
    expect(fiveHoursOld.allowed).toBe(false);
    expect(fiveHoursOld.reasons.join(" ")).toContain("agri.soil.moisture.percent is out of date");
    // A stale soil reading is a reason to check the field, not a hard safety stop.
    expect(fiveHoursOld.hardSafetyBlock).toBe(false);
  });

  it("honours a limit set on the point itself", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          // A fast meter: this one is expected to report every few seconds, so two minutes is already late.
          "water.flow.lpm": { value: 12, unit: "lpm", quality: "OK", timestampUtc: at(2), maxAgeSeconds: 60 }
        }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("water.flow.lpm is out of date");
  });

  it("does not call a reading with no usable timestamp fresh", () => {
    const result = evaluateCommandSafety(
      context({
        sensors: {
          ...healthySensors,
          "water.flow.lpm": { value: 12, unit: "lpm", quality: "OK", timestampUtc: "garbage" }
        }
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("water.flow.lpm has no usable timestamp");
  });
});

describe("GAIA safety: stopping is always possible", () => {
  const stop: CommandMessage = { ...command, requestedValue: "OFF", reason: "Stop the pump now" };
  const at = (minutesBeforeCommand: number) => new Date(Date.parse("2026-04-29T10:00:00.000Z") - minutesBeforeCommand * 60_000).toISOString();
  const dryRunState = {
    "water.pump.dry_run_risk": {
      id: "state-1",
      tenantId: DEMO_TENANT_ID,
      siteId: "site-1",
      stateKey: "water.pump.dry_run_risk" as const,
      stateValue: true,
      severity: "critical" as const,
      confidence: 0.9,
      reason: "The pump is running and flow is 0.00 lpm.",
      createdAtUtc: at(2),
      updatedAtUtc: at(1)
    }
  };

  it("lets a stop through when the same condition would refuse a start: over-pressure", () => {
    const sensors: SensorSnapshot = {
      ...healthySensors,
      "water.pressure.bar": { value: 6.1, unit: "bar", quality: "OK", timestampUtc: at(1) }
    };
    expect(evaluateCommandSafety(context({ sensors })).allowed).toBe(false);

    const result = evaluateCommandSafety(context({ command: stop, sensors }));
    expect(result.allowed).toBe(true);
    expect(result.hardSafetyBlock).toBe(false);
  });

  it("lets a stop through while the pump is running dry, which is exactly when it is needed", () => {
    expect(evaluateCommandSafety(context({ states: dryRunState })).allowed).toBe(false);
    expect(evaluateCommandSafety(context({ command: stop, states: dryRunState })).allowed).toBe(true);
  });

  it("lets a stop through when a required sensor is bad, missing or out of date", () => {
    const bad: SensorSnapshot = { "water.pressure.bar": { value: 2, unit: "bar", quality: "BAD", timestampUtc: at(1) } };
    const stale: SensorSnapshot = {
      "water.flow.lpm": { value: 12, unit: "lpm", quality: "OK", timestampUtc: at(60) },
      "water.pressure.bar": { value: 2, unit: "bar", quality: "OK", timestampUtc: at(60) }
    };
    for (const sensors of [bad, stale, {} as SensorSnapshot]) {
      expect(evaluateCommandSafety(context({ command: stop, sensors })).allowed).toBe(true);
    }
  });

  it("lets a stop through straight after a stop, inside the rest period that delays a restart", () => {
    const result = evaluateCommandSafety(context({ command: stop, lastPumpStoppedAtUtc: at(1) }));
    expect(result.allowed).toBe(true);
  });

  it("lets a stop through while emergency stop is active (the pump is meant to be stopped)", () => {
    expect(evaluateCommandSafety(context({ systemMode: "emergency_stop" })).allowed).toBe(false);
    expect(evaluateCommandSafety(context({ command: stop, systemMode: "emergency_stop" })).allowed).toBe(true);
  });

  it("treats closing an irrigation valve the same way", () => {
    const close: CommandMessage = {
      ...command,
      target: { deviceId: "valve-1", pointId: "point-irrigation", canonicalName: "agri.irrigation.command" },
      requestedValue: "OFF",
      reason: "Close the zone valve"
    };
    expect(evaluateCommandSafety(context({ command: close, sensors: {} })).allowed).toBe(true);
  });

  it("recognises the other ways of saying stop", () => {
    for (const requestedValue of [false, 0, "off", "STOP", "close", "Closed"]) {
      expect(evaluateCommandSafety(context({ command: { ...stop, requestedValue }, sensors: {} })).allowed).toBe(true);
    }
  });

  it("still requires who and why: authority and a reason are never skipped", () => {
    const viewerStop = evaluateCommandSafety(context({ command: { ...stop, requestedByRole: "viewer" } }));
    expect(viewerStop.allowed).toBe(false);
    expect(viewerStop.reasons.join(" ")).toContain("cannot issue equipment commands");

    const noReason = evaluateCommandSafety(context({ command: { ...stop, reason: "" } }));
    expect(noReason.allowed).toBe(false);
    expect(noReason.reasons.join(" ")).toContain("operating reason");
  });

  it("explains why process checks were not applied, and always asks for an audit record", () => {
    const result = evaluateCommandSafety(context({ command: stop }));
    expect(result.notes?.join(" ")).toContain("never blocked by process interlocks");
    expect(result.requiredAudit).toBe(true);
  });

  it("does not let a word that merely contains 'off' turn a start into a stop", () => {
    const sensors: SensorSnapshot = { ...healthySensors, "water.pressure.bar": { value: 6.1, unit: "bar", quality: "OK", timestampUtc: at(1) } };
    for (const requestedValue of ["ON", "START", "turn off valve later", 1, true]) {
      expect(evaluateCommandSafety(context({ command: { ...stop, requestedValue }, sensors })).allowed).toBe(false);
    }
  });
});
