import { describe, expect, it } from "vitest";
import { describeConnection, describeSource, gatewayContact, isManualSetupStep, validateHeartbeat } from "./setup";
import { profileByKey } from "./device-profiles";

const NOW = Date.parse("2026-10-19T10:00:00Z");
const secondsAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("gatewayContact", () => {
  it("says never when the box has not reported", () => {
    expect(gatewayContact(undefined, NOW)).toBe("never");
    expect(gatewayContact("not a date", NOW)).toBe("never");
  });

  it("is online within two minutes, late up to fifteen, offline after", () => {
    expect(gatewayContact(secondsAgo(20), NOW)).toBe("online");
    expect(gatewayContact(secondsAgo(120), NOW)).toBe("online");
    expect(gatewayContact(secondsAgo(121), NOW)).toBe("late");
    expect(gatewayContact(secondsAgo(900), NOW)).toBe("late");
    expect(gatewayContact(secondsAgo(901), NOW)).toBe("offline");
  });

  it("treats a heartbeat stamped slightly in the future as online rather than failing", () => {
    expect(gatewayContact(secondsAgo(-5), NOW)).toBe("online");
  });
});

describe("describing equipment in words", () => {
  it("writes an address the way someone at the box says it", () => {
    expect(describeConnection({ kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 2 })).toBe("192.168.1.50:502, unit 2");
  });

  it("describes the grid meter's two readings from one register", () => {
    const profile = profileByKey("eastron-sdm630-grid");
    const [imported, exported] = (profile?.points ?? []).map((point) => describeSource(point.source));
    expect(imported).toBe("input register 52, float32, ×0.001, only when positive");
    expect(exported).toBe("input register 52, float32, ×0.001, only when negative, as a positive number");
  });

  it("describes a 4-20 mA conversion and a low-word-first register", () => {
    expect(
      describeSource({ kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 10 } })
    ).toBe("holding register 0, uint16, 4 to 20 is 0 to 10");
    expect(describeSource({ kind: "modbus", registerType: "holding", address: 9, dataType: "uint32", wordOrder: "little", scale: 0.1, offset: -2 })).toBe(
      "holding register 9, uint32, low word first, ×0.1, −2"
    );
  });
});

describe("validateHeartbeat", () => {
  const good = {
    agentVersion: "0.2.0+abc12345",
    uptimeSeconds: 120,
    sentAtUtc: "2026-10-19T10:00:00Z",
    bufferDepth: 0,
    configVersion: "9f2c",
    devices: [{ deviceId: "44444444-4444-4444-8444-444444444401", ok: true, readingsOk: 3, readingsFailed: 0 }]
  };

  it("accepts a normal heartbeat, with or without devices", () => {
    expect(validateHeartbeat(good)).toEqual([]);
    expect(validateHeartbeat({ ...good, devices: [] })).toEqual([]);
  });

  it("rejects things that are not heartbeats", () => {
    expect(validateHeartbeat(undefined)).toEqual(["The heartbeat is missing."]);
    expect(validateHeartbeat("hello")).toEqual(["The heartbeat is missing."]);
  });

  it("names each wrong field", () => {
    const problems = validateHeartbeat({ ...good, agentVersion: "", uptimeSeconds: -1, sentAtUtc: "yesterday", bufferDepth: "many", devices: "none" });
    expect(problems.join(" ")).toContain("agentVersion");
    expect(problems.join(" ")).toContain("uptimeSeconds");
    expect(problems.join(" ")).toContain("sentAtUtc must be a date and time");
    expect(problems.join(" ")).toContain("bufferDepth");
    expect(problems.join(" ")).toContain("devices must be a list");
  });

  it("checks every device entry", () => {
    const problems = validateHeartbeat({ ...good, devices: [{ deviceId: "x", ok: "yes", readingsOk: 1, readingsFailed: -2, lastError: 5 }, null] });
    expect(problems.join(" ")).toContain("devices[0].ok");
    expect(problems.join(" ")).toContain("devices[0].readingsFailed");
    expect(problems.join(" ")).toContain("devices[0].lastError");
    expect(problems.join(" ")).toContain("devices[1] must be an object");
  });

  it("limits the size of what it will accept", () => {
    const many = Array.from({ length: 501 }, (_, index) => ({ deviceId: `d${index}`, ok: true, readingsOk: 1, readingsFailed: 0 }));
    expect(validateHeartbeat({ ...good, devices: many }).join(" ")).toContain("up to 500");
    expect(validateHeartbeat({ ...good, agentVersion: "v".repeat(65) }).join(" ")).toContain("agentVersion");
  });
});

describe("manual steps", () => {
  it("knows which steps a person confirms by hand", () => {
    expect(isManualSetupStep("direction")).toBe(true);
    expect(isManualSetupStep("commissioned")).toBe(true);
    expect(isManualSetupStep("box")).toBe(false);
    expect(isManualSetupStep("__proto__")).toBe(false);
  });
});
