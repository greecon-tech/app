// Reading a number out of Modbus registers, in one place: the gateway uses it to turn what a device
// says into an engineering value, and the platform uses the same description to check what a person
// typed. Pure, so the same input always gives the same value and it can be tested without a device.

export const modbusDataTypes = ["uint16", "int16", "uint32", "int32", "float32"] as const;
export type ModbusDataType = (typeof modbusDataTypes)[number];

/** Multi-register values are not stored the same way by every maker: which 16-bit word comes first. */
export const modbusWordOrders = ["big", "little"] as const;
export type ModbusWordOrder = (typeof modbusWordOrders)[number];

/** "discrete" is a digital input read with function 02: one bit, a contact that is open or closed. Reading it never changes anything. */
export const modbusRegisterTypes = ["holding", "input", "discrete"] as const;
export type ModbusRegisterType = (typeof modbusRegisterTypes)[number];

/** What a signal's sign means for the reading. A two-way meter reports one signed power; the
 * platform has separate import and export readings, so each takes the part that is its own. */
export const signParts = ["positive", "negative", "absolute"] as const;
export type SignPart = (typeof signParts)[number];

/** A straight-line conversion from what the device reports to what it measures, the way a datasheet
 * states it: a 4-20 mA transmitter that covers 0 to 10 bar is { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 10 }. */
export interface LinearScaling {
  rawLow: number;
  rawHigh: number;
  engLow: number;
  engHigh: number;
}

/** Where a reading comes from and how to turn it into a number. */
export interface PointSource {
  kind: "modbus";
  registerType: ModbusRegisterType;
  /** The address on the wire, counted from zero. A manual's "30013" is protocol address 12. */
  address: number;
  dataType: ModbusDataType;
  /** For two-register values. Default "big": the first register holds the high word. */
  wordOrder?: ModbusWordOrder;
  /** value = raw * scale + offset. Default scale 1, offset 0. Ignored when `linear` is given. */
  scale?: number;
  offset?: number;
  linear?: LinearScaling;
  part?: SignPart;
}

export function registersFor(dataType: ModbusDataType): number {
  return dataType === "uint16" || dataType === "int16" ? 1 : 2;
}

/** The raw number held in the registers, before any scaling. `words` are the 16-bit register values
 * in the order they were read. */
export function rawValue(words: readonly number[], dataType: ModbusDataType, wordOrder: ModbusWordOrder = "big"): number {
  const needed = registersFor(dataType);
  if (words.length < needed) throw new Error(`Expected ${needed} register(s) for ${dataType}, got ${words.length}.`);

  if (needed === 1) {
    const word = (words[0] as number) & 0xffff;
    return dataType === "int16" && word > 0x7fff ? word - 0x10000 : word;
  }

  const first = (words[0] as number) & 0xffff;
  const second = (words[1] as number) & 0xffff;
  const high = wordOrder === "big" ? first : second;
  const low = wordOrder === "big" ? second : first;
  const bits = ((high << 16) | low) >>> 0;
  if (dataType === "uint32") return bits;
  if (dataType === "int32") return bits > 0x7fffffff ? bits - 0x1_0000_0000 : bits;

  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits);
  return view.getFloat32(0);
}

/** The engineering value of a reading: raw, then the straight-line or scale-and-offset conversion,
 * then the part of the sign that is this reading's own. Returns undefined for a value that is not a
 * number (a float register that holds NaN, which is what many meters report when they have nothing). */
export function convertRaw(raw: number, source: Pick<PointSource, "scale" | "offset" | "linear" | "part">): number | undefined {
  if (!Number.isFinite(raw)) return undefined;

  let value: number;
  if (source.linear) {
    const { rawLow, rawHigh, engLow, engHigh } = source.linear;
    value = ((raw - rawLow) * (engHigh - engLow)) / (rawHigh - rawLow) + engLow;
  } else {
    value = raw * (source.scale ?? 1) + (source.offset ?? 0);
  }
  if (!Number.isFinite(value)) return undefined;

  switch (source.part) {
    case "positive":
      return Math.max(0, value);
    case "negative":
      return Math.max(0, -value);
    case "absolute":
      return Math.abs(value);
    default:
      return value;
  }
}

export function readModbusValue(words: readonly number[], source: PointSource): number | undefined {
  return convertRaw(rawValue(words, source.dataType, source.wordOrder), source);
}

/** What is wrong with a description of a source, in words the person who typed it can act on. */
export function validatePointSource(source: unknown): string[] {
  if (typeof source !== "object" || source === null) return ["The register description is missing."];
  const candidate = source as Record<string, unknown>;
  const problems: string[] = [];

  if (candidate.kind !== "modbus") problems.push('The kind of source must be "modbus".');
  if (!modbusRegisterTypes.includes(candidate.registerType as ModbusRegisterType)) problems.push('The register type must be "holding", "input" or "discrete".');
  if (candidate.registerType === "discrete" && candidate.dataType !== "uint16") problems.push("A digital input is one bit: its data type must be uint16.");
  if (typeof candidate.address !== "number" || !Number.isInteger(candidate.address) || candidate.address < 0 || candidate.address > 65535) {
    problems.push("The register address must be a whole number from 0 to 65535.");
  }
  if (!modbusDataTypes.includes(candidate.dataType as ModbusDataType)) problems.push(`The data type must be one of ${modbusDataTypes.join(", ")}.`);
  if (candidate.wordOrder !== undefined && !modbusWordOrders.includes(candidate.wordOrder as ModbusWordOrder)) problems.push('The word order must be "big" or "little".');
  if (candidate.part !== undefined && !signParts.includes(candidate.part as SignPart)) problems.push(`The sign part must be one of ${signParts.join(", ")}.`);
  for (const key of ["scale", "offset"] as const) {
    if (candidate[key] !== undefined && (typeof candidate[key] !== "number" || !Number.isFinite(candidate[key] as number))) problems.push(`The ${key} must be a number.`);
  }
  if (candidate.scale === 0) problems.push("The scale cannot be zero: every reading would be zero.");

  if (candidate.linear !== undefined) {
    const linear = candidate.linear as Record<string, unknown>;
    const numbers = ["rawLow", "rawHigh", "engLow", "engHigh"].every((key) => typeof linear?.[key] === "number" && Number.isFinite(linear[key] as number));
    if (!numbers) problems.push("The straight-line conversion needs four numbers: raw low and high, and the measured low and high.");
    else if (linear.rawLow === linear.rawHigh) problems.push("The raw low and raw high of the conversion cannot be the same number.");
  }
  return problems;
}

export interface ModbusConnection {
  kind: "modbus_tcp";
  host: string;
  port: number;
  /** The device's own address on the bus, 0 to 247. Several devices behind one converter share its host and differ here. */
  unitId: number;
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function validateConnection(connection: unknown): string[] {
  if (typeof connection !== "object" || connection === null) return ["The connection is missing."];
  const candidate = connection as Record<string, unknown>;
  const problems: string[] = [];

  if (candidate.kind !== "modbus_tcp") problems.push('The kind of connection must be "modbus_tcp".');
  // A string of only digits and dots is an attempt at an IP address and must be a real one: "192.168.1.999"
  // is also a well-formed host name, and would otherwise be accepted and never connect.
  const hostOk = typeof candidate.host === "string" && (/^[\d.]+$/.test(candidate.host) ? IPV4.test(candidate.host) : HOSTNAME.test(candidate.host));
  if (!hostOk) {
    problems.push("The address must be an IP address such as 192.168.1.50, or a host name.");
  }
  if (typeof candidate.port !== "number" || !Number.isInteger(candidate.port) || candidate.port < 1 || candidate.port > 65535) {
    problems.push("The port must be a whole number from 1 to 65535 (502 is usual).");
  }
  if (typeof candidate.unitId !== "number" || !Number.isInteger(candidate.unitId) || candidate.unitId < 0 || candidate.unitId > 247) {
    problems.push("The unit ID must be a whole number from 0 to 247.");
  }
  return problems;
}
