import type { CanonicalPointName } from "./index";
import type { PointSource } from "./modbus";

// Equipment whose registers are known, so a project manager picks a name and types an address instead
// of copying register numbers out of a manual. Every address here is from the maker's published
// Modbus table; anything not listed is added by hand from its own datasheet.
//
// These are also the equipment Greecon buys (docs/launch/03): a kit is made of these models and no
// others, so that the numbers a device is set to, the registers it is read from and the way the box
// recognises it on the network are all known before anyone is on site, and nobody has to read a datasheet.

/** What a piece of equipment is, for finding it on the network: a meter answers at one register, a module at another. */
export type EquipmentFamily = "eastron-meter" | "analog-module" | "digital-module";

/** What the equipment is set to as it is delivered, and so what the converter must be set to: the install card prints it. */
export interface SerialSettings {
  baud: number;
  dataBits: 8;
  parity: "none" | "even" | "odd";
  stopBits: 1 | 2;
}

/** A reading that comes from a 4 to 20 mA transmitter: the one thing that is not known in advance is the range printed on its label. */
export interface SensorRange {
  /** A level in a tank is asked as the transmitter's range and the tank's height; anything else as the top of the range. */
  kind: "level" | "span";
  /** The module's input, counted from 1 as its terminals are. */
  channel: number;
  /** What the person is asked, in the words of the label on the transmitter. */
  question: string;
  /** Said under the question. */
  help: string;
  /** The unit of the range printed on the label: "m", "bar", "lpm". */
  rangeUnit: string;
}

export interface DeviceProfilePoint {
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
  /** Absent for a reading whose scale depends on the transmitter fitted: it is set from `range` when the person gives the range. */
  source?: PointSource;
  range?: SensorRange;
}

export interface DeviceProfile {
  key: string;
  name: string;
  maker: string;
  /** The model Greecon buys, as it is ordered. */
  model: string;
  /** What it is for, in a sentence a project manager can say to a customer. */
  description: string;
  deviceType: string;
  family: EquipmentFamily;
  /** What is usual for this equipment; the person setting up confirms or changes the address and unit. */
  defaultPort: number;
  /** The address Greecon gives this kind of equipment in every kit, so that a site looks like the last one. */
  defaultUnitId: number;
  /** What it is set to as delivered, and what the converter must be set to. */
  serial: SerialSettings;
  notes: string[];
  points: DeviceProfilePoint[];
}

type MeterModel = "sdm230" | "sdm630";
type MeterRole = "grid" | "solar" | "load";

/** The address each kind of equipment has in every kit. A kit that is the same everywhere is a kit nobody has to think about. */
export const KIT_UNITS = { grid: 1, solar: 2, waterModule: 3, load: 4, pumpContact: 5, soil: 6, weather: 7 } as const;

// Eastron SDM230 (one phase) and SDM630 (three phase). Input registers, IEEE 754 float32, high word
// first, power in watts. "Total active power" is protocol address 12 (0x000C, documented as 30013) on
// the SDM230 and 52 (0x0034, 30053) on the SDM630. The meters speak Modbus RTU over RS-485: a
// converter to Ethernet in "Modbus RTU to TCP" mode puts them on the network, each meter keeping its
// own unit ID.
const MODELS: Record<MeterModel, { name: string; powerAddress: number; phases: string; serial: string; delivered: SerialSettings }> = {
  sdm230: {
    name: "Eastron SDM230",
    powerAddress: 12,
    phases: "single-phase",
    serial: "As delivered its speed depends on the version (the V1.6 manual says 2400 baud), with no parity and one stop bit. Greecon sets it to 9600, like everything else on the cable, on the meter's own display (the Baud Rate page) before it leaves the office.",
    delivered: { baud: 2400, dataBits: 8, parity: "none", stopBits: 1 }
  },
  sdm630: {
    name: "Eastron SDM630",
    powerAddress: 52,
    phases: "three-phase",
    serial: "As delivered it is 9600 baud, 8 data bits, no parity and one stop bit, which is what the whole cable uses: check it on the meter's own display.",
    delivered: { baud: 9600, dataBits: 8, parity: "none", stopBits: 1 }
  }
};

const UNIT_OF_ROLE: Record<MeterRole, number> = { grid: KIT_UNITS.grid, solar: KIT_UNITS.solar, load: KIT_UNITS.load };

const power = (address: number, part: PointSource["part"]): PointSource => ({
  kind: "modbus",
  registerType: "input",
  address,
  dataType: "float32",
  wordOrder: "big",
  scale: 0.001,
  part
});

function meterProfile(model: MeterModel, role: MeterRole): DeviceProfile {
  const { name, powerAddress, phases, serial, delivered } = MODELS[model];
  const common = {
    maker: "Eastron",
    model: name,
    family: "eastron-meter" as const,
    defaultPort: 502,
    defaultUnitId: UNIT_OF_ROLE[role],
    serial: delivered,
    deviceType: role === "grid" ? "grid_meter" : role === "solar" ? "production_meter" : "load_meter"
  };
  const reading = (canonicalName: CanonicalPointName, label: string, part: PointSource["part"]): DeviceProfilePoint => ({ canonicalName, label, unit: "kW", source: power(powerAddress, part) });
  const address = `Its own address is set to ${UNIT_OF_ROLE[role]} on its display at the office, before it is connected to the others: two meters on one cable with the same address answer over each other.`;

  if (role === "grid") {
    return {
      ...common,
      key: `eastron-${model}-grid`,
      name: `${name} at the grid connection`,
      description: `A ${phases} meter where the site meets the grid. Positive power is energy coming in, negative is energy sent out, so it gives both Grid import and Grid export.`,
      notes: [
        "Fit it where the supply enters the site, with the current clamps on the incoming phases, arrow towards the site.",
        "Check the direction: switch on a known load with the sun down. Grid import must go up. If Grid export goes up instead, the clamps are reversed.",
        `${address} ${serial} Every device on one cable uses the same speed and parity, and its own address.`
      ],
      points: [reading("energy.grid.import.kw", "Grid import", "positive"), reading("energy.grid.export.kw", "Grid export", "negative")]
    };
  }
  if (role === "solar") {
    return {
      ...common,
      key: `eastron-${model}-solar`,
      name: `${name} on the solar output`,
      description: `A ${phases} meter on the inverter's AC output. It gives Solar production whichever way its clamps were fitted, so it works with any inverter brand.`,
      notes: [
        "Fit it on the inverter's AC output, after the inverter and before the site's distribution board.",
        "Production is the size of the power, so a reversed clamp does not make it read zero. At night it reads zero or a few watts.",
        address
      ],
      points: [reading("energy.solar.power.kw", "Solar production", "absolute")]
    };
  }
  return {
    ...common,
    key: `eastron-${model}-load`,
    name: `${name} on the site's own consumption`,
    description: `A ${phases} meter on the feed to the loads, to measure what the site uses directly instead of working it out.`,
    notes: ["Optional. With grid and solar meters the site's consumption can be worked out; a load meter makes it measured and lets the platform check that everything adds up.", address],
    points: [reading("energy.consumption.kw", "Energy consumption", "absolute")]
  };
}

const roles: MeterRole[] = ["grid", "solar", "load"];
const models: MeterModel[] = ["sdm230", "sdm630"];

// Waveshare "Modbus RTU Analog Input 8CH", the current version: eight 12-bit inputs, 4 to 20 mA among them. Input registers 0 to 7 (function
// 04) hold channels 1 to 8; in its default 0 to 20 mA range a channel reads in microamps, so a 4 to 20 mA transmitter reads 4000 to 20000.
// 9600 baud, 8 data bits, no parity, address 1 as delivered; the address is set by a command, not by a switch (docs/launch/03).
const WATER_MODULE: DeviceProfile = {
  key: "waveshare-ai8-water",
  name: "4 to 20 mA input module",
  maker: "Waveshare",
  model: "Modbus RTU Analog Input 8CH (current version)",
  description: "Takes the 4 to 20 mA signals of the tank's level transmitter, the line's pressure transmitter and the flow meter, and puts them on the cable.",
  deviceType: "analog_io_module",
  family: "analog-module",
  defaultPort: 502,
  defaultUnitId: KIT_UNITS.waterModule,
  serial: { baud: 9600, dataBits: 8, parity: "none", stopBits: 1 },
  notes: [
    "Wire the level transmitter to input 1, the pressure transmitter to input 2 and the flow meter to input 3. A two-wire transmitter needs a 24 V supply in series with its loop: the electrician wires it as the module's manual draws it.",
    "It is delivered set to address 1. Greecon sets it to 3 at the office, with the maker's setting tool, and labels it. Use the version that reads current, not the one that reads voltage, and leave its inputs in their default 0 to 20 mA mode: a wire that has come off then reads 0, below the 4 mA of an empty tank, and Greecon can say so.",
    "The range of each transmitter is printed on its label. Greecon asks for it once the module answers, and works out the scale: nobody types a register."
  ],
  points: [
    {
      canonicalName: "water.tank.level.percent",
      label: "Tank level",
      unit: "%",
      range: { kind: "level", channel: 1, rangeUnit: "m", question: "Level transmitter", help: "The range on its label (for example 0 to 5 m), and how tall the tank is inside, from the bottom to the top of the water when it is full." }
    },
    {
      canonicalName: "water.pressure.bar",
      label: "Line pressure",
      unit: "bar",
      range: { kind: "span", channel: 2, rangeUnit: "bar", question: "Pressure transmitter", help: "The top of the range on its label (0 to 10 bar is the usual one)." }
    },
    {
      canonicalName: "water.flow.lpm",
      label: "Pump flow",
      unit: "lpm",
      range: { kind: "span", channel: 3, rangeUnit: "lpm", question: "Flow meter", help: "The top of the range on its label or its manual, in litres a minute. Leave the flow meter out if there is none." }
    }
  ]
};

// Waveshare "Modbus RTU IO 8CH": eight isolated digital inputs (a dry contact is enough) read with function 02 at addresses 0 to 7; it has
// relay outputs too, which Greecon never uses. 9600 baud, 8 data bits, no parity, address 1 as delivered.
const PUMP_CONTACT: DeviceProfile = {
  key: "waveshare-io8-pump",
  name: "Pump contact module",
  maker: "Waveshare",
  model: "Modbus RTU IO 8CH",
  description: "Reads whether the pump is running, from a dry contact on its starter. It only reads: it is never made to switch anything.",
  deviceType: "digital_input_module",
  family: "digital-module",
  defaultPort: 502,
  defaultUnitId: KIT_UNITS.pumpContact,
  serial: { baud: 9600, dataBits: 8, parity: "none", stopBits: 1 },
  notes: [
    "Wire the pump starter's 'running' contact to input 1 as a dry contact, as the module's manual draws it (its DI COM left unconnected). Do not use the relay outputs.",
    "It is delivered set to address 1. Greecon sets it to 5 at the office, with the maker's setting tool, and labels it.",
    "Check it by eye: with the pump running, Pump running must read 1; stopped, 0. If it reads the other way round, the contact is inverted: use the other contact of the starter."
  ],
  points: [{ canonicalName: "water.pump.status", label: "Pump running", unit: "state", source: { kind: "modbus", registerType: "discrete", address: 0, dataType: "uint16" } }]
};

export const deviceProfiles: readonly DeviceProfile[] = [...models.flatMap((model) => roles.map((role) => meterProfile(model, role))), WATER_MODULE, PUMP_CONTACT];

export function profileByKey(key: string): DeviceProfile | undefined {
  return deviceProfiles.find((profile) => profile.key === key);
}

// ---- A range on a label becomes a scale ----------------------------------------------------------------------------------------

/** 4 mA and 20 mA, as the module reports them in microamps. */
export const FOUR_MA_RAW = 4000;
export const TWENTY_MA_RAW = 20000;

export interface RangeAnswer {
  /** The top of the transmitter's range, in the unit on its label. */
  range: number;
  /** For a level: how tall the tank is, in the same unit. */
  tankHeight?: number;
}

/** What is wrong with an answer, in words, or undefined. */
export function rangeProblem(range: SensorRange, answer: Partial<RangeAnswer>): string | undefined {
  const top = answer.range;
  if (top === undefined || !Number.isFinite(top) || top <= 0) return `Give the top of the range on the label, as a number above zero (in ${range.rangeUnit}).`;
  if (range.kind === "level") {
    const height = answer.tankHeight;
    if (height === undefined || !Number.isFinite(height) || height <= 0) return "Give how tall the tank is inside, as a number above zero (in metres).";
    if (height > top) return `The transmitter reads up to ${top} ${range.rangeUnit} and the tank is ${height} ${range.rangeUnit} tall: it cannot see the top of the water. Fit a transmitter with a longer range.`;
  }
  return undefined;
}

/** Where a reading comes from, for an answer. The reading's scale is a straight line from 4 mA (zero) to 20 mA (the top of the range); for a
 * level that is a percentage of the tank, so a transmitter longer than the tank reads past 100 at the top of its range and 100 at a full tank. */
export function sourceFromRange(range: SensorRange, answer: RangeAnswer): PointSource {
  const problem = rangeProblem(range, answer);
  if (problem) throw new Error(problem);
  const engHigh = range.kind === "level" ? (answer.range / (answer.tankHeight as number)) * 100 : answer.range;
  return {
    kind: "modbus",
    registerType: "input",
    address: range.channel - 1,
    dataType: "uint16",
    linear: { rawLow: FOUR_MA_RAW, rawHigh: TWENTY_MA_RAW, engLow: 0, engHigh: Math.round(engHigh * 1000) / 1000 }
  };
}
