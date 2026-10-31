import { describe, expect, it } from "vitest";
import { KIT_UNITS, canonicalPoints, canonicalUnits, convertRaw, deviceProfiles, plausibilityProblem, plausibleRanges, profileByKey, rangeProblem, readModbusValue, siteTemplates, sourceFromRange, templateByKey, validatePointSource } from "./index";

describe("the equipment profiles", () => {
  it("are all described with registers that pass the same checks a person's typing does", () => {
    for (const profile of deviceProfiles) {
      expect(profile.points.length, profile.key).toBeGreaterThan(0);
      for (const point of profile.points) {
        // A reading has its register known in advance, or it waits for one thing: the range on a transmitter's label.
        expect(point.source !== undefined || point.range !== undefined, `${profile.key} ${point.canonicalName} has neither a register nor a range`).toBe(true);
        expect(point.source !== undefined && point.range !== undefined, `${profile.key} ${point.canonicalName} has both`).toBe(false);
        if (point.source) expect(validatePointSource(point.source), `${profile.key} ${point.canonicalName}`).toEqual([]);
        expect(canonicalPoints, point.canonicalName).toContain(point.canonicalName);
        expect(point.unit).toBe(canonicalUnits[point.canonicalName]);
      }
    }
  });

  it("say what each piece of equipment is set to as delivered, so the converter can be set to match", () => {
    for (const profile of deviceProfiles) {
      expect(profile.serial.baud, profile.key).toBeGreaterThanOrEqual(1200);
      expect(profile.serial.dataBits, profile.key).toBe(8);
      expect(profile.defaultUnitId, profile.key).toBeGreaterThanOrEqual(1);
      expect(profile.defaultUnitId, profile.key).toBeLessThanOrEqual(247);
      expect(profile.model.length, profile.key).toBeGreaterThan(0);
    }
    expect(profileByKey("waveshare-ai8-water")?.serial).toEqual({ baud: 9600, dataBits: 8, parity: "none", stopBits: 1 });
  });

  it("give each kind of equipment in a kit its own address, the same in every kit", () => {
    expect(new Set(Object.values(KIT_UNITS)).size).toBe(Object.values(KIT_UNITS).length);
    expect(profileByKey("eastron-sdm630-grid")?.defaultUnitId).toBe(KIT_UNITS.grid);
    expect(profileByKey("eastron-sdm630-solar")?.defaultUnitId).toBe(KIT_UNITS.solar);
    expect(profileByKey("eastron-sdm630-load")?.defaultUnitId).toBe(KIT_UNITS.load);
    expect(profileByKey("waveshare-ai8-water")?.defaultUnitId).toBe(KIT_UNITS.waterModule);
    expect(profileByKey("waveshare-io8-pump")?.defaultUnitId).toBe(KIT_UNITS.pumpContact);
  });

  it("never put two devices of one site on the same address, because they share one cable", () => {
    for (const template of siteTemplates) {
      const units = template.devices.map((device) => (device.profile ? profileByKey(device.profile)?.defaultUnitId : device.defaultUnitId)).filter((unit): unit is number => unit !== undefined);
      expect(new Set(units).size, `${template.key} gives two devices one address: ${units.join(", ")}`).toBe(units.length);
    }
  });

  it("read the pump contact as a digital input, function 02, that is 1 when the contact is closed", () => {
    const status = profileByKey("waveshare-io8-pump")?.points[0];
    expect(status?.canonicalName).toBe("water.pump.status");
    expect(status?.source).toMatchObject({ registerType: "discrete", address: 0, dataType: "uint16" });
    expect(readModbusValue([1], status!.source!)).toBe(1);
    expect(readModbusValue([0], status!.source!)).toBe(0);
  });

  it("refuse a digital input that claims to be anything but one bit", () => {
    expect(validatePointSource({ kind: "modbus", registerType: "discrete", address: 0, dataType: "uint16" })).toEqual([]);
    expect(validatePointSource({ kind: "modbus", registerType: "discrete", address: 0, dataType: "float32" })).toEqual(["A digital input is one bit: its data type must be uint16."]);
  });

  it("use the Eastron registers the maker publishes: 12 on the SDM230 and 52 on the SDM630, input registers, float32", () => {
    expect(profileByKey("eastron-sdm230-grid")?.points[0]?.source).toMatchObject({ registerType: "input", address: 12, dataType: "float32", wordOrder: "big", scale: 0.001 });
    expect(profileByKey("eastron-sdm630-grid")?.points[0]?.source).toMatchObject({ registerType: "input", address: 52, dataType: "float32" });
  });

  it("give a grid meter an import and an export that are the two halves of one signed power", () => {
    const grid = profileByKey("eastron-sdm630-grid");
    const [imported, exported] = grid?.points ?? [];
    expect(imported?.canonicalName).toBe("energy.grid.import.kw");
    expect(exported?.canonicalName).toBe("energy.grid.export.kw");
    // The same register, read twice, each taking its own sign.
    const words = (watts: number): number[] => {
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, watts);
      return [view.getUint16(0), view.getUint16(2)];
    };
    expect(readModbusValue(words(2500), imported!.source!)).toBeCloseTo(2.5, 4);
    expect(readModbusValue(words(2500), exported!.source!)).toBe(0);
    expect(readModbusValue(words(-4200), imported!.source!)).toBe(0);
    expect(readModbusValue(words(-4200), exported!.source!)).toBeCloseTo(4.2, 4);
  });

  it("give a production meter the size of the power whichever way it was clamped", () => {
    const solar = profileByKey("eastron-sdm630-solar")?.points[0];
    expect(solar?.canonicalName).toBe("energy.solar.power.kw");
    expect(solar?.source?.part).toBe("absolute");
  });

  it("have unique keys and tell a person where to fit and how to check the direction", () => {
    expect(new Set(deviceProfiles.map((profile) => profile.key)).size).toBe(deviceProfiles.length);
    expect(profileByKey("eastron-sdm630-grid")?.notes.join(" ")).toContain("Check the direction");
    expect(profileByKey("nonexistent")).toBeUndefined();
  });

  it("give each meter model its own serial settings and never the other model's", () => {
    const sdm630 = profileByKey("eastron-sdm630-grid")?.notes.join(" ") ?? "";
    const sdm230 = profileByKey("eastron-sdm230-grid")?.notes.join(" ") ?? "";
    expect(sdm630).toContain("9600 baud");
    expect(sdm630).not.toContain("2400");
    // The SDM230's speed as delivered depends on the version, so its note says so and says what Greecon sets it to; it never claims the other model's 9600 as delivered.
    expect(sdm230).toContain("depends on the version");
    expect(sdm230).toContain("sets it to 9600");
    expect(sdm230).not.toContain("As delivered it is 9600");
  });
});

describe("the site templates", () => {
  it("are consistent: every device sits on a real asset, every reading is a real kind, every profile exists", () => {
    for (const template of siteTemplates) {
      const assetRefs = new Set(template.assets.map((asset) => asset.ref));
      expect(assetRefs.size, template.key).toBe(template.assets.length);
      const deviceRefs = new Set(template.devices.map((device) => device.ref));
      expect(deviceRefs.size, template.key).toBe(template.devices.length);

      for (const device of template.devices) {
        if (device.assetRef) expect(assetRefs, `${template.key}/${device.ref}`).toContain(device.assetRef);
        if (device.profile) expect(profileByKey(device.profile), `${template.key}/${device.ref} profile`).toBeDefined();
        for (const point of device.points) {
          expect(canonicalPoints, point.canonicalName).toContain(point.canonicalName);
          expect(point.unit, `${template.key}/${point.canonicalName}`).toBe(canonicalUnits[point.canonicalName]);
          if (point.source) expect(validatePointSource(point.source)).toEqual([]);
        }
      }
    }
  });

  it("never plan two readings of one kind at a site, because the platform judges a site by one reading of each kind", () => {
    for (const template of siteTemplates) {
      const kinds: string[] = [];
      for (const device of template.devices) {
        const own = device.profile ? (profileByKey(device.profile)?.points ?? []) : device.points;
        kinds.push(...own.map((point) => point.canonicalName));
      }
      expect(new Set(kinds).size, `${template.key} repeats ${kinds.filter((kind, index) => kinds.indexOf(kind) !== index).join(", ")}`).toBe(kinds.length);
    }
  });

  it("start the usual customer from the right place and tell the project manager what to ask for", () => {
    const hotel = templateByKey("hotel");
    expect(hotel?.devices.map((device) => device.profile ?? device.ref)).toEqual(["eastron-sdm630-grid", "eastron-sdm630-solar", "waveshare-ai8-water", "waveshare-io8-pump"]);
    for (const template of siteTemplates) expect(template.checklist.length, template.key).toBeGreaterThan(0);
    expect(templateByKey("blank")?.devices).toEqual([]);
  });

  it("have unique keys", () => {
    expect(new Set(siteTemplates.map((template) => template.key)).size).toBe(siteTemplates.length);
  });
});

describe("a range on a transmitter's label", () => {
  const level = profileByKey("waveshare-ai8-water")?.points.find((point) => point.canonicalName === "water.tank.level.percent")?.range;
  const pressure = profileByKey("waveshare-ai8-water")?.points.find((point) => point.canonicalName === "water.pressure.bar")?.range;
  if (!level || !pressure) throw new Error("the water module must ask for a level range and a pressure range");

  it("becomes the straight line from 4 mA to 20 mA that the module reports in microamps", () => {
    const source = sourceFromRange(pressure, { range: 10 });
    expect(validatePointSource(source)).toEqual([]);
    expect(source).toMatchObject({ registerType: "input", address: 1, dataType: "uint16", linear: { rawLow: 4000, rawHigh: 20000, engLow: 0, engHigh: 10 } });
    // 4 mA is no pressure, 12 mA is half the range, 20 mA is the top of it.
    expect(convertRaw(4000, source)).toBe(0);
    expect(convertRaw(12000, source)).toBe(5);
    expect(convertRaw(20000, source)).toBe(10);
  });

  it("makes a tank level a percentage of the tank, not of the transmitter", () => {
    // A 0 to 5 m transmitter in a 4 m tank: a full tank is 4 m of water, which is 16.8 mA (4 mA plus 16 mA times 4 over 5), and must read 100 %.
    const source = sourceFromRange(level, { range: 5, tankHeight: 4 });
    expect(source.address).toBe(0);
    expect(convertRaw(4000, source)).toBe(0);
    expect(convertRaw(16800, source)).toBeCloseTo(100, 6);
    // 12 mA is the middle of the transmitter's range: 2.5 m, which is 62.5 % of a 4 m tank.
    expect(convertRaw(12000, source)).toBeCloseTo(62.5, 6);
  });

  it("reads a broken wire as a reading that cannot be real, so the setup list says so", () => {
    const source = sourceFromRange(level, { range: 5, tankHeight: 5 });
    const broken = convertRaw(0, source);
    expect(broken).toBeLessThan(0);
    expect(plausibilityProblem("water.tank.level.percent", broken as number)).toMatch(/cannot be a tank level/);
  });

  it("refuses an answer that cannot be right, and says why in the label's own words", () => {
    expect(rangeProblem(pressure, {})).toMatch(/top of the range on the label/);
    expect(rangeProblem(pressure, { range: 0 })).toMatch(/above zero/);
    expect(rangeProblem(pressure, { range: Number.NaN })).toMatch(/above zero/);
    expect(rangeProblem(level, { range: 5 })).toMatch(/how tall the tank is/);
    expect(rangeProblem(level, { range: 3, tankHeight: 4 })).toMatch(/cannot see the top of the water/);
    expect(rangeProblem(level, { range: 5, tankHeight: 5 })).toBeUndefined();
    expect(() => sourceFromRange(level, { range: 3, tankHeight: 4 })).toThrow(/cannot see the top of the water/);
  });

  it("has a question in words a person with no training can answer, for every reading that needs one", () => {
    for (const profile of deviceProfiles) {
      for (const point of profile.points.filter((candidate) => candidate.range)) {
        const range = point.range!;
        expect(range.channel, `${profile.key} ${point.canonicalName}`).toBeGreaterThanOrEqual(1);
        expect(range.question.length).toBeGreaterThan(3);
        expect(range.help.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("plausible readings", () => {
  it("say a number cannot be that kind of reading, and what to check", () => {
    expect(plausibilityProblem("water.tank.level.percent", 237)).toMatch(/237 cannot be a tank level \(0 to 100\)\. Check the register address, the scale or the sensor/);
    expect(plausibilityProblem("water.pressure.bar", 150)).toMatch(/line pressure/);
    expect(plausibilityProblem("agri.soil.moisture.percent", -3.14159)).toMatch(/-3\.1 cannot be soil moisture/);
  });

  it("accept everything a real reading can be, including the extremes", () => {
    expect(plausibilityProblem("water.tank.level.percent", 0)).toBeUndefined();
    expect(plausibilityProblem("water.tank.level.percent", 100)).toBeUndefined();
    // A full tank can read a little over 100 (a transmitter's tolerance, a tank measured a few centimetres short), and an empty one a little under 0.
    expect(plausibilityProblem("water.tank.level.percent", 103.4)).toBeUndefined();
    expect(plausibilityProblem("water.tank.level.percent", -2)).toBeUndefined();
    expect(plausibilityProblem("water.tank.level.percent", 106)).toMatch(/cannot be a tank level/);
    expect(plausibilityProblem("water.tank.level.percent", -6)).toMatch(/cannot be a tank level/);
    expect(plausibilityProblem("energy.battery.power.kw", -50)).toBeUndefined();
    expect(plausibilityProblem("energy.solar.power.kw", 18.6)).toBeUndefined();
  });

  it("say nothing about a kind with no range, or a value that is not a number", () => {
    expect(plausibilityProblem("water.pump.status", 5)).toBeUndefined();
    expect(plausibilityProblem("water.tank.level.percent", Number.NaN)).toBeUndefined();
    expect(Object.keys(plausibleRanges).every((name) => (canonicalPoints as readonly string[]).includes(name))).toBe(true);
  });
});
