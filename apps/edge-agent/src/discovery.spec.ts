import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiscoveryRequest, PROBES, ProbeRead, identifyUnit, proposeAssignments, expectationOf, validateDiscoveryResult } from "@greecon/shared";
import { Answer, DiscoveryTools, realTools, runDiscovery, sanitise, subnetsOf } from "./discovery";
import { FakeModbusServer, startFakeModbusServer } from "./testing/fake-modbus-server";

const lan = (address: string, netmask = "255.255.255.0", extra: Partial<{ internal: boolean; family: string }> = {}) => ({ address, netmask, internal: false, family: "IPv4", ...extra });

describe("which networks the box is willing to look at", () => {
  it("is its own private network, as far as 254 addresses, never its own address, the network or the broadcast", () => {
    const [subnet, ...rest] = subnetsOf([lan("192.168.1.20")]);
    expect(rest).toEqual([]);
    expect(subnet?.cidr).toBe("192.168.1.0/24");
    expect(subnet?.hosts).toHaveLength(253);
    expect(subnet?.hosts).not.toContain("192.168.1.20");
    expect(subnet?.hosts).not.toContain("192.168.1.0");
    expect(subnet?.hosts).not.toContain("192.168.1.255");
    expect(subnet?.hosts[0]).toBe("192.168.1.1");
  });

  it("is no wider than 254 addresses, even on a big network, and the part around the box", () => {
    const [subnet] = subnetsOf([lan("10.4.7.9", "255.255.0.0")]);
    expect(subnet?.cidr).toBe("10.4.7.0/24");
    expect(subnet?.hosts).toHaveLength(253);
  });

  it("is a small network exactly, not a bigger one around it", () => {
    const [subnet] = subnetsOf([lan("192.168.4.34", "255.255.255.240")]);
    expect(subnet?.cidr).toBe("192.168.4.32/28");
    expect(subnet?.hosts.length).toBe(13);
    expect(subnet?.hosts).not.toContain("192.168.4.34");
  });

  it("is nothing on a public address, a loopback, a link that is internal or an address that is not IPv4", () => {
    expect(subnetsOf([lan("84.22.1.9"), lan("127.0.0.1", "255.0.0.0", { internal: true }), lan("192.168.1.5", "255.255.255.0", { internal: true }), lan("fe80::1", "ffff:ffff:ffff:ffff::", { family: "IPv6" })])).toEqual([]);
  });

  it("is each network once, when the box has two addresses on it", () => {
    expect(subnetsOf([lan("192.168.1.20"), lan("192.168.1.21"), lan("10.0.0.5")]).map((subnet) => subnet.cidr)).toEqual(["192.168.1.0/24", "10.0.0.0/24"]);
  });

  it("stops at the most addresses it is willing to try, however many networks there are", () => {
    const subnets = subnetsOf([lan("192.168.1.20"), lan("192.168.2.20"), lan("192.168.3.20")], 300);
    expect(subnets.flatMap((subnet) => subnet.hosts)).toHaveLength(300);
  });
});

describe("what the box is willing to be asked", () => {
  it("looks only at private addresses, and says which it refused", () => {
    expect(sanitise({ id: "r", hosts: ["192.168.1.60", "8.8.8.8", "10.0.0.2", "not an address"] })).toMatchObject({ hosts: ["192.168.1.60", "10.0.0.2"], refused: ["8.8.8.8", "not an address"] });
  });

  it("uses the usual port and the kit's unit numbers unless told, and keeps to sensible ones when told", () => {
    expect(sanitise({ id: "r" })).toMatchObject({ ports: [502], units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(sanitise({ id: "r", ports: [0, 502, 70000, 4001, 1.5], units: [300, 1, -2, 7] })).toMatchObject({ ports: [502, 4001], units: [1, 7] });
    expect(sanitise({ id: "r", ports: [], units: [] })).toMatchObject({ ports: [502], units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(sanitise({ id: "r", ports: [1, 2, 3, 4, 5, 6] }).ports).toHaveLength(4);
    expect(sanitise({ id: "r", units: Array.from({ length: 100 }, (_, index) => index) }).units).toHaveLength(32);
    expect(sanitise({ id: "r", hosts: Array.from({ length: 40 }, (_, index) => `10.0.0.${index + 1}`) }).hosts).toHaveLength(16);
  });
});

/** A network that is only an object: which addresses accept a connection, and what each unit answers. */
function pretendNetwork(options: { open?: string[]; units?: Record<string, Record<number, Partial<Record<string, Answer>>>>; interfaces?: ReturnType<DiscoveryTools["interfaces"]> } = {}) {
  const asked: Array<{ host: string; unit: number; probe: string }> = [];
  const connects: string[] = [];
  let clockMs = Date.parse("2026-10-31T10:00:00Z");
  const keyOf = (read: ProbeRead) => PROBES.find((probe) => probe.read.registerType === read.registerType && probe.read.address === read.address && probe.read.count === read.count)?.key ?? "unknown";
  const tools: DiscoveryTools = {
    interfaces: () => options.interfaces ?? [lan("192.168.1.20")],
    connects: async (host, port) => {
      connects.push(`${host}:${port}`);
      return (options.open ?? []).includes(host);
    },
    ask: async (host, _port, unit, read) => {
      const probe = keyOf(read);
      asked.push({ host, unit, probe });
      clockMs += 10;
      return options.units?.[host]?.[unit]?.[probe] ?? { outcome: "silent" };
    },
    close: async () => undefined,
    now: () => clockMs
  };
  return { tools, asked, connects, tick: (ms: number) => void (clockMs += ms) };
}

const floatWords = (watts: number): number[] => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, watts);
  return [view.getUint16(0), view.getUint16(2)];
};

/** What an SDM630 says to each question. */
const meter = (watts: number): Record<string, Answer> => ({
  "eastron-voltage": { outcome: "ok", words: floatWords(231) },
  "analog-channels": { outcome: "ok", words: [...floatWords(231), 0] },
  "digital-inputs": { outcome: "refused" },
  "eastron-630": { outcome: "ok", words: floatWords(watts) },
  "eastron-230": { outcome: "ok", words: floatWords(watts / 3) },
  "module-address": { outcome: "refused" }
});

describe("looking at the network", () => {
  it("tries every address on the box's own network, and asks only the converters that answered", async () => {
    const network = pretendNetwork({
      open: ["192.168.1.50"],
      units: { "192.168.1.50": { 1: meter(2000) } }
    });
    const result = await runDiscovery({ id: "r-1" }, network.tools);
    expect(network.connects).toHaveLength(253);
    expect(new Set(network.asked.map((entry) => entry.host))).toEqual(new Set(["192.168.1.50"]));
    expect(result).toMatchObject({ requestId: "r-1", scanned: { subnets: ["192.168.1.0/24"], hostsTried: 253, ports: [502], units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, notes: [] });
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0]?.units.map((unit) => unit.unit)).toEqual([1]);
    expect(validateDiscoveryResult(result)).toEqual([]);
    expect(identifyUnit(result.hosts[0]!.units[0]!.probes)).toMatchObject({ family: "eastron-meter" });
  });

  it("asks a unit that answers none of the three presence questions nothing more, because nothing is there", async () => {
    const network = pretendNetwork({ open: ["192.168.1.50"] });
    const result = await runDiscovery({ id: "r-1" }, network.tools);
    // Ten units, three questions each: all six would be sixty, and a converter waits out its serial timeout for every one.
    expect(network.asked).toHaveLength(30);
    expect(new Set(network.asked.map((entry) => entry.probe))).toEqual(new Set(PROBES.filter((probe) => probe.presence).map((probe) => probe.key)));
    expect(result.hosts).toEqual([{ host: "192.168.1.50", port: 502, units: [] }]);
  });

  it("asks every question of a unit that answers any of the presence ones, and says which went unanswered", async () => {
    const network = pretendNetwork({ open: ["192.168.1.50"], units: { "192.168.1.50": { 3: { "analog-channels": { outcome: "ok", words: [12000, 8000, 4000] }, "module-address": { outcome: "ok", words: [3] } } } } });
    const result = await runDiscovery({ id: "r-1", units: [3] }, network.tools);
    expect(network.asked.map((entry) => entry.probe)).toEqual(PROBES.map((probe) => probe.key));
    expect(result.hosts[0]?.units[0]?.probes.map((probe) => [probe.key, probe.outcome])).toEqual([
      ["eastron-voltage", "silent"],
      ["analog-channels", "ok"],
      ["digital-inputs", "silent"],
      ["eastron-630", "silent"],
      ["eastron-230", "silent"],
      ["module-address", "ok"]
    ]);
    expect(result.hosts[0]?.units[0]?.probes[1]?.words).toEqual([12000, 8000, 4000]);
  });

  it("asks a unit that only refuses the rest too, because only equipment that is there can refuse", async () => {
    const network = pretendNetwork({ open: ["192.168.1.50"], units: { "192.168.1.50": { 8: { "digital-inputs": { outcome: "refused" } } } } });
    const result = await runDiscovery({ id: "r-1", units: [8] }, network.tools);
    expect(network.asked).toHaveLength(PROBES.length);
    expect(result.hosts[0]?.units.map((unit) => unit.unit)).toEqual([8]);
  });

  it("finds a device that stays silent on a register it does not have, by the registers it does", async () => {
    // A cheap module that ignores the meter's registers and the digital inputs, and answers only its own: the unit is there all the same.
    const network = pretendNetwork({ open: ["192.168.1.50"], units: { "192.168.1.50": { 3: { "analog-channels": { outcome: "ok", words: [4000, 4000, 4000] }, "module-address": { outcome: "ok", words: [3] } } } } });
    const result = await runDiscovery({ id: "r-1", units: [3] }, network.tools);
    expect(identifyUnit(result.hosts[0]!.units[0]!.probes, 3).family).toBe("analog-module");
  });

  it("looks at the addresses it was given, and nothing else", async () => {
    const network = pretendNetwork({ open: ["192.168.1.60"] });
    const result = await runDiscovery({ id: "r-2", hosts: ["192.168.1.60"], ports: [502] }, network.tools);
    expect(network.connects).toEqual(["192.168.1.60:502"]);
    expect(result.scanned.subnets).toEqual([]);
    expect(result.hosts.map((host) => host.host)).toEqual(["192.168.1.60"]);
  });

  it("says when an address it was given does not answer, and what to check", async () => {
    const network = pretendNetwork({ open: [] });
    const result = await runDiscovery({ id: "r-2", hosts: ["192.168.1.60"] }, network.tools);
    expect(result.hosts).toEqual([]);
    expect(result.notes).toEqual(["Nothing at 192.168.1.60 accepts a connection on port 502. Check the converter is switched on and on this network."]);
  });

  it("refuses an address that is not on a private network, says so, and does not fall back to looking around", async () => {
    const network = pretendNetwork({ open: ["8.8.8.8"] });
    const result = await runDiscovery({ id: "r-3", hosts: ["8.8.8.8"] }, network.tools);
    expect(network.connects).toEqual([]);
    expect(result.notes).toEqual(["8.8.8.8 is not on a private network, so the box did not look there."]);
  });

  it("says so when the box is not on a network it may look at", async () => {
    const network = pretendNetwork({ interfaces: [lan("84.22.1.9")] });
    const result = await runDiscovery({ id: "r-4" }, network.tools);
    expect(network.connects).toEqual([]);
    expect(result.notes[0]).toContain("not on a private network that it may look at");
  });

  it("stops when the converter stops answering part way, and says so", async () => {
    const network = pretendNetwork({ open: ["192.168.1.50"] });
    let calls = 0;
    const tools: DiscoveryTools = { ...network.tools, ask: async () => ((calls += 1) > 3 ? { outcome: "silent", converterGone: true } : { outcome: "silent" }) };
    const result = await runDiscovery({ id: "r-5" }, tools);
    // The first unit took three questions (nothing there); the fourth question found the converter gone.
    expect(calls).toBe(4);
    expect(result.notes).toEqual(["The converter at 192.168.1.50 stopped answering part way through."]);
  });

  it("gives up when its time is used, and says the answer may be incomplete", async () => {
    const network = pretendNetwork({ open: ["192.168.1.50"] });
    const slow: DiscoveryTools = { ...network.tools, ask: async (host, port, unit, read) => (network.tick(30_000), network.tools.ask(host, port, unit, read)) };
    const result = await runDiscovery({ id: "r-6" }, slow, { budgetMs: 60_000 });
    expect(result.notes).toEqual(["The search was stopped after 60 seconds, so it may be incomplete. Find the equipment again."]);
    expect(result.hosts).toHaveLength(1);
  });

  it("looks at converters one question at a time, and several converters at once", async () => {
    let inFlight = 0;
    let most = 0;
    const perHost = new Map<string, number>();
    let mostOnOne = 0;
    const network = pretendNetwork({ open: ["192.168.1.50", "192.168.1.51", "192.168.1.52"] });
    const tools: DiscoveryTools = {
      ...network.tools,
      ask: async (host, port, unit, read) => {
        inFlight += 1;
        perHost.set(host, (perHost.get(host) ?? 0) + 1);
        most = Math.max(most, inFlight);
        mostOnOne = Math.max(mostOnOne, perHost.get(host) ?? 0);
        await new Promise((resolve) => setTimeout(resolve, 2));
        const answer = await network.tools.ask(host, port, unit, read);
        inFlight -= 1;
        perHost.set(host, (perHost.get(host) ?? 1) - 1);
        return answer;
      }
    };
    await runDiscovery({ id: "r-7", units: [1, 2] }, tools);
    expect(mostOnOne).toBe(1);
    expect(most).toBe(3);
  });

  it("never writes: every question is a read of one of the three kinds of register", () => {
    expect(new Set(PROBES.map((probe) => probe.read.registerType))).toEqual(new Set(["input", "holding", "discrete"]));
  });
});

describe("looking at a real converter", () => {
  let converter: FakeModbusServer;
  let tools: DiscoveryTools;

  beforeEach(async () => {
    // The kit of a hotel on one converter, as the equipment makers' own registers would answer.
    converter = await startFakeModbusServer([1, 2, 3, 5]);
    for (const [unit, watts] of [[1, 3200], [2, 5100]] as const) {
      converter.setFloat32(unit, "input", 0, 231);
      converter.setRegister(unit, "input", 2, 0);
      converter.setFloat32(unit, "input", 52, watts);
      converter.setFloat32(unit, "input", 12, watts / 3);
    }
    for (const channel of [0, 1, 2]) converter.setRegister(3, "input", channel, [12000, 8000, 4000][channel] as number);
    converter.setRegister(3, "holding", 0x4000, 3);
    converter.setRegister(5, "holding", 0x4000, 5);
    for (let input = 0; input < 8; input += 1) converter.setDiscrete(5, input, input === 0 ? 1 : 0);
    // The module that takes 4 to 20 mA is not a digital module, and the digital module is not an analog one.
    converter.refuseFunction(1, 2);
    converter.refuseFunction(3, 2);
    converter.setAbsentUnits("exception");
    tools = realTools(Date.now, { requestTimeoutMs: 300, connectTimeoutMs: 500 });
  });

  afterEach(async () => {
    await tools.close();
    await converter.close();
  });

  it("finds each piece of the kit by what it answers, and the platform can match them to the devices it plans", async () => {
    const request: DiscoveryRequest = { id: "real-1", hosts: [converter.host], ports: [converter.port], units: [1, 2, 3, 4, 5, 6, 7] };
    const result = await runDiscovery(request, tools);
    expect(validateDiscoveryResult(result)).toEqual([]);
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0]?.units.map((unit) => unit.unit)).toEqual([1, 2, 3, 5]);

    const planned = [
      { id: "g", name: "Grid meter", deviceType: "grid_meter", profileKey: "eastron-sdm630-grid" },
      { id: "s", name: "Solar meter", deviceType: "production_meter", profileKey: "eastron-sdm630-solar" },
      { id: "w", name: "Water I/O module", deviceType: "analog_io_module", profileKey: "waveshare-ai8-water" },
      { id: "p", name: "Pump contact module (optional)", deviceType: "digital_input_module", profileKey: "waveshare-io8-pump" }
    ].map((device) => ({ ...device, ...expectationOf(device) }));
    const { proposals, unclaimed, notes } = proposeAssignments(result.hosts, planned);
    expect(proposals.map((proposal) => [proposal.name, proposal.status, proposal.match?.unit])).toEqual([
      ["Grid meter", "found", 1],
      ["Solar meter", "found", 2],
      ["Water I/O module", "found", 3],
      ["Pump contact module (optional)", "found", 5]
    ]);
    expect(proposals[0]?.message).toContain("reading 3.20 kW at 231 V");
    expect(proposals[2]?.message).toContain("12.0 mA, 8.0 mA, 4.0 mA");
    expect(proposals[3]?.message).toContain("input 1 is closed");
    expect(unclaimed).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("does not take a unit that is not there for one that is, whether the converter says so at once or says nothing", async () => {
    const now = Date.now();
    const quiet = realTools(() => Date.now(), { requestTimeoutMs: 150, connectTimeoutMs: 300 });
    converter.setAbsentUnits("silent");
    try {
      const result = await runDiscovery({ id: "real-2", hosts: [converter.host], ports: [converter.port], units: [1, 9] }, quiet);
      expect(result.hosts[0]?.units.map((unit) => unit.unit)).toEqual([1]);
      // Unit 9 cost two questions that went unanswered, and no more.
      expect(Date.now() - now).toBeLessThan(5_000);
    } finally {
      await quiet.close();
    }
  });

  it("says what it saw of a converter with nothing behind it", async () => {
    const empty = await startFakeModbusServer([]);
    empty.setAbsentUnits("exception");
    try {
      const result = await runDiscovery({ id: "real-3", hosts: [empty.host], ports: [empty.port], units: [1, 2, 3] }, tools);
      expect(result.hosts).toEqual([{ host: empty.host, port: empty.port, units: [] }]);
      const { notes } = proposeAssignments(result.hosts, []);
      expect(notes[0]).toContain("but nothing answers behind it");
    } finally {
      await empty.close();
    }
  });

  it("only ever read: what it left on the converter is what was there", async () => {
    const before = converter.requests;
    await runDiscovery({ id: "real-4", hosts: [converter.host], ports: [converter.port], units: [1, 3] }, tools);
    expect(converter.requests).toBeGreaterThan(before);
    // The registers are as they were, because no question was a write: the fake server answers writes with an exception and keeps nothing.
    expect(await tools.ask(converter.host, converter.port, 3, { registerType: "holding", address: 0x4000, count: 1 })).toEqual({ outcome: "ok", words: [3] });
  });
});
