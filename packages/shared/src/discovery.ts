import { EquipmentFamily, KIT_UNITS, deviceProfiles, profileByKey } from "./device-profiles";
import type { ModbusRegisterType } from "./modbus";
import { templateByKey } from "./site-templates";

// Finding the equipment on the site's network, so that nobody types an address. The box looks for Modbus converters on its own network,
// asks each unit number that might have something on it three or four harmless questions (reads, never writes), and says what answered. The
// platform recognises what it is from the answers, matches it to the devices the site is meant to have, and fills in their addresses.
//
// Everything here is pure: the box and the platform both use it, and it is tested without a network.

/** One question to a unit: read this. Only reads: function codes 02, 03 and 04. */
export interface ProbeRead {
  registerType: ModbusRegisterType;
  address: number;
  count: number;
}

export interface Probe {
  key: string;
  family: EquipmentFamily;
  read: ProbeRead;
  /** A register that is there in every unit of its family, so that something is there if any presence question gets an answer, a refusal included.
   * These are asked first, and a unit that answers none of them is not asked the rest. */
  presence?: boolean;
}

/** The questions that tell the equipment Greecon buys apart. Each is a register the maker documents; an answer that is a refusal is as
 * useful as a value, because only equipment that is there can refuse. What a unit is, though, is decided by what it positively says
 * (see identifyUnit), never by what it fails to say. */
export const PROBES: readonly Probe[] = [
  { key: "eastron-voltage", family: "eastron-meter", read: { registerType: "input", address: 0, count: 2 }, presence: true },
  { key: "analog-channels", family: "analog-module", read: { registerType: "input", address: 0, count: 3 }, presence: true },
  { key: "digital-inputs", family: "digital-module", read: { registerType: "discrete", address: 0, count: 8 }, presence: true },
  { key: "eastron-630", family: "eastron-meter", read: { registerType: "input", address: 52, count: 2 } },
  { key: "eastron-230", family: "eastron-meter", read: { registerType: "input", address: 12, count: 2 } },
  { key: "module-address", family: "analog-module", read: { registerType: "holding", address: 0x4000, count: 1 } }
];

/** Whether the unit answered: with a value, with a refusal (it is there but has no such register), or not at all (nothing is there, or the
 * converter could not reach it). */
export type ProbeOutcome = "ok" | "refused" | "silent";

export interface ProbeResult {
  key: string;
  outcome: ProbeOutcome;
  /** The words read, for an answer. A digital input is 0 or 1 for each of its inputs. */
  words?: number[];
  /** For a refusal: the Modbus exception code. 1 and 2 (no such function, no such register) are a device saying plainly that it does not have it;
   * 4 (device failure) and 6 (busy) are a device that could not say. Absent from an older box, which is read as a plain refusal. */
  code?: number;
}

export interface DiscoveredUnit {
  unit: number;
  probes: ProbeResult[];
}

export interface DiscoveredHost {
  host: string;
  port: number;
  units: DiscoveredUnit[];
}

/** What the platform asks the box to look for. Without hosts the box looks at its own network. */
export interface DiscoveryRequest {
  id: string;
  /** Addresses to look at as well (or instead, on a desk): private addresses only. */
  hosts?: string[];
  ports?: number[];
  units?: number[];
}

export interface DiscoveryResult {
  requestId: string;
  startedAtUtc: string;
  finishedAtUtc: string;
  scanned: { subnets: string[]; hostsTried: number; ports: number[]; units: number[] };
  /** Every address where something answered on the port, whether or not anything answered behind it. */
  hosts: DiscoveredHost[];
  /** Said in words: the scan was cut short, a network could not be read. */
  notes: string[];
}

export const DEFAULT_DISCOVERY_PORTS = [502];
/** Units 1 to 7 are the kit's; the rest are spare, so that a meter left at another number is still found. */
export const DEFAULT_DISCOVERY_UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ---- Recognising what answered -------------------------------------------------------------------------------------------------

export interface UnitIdentity {
  /** Something answered at this unit, with a value or a refusal. */
  present: boolean;
  family?: EquipmentFamily;
  /** The models whose own total-power register answered with a number that can be a power: both, for a three-phase meter, whose phase-one power sits where the SDM230's total does. */
  models?: MeterModel[];
  /** The models whose own total-power register was plainly refused ("no such register"). A register that merely did not answer rules nothing out: one
   * missed answer must not turn a three-phase meter into a single-phase one. */
  ruledOut?: MeterModel[];
  /** What it reads right now, in words. */
  sample?: string;
}

function float32(words: readonly number[] | undefined): number | undefined {
  if (!words || words.length < 2) return undefined;
  const view = new DataView(new ArrayBuffer(4));
  view.setUint16(0, (words[0] as number) & 0xffff);
  view.setUint16(2, (words[1] as number) & 0xffff);
  const value = view.getFloat32(0);
  return Number.isFinite(value) && Math.abs(value) < 10_000_000 ? value : undefined;
}

/** The mains voltage an Eastron meter shows on its first phase is somewhere in this range wherever it is installed (110 to 400 V systems, a line-to-line
 * reading included); a register that is not a voltage reads nothing like it. */
const MAINS_VOLTS = { min: 80, max: 480 };

/** What a unit is, from what it positively said. A unit is a Waveshare module when the register that holds its own address holds the address it
 * answered at, and an analog one if its input channels read and a digital one if its inputs do. A unit is an Eastron meter when its first-phase
 * voltage is a mains voltage and its power register holds a number: an absence of refusals is not a signature, because a device may answer
 * a register it does not have with zeros. `unit` is the address the unit was asked at. */
export function identifyUnit(probes: readonly ProbeResult[], unit?: number): UnitIdentity {
  const by = new Map(probes.map((probe) => [probe.key, probe]));
  const ok = (key: string) => by.get(key)?.outcome === "ok";
  const present = probes.some((probe) => probe.outcome !== "silent");
  if (!present) return { present: false };

  const address = ok("module-address") ? by.get("module-address")?.words?.[0] : undefined;
  const isModule = address !== undefined && (unit === undefined || address === unit);
  if (isModule && ok("analog-channels")) {
    const channels = (by.get("analog-channels")?.words ?? []).map((word) => `${(word / 1000).toFixed(1)} mA`);
    return { present, family: "analog-module", sample: channels.join(", ") };
  }
  if (isModule && ok("digital-inputs")) {
    const bits = by.get("digital-inputs")?.words ?? [];
    return { present, family: "digital-module", sample: `input 1 is ${bits[0] ? "closed" : "open"}` };
  }

  const volts = ok("eastron-voltage") ? float32(by.get("eastron-voltage")?.words) : undefined;
  const sdm630 = ok("eastron-630") ? float32(by.get("eastron-630")?.words) : undefined;
  const sdm230 = ok("eastron-230") ? float32(by.get("eastron-230")?.words) : undefined;
  if (volts !== undefined && volts >= MAINS_VOLTS.min && volts <= MAINS_VOLTS.max && (sdm630 !== undefined || sdm230 !== undefined)) {
    const watts = sdm630 ?? (sdm230 as number);
    const models: MeterModel[] = [...(sdm630 !== undefined ? (["SDM630"] as const) : []), ...(sdm230 !== undefined ? (["SDM230"] as const) : [])];
    const plainlyRefused = (key: string): boolean => {
      const probe = by.get(key);
      return probe?.outcome === "refused" && (probe.code === undefined || probe.code === 1 || probe.code === 2 || probe.code === 3);
    };
    const ruledOut: MeterModel[] = [...(plainlyRefused("eastron-630") ? (["SDM630"] as const) : []), ...(plainlyRefused("eastron-230") ? (["SDM230"] as const) : [])];
    return { present, family: "eastron-meter", models, ruledOut, sample: `${(watts / 1000).toFixed(2)} kW at ${Math.round(volts)} V` };
  }
  return { present };
}

const FAMILY_WORDS: Record<EquipmentFamily, string> = { "eastron-meter": "an Eastron meter", "analog-module": "a 4 to 20 mA input module", "digital-module": "a digital input module" };

export function describeIdentity(identity: UnitIdentity): string {
  if (!identity.present) return "nothing answers";
  if (!identity.family) return "something answers that Greecon does not recognise";
  return `${FAMILY_WORDS[identity.family]}${identity.sample ? `, reading ${identity.sample}` : ""}`;
}

// ---- What the site is meant to have ----------------------------------------------------------------------------------------

export interface ExpectedDevice {
  id: string;
  name: string;
  deviceType: string;
  /** The profile the device was made from, when it is known. */
  profileKey?: string;
  connection?: { host: string; port: number; unitId: number };
}

/** The Eastron model a profile is for, from its key. */
export type MeterModel = "SDM230" | "SDM630";

/** "eastron-sdm630-grid" is for an SDM630 and "eastron-sdm230-grid" for an SDM230; nothing else is a meter. */
export function meterModelOf(profileKey: string | undefined): MeterModel | undefined {
  const match = /^eastron-(sdm230|sdm630)-/.exec(profileKey ?? "");
  return match ? (match[1]!.toUpperCase() as MeterModel) : undefined;
}

/** The profile of the same role (grid, solar, load) for the other model: where the box found a different meter from the one planned. */
export function profileForModel(profileKey: string, model: MeterModel): string | undefined {
  const match = /^eastron-(?:sdm230|sdm630)-(grid|solar|load)$/.exec(profileKey);
  return match ? `eastron-${model.toLowerCase()}-${match[1]}` : undefined;
}

const FAMILY_OF_TYPE: Record<string, { profile?: string; unit?: number }> = {
  grid_meter: { profile: "eastron-sdm630-grid" },
  production_meter: { profile: "eastron-sdm630-solar" },
  load_meter: { profile: "eastron-sdm630-load" },
  analog_io_module: { profile: "waveshare-ai8-water" },
  digital_input_module: { profile: "waveshare-io8-pump" },
  soil_sensor: { unit: KIT_UNITS.soil },
  weather_station: { unit: KIT_UNITS.weather }
};

/** What kind of equipment a device is meant to be and the address it has in the kit, from what is known of it: the profile it was made from,
 * the template's device of that name, or the kind of device. Equipment Greecon cannot recognise on a network has no family. */
export function expectationOf(device: Pick<ExpectedDevice, "name" | "deviceType" | "profileKey">, templateKey?: string): { family?: EquipmentFamily; unitId?: number; profileKey?: string; meterModel?: MeterModel } {
  const fromProfile = (key: string | undefined) => {
    const profile = key ? profileByKey(key) : undefined;
    return profile ? { family: profile.family, unitId: profile.defaultUnitId, profileKey: profile.key, ...(meterModelOf(profile.key) ? { meterModel: meterModelOf(profile.key) as MeterModel } : {}) } : undefined;
  };
  const direct = fromProfile(device.profileKey);
  if (direct) return direct;
  const templated = templateKey ? templateByKey(templateKey)?.devices.find((entry) => entry.name === device.name) : undefined;
  if (templated) return fromProfile(templated.profile) ?? { unitId: templated.defaultUnitId };
  const named = fromProfile(deviceProfiles.find((profile) => profile.name === device.name)?.key);
  if (named) return named;
  const byType = FAMILY_OF_TYPE[device.deviceType];
  return byType?.profile ? (fromProfile(byType.profile) as { family: EquipmentFamily; unitId: number }) : { unitId: byType?.unit };
}

// ---- Matching what was found to what is meant to be there --------------------------------------------------------------------

export interface UnitFound {
  host: string;
  port: number;
  unit: number;
  identity: UnitIdentity;
  /** Everything the unit said, as one string. Two different devices never say exactly the same words (their voltage, their power, their own address differ). */
  signature: string;
}

export type ProposalStatus = "found" | "already" | "missing" | "unsure" | "by-hand";

export interface DeviceProposal {
  deviceId: string;
  name: string;
  status: ProposalStatus;
  /** Where it was found, for "found" and "already". */
  match?: { host: string; port: number; unit: number; seen: string };
  /** Found at the number the kit gives it: the only kind of match that is filled in without anybody pressing a button. */
  exact?: boolean;
  /** The meter that is there is not the model planned: the device is to be read as this one instead, once a person says to. */
  useModel?: MeterModel;
  /** In words: what was found, or what to check. */
  message: string;
}

export interface DiscoveryProposal {
  proposals: DeviceProposal[];
  /** Units that answered and that no device of the site accounts for. */
  unclaimed: UnitFound[];
  /** What to say about the network as a whole. */
  notes: string[];
}

const signatureOf = (probes: readonly ProbeResult[]): string => JSON.stringify(probes.map((probe) => [probe.key, probe.outcome, probe.words ?? null]));

export function unitsFound(hosts: readonly DiscoveredHost[]): UnitFound[] {
  return hosts
    .flatMap((host) => host.units.map((unit) => ({ host: host.host, port: host.port, unit: unit.unit, identity: identifyUnit(unit.probes, unit.unit), signature: signatureOf(unit.probes) })))
    .filter((found) => found.identity.present);
}

const MODEL_WORDS: Record<MeterModel, string> = { SDM230: "single-phase SDM230", SDM630: "three-phase SDM630" };

/** "three-phase SDM630". */
export function describeModel(model: MeterModel): string {
  return MODEL_WORDS[model];
}

export function proposeAssignments(hosts: readonly DiscoveredHost[], devices: ReadonlyArray<ExpectedDevice & { family?: EquipmentFamily; unitId?: number; meterModel?: MeterModel }>): DiscoveryProposal {
  const found = unitsFound(hosts);
  const recognised = found.filter((candidate) => candidate.identity.family);
  const notes: string[] = [];

  // A converter set to a mode that fixes the unit number answers every unit number as the one device behind it. Units that said exactly the same words are
  // not different devices, and taking them for the grid meter and the solar meter would show one meter's readings as both.
  const bySignature = new Map<string, UnitFound[]>();
  for (const candidate of recognised) {
    const key = `${candidate.host}:${candidate.port}|${candidate.signature}`;
    bySignature.set(key, [...(bySignature.get(key) ?? []), candidate]);
  }
  const echoed = new Set<UnitFound>();
  const echoWords = new Map<EquipmentFamily, string>();
  for (const group of bySignature.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) echoed.add(candidate);
    const first = group[0] as UnitFound;
    const words = `Units ${group.map((candidate) => candidate.unit).join(", ")} at ${first.host} all answered with exactly the same words, so they cannot be different devices: the converter is probably answering every unit number as the one device behind it. It must be in Modbus TCP to RTU (gateway) mode, not in a mode that fixes the unit number. If the converter is set right and the devices simply read the same (two meters that are both off), look again when one of them is working.`;
    echoWords.set(first.identity.family as EquipmentFamily, words);
    notes.push(words);
  }
  const usable = recognised.filter((candidate) => !echoed.has(candidate));

  // `claimed`: given to a device (or held for it). `involved`: named in a line that says Greecon is not sure which is which: it stays available to the devices
  // of its kind, so that each of them says so too, and it is not listed a second time as unaccounted for.
  const claimed = new Set<UnitFound>();
  const involved = new Set<UnitFound>();
  const result = new Map<string, DeviceProposal>();
  const seen = (candidate: UnitFound) => describeIdentity(candidate.identity);
  const unsure = (device: ExpectedDevice, message: string): DeviceProposal => ({ deviceId: device.id, name: device.name, status: "unsure", message });
  const take = (device: ExpectedDevice & { meterModel?: MeterModel }, candidate: UnitFound, exact: boolean, extra = ""): DeviceProposal => {
    const models = candidate.identity.models ?? [];
    const ruledOut = candidate.identity.ruledOut ?? [];
    const planned = device.meterModel;
    // The planned model's own register did not answer, and was not plainly refused either: a missed answer must not change what a meter is.
    if (planned && models.length > 0 && !models.includes(planned) && !ruledOut.includes(planned)) {
      claimed.add(candidate);
      return unsure(device, `Something answers at ${candidate.host}, unit ${candidate.unit}, but not clearly enough to tell whether it is the ${describeModel(planned)} planned. Look again; if it is the same, check the speed and the A and B wires.`);
    }
    claimed.add(candidate);
    const same = device.connection && device.connection.host === candidate.host && device.connection.port === candidate.port && device.connection.unitId === candidate.unit;
    // The planned model's register was plainly refused and the other model's answered: it is the other model, and a person is asked to say so.
    const useModel = planned && models.length > 0 && !models.includes(planned) ? (models[0] as MeterModel) : undefined;
    const change = useModel ? ` It is a ${describeModel(useModel)}, not the ${describeModel(planned as MeterModel)} planned. If you use this address, Greecon reads it as a ${describeModel(useModel)}.` : "";
    // Where both power registers answer and a single-phase meter was planned, it may be a three-phase one, which would be read at one phase only.
    const maybeThreePhase = planned === "SDM230" && models.includes("SDM630") && models.includes("SDM230");
    const check = maybeThreePhase
      ? ` It also answers the three-phase meter's total-power register, so it may be a three-phase SDM630: check the model on its label, and if it is one, remove this device and add the three-phase meter from "Add equipment Greecon already knows".`
      : "";
    return {
      deviceId: device.id,
      name: device.name,
      status: same && !useModel ? "already" : "found",
      match: { host: candidate.host, port: candidate.port, unit: candidate.unit, seen: seen(candidate) },
      exact,
      ...(useModel ? { useModel } : {}),
      message: `${same && !useModel ? "Already set, and answering" : "Found"} at ${candidate.host}, unit ${candidate.unit}: ${seen(candidate)}.${change}${check}${extra}`
    };
  };

  const withFamily = devices.filter((device) => device.family);
  // First, the meter, module or contact at the address the kit gives it. Two at one address cannot be told apart from here, and a guess would
  // swap two meters: the grid meter's readings would be the solar's.
  for (const device of withFamily) {
    const exact = usable.filter((candidate) => !claimed.has(candidate) && candidate.identity.family === device.family && candidate.unit === device.unitId);
    if (exact.length === 1) result.set(device.id, take(device, exact[0] as UnitFound, true));
    else if (exact.length > 1) {
      for (const candidate of exact) involved.add(candidate);
      result.set(
        device.id,
        unsure(device, `${exact.length} of this kind answer at unit ${device.unitId} (at ${exact.map((candidate) => candidate.host).join(", ")}), so Greecon cannot tell which is this one. Give each its own unit number (the install card lists them), or enter its address by hand.`)
      );
    }
  }
  // Then, where only one of a kind is left and only one device wants it, that one, whatever address it has been left at. It is only a suggestion: a
  // person says whether it is theirs, because it may be a meter of the customer's own that happens to share the cable.
  for (const device of withFamily) {
    if (result.has(device.id)) continue;
    const wanting = withFamily.filter((other) => !result.has(other.id) && other.family === device.family);
    const spare = usable.filter((candidate) => !claimed.has(candidate) && candidate.identity.family === device.family);
    if (wanting.length === 1 && spare.length === 1) {
      const candidate = spare[0] as UnitFound;
      result.set(device.id, take(device, candidate, false, ` It is at unit ${candidate.unit}, not ${device.unitId}: if it is this site's, use this address, and the install card gives ${device.unitId} so that the next site looks like this one.`));
    } else if (spare.length > 1) {
      for (const candidate of spare) involved.add(candidate);
      result.set(device.id, unsure(device, `${spare.length} of this kind answered (units ${spare.map((candidate) => candidate.unit).join(", ")}) and none is at unit ${device.unitId}. Set each to the address on the install card, then find the equipment again.`));
    }
  }
  for (const device of devices) {
    if (result.has(device.id)) continue;
    if (!device.family) {
      result.set(device.id, { deviceId: device.id, name: device.name, status: "by-hand", message: "Greecon cannot recognise this one on the network. Enter its address by hand." });
    } else if (echoWords.has(device.family)) {
      result.set(device.id, unsure(device, echoWords.get(device.family) as string));
    } else {
      const optional = /\(optional\)/i.test(device.name) ? " If the site does not have one, remove it from the list below." : "";
      result.set(device.id, {
        deviceId: device.id,
        name: device.name,
        status: "missing",
        message: `Nothing that looks like ${FAMILY_WORDS[device.family]} answers at unit ${device.unitId}. Check the address set on it, the speed, and the A and B wires.${optional}`
      });
    }
  }

  if (hosts.length === 0) {
    notes.push("No Modbus converter answered on this network. Check that the converter is switched on and plugged into the same router as the box, then find the equipment again. If the converter is on a different part of the network, give its address (I know the converter's address).");
  } else if (found.length === 0) {
    notes.push(`A converter answers at ${hosts.map((host) => host.host).join(", ")}, but nothing answers behind it. Check each meter's address, the speed on the converter and the meters, and the A and B wires.`);
  }
  return {
    proposals: devices.map((device) => result.get(device.id) as DeviceProposal),
    // What answered and is named in one of the lines above is not listed a second time as unaccounted for.
    unclaimed: found.filter((candidate) => !claimed.has(candidate) && !involved.has(candidate) && !echoed.has(candidate)),
    notes
  };
}

// ---- What the person who pressed "Find equipment" sees --------------------------------------------------------------------------

/** Where a search stands, and what it found, as the setup page shows it. */
export interface DiscoveryView {
  /** "idle": nobody has asked (or the platform has restarted since). "waiting": asked, and the box has not said yet. "done": the box said.
   * "expired": asked a long while ago and the box never said. */
  state: "idle" | "waiting" | "done" | "expired";
  requestedAtUtc?: string;
  finishedAtUtc?: string;
  /** Each box that has said, and what it looked at, in a sentence. */
  boxes: Array<{ name: string; finishedAtUtc: string; looked: string }>;
  /** One line for each device of the site that a box reads, from what the box found. */
  proposals: DeviceProposal[];
  /** What answered that no device of the site accounts for, in a sentence each. */
  unclaimed: Array<{ host: string; port: number; unit: number; seen: string }>;
  notes: string[];
  /** How many devices would be given an address, or a different one, by pressing "Use these addresses". */
  toApply: number;
  /** Every device that a box reads has the address that was found for it. */
  allSet: boolean;
}

/** A sentence for what a box looked at: "253 addresses on 192.168.1.0/24, unit numbers 1 to 10". */
export function describeScan(scanned: DiscoveryResult["scanned"]): string {
  const units = scanned.units.length === 0 ? "no unit numbers" : `unit numbers ${rangeWords(scanned.units)}`;
  const where = scanned.subnets.length > 0 ? ` on ${scanned.subnets.join(" and ")}` : "";
  return `${scanned.hostsTried} ${scanned.hostsTried === 1 ? "address" : "addresses"}${where}, ${units}`;
}

function rangeWords(numbers: readonly number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let index = 0; index < sorted.length; ) {
    let end = index;
    while (end + 1 < sorted.length && (sorted[end + 1] as number) === (sorted[end] as number) + 1) end += 1;
    runs.push(end > index + 1 ? `${sorted[index]} to ${sorted[end]}` : sorted.slice(index, end + 1).join(", "));
    index = end + 1;
  }
  return runs.join(", ");
}

// ---- What the box says is checked as it arrives ------------------------------------------------------------------------------

export function validateDiscoveryResult(body: unknown): string[] {
  if (typeof body !== "object" || body === null) return ["The result is missing."];
  const result = body as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof result.requestId !== "string" || result.requestId.length === 0 || result.requestId.length > 64) problems.push("requestId must be text of 1 to 64 characters.");
  for (const key of ["startedAtUtc", "finishedAtUtc"]) {
    if (typeof result[key] !== "string" || Number.isNaN(Date.parse(result[key] as string))) problems.push(`${key} must be a date and time.`);
  }
  if (!Array.isArray(result.hosts) || result.hosts.length > 64) return [...problems, "hosts must be a list of up to 64 entries."];
  const probeKeys = new Set(PROBES.map((probe) => probe.key));
  const ipv4 = /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/;
  result.hosts.forEach((entry: unknown, hostIndex: number) => {
    const host = entry as Partial<DiscoveredHost> | null;
    if (typeof host !== "object" || host === null || typeof host.host !== "string" || !ipv4.test(host.host)) return void problems.push(`hosts[${hostIndex}] must have an IPv4 address.`);
    // A box only looks at a site's own network, so an answer from anywhere else is not one it can have got.
    if (!isPrivateAddress(host.host)) problems.push(`hosts[${hostIndex}] is not on a private network.`);
    if (typeof host.port !== "number" || !Number.isInteger(host.port) || host.port < 1 || host.port > 65535) problems.push(`hosts[${hostIndex}].port must be a port number.`);
    if (!Array.isArray(host.units) || host.units.length > 64) return void problems.push(`hosts[${hostIndex}].units must be a list of up to 64 entries.`);
    host.units.forEach((unit, unitIndex) => {
      if (typeof unit?.unit !== "number" || !Number.isInteger(unit.unit) || unit.unit < 0 || unit.unit > 247) problems.push(`hosts[${hostIndex}].units[${unitIndex}].unit must be 0 to 247.`);
      if (!Array.isArray(unit?.probes) || unit.probes.length > PROBES.length) return void problems.push(`hosts[${hostIndex}].units[${unitIndex}].probes must be a list.`);
      for (const probe of unit.probes) {
        if (!probeKeys.has(probe?.key) || !["ok", "refused", "silent"].includes(probe?.outcome)) problems.push(`hosts[${hostIndex}].units[${unitIndex}] has a probe that is not one of ours.`);
        if (probe?.words !== undefined && (!Array.isArray(probe.words) || probe.words.length > 16 || probe.words.some((word: unknown) => typeof word !== "number" || !Number.isFinite(word)))) problems.push("A probe's words must be up to 16 numbers.");
        if (probe?.code !== undefined && (typeof probe.code !== "number" || !Number.isInteger(probe.code) || probe.code < 0 || probe.code > 255)) problems.push("A probe's exception code must be a whole number from 0 to 255.");
      }
    });
  });
  if (!Array.isArray(result.notes) || result.notes.length > 20 || result.notes.some((note: unknown) => typeof note !== "string" || note.length > 300)) problems.push("notes must be up to 20 short sentences.");
  const scanned = result.scanned as Record<string, unknown> | undefined;
  const listOf = (value: unknown, max: number, each: (item: unknown) => boolean): boolean => Array.isArray(value) && value.length <= max && value.every(each);
  if (
    typeof scanned !== "object" ||
    scanned === null ||
    !listOf(scanned.subnets, 8, (item) => typeof item === "string" && item.length <= 40) ||
    !listOf(scanned.ports, 8, (item) => typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 65535) ||
    !listOf(scanned.units, 64, (item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 247) ||
    typeof scanned.hostsTried !== "number" ||
    !Number.isInteger(scanned.hostsTried) ||
    scanned.hostsTried < 0 ||
    scanned.hostsTried > 100_000
  ) {
    problems.push("scanned must say what was looked at, in short lists.");
  }
  return problems;
}

/** A private address (one a site's own network uses) or this machine: the only places the box is asked to look. */
export function isPrivateAddress(host: string): boolean {
  // Plain decimal octets only, with no leading zero: "010.1.1.1" is 10.1.1.1 to this check, and to the system's resolver it is octal, 8.1.1.1, a public address.
  const match = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(host);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number) as [number, number, number, number];
  if ([a, b, c, d].some((part) => part > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 127;
}
