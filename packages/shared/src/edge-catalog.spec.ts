import { describe, expect, it } from "vitest";
import { canonicalPoints, canonicalUnits, deviceProfiles, plausibilityProblem, plausibleRanges, profileByKey, readModbusValue, siteTemplates, templateByKey, validatePointSource } from "./index";

describe("the equipment profiles", () => {
  it("are all described with registers that pass the same checks a person's typing does", () => {
    for (const profile of deviceProfiles) {
      expect(profile.points.length, profile.key).toBeGreaterThan(0);
      for (const point of profile.points) {
        expect(validatePointSource(point.source), `${profile.key} ${point.canonicalName}`).toEqual([]);
        expect(canonicalPoints, point.canonicalName).toContain(point.canonicalName);
        expect(point.unit).toBe(canonicalUnits[point.canonicalName]);
      }
    }
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
    expect(readModbusValue(words(2500), imported!.source)).toBeCloseTo(2.5, 4);
    expect(readModbusValue(words(2500), exported!.source)).toBe(0);
    expect(readModbusValue(words(-4200), imported!.source)).toBe(0);
    expect(readModbusValue(words(-4200), exported!.source)).toBeCloseTo(4.2, 4);
  });

  it("give a production meter the size of the power whichever way it was clamped", () => {
    const solar = profileByKey("eastron-sdm630-solar")?.points[0];
    expect(solar?.canonicalName).toBe("energy.solar.power.kw");
    expect(solar?.source.part).toBe("absolute");
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
    // The SDM230's speed depends on the version, so its note sends the person to the meter's own display.
    expect(sdm230).toContain("depends on the version");
    expect(sdm230).not.toContain("9600");
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
    expect(hotel?.devices.map((device) => device.profile ?? device.ref)).toEqual(["eastron-sdm630-grid", "eastron-sdm630-solar", "water-io"]);
    for (const template of siteTemplates) expect(template.checklist.length, template.key).toBeGreaterThan(0);
    expect(templateByKey("blank")?.devices).toEqual([]);
  });

  it("have unique keys", () => {
    expect(new Set(siteTemplates.map((template) => template.key)).size).toBe(siteTemplates.length);
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
    expect(plausibilityProblem("energy.battery.power.kw", -50)).toBeUndefined();
    expect(plausibilityProblem("energy.solar.power.kw", 18.6)).toBeUndefined();
  });

  it("say nothing about a kind with no range, or a value that is not a number", () => {
    expect(plausibilityProblem("water.pump.status", 5)).toBeUndefined();
    expect(plausibilityProblem("water.tank.level.percent", Number.NaN)).toBeUndefined();
    expect(Object.keys(plausibleRanges).every((name) => (canonicalPoints as readonly string[]).includes(name))).toBe(true);
  });
});
