import { describe, expect, it } from "vitest";
import {
  DiscoveredHost,
  DiscoveredUnit,
  ExpectedDevice,
  PROBES,
  ProbeResult,
  describeIdentity,
  expectationOf,
  identifyUnit,
  isPrivateAddress,
  meterModelOf,
  profileForModel,
  proposeAssignments,
  unitsFound,
  validateDiscoveryResult
} from "./index";

/** What the box would send back for a unit, from what each of the five questions got. */
function probes(answers: Partial<Record<(typeof PROBES)[number]["key"], "silent" | "refused" | number[]>>): ProbeResult[] {
  return PROBES.map((probe) => {
    const answer = answers[probe.key] ?? "silent";
    if (answer === "silent" || answer === "refused") return { key: probe.key, outcome: answer };
    return { key: probe.key, outcome: "ok", words: answer };
  });
}

const floatWords = (watts: number): number[] => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, watts);
  return [view.getUint16(0), view.getUint16(2)];
};

// What each piece of the kit says when asked the six questions.
/** An SDM630 answers its voltage, both power registers (the total at 52, and phase one's power where the SDM230 keeps its total) and, being a meter, the first three input registers. */
const sdm630 = (watts = 1800, volts = 231): ProbeResult[] =>
  probes({ "eastron-voltage": floatWords(volts), "analog-channels": [...floatWords(volts), 0], "digital-inputs": "refused", "eastron-630": floatWords(watts), "eastron-230": floatWords(watts / 3), "module-address": "refused" });
/** An SDM230 answers its voltage and its power, and refuses the SDM630's register. */
const sdm230 = (watts = 600, volts = 229): ProbeResult[] =>
  probes({ "eastron-voltage": floatWords(volts), "analog-channels": "refused", "digital-inputs": "refused", "eastron-630": "refused", "eastron-230": floatWords(watts), "module-address": "refused" });
const analog = (microamps = [12000, 8000, 4000], address = 3): ProbeResult[] =>
  probes({ "eastron-voltage": [microamps[0] as number, microamps[1] as number], "analog-channels": microamps, "digital-inputs": "refused", "eastron-630": "refused", "eastron-230": "refused", "module-address": [address] });
const digital = (closed = true, address = 5): ProbeResult[] =>
  probes({ "eastron-voltage": "refused", "analog-channels": "refused", "digital-inputs": [closed ? 1 : 0, 0, 0, 0, 0, 0, 0, 0], "eastron-630": "refused", "eastron-230": "refused", "module-address": [address] });
const nothing = (): ProbeResult[] => probes({});

const unit = (number: number, answers: ProbeResult[]): DiscoveredUnit => ({ unit: number, probes: answers });
const converter = (host: string, units: DiscoveredUnit[], port = 502): DiscoveredHost => ({ host, port, units });

/** The kit of a hotel on one converter: grid meter 1, solar meter 2, 4 to 20 mA module 3, pump contact 5. */
const kit = (host = "192.168.1.50"): DiscoveredHost => converter(host, [unit(1, sdm630()), unit(2, sdm630(5200)), unit(3, analog()), unit(4, nothing()), unit(5, digital())]);

function device(name: string, deviceType: string, profileKey: string | undefined, connection?: ExpectedDevice["connection"]): ExpectedDevice & ReturnType<typeof expectationOf> {
  const base: ExpectedDevice = { id: `d-${name}`, name, deviceType, ...(profileKey ? { profileKey } : {}), ...(connection ? { connection } : {}) };
  return { ...base, ...expectationOf(base, "hotel") };
}
const hotelDevices = (connected = false) => [
  device("Grid meter", "grid_meter", "eastron-sdm630-grid", connected ? { host: "192.168.1.50", port: 502, unitId: 1 } : undefined),
  device("Solar meter", "production_meter", "eastron-sdm630-solar", connected ? { host: "192.168.1.50", port: 502, unitId: 2 } : undefined),
  device("Water I/O module", "analog_io_module", "waveshare-ai8-water"),
  device("Pump contact module (optional)", "digital_input_module", "waveshare-io8-pump")
];

describe("recognising what answered", () => {
  it("says nothing is there when every question went unanswered", () => {
    expect(identifyUnit(nothing())).toEqual({ present: false });
    expect(describeIdentity({ present: false })).toBe("nothing answers");
  });

  it("recognises a three-phase meter by its total-power register, and says what it reads", () => {
    const identity = identifyUnit(sdm630(2500));
    expect(identity).toMatchObject({ present: true, family: "eastron-meter", models: ["SDM630", "SDM230"], sample: "2.50 kW at 231 V" });
    expect(describeIdentity(identity)).toBe("an Eastron meter, reading 2.50 kW at 231 V");
  });

  it("recognises a single-phase meter, which refuses the three-phase meter's register", () => {
    expect(identifyUnit(sdm230(400))).toMatchObject({ present: true, family: "eastron-meter", models: ["SDM230"], sample: "0.40 kW at 229 V" });
  });

  it("recognises a 4 to 20 mA module by its channels and its address register, and shows the current in milliamps", () => {
    expect(identifyUnit(analog([12000, 8000, 4000]), 3)).toMatchObject({ present: true, family: "analog-module", sample: "12.0 mA, 8.0 mA, 4.0 mA" });
  });

  it("takes a module for the one it is only when its address register holds the address it answered at", () => {
    // A module set to 3 and asked at 3 says so. Something that answers at 4 with a 3 in that register is not that module.
    expect(identifyUnit(analog(undefined, 3), 3).family).toBe("analog-module");
    expect(identifyUnit(analog(undefined, 3), 4).family).toBeUndefined();
    expect(identifyUnit(digital(true, 5), 5).family).toBe("digital-module");
    expect(identifyUnit(digital(true, 5), 6).family).toBeUndefined();
  });

  it("recognises a digital input module by its inputs, and says whether the first is closed", () => {
    expect(identifyUnit(digital(true), 5)).toMatchObject({ present: true, family: "digital-module", sample: "input 1 is closed" });
    expect(identifyUnit(digital(false), 5)).toMatchObject({ sample: "input 1 is open" });
  });

  it("does not take a digital module for an analog one, though both answer the address register", () => {
    expect(identifyUnit(digital(), 5).family).toBe("digital-module");
    expect(identifyUnit(analog(), 3).family).toBe("analog-module");
  });

  it("does not take an analog module's channels for a meter's voltage, however the numbers fall", () => {
    // Channels at 12 and 8 mA read as the two halves of a float that is nowhere near a mains voltage.
    expect(identifyUnit(analog([12000, 8000, 4000], 9), 3).family).toBeUndefined();
  });

  it("is present but not recognised when something answers that is none of ours", () => {
    const stranger = probes({ "eastron-voltage": "refused", "analog-channels": "refused", "digital-inputs": "refused", "eastron-630": "refused", "eastron-230": "refused", "module-address": "refused" });
    const identity = identifyUnit(stranger);
    expect(identity).toEqual({ present: true });
    expect(describeIdentity(identity)).toBe("something answers that Greecon does not recognise");
  });

  it("does not take a register that holds nonsense for a meter", () => {
    // A converter that answers every question with the same all-ones words is not an Eastron meter: the float is not a number.
    const noise = probes({ "eastron-voltage": [0x7fc0, 0], "eastron-630": [0x7fc0, 0], "eastron-230": [0xffff, 0xffff] });
    expect(identifyUnit(noise).family).toBeUndefined();
    const huge = probes({ "eastron-voltage": floatWords(231), "eastron-630": floatWords(4e12) });
    expect(identifyUnit(huge).family).toBeUndefined();
  });

  it("does not take a device that answers every register with zeros for a meter: a meter at zero volts is not one that is powered", () => {
    const zeros = probes({ "eastron-voltage": [0, 0], "analog-channels": [0, 0, 0], "digital-inputs": "refused", "eastron-630": [0, 0], "eastron-230": [0, 0], "module-address": "refused" });
    expect(identifyUnit(zeros, 1)).toEqual({ present: true });
    // And one whose first phase is dead is not a meter that can be read either, whatever its power register says.
    expect(identifyUnit(sdm630(1000, 12), 1).family).toBeUndefined();
    expect(identifyUnit(sdm630(1000, 400), 1).family).toBeUndefined();
  });

  it("takes a meter on a 110 volt system for a meter", () => {
    expect(identifyUnit(sdm230(300, 112), 1).family).toBe("eastron-meter");
  });
});

describe("what a device is meant to be", () => {
  it("comes from the equipment it was made from, with the address the kit gives it", () => {
    expect(expectationOf({ name: "Grid meter", deviceType: "grid_meter", profileKey: "eastron-sdm630-grid" })).toMatchObject({ family: "eastron-meter", unitId: 1, meterModel: "SDM630" });
    expect(expectationOf({ name: "x", deviceType: "analog_io_module", profileKey: "waveshare-ai8-water" })).toMatchObject({ family: "analog-module", unitId: 3 });
    expect(expectationOf({ name: "x", deviceType: "digital_input_module", profileKey: "waveshare-io8-pump" })).toMatchObject({ family: "digital-module", unitId: 5 });
  });

  it("comes from the template's device of that name when the device was made before it remembered its equipment", () => {
    expect(expectationOf({ name: "Solar meter", deviceType: "production_meter" }, "hotel")).toMatchObject({ family: "eastron-meter", unitId: 2 });
    expect(expectationOf({ name: "Pump meter (optional)", deviceType: "load_meter" }, "water_station")).toMatchObject({ family: "eastron-meter", unitId: 4, meterModel: "SDM230" });
  });

  it("comes from the kind of device when nothing else is known", () => {
    expect(expectationOf({ name: "Meter in the basement", deviceType: "grid_meter" })).toMatchObject({ family: "eastron-meter", unitId: 1 });
  });

  it("gives equipment the platform cannot recognise on a network its address in the kit, and no family", () => {
    expect(expectationOf({ name: "Soil probe", deviceType: "soil_sensor" }, "farm_irrigation")).toEqual({ unitId: 6 });
    expect(expectationOf({ name: "Weather sensor", deviceType: "weather_station" }, "farm_irrigation")).toEqual({ unitId: 7 });
    expect(expectationOf({ name: "Anything", deviceType: "inverter" })).toEqual({ unitId: undefined });
  });

  it("knows which meter model a profile is for, and the same role for the other model", () => {
    expect(meterModelOf("eastron-sdm230-load")).toBe("SDM230");
    expect(meterModelOf("waveshare-ai8-water")).toBeUndefined();
    expect(meterModelOf(undefined)).toBeUndefined();
    expect(profileForModel("eastron-sdm630-solar", "SDM230")).toBe("eastron-sdm230-solar");
    expect(profileForModel("waveshare-ai8-water", "SDM230")).toBeUndefined();
  });
});

describe("matching what was found to what the site is meant to have", () => {
  it("finds the whole kit of a hotel on one converter, each at the address the kit gives it", () => {
    const { proposals, unclaimed, notes } = proposeAssignments([kit()], hotelDevices());
    expect(proposals.map((proposal) => [proposal.name, proposal.status, proposal.match?.unit])).toEqual([
      ["Grid meter", "found", 1],
      ["Solar meter", "found", 2],
      ["Water I/O module", "found", 3],
      ["Pump contact module (optional)", "found", 5]
    ]);
    expect(proposals[0]?.message).toBe("Found at 192.168.1.50, unit 1: an Eastron meter, reading 1.80 kW at 231 V.");
    expect(unclaimed).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("says a device that already has its address and still answers is fine as it is", () => {
    const { proposals } = proposeAssignments([kit()], hotelDevices(true));
    expect(proposals[0]).toMatchObject({ status: "already" });
    expect(proposals[0]?.message).toContain("Already set, and answering");
    expect(proposals[1]).toMatchObject({ status: "already" });
    expect(proposals[2]).toMatchObject({ status: "found" });
  });

  it("finds a meter that was left at another address when it is the only one of its kind and only one device wants it", () => {
    const only = converter("192.168.1.50", [unit(7, sdm630())]);
    const { proposals } = proposeAssignments([only], [device("Grid meter", "grid_meter", "eastron-sdm630-grid")]);
    expect(proposals[0]).toMatchObject({ status: "found", match: { unit: 7 } });
    expect(proposals[0]?.message).toContain("It is at unit 7, not 1");
  });

  it("does not guess between two meters when neither is at the address expected", () => {
    const two = converter("192.168.1.50", [unit(8, sdm630()), unit(9, sdm630())]);
    const { proposals } = proposeAssignments([two], hotelDevices().slice(0, 2));
    expect(proposals.map((proposal) => proposal.status)).toEqual(["unsure", "unsure"]);
    expect(proposals[0]?.message).toContain("2 of this kind answered (units 8, 9)");
  });

  it("does not swap two meters that answer at the same unit on two converters", () => {
    const first = converter("192.168.1.50", [unit(1, sdm630())]);
    const second = converter("192.168.1.51", [unit(1, sdm630())]);
    const { proposals } = proposeAssignments([first, second], hotelDevices().slice(0, 2));
    expect(proposals[0]).toMatchObject({ name: "Grid meter", status: "unsure" });
    expect(proposals[0]?.message).toContain("cannot tell which is this one");
    expect(proposals[0]?.message).toContain("192.168.1.50, 192.168.1.51");
    expect(proposals[0]?.match).toBeUndefined();
    expect(proposals[1]?.status).toBe("unsure");
  });

  it("says what is missing, and what to check", () => {
    const partial = converter("192.168.1.50", [unit(1, sdm630()), unit(2, nothing()), unit(3, nothing())]);
    const { proposals } = proposeAssignments([partial], hotelDevices());
    expect(proposals.map((proposal) => proposal.status)).toEqual(["found", "missing", "missing", "missing"]);
    expect(proposals[1]?.message).toBe("Nothing that looks like an Eastron meter answers at unit 2. Check the address set on it, the speed, and the A and B wires.");
  });

  it("tells the person what to do about an optional device that was not found: take it off the list if the site has none", () => {
    const { proposals } = proposeAssignments([converter("192.168.1.50", [unit(1, sdm630())])], hotelDevices());
    expect(proposals.find((proposal) => proposal.name === "Pump contact module (optional)")?.message).toContain("If the site does not have one, remove it from the list below.");
    expect(proposals.find((proposal) => proposal.name === "Solar meter")?.message).not.toContain("remove it");
  });

  it("sends equipment it cannot recognise to be addressed by hand", () => {
    const soil = device("Soil probe", "soil_sensor", undefined);
    const { proposals } = proposeAssignments([kit()], [soil]);
    expect(proposals[0]).toMatchObject({ status: "by-hand" });
  });

  it("reads a meter as the model that is there when it is not the one planned", () => {
    const single = converter("192.168.1.50", [unit(1, sdm230(500))]);
    const { proposals } = proposeAssignments([single], [hotelDevices()[0]!]);
    expect(proposals[0]).toMatchObject({ status: "found", useModel: "SDM230" });
    expect(proposals[0]?.message).toContain("It is a single-phase SDM230, not the three-phase SDM630 planned: Greecon will read it as one.");
  });

  it("keeps the planned model when it answered its own register, even though the other model's did too", () => {
    const { proposals } = proposeAssignments([kit()], [hotelDevices()[0]!]);
    expect(proposals[0]?.useModel).toBeUndefined();
  });

  it("does not count a device as already set when its model has to change", () => {
    const single = converter("192.168.1.50", [unit(1, sdm230(500))]);
    const { proposals } = proposeAssignments([single], [hotelDevices(true)[0]!]);
    expect(proposals[0]?.status).toBe("found");
  });

  it("lists what answered that no device accounts for", () => {
    const extra = converter("192.168.1.50", [unit(1, sdm630()), unit(2, sdm630()), unit(3, analog()), unit(5, digital()), unit(6, digital(true, 6))]);
    const { unclaimed } = proposeAssignments([extra], hotelDevices());
    expect(unclaimed.map((found) => [found.host, found.unit, found.identity.family])).toEqual([["192.168.1.50", 6, "digital-module"]]);
  });

  it("says so when no converter was found on the network at all", () => {
    const { notes } = proposeAssignments([], hotelDevices());
    expect(notes[0]).toContain("No Modbus converter answered on this network");
  });

  it("says so when a converter answered and nothing answered behind it", () => {
    const { notes, proposals } = proposeAssignments([converter("192.168.1.50", [unit(1, nothing()), unit(2, nothing())])], hotelDevices());
    expect(notes[0]).toBe("A converter answers at 192.168.1.50, but nothing answers behind it. Check each meter's address, the speed on the converter and the meters, and the A and B wires.");
    expect(proposals.every((proposal) => proposal.status === "missing")).toBe(true);
  });

  it("counts only units where something answered", () => {
    expect(unitsFound([converter("10.0.0.2", [unit(1, nothing()), unit(2, sdm630())])]).map((found) => found.unit)).toEqual([2]);
  });
});

describe("what the box says, checked as it arrives", () => {
  const good = () => ({
    requestId: "r-1",
    startedAtUtc: "2026-10-31T10:00:00Z",
    finishedAtUtc: "2026-10-31T10:00:30Z",
    scanned: { subnets: ["192.168.1.0/24"], hostsTried: 254, ports: [502], units: [1, 2, 3] },
    hosts: [kit()],
    notes: []
  });

  it("accepts what a box really sends", () => {
    expect(validateDiscoveryResult(good())).toEqual([]);
  });

  it("refuses something that is not a result", () => {
    expect(validateDiscoveryResult(null)).toEqual(["The result is missing."]);
    expect(validateDiscoveryResult("hello")).toEqual(["The result is missing."]);
  });

  it("refuses a result with no request id, odd times or too many hosts", () => {
    expect(validateDiscoveryResult({ ...good(), requestId: "" })).toContain("requestId must be text of 1 to 64 characters.");
    expect(validateDiscoveryResult({ ...good(), finishedAtUtc: "yesterday" })).toContain("finishedAtUtc must be a date and time.");
    expect(validateDiscoveryResult({ ...good(), hosts: Array.from({ length: 65 }, () => kit()) })).toContain("hosts must be a list of up to 64 entries.");
  });

  it("refuses a probe that is not one of ours, an outcome we do not know, and words that are not numbers", () => {
    const strange = { ...good(), hosts: [converter("192.168.1.50", [{ unit: 1, probes: [{ key: "format-disk", outcome: "ok" }] }])] };
    expect(validateDiscoveryResult(strange).join(" ")).toContain("a probe that is not one of ours");
    const outcome = { ...good(), hosts: [converter("192.168.1.50", [{ unit: 1, probes: [{ key: "eastron-630", outcome: "yes" } as unknown as ProbeResult] }])] };
    expect(validateDiscoveryResult(outcome).join(" ")).toContain("a probe that is not one of ours");
    const words = { ...good(), hosts: [converter("192.168.1.50", [{ unit: 1, probes: [{ key: "eastron-630", outcome: "ok", words: ["a"] as unknown as number[] }] }])] };
    expect(validateDiscoveryResult(words)).toContain("A probe's words must be up to 16 numbers.");
  });

  it("refuses a unit number that cannot be one and a port that cannot be one", () => {
    expect(validateDiscoveryResult({ ...good(), hosts: [converter("192.168.1.50", [unit(300, nothing())])] }).join(" ")).toContain("unit must be 0 to 247");
    expect(validateDiscoveryResult({ ...good(), hosts: [converter("192.168.1.50", [], 0)] }).join(" ")).toContain("port must be a port number");
  });

  it("refuses notes that are long or many", () => {
    expect(validateDiscoveryResult({ ...good(), notes: ["x".repeat(301)] })).toContain("notes must be up to 20 short sentences.");
    expect(validateDiscoveryResult({ ...good(), notes: Array.from({ length: 21 }, () => "x") })).toContain("notes must be up to 20 short sentences.");
  });
});

describe("where the box is allowed to look", () => {
  it("is the site's own network and this machine, and nothing else", () => {
    for (const host of ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.1", "192.168.0.1", "192.168.1.50", "169.254.1.1", "127.0.0.1"]) expect(isPrivateAddress(host), host).toBe(true);
    for (const host of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.0.1", "11.0.0.1", "greecon.earth", "192.168.1", "192.168.1.256", "", "1.1.1.1/24"]) expect(isPrivateAddress(host), host).toBe(false);
  });

  it("is not fooled by a spelling the system's resolver reads differently: a leading zero makes an octal number, a different address", () => {
    // "010.1.1.1" would read as 10.1.1.1, a private address, here, and as 8.1.1.1, a public one, to getaddrinfo.
    for (const host of ["010.1.1.1", "192.168.001.001", "192.168.01.1", "00.1.1.1", "0x0a.1.1.1", "10.0.0.1 ", " 10.0.0.1", "10.0.0.1\n", "10.0.0.1.5", "+10.0.0.1", "10.0.0.-1"]) expect(isPrivateAddress(host), JSON.stringify(host)).toBe(false);
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.0.10")).toBe(true);
  });
});
