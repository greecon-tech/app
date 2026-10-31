import { Socket } from "node:net";
import { networkInterfaces } from "node:os";
import {
  DEFAULT_DISCOVERY_PORTS,
  DEFAULT_DISCOVERY_UNITS,
  DiscoveredHost,
  DiscoveredUnit,
  DiscoveryRequest,
  DiscoveryResult,
  PROBES,
  ProbeOutcome,
  ProbeRead,
  ProbeResult,
  isPrivateAddress
} from "@greecon/shared";
import { ModbusReadError, ModbusTcpReader } from "./modbus/reader";

// Looking for the equipment on the site's network, when a person presses "Find equipment" on the platform. The box looks at its own
// network, nobody else's, for converters that speak Modbus on the usual port; asks each unit number on each converter five harmless
// questions (reads only: function codes 02, 03 and 04, never a write); and says what answered. The platform recognises the equipment
// from the answers and fills in the addresses, so that nobody types one.
//
// Nothing here changes anything on the network or on a device. It runs once for each request, takes about a minute at most, and
// gives up on its own after a hard limit. The network and the clock are passed in, so the whole of it is tested without a network.

/** How a unit answered a question: with a value, with a refusal (it is there and has no such register), or not at all. */
export interface Answer {
  outcome: ProbeOutcome;
  words?: number[];
  /** The converter itself stopped answering: nothing behind it is worth asking this time. */
  converterGone?: boolean;
}

export interface DiscoveryTools {
  /** The box's own network interfaces. */
  interfaces(): Array<{ address: string; netmask: string; internal: boolean; family: string }>;
  /** Whether something accepts a connection at this address and port. */
  connects(host: string, port: number, timeoutMs: number): Promise<boolean>;
  /** One read-only question to one unit. */
  ask(host: string, port: number, unit: number, read: ProbeRead): Promise<Answer>;
  close(): Promise<void>;
  now(): number;
}

export interface DiscoveryOptions {
  /** How long to wait for something to accept a connection. */
  connectTimeoutMs?: number;
  /** Connections tried at once while looking at the network. */
  concurrency?: number;
  /** Converters asked at once. Each converter is asked one question at a time, as it can only answer one. */
  convertersAtOnce?: number;
  /** The whole search gives up after this long and says what it has. */
  budgetMs?: number;
  /** Most addresses looked at, however large the network. */
  maxAddresses?: number;
  log?: { info(message: string): void; warn(message: string): void };
}

const DEFAULTS = { connectTimeoutMs: 600, concurrency: 64, convertersAtOnce: 4, budgetMs: 90_000, maxAddresses: 512 };
const MAX_PORTS = 4;
const MAX_UNITS = 32;
const MAX_REQUESTED_HOSTS = 16;

// ---- The network, as numbers ---------------------------------------------------------------------------------------------------

function toNumber(address: string): number {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function toAddress(value: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join(".");
}

function prefixOf(netmask: string): number {
  return toNumber(netmask).toString(2).replace(/0/g, "").length;
}

export interface Subnet {
  /** "192.168.1.0/24" */
  cidr: string;
  /** Every address on it that is not the network, the broadcast or the box itself. */
  hosts: string[];
}

/** The networks the box is on, as far as it is willing to look: private addresses only, never wider than 254 addresses, and never
 * the box's own address. A box on a public address (or none) looks at nothing; the person enters the converter's address instead. */
export function subnetsOf(interfaces: ReturnType<DiscoveryTools["interfaces"]>, maxAddresses: number = DEFAULTS.maxAddresses): Subnet[] {
  const found = new Map<string, Subnet>();
  const own = new Set(interfaces.map((entry) => entry.address));
  for (const entry of interfaces) {
    if (entry.internal || entry.family !== "IPv4" || !isPrivateAddress(entry.address) || entry.address.startsWith("127.")) continue;
    const prefix = Math.max(24, Math.min(30, prefixOf(entry.netmask)));
    const size = 2 ** (32 - prefix);
    const network = Math.floor(toNumber(entry.address) / size) * size;
    const cidr = `${toAddress(network)}/${prefix}`;
    if (found.has(cidr)) continue;
    const hosts: string[] = [];
    for (let offset = 1; offset < size - 1; offset += 1) {
      const host = toAddress(network + offset);
      if (!own.has(host)) hosts.push(host);
    }
    found.set(cidr, { cidr, hosts });
  }
  const subnets = [...found.values()];
  let room = maxAddresses;
  return subnets.map((subnet) => {
    const hosts = subnet.hosts.slice(0, Math.max(0, room));
    room -= hosts.length;
    return { cidr: subnet.cidr, hosts };
  });
}

/** What was asked, kept to what the box is willing to do whoever asked: private addresses, a few ports and unit numbers. */
export function sanitise(request: DiscoveryRequest): { hosts: string[]; refused: string[]; ports: number[]; units: number[] } {
  const wanted = Array.isArray(request.hosts) ? request.hosts.filter((host) => typeof host === "string").slice(0, MAX_REQUESTED_HOSTS) : [];
  const hosts = wanted.filter((host) => isPrivateAddress(host));
  const ports = (Array.isArray(request.ports) ? request.ports : DEFAULT_DISCOVERY_PORTS).filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535).slice(0, MAX_PORTS);
  const units = (Array.isArray(request.units) ? request.units : DEFAULT_DISCOVERY_UNITS).filter((unit) => Number.isInteger(unit) && unit >= 0 && unit <= 247).slice(0, MAX_UNITS);
  return {
    hosts,
    refused: wanted.filter((host) => !isPrivateAddress(host)),
    ports: ports.length > 0 ? ports : DEFAULT_DISCOVERY_PORTS,
    units: units.length > 0 ? units : DEFAULT_DISCOVERY_UNITS
  };
}

async function inBatches<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(lanes);
  return results;
}

// ---- Asking a unit ---------------------------------------------------------------------------------------------------------------

/** The questions to a unit, the presence ones first (a register every unit of its family has). A unit that answers none of those, a
 * refusal included, is not there, and is not asked the rest: a converter waits out its serial timeout for every question to a unit that
 * is absent, and ten absent units would otherwise take minutes. */
async function askUnit(tools: DiscoveryTools, host: string, port: number, unit: number): Promise<{ result: DiscoveredUnit; converterGone: boolean }> {
  const probes: ProbeResult[] = [];
  let answered = false;
  for (const probe of PROBES) {
    if (!probe.presence && !answered) {
      for (const rest of PROBES.filter((candidate) => !candidate.presence)) probes.push({ key: rest.key, outcome: "silent" });
      break;
    }
    const answer = await tools.ask(host, port, unit, probe.read);
    if (answer.converterGone) return { result: { unit, probes }, converterGone: true };
    if (answer.outcome !== "silent") answered = true;
    probes.push({ key: probe.key, outcome: answer.outcome, ...(answer.outcome === "ok" && answer.words ? { words: answer.words } : {}) });
  }
  return { result: { unit, probes }, converterGone: false };
}

// ---- The search ------------------------------------------------------------------------------------------------------------------

export async function runDiscovery(request: DiscoveryRequest, tools: DiscoveryTools, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const settings = { ...DEFAULTS, ...options };
  const startedMs = tools.now();
  const deadline = startedMs + settings.budgetMs;
  const notes: string[] = [];
  const asked = sanitise(request);
  const late = () => tools.now() >= deadline;
  settings.log?.info(`Looking for equipment on the site's network (request ${request.id}).`);

  // 1. Which addresses to look at: the ones the person gave, or everything on the box's own network.
  let subnets: Subnet[] = [];
  let candidates: string[];
  if (asked.hosts.length > 0 || (request.hosts?.length ?? 0) > 0) {
    candidates = asked.hosts;
    if (asked.refused.length > 0) notes.push(`${asked.refused.join(", ")} ${asked.refused.length === 1 ? "is" : "are"} not on a private network, so the box did not look there.`);
  } else {
    subnets = subnetsOf(tools.interfaces(), settings.maxAddresses);
    candidates = subnets.flatMap((subnet) => subnet.hosts);
    if (subnets.length === 0) notes.push("This box is not on a private network that it may look at, so it looked nowhere. Enter the converter's address instead.");
  }

  // 2. Which of them accept a connection on the port.
  const targets = candidates.flatMap((host) => asked.ports.map((port) => ({ host, port })));
  let cutShort = false;
  const open = (
    await inBatches(targets, settings.concurrency, async (target) => {
      if (late()) {
        cutShort = true;
        return undefined;
      }
      return (await tools.connects(target.host, target.port, settings.connectTimeoutMs)) ? target : undefined;
    })
  ).filter((target): target is { host: string; port: number } => target !== undefined);
  if (asked.hosts.length > 0) {
    for (const host of asked.hosts) {
      if (!open.some((target) => target.host === host)) notes.push(`Nothing at ${host} accepts a connection on port ${asked.ports.join(" or ")}. Check the converter is switched on and on this network.`);
    }
  }

  // 3. What answers behind each of them.
  const hosts = await inBatches(open, settings.convertersAtOnce, async (target): Promise<DiscoveredHost> => {
    const units: DiscoveredUnit[] = [];
    for (const number of asked.units) {
      if (late()) {
        cutShort = true;
        break;
      }
      const { result, converterGone } = await askUnit(tools, target.host, target.port, number);
      if (result.probes.some((probe) => probe.outcome !== "silent")) units.push(result);
      if (converterGone) {
        notes.push(`The converter at ${target.host} stopped answering part way through.`);
        break;
      }
    }
    return { host: target.host, port: target.port, units };
  });

  if (cutShort) notes.push(`The search was stopped after ${Math.round(settings.budgetMs / 1000)} seconds, so it may be incomplete. Find the equipment again.`);
  const finishedMs = tools.now();
  const found = hosts.reduce((total, host) => total + host.units.length, 0);
  settings.log?.info(`Looked at ${targets.length} address(es): ${hosts.length} converter(s) answered, ${found} unit(s) behind them.`);
  return {
    requestId: request.id,
    startedAtUtc: new Date(startedMs).toISOString(),
    finishedAtUtc: new Date(finishedMs).toISOString(),
    scanned: { subnets: subnets.map((subnet) => subnet.cidr), hostsTried: candidates.length, ports: asked.ports, units: asked.units },
    hosts: hosts.slice(0, 64),
    notes: notes.slice(0, 20).map((note) => note.slice(0, 300))
  };
}

// ---- The real network ------------------------------------------------------------------------------------------------------------

/** Exceptions 10 and 11 are the converter saying that nothing answered it: the unit is not there. Every other refusal comes from a device. */
const GATEWAY_EXCEPTIONS = new Set([10, 11]);

export function realTools(now: () => number = Date.now, waits: { requestTimeoutMs?: number; connectTimeoutMs?: number } = {}): DiscoveryTools {
  // Its own connections, with short waits: a unit that is not there must not hold the search up for as long as it holds up a reading.
  const reader = new ModbusTcpReader({ requestTimeoutMs: waits.requestTimeoutMs ?? 1200, connectTimeoutMs: waits.connectTimeoutMs ?? 1000 });
  return {
    interfaces: () =>
      Object.values(networkInterfaces())
        .flatMap((list) => list ?? [])
        .map((entry) => ({ address: entry.address, netmask: entry.netmask, internal: entry.internal, family: String(entry.family) })),
    connects: (host, port, timeoutMs) =>
      new Promise<boolean>((resolve) => {
        const socket = new Socket();
        const finish = (result: boolean) => {
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
        socket.connect(port, host);
      }),
    ask: async (host, port, unit, read) => {
      try {
        const words = await reader.read({ kind: "modbus_tcp", host, port, unitId: unit }, read.registerType, read.address, read.count);
        return { outcome: "ok", words };
      } catch (error) {
        if (error instanceof ModbusReadError) {
          if (error.converterUnreachable) return { outcome: "silent", converterGone: true };
          if (error.kind === "refused" && !(error.modbusCode !== undefined && GATEWAY_EXCEPTIONS.has(error.modbusCode))) return { outcome: "refused" };
        }
        return { outcome: "silent" };
      }
    },
    close: () => reader.close(),
    now
  };
}
