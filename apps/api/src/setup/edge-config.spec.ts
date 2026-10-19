import { describe, expect, it } from "vitest";
import type { Device, EdgeGateway, Point } from "@greecon/shared";
import { buildEdgeConfig, canonicalJson } from "./edge-config";

const TENANT = "t-1";
const SITE = "s-1";
const gateway: EdgeGateway = { id: "g-1", tenantId: TENANT, siteId: SITE, name: "Box", status: "OK", secureIdentityStatus: "provisioned" };

const device = (id: string, overrides: Partial<Device> = {}): Device => ({
  id,
  tenantId: TENANT,
  siteId: SITE,
  gatewayId: "g-1",
  name: `Device ${id}`,
  deviceType: "grid_meter",
  protocol: "modbus",
  driverType: "modbus-tcp",
  health: "OK",
  secureIdentityStatus: "placeholder",
  connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 1 },
  ...overrides
});

const point = (id: string, deviceId: string, overrides: Partial<Point> = {}): Point => ({
  id,
  tenantId: TENANT,
  siteId: SITE,
  deviceId,
  canonicalName: "energy.grid.import.kw",
  label: "Grid import",
  unit: "kW",
  quality: "OK",
  capability: "read",
  source: { kind: "modbus", registerType: "input", address: 52, dataType: "float32", scale: 0.001, part: "positive" },
  ...overrides
});

describe("canonicalJson", () => {
  it("does not depend on the order keys were written in", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: "x" } })).toBe(canonicalJson({ a: { c: "x", d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });

  it("ignores undefined, as JSON does", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe("buildEdgeConfig", () => {
  it("tells the box to read its own devices that have an address, with their mapped readings", () => {
    const config = buildEdgeConfig(gateway, [device("d-1")], [point("p-1", "d-1")]);
    expect(config.gatewayId).toBe("g-1");
    expect(config.tenantId).toBe(TENANT);
    expect(config.siteId).toBe(SITE);
    expect(config.devices).toHaveLength(1);
    expect(config.devices[0]?.connection.host).toBe("192.168.1.50");
    expect(config.devices[0]?.points[0]).toMatchObject({ pointId: "p-1", canonicalName: "energy.grid.import.kw", unit: "kW" });
    expect(config.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it("leaves out what is not ready: no address, no register, a command point, or another protocol", () => {
    const config = buildEdgeConfig(
      gateway,
      [device("d-ok"), device("d-no-address", { connection: undefined }), device("d-sim", { protocol: "simulated" }), device("d-empty")],
      [
        point("p-ok", "d-ok"),
        point("p-1", "d-no-address"),
        point("p-2", "d-sim"),
        point("p-unmapped", "d-empty", { source: undefined }),
        point("p-cmd", "d-ok", { canonicalName: "water.pump.command", capability: "write" })
      ]
    );
    expect(config.devices.map((entry) => entry.deviceId)).toEqual(["d-ok"]);
    expect(config.devices[0]?.points.map((entry) => entry.pointId)).toEqual(["p-ok"]);
  });

  it("never includes devices of another gateway, site or tenant", () => {
    const config = buildEdgeConfig(
      gateway,
      [
        device("d-mine"),
        device("d-other-gateway", { gatewayId: "g-2" }),
        device("d-unassigned", { gatewayId: undefined }),
        device("d-other-site", { siteId: "s-2" }),
        device("d-other-tenant", { tenantId: "t-2" })
      ],
      ["d-mine", "d-other-gateway", "d-unassigned", "d-other-site", "d-other-tenant"].map((id) => point(`p-${id}`, id))
    );
    expect(config.devices.map((entry) => entry.deviceId)).toEqual(["d-mine"]);
  });

  it("is an empty configuration, not an error, for a box with nothing to read yet", () => {
    const config = buildEdgeConfig(gateway, [], []);
    expect(config.devices).toEqual([]);
    expect(config.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it("keeps the same version for the same content, whatever the order it was stored in", () => {
    const a = buildEdgeConfig(gateway, [device("d-1"), device("d-2")], [point("p-1", "d-1"), point("p-2", "d-2")]);
    const b = buildEdgeConfig(gateway, [device("d-2"), device("d-1")], [point("p-2", "d-2"), point("p-1", "d-1")]);
    expect(a.version).toBe(b.version);

    const shuffledSource = point("p-1", "d-1", { source: { part: "positive", scale: 0.001, dataType: "float32", address: 52, registerType: "input", kind: "modbus" } });
    expect(buildEdgeConfig(gateway, [device("d-1"), device("d-2")], [shuffledSource, point("p-2", "d-2")]).version).toBe(a.version);
  });

  it("changes the version when an address, a register or a setting changes", () => {
    const base = buildEdgeConfig(gateway, [device("d-1")], [point("p-1", "d-1")]);
    const newAddress = buildEdgeConfig(gateway, [device("d-1", { connection: { kind: "modbus_tcp", host: "192.168.1.51", port: 502, unitId: 1 } })], [point("p-1", "d-1")]);
    const newRegister = buildEdgeConfig(gateway, [device("d-1")], [point("p-1", "d-1", { source: { kind: "modbus", registerType: "input", address: 53, dataType: "float32" } })]);
    const newInterval = buildEdgeConfig(gateway, [device("d-1")], [point("p-1", "d-1")], 5000);
    expect(new Set([base.version, newAddress.version, newRegister.version, newInterval.version]).size).toBe(4);
  });

  it("does not change the version when something that is not sent changes", () => {
    const base = buildEdgeConfig(gateway, [device("d-1")], [point("p-1", "d-1")]);
    const renamedElsewhere = buildEdgeConfig(
      gateway,
      [device("d-1", { health: "Warning", lastSeenUtc: "2026-10-19T10:00:00Z" })],
      [point("p-1", "d-1", { quality: "BAD", thresholdConfig: { warning_low: 40 } })]
    );
    expect(renamedElsewhere.version).toBe(base.version);
  });
});
