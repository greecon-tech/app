import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EdgeConfig, EdgeConfigDevice, EdgeConfigPoint, PointSource } from "@greecon/shared";
import { profileByKey } from "@greecon/shared";
import { FakeModbusServer, startFakeModbusServer } from "../testing/fake-modbus-server";
import { DevicePoller } from "./poller";
import { ModbusTcpReader } from "./reader";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222201";

const point = (id: string, canonicalName: EdgeConfigPoint["canonicalName"], source: PointSource, extra: Partial<EdgeConfigPoint> = {}): EdgeConfigPoint => ({
  pointId: id,
  canonicalName,
  label: canonicalName,
  unit: canonicalName.endsWith("percent") ? "%" : "kW",
  source,
  ...extra
});

const device = (server: FakeModbusServer, deviceId: string, unitId: number, points: EdgeConfigPoint[], name = `Device ${unitId}`): EdgeConfigDevice => ({
  deviceId,
  name,
  connection: { kind: "modbus_tcp", host: server.host, port: server.port, unitId },
  points
});

const configOf = (devices: EdgeConfigDevice[]): EdgeConfig => ({ version: "v", tenantId: TENANT, siteId: SITE, gatewayId: "g", pollIntervalMs: 10_000, devices });

describe("one round of reading", () => {
  let server: FakeModbusServer;
  let reader: ModbusTcpReader;
  let clock: number;
  let logged: string[];
  let poller: DevicePoller;

  beforeEach(async () => {
    server = await startFakeModbusServer([1, 2, 3]);
    reader = new ModbusTcpReader({ requestTimeoutMs: 200, connectTimeoutMs: 400 });
    clock = Date.parse("2026-10-19T10:00:00Z");
    logged = [];
    poller = new DevicePoller(reader, { info: (message) => logged.push(`info: ${message}`), warn: (message) => logged.push(`warn: ${message}`) }, () => clock);
  });

  afterEach(async () => {
    await reader.close();
    await server.close();
  });

  const grid = profileByKey("eastron-sdm630-grid")!;
  const gridPoints = (): EdgeConfigPoint[] => grid.points.map((entry, index) => point(`grid-${index}`, entry.canonicalName, entry.source));

  it("turns a meter's one signed power into import and export, reading the register once", async () => {
    server.setFloat32(1, "input", 52, 4213.5);
    let result = await poller.pollAll(configOf([device(server, "meter", 1, gridPoints())]));
    const importing = result.messages[0]?.readings;
    expect(importing?.map((reading) => [reading.canonicalName, reading.value])).toEqual([
      ["energy.grid.import.kw", 4.2135],
      ["energy.grid.export.kw", 0]
    ]);
    expect(server.requests).toBe(1);

    server.setFloat32(1, "input", 52, -1500);
    result = await poller.pollAll(configOf([device(server, "meter", 1, gridPoints())]));
    expect(result.messages[0]?.readings.map((reading) => [reading.canonicalName, reading.value])).toEqual([
      ["energy.grid.import.kw", 0],
      ["energy.grid.export.kw", 1.5]
    ]);
  });

  it("makes one message per device that gave something, carrying who, where and when", async () => {
    server.setFloat32(1, "input", 52, 1000);
    server.setRegister(2, "holding", 0, 7);
    const result = await poller.pollAll(
      configOf([
        device(server, "meter", 1, gridPoints().slice(0, 1).map((entry) => ({ ...entry, assetId: "asset-grid" }))),
        device(server, "module", 2, [point("tank", "water.tank.level.percent", { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16" })])
      ])
    );
    expect(result.messages.map((message) => message.deviceId)).toEqual(["meter", "module"]);
    const first = result.messages[0] as NonNullable<(typeof result.messages)[number]>;
    expect(first).toMatchObject({ messageType: "telemetry", tenantId: TENANT, siteId: SITE, publishedAtUtc: "2026-10-19T10:00:00.000Z" });
    expect(first.correlationId).toBeTruthy();
    expect(first.readings[0]).toMatchObject({
      timestampUtc: "2026-10-19T10:00:00.000Z",
      tenantId: TENANT,
      siteId: SITE,
      assetId: "asset-grid",
      deviceId: "meter",
      pointId: "grid-0",
      quality: "OK",
      source: "edge",
      unit: "kW"
    });
    expect(result.messages[1]?.readings[0]?.value).toBe(7);
  });

  it("reads a two-register number whichever word the device puts first", async () => {
    server.setFloat32(1, "holding", 10, 12.5, "little");
    server.setUint32(1, "holding", 20, 123456, "big");
    server.setUint32(1, "holding", 30, 123456, "little");
    const source = (address: number, dataType: PointSource["dataType"], wordOrder: PointSource["wordOrder"]): PointSource => ({ kind: "modbus", registerType: "holding", address, dataType, wordOrder });
    const result = await poller.pollAll(
      configOf([
        device(server, "d", 1, [
          point("a", "energy.solar.power.kw", source(10, "float32", "little")),
          point("b", "energy.consumption.kw", source(20, "uint32", "big")),
          point("c", "energy.battery.power.kw", source(30, "uint32", "little"))
        ])
      ])
    );
    expect(result.messages[0]?.readings.map((reading) => reading.value)).toEqual([12.5, 123456, 123456]);
  });

  it("converts a 4-20 mA signal with the datasheet's straight line", async () => {
    server.setRegister(1, "holding", 0, 12);
    const result = await poller.pollAll(
      configOf([device(server, "module", 1, [point("t", "water.tank.level.percent", { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 100 } })])])
    );
    expect(result.messages[0]?.readings[0]?.value).toBe(50);
  });

  it("reads a negative whole number and applies a scale and offset", async () => {
    server.setRegister(1, "holding", 0, 0xffec); // -20
    const result = await poller.pollAll(configOf([device(server, "d", 1, [point("t", "agri.air.temperature.c", { kind: "modbus", registerType: "holding", address: 0, dataType: "int16", scale: 0.1, offset: 5 })])]));
    expect(result.messages[0]?.readings[0]?.value).toBe(3);
  });

  describe("when a device does not answer", () => {
    it("gives no reading for it, says why, and still reads the others behind the same converter", async () => {
      server.setFloat32(1, "input", 52, 2000);
      server.removeUnit(2);
      const result = await poller.pollAll(configOf([device(server, "meter", 1, gridPoints(), "Grid meter"), device(server, "solar", 2, gridPoints().slice(0, 1), "Solar meter")]));

      expect(result.messages.map((message) => message.deviceId)).toEqual(["meter"]);
      expect(result.statuses).toEqual([
        { deviceId: "meter", ok: true, readingsOk: 2, readingsFailed: 0, lastOkAtUtc: "2026-10-19T10:00:00.000Z" },
        expect.objectContaining({ deviceId: "solar", ok: false, readingsOk: 0, readingsFailed: 1, lastError: expect.stringContaining("no answer from") })
      ]);
      expect(logged.some((line) => line.startsWith("warn: Solar meter: no answer from"))).toBe(true);
    });

    it("stops asking one device for more registers once it has been silent, rather than waiting for each", async () => {
      server.removeUnit(1);
      const before = server.requests;
      const started = Date.now();
      await poller.pollAll(configOf([device(server, "d", 1, [0, 1, 2, 3, 4, 5].map((address) => point(`p${address}`, "energy.solar.power.kw", { kind: "modbus", registerType: "input", address, dataType: "uint16" })))]));
      expect(server.requests - before).toBe(1);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it("asks a silent device once a minute instead of every round, and says when it is back", async () => {
      server.removeUnit(2);
      const config = configOf([device(server, "solar", 2, gridPoints().slice(0, 1), "Solar meter")]);
      for (let round = 0; round < 3; round += 1) {
        await poller.pollAll(config);
        clock += 10_000;
      }
      const askedSoFar = server.requests;
      expect(askedSoFar).toBe(3);

      // Backed off: rounds in the next minute do not ask it, and still report it as not answering.
      const quiet = await poller.pollAll(config);
      expect(server.requests).toBe(askedSoFar);
      expect(quiet.statuses[0]).toMatchObject({ ok: false, lastError: expect.stringContaining("no answer from") });

      // After a minute it is tried again, and when it answers it is read as normal.
      clock += 61_000;
      server.setFloat32(2, "input", 52, 3000);
      const back = await poller.pollAll(config);
      expect(server.requests).toBeGreaterThan(askedSoFar);
      expect(back.messages[0]?.readings[0]?.value).toBe(3);
      expect(back.statuses[0]).toMatchObject({ ok: true });
      expect(logged).toContain("info: Solar meter is answering again.");
    });

    it("does not repeat the same complaint in the log every round", async () => {
      server.removeUnit(2);
      const config = configOf([device(server, "solar", 2, gridPoints().slice(0, 1), "Solar meter")]);
      for (let round = 0; round < 8; round += 1) {
        await poller.pollAll(config);
        clock += 10_000;
      }
      // Eight rounds of silence, one complaint.
      expect(logged.filter((line) => line.startsWith("warn:"))).toHaveLength(1);
    });
  });

  it("carries on with the other registers when the device refuses one, and says which", async () => {
    server.setRegister(1, "holding", 0, 7);
    const result = await poller.pollAll(
      configOf([
        device(server, "d", 1, [
          point("good", "water.tank.level.percent", { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16" }),
          point("bad", "water.pressure.bar", { kind: "modbus", registerType: "holding", address: 99, dataType: "uint16" })
        ])
      ])
    );
    expect(result.messages[0]?.readings.map((reading) => reading.pointId)).toEqual(["good"]);
    expect(result.statuses[0]).toMatchObject({ ok: true, readingsOk: 1, readingsFailed: 1 });
    expect(result.statuses[0]?.lastError).toContain("no register at that address");
  });

  it("does not invent a value when a float register holds no number", async () => {
    server.setFloat32(1, "input", 52, Number.NaN);
    const result = await poller.pollAll(configOf([device(server, "d", 1, gridPoints(), "Grid meter")]));
    expect(result.messages).toEqual([]);
    expect(result.statuses[0]).toMatchObject({ ok: false, readingsFailed: 2 });
    expect(result.statuses[0]?.lastError).toContain("Grid meter reported no value for");
  });

  it("reads converters at the same time, not one after the other", async () => {
    const other = await startFakeModbusServer([1]);
    try {
      server.setDelay(200);
      other.setDelay(200);
      server.setRegister(1, "holding", 0, 1);
      other.setRegister(1, "holding", 0, 2);
      const read = (s: FakeModbusServer, id: string) => device(s, id, 1, [point(`${id}-p`, "water.tank.level.percent", { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16" })]);
      const slow = new ModbusTcpReader({ requestTimeoutMs: 1000 });
      const timed = new DevicePoller(slow, { info: () => undefined, warn: () => undefined });
      const started = Date.now();
      const result = await timed.pollAll(configOf([read(server, "a"), read(other, "b")]));
      expect(Date.now() - started).toBeLessThan(380);
      expect(result.messages.map((message) => message.readings[0]?.value)).toEqual([1, 2]);
      await slow.close();
    } finally {
      await other.close();
    }
  });

  it("copes with a configuration that has nothing in it", async () => {
    expect(await poller.pollAll(configOf([]))).toEqual({ messages: [], statuses: [] });
  });
});
