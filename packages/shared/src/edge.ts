import type { CanonicalPointName } from "./index";
import type { ModbusConnection, PointSource } from "./modbus";

// What the gateway at a site and the platform say to each other: what to read (config), and how the
// box is doing (heartbeat). The gateway is told what to read by the platform, so equipment is described
// once, in the platform, and nobody edits files on a box in a plant room.

export type DeviceConnection = ModbusConnection;

export interface EdgeConfigPoint {
  pointId: string;
  assetId?: string;
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
  source: PointSource;
}

export interface EdgeConfigDevice {
  deviceId: string;
  name: string;
  connection: DeviceConnection;
  points: EdgeConfigPoint[];
}

export interface EdgeConfig {
  /** A digest of the rest. The gateway compares it with what it holds, and changes only when it differs. */
  version: string;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  pollIntervalMs: number;
  devices: EdgeConfigDevice[];
}

/** How one device answered the last time the driver asked it for its readings. */
export interface DriverDeviceStatus {
  deviceId: string;
  /** False when none of its readings could be read. */
  ok: boolean;
  readingsOk: number;
  readingsFailed: number;
  /** In words a person at the site can act on: "no answer from 192.168.1.50:502 (unit 2)". */
  lastError?: string;
  lastOkAtUtc?: string;
}

/** Published by the driver on the box after every round of reading, and gathered into the heartbeat. */
export interface DriverStatusMessage {
  messageType: "driver_status";
  tenantId: string;
  siteId: string;
  gatewayId: string;
  configVersion?: string;
  publishedAtUtc: string;
  devices: DriverDeviceStatus[];
}

export interface GatewayHeartbeat {
  agentVersion: string;
  uptimeSeconds: number;
  sentAtUtc: string;
  /** Readings waiting on the box because the platform could not be reached. */
  bufferDepth: number;
  oldestBufferedAgeSeconds?: number;
  configVersion?: string;
  devices: DriverDeviceStatus[];
}

export interface HeartbeatReply {
  serverTimeUtc: string;
  /** The version of the configuration the platform holds for this gateway now. */
  configVersion: string;
  /** The box's clock minus the platform's, in seconds. Large values corrupt timestamps, so they are shown. */
  clockSkewSeconds: number;
  latestAgentVersion: string;
  updateAvailable: boolean;
}

/** The unit each kind of reading is kept in. */
export const canonicalUnits: Readonly<Record<CanonicalPointName, string>> = {
  "water.tank.level.percent": "%",
  "water.flow.lpm": "lpm",
  "water.pressure.bar": "bar",
  "water.pump.status": "state",
  "water.pump.command": "state",
  "energy.solar.power.kw": "kW",
  "energy.consumption.kw": "kW",
  "energy.battery.soc.percent": "%",
  "energy.battery.power.kw": "kW",
  "energy.grid.import.kw": "kW",
  "energy.grid.export.kw": "kW",
  "agri.soil.moisture.percent": "%",
  "agri.air.temperature.c": "C",
  "agri.humidity.percent": "%",
  "agri.irrigation.command": "state",
  "system.gateway.online": "state"
};

/** The range a reading of each kind can sensibly be in. Outside it the reading is almost certainly a
 * wrong register, a wrong scale or a wiring fault, and commissioning says so. Not a limit on the
 * process: a real tank can be at 0%, and a real pressure can be dangerous; this is only "could this
 * number be a tank level at all". */
export const plausibleRanges: Readonly<Partial<Record<CanonicalPointName, { min: number; max: number; what: string }>>> = {
  "water.tank.level.percent": { min: 0, max: 100, what: "a tank level" },
  "water.flow.lpm": { min: 0, max: 100000, what: "a flow in litres a minute" },
  "water.pressure.bar": { min: -1, max: 40, what: "a line pressure in bar" },
  "energy.solar.power.kw": { min: 0, max: 5000, what: "a solar plant's power" },
  "energy.consumption.kw": { min: 0, max: 10000, what: "a site's consumption" },
  "energy.grid.import.kw": { min: 0, max: 10000, what: "power imported from the grid" },
  "energy.grid.export.kw": { min: 0, max: 5000, what: "power exported to the grid" },
  "energy.battery.soc.percent": { min: 0, max: 100, what: "a battery's charge" },
  "energy.battery.power.kw": { min: -2000, max: 2000, what: "a battery's power" },
  "agri.soil.moisture.percent": { min: 0, max: 100, what: "soil moisture" },
  "agri.air.temperature.c": { min: -40, max: 70, what: "an air temperature in degrees Celsius" },
  "agri.humidity.percent": { min: 0, max: 100, what: "a relative humidity" }
};

/** Why a number could not be this kind of reading, or undefined when it could. */
export function plausibilityProblem(canonicalName: CanonicalPointName, value: number): string | undefined {
  const range = plausibleRanges[canonicalName];
  if (!range || !Number.isFinite(value)) return undefined;
  if (value >= range.min && value <= range.max) return undefined;
  const shown = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${shown} cannot be ${range.what} (${range.min} to ${range.max}). Check the register address, the scale or the sensor.`;
}
