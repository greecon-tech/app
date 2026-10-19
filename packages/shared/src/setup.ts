import type { CanonicalPointName, GatewayContact, QualityFlag, SiteProfile, SiteType, UserRole } from "./index";
import type { DriverDeviceStatus } from "./edge";
import type { ModbusConnection, PointSource } from "./modbus";

// What the person setting a site up sees, and what the box says about itself. A project manager
// works down a list of plain steps; each says what is true now and what to do next, and none is
// marked done unless the platform has seen it work (a reading arrived) or a person said they checked.

/** The box reports in this often. */
export const HEARTBEAT_INTERVAL_SECONDS = 30;
/** Heard from within this long ago: online. Up to GATEWAY_LATE_WITHIN_SECONDS: late. After that: offline. */
export const GATEWAY_ONLINE_WITHIN_SECONDS = 120;
export const GATEWAY_LATE_WITHIN_SECONDS = 900;

export function gatewayContact(lastSeenUtc: string | undefined, nowMs: number): GatewayContact {
  if (!lastSeenUtc) return "never";
  const seenMs = Date.parse(lastSeenUtc);
  if (Number.isNaN(seenMs)) return "never";
  const ageSeconds = Math.max(0, (nowMs - seenMs) / 1000);
  if (ageSeconds <= GATEWAY_ONLINE_WITHIN_SECONDS) return "online";
  return ageSeconds <= GATEWAY_LATE_WITHIN_SECONDS ? "late" : "offline";
}

export interface EnrolmentIssued {
  /** Shown once, to the person at the box. Only its hash is kept. */
  code: string;
  expiresAtUtc: string;
  /** The line to paste into the box's terminal. */
  installCommand: string;
}

export interface EnrolResponse {
  apiUrl: string;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  gatewayName: string;
  /** The box's own credential. Sent once, to the box that used the code, and never again. */
  secret: string;
}

export type SetupStepStatus = "done" | "todo" | "waiting" | "attention";

export interface SetupStepItem {
  label: string;
  status: SetupStepStatus;
  detail?: string;
}

export interface SetupStep {
  /** Stable name of the step, for links and for confirming it. */
  key: string;
  title: string;
  status: SetupStepStatus;
  /** What is true now, in one sentence. */
  detail: string;
  /** What to do next. Present unless the step is done. */
  nextAction?: string;
  /** The parts the step covers, one line each: a device, a reading. */
  items?: SetupStepItem[];
  /** A step that does not hold up commissioning. */
  optional?: boolean;
  /** A person confirms this one by hand: the platform cannot see it. */
  manual?: boolean;
  confirmedAtUtc?: string;
  confirmedBy?: string;
  note?: string;
}

export interface SetupView {
  siteId: string;
  siteName: string;
  /** The template the site was made from, if any. */
  templateKey?: string;
  steps: SetupStep[];
  doneCount: number;
  totalCount: number;
  /** Every step that must be done, other than the final confirmation, is done. */
  readyToCommission: boolean;
  commissioned: boolean;
  commissionedAtUtc?: string;
  commissionedBy?: string;
}

/** The reading limits whose standard values decide when people are alerted: the ones agreed with the customer. */
export const ALERT_LIMIT_KEYS: readonly string[] = ["critical_low", "warning_low", "irrigate_below", "dry_run_lpm"];

/** The steps a person confirms by hand. */
export const manualSetupSteps = ["direction", "limits", "commissioned"] as const;
export type ManualSetupStep = (typeof manualSetupSteps)[number];

export function isManualSetupStep(key: string): key is ManualSetupStep {
  return (manualSetupSteps as readonly string[]).includes(key);
}

export interface HandoverReading {
  label: string;
  canonicalName: CanonicalPointName;
  unit: string;
  /** Where it is read from, in words. Absent if not mapped. */
  register?: string;
  latestValue?: number | boolean | string;
  latestAtUtc?: string;
  ageSeconds?: number;
  quality?: QualityFlag;
  current?: boolean;
  /** The limits in force: the ones set on the reading, else the standard ones. */
  limits: Array<{ key: string; label: string; value: number; standard: boolean }>;
}

export interface HandoverDevice {
  name: string;
  deviceType: string;
  /** "192.168.1.50:502, unit 2", or undefined when no address was entered. */
  address?: string;
  placementNote?: string;
  readings: HandoverReading[];
}

export interface HandoverView {
  generatedAtUtc: string;
  customer: string;
  site: { id: string; name: string; type: SiteType; locationName: string };
  profile: Pick<SiteProfile, "timezone" | "currency" | "importPricePerKwh" | "exportPricePerKwh" | "waterPricePerM3" | "zeroExport">;
  gateways: Array<{ name: string; contact: GatewayContact; lastSeenUtc?: string; softwareVersion?: string; enrolledAtUtc?: string }>;
  devices: HandoverDevice[];
  /** The checklist as it stands, including who confirmed what and when. */
  steps: SetupStep[];
  commissioned: boolean;
  commissionedAtUtc?: string;
  commissionedBy?: string;
  people: Array<{ name: string; email: string; role: UserRole }>;
  support: { email: string };
}

/** "192.168.1.50:502, unit 2". */
export function describeConnection(connection: ModbusConnection): string {
  return `${connection.host}:${connection.port}, unit ${connection.unitId}`;
}

const SIGN_WORDS: Record<NonNullable<PointSource["part"]>, string> = {
  positive: "only when positive",
  negative: "only when negative, as a positive number",
  absolute: "size of the value, either way"
};

/** "input register 52, float32, ×0.001, only when positive": the register as a person at the box would say it. */
export function describeSource(source: PointSource): string {
  const parts = [`${source.registerType} register ${source.address}`, source.dataType];
  if (source.wordOrder === "little") parts.push("low word first");
  if (source.linear) {
    const { rawLow, rawHigh, engLow, engHigh } = source.linear;
    parts.push(`${rawLow} to ${rawHigh} is ${engLow} to ${engHigh}`);
  } else {
    if (source.scale !== undefined && source.scale !== 1) parts.push(`×${source.scale}`);
    if (source.offset) parts.push(`${source.offset > 0 ? "+" : "−"}${Math.abs(source.offset)}`);
  }
  if (source.part) parts.push(SIGN_WORDS[source.part]);
  return parts.join(", ");
}

/** What is wrong with a heartbeat as it arrived, or an empty list. The box is ours, but a wrong
 * version of it, or something that is not our box at all, must not be able to write odd values. */
export function validateHeartbeat(body: unknown): string[] {
  if (typeof body !== "object" || body === null) return ["The heartbeat is missing."];
  const heartbeat = body as Record<string, unknown>;
  const problems: string[] = [];

  const text = (key: string, max: number): void => {
    const value = heartbeat[key];
    if (typeof value !== "string" || value.length === 0 || value.length > max) problems.push(`${key} must be text of 1 to ${max} characters.`);
  };
  const count = (key: string, required: boolean): void => {
    const value = heartbeat[key];
    if (value === undefined && !required) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) problems.push(`${key} must be a number, zero or more.`);
  };

  text("agentVersion", 64);
  text("sentAtUtc", 40);
  if (typeof heartbeat.sentAtUtc === "string" && Number.isNaN(Date.parse(heartbeat.sentAtUtc))) problems.push("sentAtUtc must be a date and time.");
  count("uptimeSeconds", true);
  count("bufferDepth", true);
  count("oldestBufferedAgeSeconds", false);
  if (heartbeat.configVersion !== undefined && (typeof heartbeat.configVersion !== "string" || heartbeat.configVersion.length > 64)) {
    problems.push("configVersion must be text of up to 64 characters.");
  }

  if (!Array.isArray(heartbeat.devices) || heartbeat.devices.length > 500) {
    problems.push("devices must be a list of up to 500 entries.");
  } else {
    heartbeat.devices.forEach((entry: unknown, index: number) => {
      const device = entry as Partial<DriverDeviceStatus> | null;
      if (typeof device !== "object" || device === null) return void problems.push(`devices[${index}] must be an object.`);
      if (typeof device.deviceId !== "string" || device.deviceId.length === 0 || device.deviceId.length > 64) problems.push(`devices[${index}].deviceId must be text.`);
      if (typeof device.ok !== "boolean") problems.push(`devices[${index}].ok must be true or false.`);
      for (const key of ["readingsOk", "readingsFailed"] as const) {
        if (typeof device[key] !== "number" || !Number.isFinite(device[key]) || (device[key] as number) < 0) problems.push(`devices[${index}].${key} must be a number, zero or more.`);
      }
      if (device.lastError !== undefined && (typeof device.lastError !== "string" || device.lastError.length > 500)) problems.push(`devices[${index}].lastError must be text of up to 500 characters.`);
      if (device.lastOkAtUtc !== undefined && (typeof device.lastOkAtUtc !== "string" || Number.isNaN(Date.parse(device.lastOkAtUtc)))) problems.push(`devices[${index}].lastOkAtUtc must be a date and time.`);
    });
  }
  return problems;
}
