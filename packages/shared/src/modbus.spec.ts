import { describe, expect, it } from "vitest";
import { convertRaw, rawValue, readModbusValue, registersFor, validateConnection, validatePointSource, PointSource } from "./modbus";

/** The two registers a float32 is held in, high word first. */
function floatWords(value: number): [number, number] {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value);
  return [view.getUint16(0), view.getUint16(2)];
}

describe("reading registers", () => {
  it("reads a signed and an unsigned 16-bit register", () => {
    expect(rawValue([55], "uint16")).toBe(55);
    expect(rawValue([0xffff], "uint16")).toBe(65535);
    expect(rawValue([0xffff], "int16")).toBe(-1);
    expect(rawValue([0x8000], "int16")).toBe(-32768);
    expect(rawValue([0x7fff], "int16")).toBe(32767);
  });

  it("reads a float32 across two registers, high word first by default (an Eastron meter's order)", () => {
    expect(rawValue(floatWords(1234.5), "float32")).toBeCloseTo(1234.5, 3);
    expect(rawValue(floatWords(-350.25), "float32")).toBeCloseTo(-350.25, 3);
  });

  it("reads the same value from a device that sends the low word first, when told to", () => {
    const [high, low] = floatWords(1234.5);
    expect(rawValue([low, high], "float32", "little")).toBeCloseTo(1234.5, 3);
    // Left at the default, the swapped words are not the value: this is what the setting is for.
    expect(rawValue([low, high], "float32", "big")).not.toBeCloseTo(1234.5, 1);
  });

  it("reads 32-bit integers in either word order", () => {
    expect(rawValue([0x0001, 0x0000], "uint32")).toBe(65536);
    expect(rawValue([0x0000, 0x0001], "uint32", "little")).toBe(65536);
    expect(rawValue([0xffff, 0xffff], "int32")).toBe(-1);
    expect(rawValue([0xffff, 0xfffe], "uint32")).toBe(4294967294);
    expect(rawValue([0x8000, 0x0000], "int32")).toBe(-2147483648);
  });

  it("says how many registers each type spans, and refuses to read too few", () => {
    expect(registersFor("uint16")).toBe(1);
    expect(registersFor("float32")).toBe(2);
    expect(() => rawValue([1], "float32")).toThrow(/Expected 2 register/);
  });
});

describe("turning a raw number into the thing measured", () => {
  it("applies scale and offset", () => {
    expect(convertRaw(55, { scale: 0.1 })).toBeCloseTo(5.5, 6);
    expect(convertRaw(100, { scale: 0.5, offset: -10 })).toBe(40);
    expect(convertRaw(7, {})).toBe(7);
  });

  it("converts a 4-20 mA transmitter the way its datasheet states it: 4 mA is 0 bar and 20 mA is 10 bar", () => {
    const pressure = { linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 10 } };
    expect(convertRaw(4, pressure)).toBe(0);
    expect(convertRaw(20, pressure)).toBe(10);
    expect(convertRaw(12, pressure)).toBe(5);
    // A broken wire reads below 4 mA: the conversion says so rather than clamping it into range.
    expect(convertRaw(0, pressure)).toBeCloseTo(-2.5, 6);
  });

  it("converts a level transmitter whose module reports thousandths of a milliamp", () => {
    const level = { linear: { rawLow: 4000, rawHigh: 20000, engLow: 0, engHigh: 100 } };
    expect(convertRaw(12000, level)).toBe(50);
  });

  it("splits one signed power into the import and export readings the platform keeps", () => {
    expect(convertRaw(2500, { scale: 0.001, part: "positive" })).toBeCloseTo(2.5, 6);
    expect(convertRaw(2500, { scale: 0.001, part: "negative" })).toBe(0);
    expect(convertRaw(-4200, { scale: 0.001, part: "positive" })).toBe(0);
    expect(convertRaw(-4200, { scale: 0.001, part: "negative" })).toBeCloseTo(4.2, 6);
  });

  it("takes the size of a production meter's power, whichever way its clamp was fitted", () => {
    expect(convertRaw(-18600, { scale: 0.001, part: "absolute" })).toBeCloseTo(18.6, 6);
    expect(convertRaw(18600, { scale: 0.001, part: "absolute" })).toBeCloseTo(18.6, 6);
  });

  it("returns nothing for a value that is not a number, which many meters send when they have nothing to say", () => {
    expect(convertRaw(Number.NaN, {})).toBeUndefined();
    expect(convertRaw(Number.POSITIVE_INFINITY, { scale: 2 })).toBeUndefined();
  });

  it("reads and converts in one step from a source description", () => {
    const source: PointSource = { kind: "modbus", registerType: "input", address: 12, dataType: "float32", scale: 0.001, part: "negative" };
    expect(readModbusValue(floatWords(-3500), source)).toBeCloseTo(3.5, 4);
  });
});

describe("checking what a person typed", () => {
  const good: PointSource = { kind: "modbus", registerType: "input", address: 52, dataType: "float32", scale: 0.001 };

  it("accepts a sound description", () => {
    expect(validatePointSource(good)).toEqual([]);
    expect(validatePointSource({ ...good, linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 10 }, wordOrder: "little", part: "absolute", offset: 0 })).toEqual([]);
  });

  it("says what is wrong, one problem at a time, in plain words", () => {
    expect(validatePointSource(undefined)).toEqual(["The register description is missing."]);
    expect(validatePointSource({ ...good, address: 70000 })[0]).toMatch(/whole number from 0 to 65535/);
    expect(validatePointSource({ ...good, address: 1.5 })[0]).toMatch(/whole number/);
    expect(validatePointSource({ ...good, registerType: "coil" })[0]).toMatch(/holding.*input/);
    expect(validatePointSource({ ...good, dataType: "double" })[0]).toMatch(/data type/);
    expect(validatePointSource({ ...good, wordOrder: "middle" })[0]).toMatch(/word order/);
    expect(validatePointSource({ ...good, scale: 0 })[0]).toMatch(/scale cannot be zero/);
    expect(validatePointSource({ ...good, scale: Number.NaN })[0]).toMatch(/scale must be a number/);
    expect(validatePointSource({ ...good, linear: { rawLow: 4, rawHigh: 4, engLow: 0, engHigh: 10 } })[0]).toMatch(/cannot be the same/);
    expect(validatePointSource({ ...good, linear: { rawLow: 4 } })[0]).toMatch(/four numbers/);
    expect(validatePointSource({ ...good, kind: "opc" })[0]).toMatch(/modbus/);
  });

  it("checks a connection: an address, a port and a unit ID", () => {
    const connection = { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: 1 };
    expect(validateConnection(connection)).toEqual([]);
    expect(validateConnection({ ...connection, host: "meter-room.local" })).toEqual([]);
    expect(validateConnection({ ...connection, host: "192.168.1.999" })[0]).toMatch(/IP address/);
    expect(validateConnection({ ...connection, host: "" })[0]).toMatch(/IP address/);
    expect(validateConnection({ ...connection, host: "not a host" })[0]).toMatch(/IP address/);
    expect(validateConnection({ ...connection, port: 0 })[0]).toMatch(/port/);
    expect(validateConnection({ ...connection, unitId: 248 })[0]).toMatch(/unit ID/);
    expect(validateConnection({ ...connection, unitId: 0 })).toEqual([]);
    expect(validateConnection(null)[0]).toMatch(/missing/);
  });
});
