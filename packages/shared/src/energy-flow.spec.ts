import { describe, expect, it } from "vitest";
import { deriveEnergyFlow, formatKw, type FlowReading } from "./energy-flow";

const current = (value: number, extra: Partial<FlowReading> = {}): FlowReading => ({ value, fresh: true, ageSeconds: 10, ...extra });
const stale = (value: number, ageSeconds: number): FlowReading => ({ value, fresh: false, ageSeconds });

describe("deriveEnergyFlow", () => {
  it("says what is happening in one sentence: a farm exporting its surplus", () => {
    const view = deriveEnergyFlow({ solarKw: current(18.6), consumptionKw: current(12), gridImportKw: current(0), gridExportKw: current(6.6) });

    expect(view.headline).toBe("Exporting 6.6 kW to the grid.");
    expect(view.detail).toBe("Solar is producing 18.6 kW; the site is using 12.0 kW.");
    expect(view.state).toBe("live");
    expect(view.links.solar).toMatchObject({ direction: "to_hub", kw: 18.6, status: "current" });
    expect(view.links.grid).toMatchObject({ direction: "from_hub", kw: 6.6 });
    expect(view.links.site).toMatchObject({ direction: "from_hub", kw: 12 });
    expect(view.links.battery.status).toBe("not_measured");
    expect(view.unaccountedKw).toBeCloseTo(0, 5);
    expect(view.notes).toEqual([]);
  });

  it("shows the net flow when a meter reports import and export at once, because that is what crosses the junction", () => {
    const view = deriveEnergyFlow({ solarKw: current(18.6), consumptionKw: current(12), gridImportKw: current(3.2), gridExportKw: current(9.8) });

    expect(view.headline).toBe("Exporting 6.6 kW to the grid.");
    expect(view.links.grid).toMatchObject({ direction: "from_hub", kw: 6.6 });
    expect(view.unaccountedKw).toBeCloseTo(0, 5);
    expect(view.notes).toEqual([]);
  });

  it("shows a night with no sun as importing, and says there is no solar rather than leaving it out", () => {
    const view = deriveEnergyFlow({ solarKw: current(0), consumptionKw: current(3.2), gridImportKw: current(3.2), gridExportKw: current(0) });

    expect(view.headline).toBe("Importing 3.2 kW from the grid.");
    expect(view.detail).toBe("No solar production; the site is using 3.2 kW.");
    expect(view.links.solar.direction).toBe("idle");
    expect(view.links.grid).toMatchObject({ direction: "to_hub", kw: 3.2 });
  });

  it("says when solar is covering the site on its own", () => {
    const view = deriveEnergyFlow({ solarKw: current(5), consumptionKw: current(5), gridImportKw: current(0), gridExportKw: current(0) });
    expect(view.headline).toBe("Solar is supplying the site on its own.");
    expect(view.links.grid.direction).toBe("idle");
  });

  it("shows the battery supplying the site, with its level", () => {
    const view = deriveEnergyFlow({
      solarKw: current(0),
      consumptionKw: current(2.5),
      gridImportKw: current(0),
      gridExportKw: current(0),
      batteryKw: current(-2.5),
      batterySocPercent: current(64)
    });

    expect(view.headline).toBe("The battery is supplying the site.");
    expect(view.links.battery).toMatchObject({ direction: "to_hub", kw: 2.5, socPercent: 64 });
    expect(view.detail).toContain("the battery is discharging at 2.5 kW (64%)");
    expect(view.unaccountedKw).toBeCloseTo(0, 5);
  });

  it("shows a battery charging from surplus solar while exporting the rest", () => {
    const view = deriveEnergyFlow({
      solarKw: current(10),
      consumptionKw: current(2),
      gridImportKw: current(0),
      gridExportKw: current(4),
      batteryKw: current(4),
      batterySocPercent: current(50)
    });
    expect(view.headline).toBe("Exporting 4.0 kW to the grid.");
    expect(view.links.battery).toMatchObject({ direction: "from_hub", kw: 4 });
    expect(view.notes).toEqual([]);
  });

  it("never shows an out-of-date reading as still flowing", () => {
    const view = deriveEnergyFlow({
      solarKw: stale(18.6, 3 * 3600),
      consumptionKw: current(12),
      gridImportKw: current(3.2),
      gridExportKw: current(0)
    });

    expect(view.state).toBe("partial");
    expect(view.links.solar).toMatchObject({ direction: "unknown", status: "out_of_date", ageSeconds: 3 * 3600 });
    expect(view.links.solar.kw).toBeUndefined();
    expect(view.detail).toContain("solar readings are out of date (3 hours old)");
    expect(view.headline).toBe("Importing 3.2 kW from the grid.");
    expect(view.unaccountedKw).toBeUndefined();
  });

  it("says the flow is not known when nothing measured is current, and how old the newest reading is", () => {
    const view = deriveEnergyFlow({ solarKw: stale(5, 7200), gridImportKw: stale(1, 3600), gridExportKw: stale(0, 3600) });

    expect(view.state).toBe("unknown");
    expect(view.hasEnergy).toBe(true);
    expect(view.headline).toBe("Energy flow is not known right now.");
    expect(view.detail).toBe("The newest energy reading is 1 hour old.");
  });

  it("has nothing to draw for a site with no energy readings", () => {
    const view = deriveEnergyFlow({});
    expect(view.hasEnergy).toBe(false);
    expect(view.state).toBe("unknown");
    expect(view.headline).toBe("No energy flow is measured at this site.");
  });

  it("has nothing to draw when all a site reports is a battery level, which says nothing about where energy goes", () => {
    const view = deriveEnergyFlow({ batterySocPercent: current(68) });
    expect(view.hasEnergy).toBe(false);
    expect(view.headline).toBe("No energy flow is measured at this site.");
  });

  it("does not claim the grid is idle when one side of it is out of date", () => {
    const view = deriveEnergyFlow({ solarKw: current(4), gridImportKw: current(0), gridExportKw: stale(0, 900) });
    expect(view.links.grid).toMatchObject({ direction: "unknown", status: "out_of_date", ageSeconds: 900 });
  });

  it("still says which way the grid flows when it is moving, even if the other side is out of date", () => {
    const view = deriveEnergyFlow({ gridImportKw: current(2), gridExportKw: stale(0, 900) });
    expect(view.links.grid).toMatchObject({ direction: "to_hub", kw: 2, status: "current" });
  });

  it("treats an unmeasured export as 'not flowing' only with a note that exporting cannot be ruled out", () => {
    const view = deriveEnergyFlow({ solarKw: current(6), consumptionKw: current(6), gridImportKw: current(0) });
    expect(view.links.grid.direction).toBe("idle");
    expect(view.notes).toContain("Grid export is not measured here, so exporting cannot be ruled out.");
  });

  it("flags readings that do not add up, which usually means a meter on the wrong side or a wrong unit", () => {
    const view = deriveEnergyFlow({ solarKw: current(10), consumptionKw: current(2), gridImportKw: current(0), gridExportKw: current(1) });

    expect(view.unaccountedKw).toBeCloseTo(7, 5);
    expect(view.notes).toHaveLength(1);
    expect(view.notes[0]).toMatch(/Supply and use differ by 7\.0 kW\. A battery or load that is not measured could explain it\./);
  });

  it("does not suggest an unmeasured battery when the battery is measured", () => {
    const view = deriveEnergyFlow({
      solarKw: current(10),
      consumptionKw: current(2),
      gridImportKw: current(0),
      gridExportKw: current(1),
      batteryKw: current(0)
    });
    expect(view.notes[0]).toMatch(/Supply and use differ by 7\.0 kW\. Check where each meter sits/);
    expect(view.notes[0]).not.toMatch(/battery or load that is not measured/);
  });

  it("tolerates ordinary meter noise without raising a note", () => {
    const view = deriveEnergyFlow({ solarKw: current(10), consumptionKw: current(8.2), gridImportKw: current(0), gridExportKw: current(1.5) });
    expect(view.unaccountedKw).toBeCloseTo(0.3, 5);
    expect(view.notes).toEqual([]);
  });

  it("treats a negative production reading as not flowing and says the sensor may be wired backwards", () => {
    const view = deriveEnergyFlow({ solarKw: current(-0.4), gridImportKw: current(1), gridExportKw: current(0) });
    expect(view.links.solar.direction).toBe("idle");
    expect(view.notes[0]).toMatch(/Solar production reads -0\.4 kW, which cannot be negative/);
  });

  it("shows a battery's level even when its power is not measured, without inventing a flow", () => {
    const view = deriveEnergyFlow({ solarKw: current(3), gridImportKw: current(0), gridExportKw: current(0), batterySocPercent: current(68) });
    expect(view.links.battery).toMatchObject({ direction: "unknown", status: "current", socPercent: 68 });
    expect(view.detail).toContain("the battery is at 68%");
  });

  it("is simulated when any reading behind it is", () => {
    expect(deriveEnergyFlow({ solarKw: current(1, { simulated: true }) }).simulated).toBe(true);
    expect(deriveEnergyFlow({ solarKw: current(1) }).simulated).toBe(false);
  });
});

describe("formatKw", () => {
  it("keeps one decimal below 100 kW and whole numbers above", () => {
    expect(formatKw(9.84)).toBe("9.8 kW");
    expect(formatKw(12)).toBe("12.0 kW");
    expect(formatKw(180.4)).toBe("180 kW");
  });

  it("says so when the grid meter reports export while nothing produces: the clamps are probably the wrong way round", () => {
    const view = deriveEnergyFlow({ solarKw: current(0), consumptionKw: current(0.5), gridImportKw: current(0), gridExportKw: current(0.5) });

    expect(view.headline).toBe("Exporting 0.5 kW to the grid.");
    expect(view.notes.some((note) => /may be the wrong way round/.test(note))).toBe(true);
  });

  it("does not say it when the sun is producing, or a battery is feeding the grid, or when it cannot be told", () => {
    const wrongWay = (extra: Partial<Parameters<typeof deriveEnergyFlow>[0]>) => deriveEnergyFlow({ solarKw: current(0), gridImportKw: current(0), gridExportKw: current(0.5), ...extra }).notes.some((note) => /wrong way round/.test(note));

    expect(wrongWay({ solarKw: current(5) })).toBe(false);
    expect(wrongWay({ batteryKw: current(-0.6), batterySocPercent: current(80) })).toBe(false); // discharging into the grid
    expect(wrongWay({ batterySocPercent: current(80) })).toBe(false); // a battery whose power nobody reads: it might be the source
    expect(wrongWay({ solarKw: undefined })).toBe(false); // nothing says the sun is down
    expect(wrongWay({ gridExportKw: stale(0.5, 3600) })).toBe(false);
  });
});
