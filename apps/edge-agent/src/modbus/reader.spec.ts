import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ModbusConnection } from "@greecon/shared";
import { FakeModbusServer, startFakeModbusServer } from "../testing/fake-modbus-server";
import { ModbusReadError, ModbusTcpReader } from "./reader";

describe("reading registers over the network", () => {
  let server: FakeModbusServer;
  let reader: ModbusTcpReader;
  const at = (unitId: number, overrides: Partial<ModbusConnection> = {}): ModbusConnection => ({ kind: "modbus_tcp", host: server.host, port: server.port, unitId, ...overrides });

  beforeEach(async () => {
    server = await startFakeModbusServer([1, 2]);
    reader = new ModbusTcpReader({ requestTimeoutMs: 250, connectTimeoutMs: 500 });
  });

  afterEach(async () => {
    await reader.close();
    await server.close();
  });

  it("reads input and holding registers, as the device holds them", async () => {
    server.setRegister(1, "input", 10, 4660);
    server.setRegister(1, "input", 11, 22136);
    server.setRegister(1, "holding", 0, 7);
    expect(await reader.read(at(1), "input", 10, 2)).toEqual([4660, 22136]);
    expect(await reader.read(at(1), "holding", 0, 1)).toEqual([7]);
  });

  it("reads each meter behind one converter by its own unit number, over one connection", async () => {
    server.setRegister(1, "input", 0, 111);
    server.setRegister(2, "input", 0, 222);
    expect(await reader.read(at(1), "input", 0, 1)).toEqual([111]);
    expect(await reader.read(at(2), "input", 0, 1)).toEqual([222]);
    expect(await reader.read(at(1), "input", 0, 1)).toEqual([111]);
    expect(server.connections()).toBe(1);
  });

  it("keeps simultaneous requests for different units apart", async () => {
    for (let index = 0; index < 20; index += 1) {
      server.setRegister(1, "input", index, 1000 + index);
      server.setRegister(2, "input", index, 2000 + index);
    }
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => reader.read(at(index % 2 === 0 ? 1 : 2), "input", index, 1)));
    expect(results.map((words) => words[0])).toEqual(Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 1000 : 2000) + index));
  });

  it("says a register does not exist, and how a manual's number maps to the address", async () => {
    const error = await reader.read(at(1), "input", 12, 2).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ModbusReadError);
    expect((error as ModbusReadError).kind).toBe("refused");
    expect((error as ModbusReadError).message).toContain("has no register at that address");
    expect((error as ModbusReadError).message).toContain("input register 12");
    expect((error as ModbusReadError).message).toContain("30013 means address 12");

    const holding = await reader.read(at(1), "holding", 0, 1).catch((caught: unknown) => caught);
    expect((holding as ModbusReadError).message).toContain("40001 means address 0");
  });

  it("carries on with other registers after one is refused", async () => {
    server.setRegister(1, "input", 5, 55);
    await expect(reader.read(at(1), "input", 99, 1)).rejects.toBeInstanceOf(ModbusReadError);
    expect(await reader.read(at(1), "input", 5, 1)).toEqual([55]);
  });

  it("says when nothing answers for a unit, and what to check", async () => {
    const error = (await reader.read(at(9), "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(error.kind).toBe("transport");
    expect(error.message).toBe(`no answer from ${server.host}:${server.port} (unit 9). Check the unit number, the cable and the converter's serial settings.`);
  });

  it("goes on working for the other units after one does not answer", async () => {
    server.setRegister(1, "input", 0, 1);
    await expect(reader.read(at(9), "input", 0, 1)).rejects.toBeInstanceOf(ModbusReadError);
    expect(await reader.read(at(1), "input", 0, 1)).toEqual([1]);
  });

  it("says when the address is not listening", async () => {
    const closed = await startFakeModbusServer();
    const { host, port } = closed;
    await closed.close();
    const error = (await reader.read({ kind: "modbus_tcp", host, port, unitId: 1 }, "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(error.kind).toBe("transport");
    expect(error.message).toContain("refused the connection");
    expect(error.message).toContain(String(port));
  });

  it("says when the host cannot be reached at all", async () => {
    const error = (await reader.read({ kind: "modbus_tcp", host: "no-such-host.invalid", port: 502, unitId: 1 }, "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(error.kind).toBe("transport");
    expect(error.message).toMatch(/cannot reach no-such-host.invalid|no answer from|refused/);
  });

  it("gets going again by itself when the converter drops the connection and comes back", async () => {
    server.setRegister(1, "input", 0, 42);
    expect(await reader.read(at(1), "input", 0, 1)).toEqual([42]);
    server.dropConnections();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The read that finds the connection gone may fail; the one after it must work.
    let words: number[] | undefined;
    for (let attempt = 0; attempt < 3 && !words; attempt += 1) {
      words = await reader.read(at(1), "input", 0, 1).catch(() => undefined);
    }
    expect(words).toEqual([42]);
  });

  it("gives up on a device that answers too slowly", async () => {
    server.setRegister(1, "input", 0, 1);
    server.setDelay(600);
    const error = (await reader.read(at(1), "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(error.kind).toBe("transport");
    expect(error.message).toContain("no answer from");
  });

  it("reads digital inputs, function 02, as 0 or 1 for each, and no more of them than were asked for", async () => {
    server.setDiscrete(1, 0, 1);
    server.setDiscrete(1, 1, 0);
    server.setDiscrete(1, 2, 1);
    for (let address = 3; address < 8; address += 1) server.setDiscrete(1, address, 0);
    expect(await reader.read(at(1), "discrete", 0, 1)).toEqual([1]);
    expect(await reader.read(at(1), "discrete", 0, 8)).toEqual([1, 0, 1, 0, 0, 0, 0, 0]);
    expect(await reader.read(at(1), "discrete", 2, 3)).toEqual([1, 0, 0]);
  });

  it("says a digital input does not exist in the words of a digital input, and gives no hint about 3xxxx numbers", async () => {
    server.setDiscrete(1, 0, 1);
    const error = (await reader.read(at(1), "discrete", 20, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(error.kind).toBe("refused");
    expect(error.message).toContain("digital input 20");
    expect(error.message).not.toContain("means address");
  });

  it("tells a device's refusal from a converter saying nothing answered it, by the exception code", async () => {
    server.refuseFunction(1, 4);
    const device = (await reader.read(at(1), "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(device).toMatchObject({ kind: "refused", modbusCode: 1 });

    server.setAbsentUnits("exception");
    const converter = (await reader.read(at(9), "input", 0, 1).catch((caught: unknown) => caught)) as ModbusReadError;
    expect(converter).toMatchObject({ kind: "refused", modbusCode: 11 });
    expect(converter.message).toContain("did not answer its converter");
  });

  it("closes the connections to addresses nobody reads any more", async () => {
    server.setRegister(1, "input", 0, 1);
    await reader.read(at(1), "input", 0, 1);
    expect(server.connections()).toBe(1);
    await reader.keepOnly([]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(server.connections()).toBe(0);
    // And it opens one again when asked.
    expect(await reader.read(at(1), "input", 0, 1)).toEqual([1]);
  });
});
