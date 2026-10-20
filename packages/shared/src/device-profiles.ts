import type { CanonicalPointName } from "./index";
import type { PointSource } from "./modbus";

// Equipment whose registers are known, so a project manager picks a name and types an address instead
// of copying register numbers out of a manual. Every address here is from the maker's published
// Modbus table; anything not listed is added by hand from its own datasheet.

export interface DeviceProfilePoint {
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
  source: PointSource;
}

export interface DeviceProfile {
  key: string;
  name: string;
  maker: string;
  /** What it is for, in a sentence a project manager can say to a customer. */
  description: string;
  deviceType: string;
  /** What is usual for this equipment; the person setting up confirms or changes the address and unit. */
  defaultPort: number;
  defaultUnitId: number;
  notes: string[];
  points: DeviceProfilePoint[];
}

type MeterModel = "sdm230" | "sdm630";
type MeterRole = "grid" | "solar" | "load";

// Eastron SDM230 (one phase) and SDM630 (three phase). Input registers, IEEE 754 float32, high word
// first, power in watts. "Total active power" is protocol address 12 (0x000C, documented as 30013) on
// the SDM230 and 52 (0x0034, 30053) on the SDM630. The meters speak Modbus RTU over RS-485: a
// converter to Ethernet in "Modbus RTU to TCP" mode puts them on the network, each meter keeping its
// own unit ID.
const MODELS: Record<MeterModel, { name: string; powerAddress: number; phases: string; serial: string }> = {
  sdm230: {
    name: "Eastron SDM230",
    powerAddress: 12,
    phases: "single-phase",
    serial: "Its serial speed depends on the version (the V1.6 manual says 2400 baud as delivered), with no parity and one stop bit: read it from the meter's own display (the Baud Rate page) and give the converter the same."
  },
  sdm630: {
    name: "Eastron SDM630",
    powerAddress: 52,
    phases: "three-phase",
    serial: "Its serial settings are 9600 baud, 8 data bits, no parity and one stop bit as delivered; read them from the meter's own display and give the converter the same."
  }
};

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
  const { name, powerAddress, phases, serial } = MODELS[model];
  const common = {
    maker: "Eastron",
    defaultPort: 502,
    defaultUnitId: 1,
    deviceType: role === "grid" ? "grid_meter" : role === "solar" ? "production_meter" : "load_meter"
  };
  const reading = (canonicalName: CanonicalPointName, label: string, part: PointSource["part"]): DeviceProfilePoint => ({ canonicalName, label, unit: "kW", source: power(powerAddress, part) });

  if (role === "grid") {
    return {
      ...common,
      key: `eastron-${model}-grid`,
      name: `${name} at the grid connection`,
      description: `A ${phases} meter where the site meets the grid. Positive power is energy coming in, negative is energy sent out, so it gives both Grid import and Grid export.`,
      notes: [
        "Fit it where the supply enters the site, with the current clamps on the incoming phases, arrow towards the site.",
        "Check the direction: switch on a known load with the sun down. Grid import must go up. If Grid export goes up instead, the clamps are reversed.",
        `The meter's Modbus address is 1 unless it was changed. ${serial} Every meter on one cable must use the same speed and parity, and its own address.`
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
        "Production is the size of the power, so a reversed clamp does not make it read zero. At night it reads zero or a few watts."
      ],
      points: [reading("energy.solar.power.kw", "Solar production", "absolute")]
    };
  }
  return {
    ...common,
    key: `eastron-${model}-load`,
    name: `${name} on the site's own consumption`,
    description: `A ${phases} meter on the feed to the loads, to measure what the site uses directly instead of working it out.`,
    notes: ["Optional. With grid and solar meters the site's consumption can be worked out; a load meter makes it measured and lets the platform check that everything adds up."],
    points: [reading("energy.consumption.kw", "Energy consumption", "absolute")]
  };
}

const roles: MeterRole[] = ["grid", "solar", "load"];
const models: MeterModel[] = ["sdm230", "sdm630"];

export const deviceProfiles: readonly DeviceProfile[] = models.flatMap((model) => roles.map((role) => meterProfile(model, role)));

export function profileByKey(key: string): DeviceProfile | undefined {
  return deviceProfiles.find((profile) => profile.key === key);
}
