import { describe, expect, it } from "vitest";
import { METRES_OF_WATER_PER_BAR, levelInMetres, rangeProblem, sourceFromRange, typedNumber } from "./index";

describe("a number as a person types it", () => {
  it("takes a decimal comma as a decimal point, as people do where they write in Albanian", () => {
    expect(typedNumber("2,5")).toBe(2.5);
    expect(typedNumber("0,5")).toBe(0.5);
    expect(typedNumber(" 2.5 ")).toBe(2.5);
    expect(typedNumber("10")).toBe(10);
    expect(typedNumber("2 000")).toBe(2000);
    expect(typedNumber(".5")).toBe(0.5);
  });

  it("is never zero for something that is not a number, because a range of zero is a mistake that must be seen", () => {
    for (const text of ["", "   ", "abc", "1,2,3", "1,000.5", "5 m", "--1", "1e3", "NaN", "Infinity", ",5", "5,"]) {
      expect(typedNumber(text), JSON.stringify(text)).toBeNaN();
    }
  });
});

describe("the range on a level transmitter's label", () => {
  it("is in metres or in bar, and a bar holds up 10.197 metres of water", () => {
    expect(METRES_OF_WATER_PER_BAR).toBe(10.197);
    expect(levelInMetres(5, "m")).toBe(5);
    expect(levelInMetres(0.5, "bar")).toBeCloseTo(5.0985, 4);
    expect(levelInMetres(1, "bar")).toBeCloseTo(10.197, 4);
  });

  it("gives the same scale whichever way the label says it", () => {
    const level = { kind: "level" as const, channel: 1, rangeUnit: "m", question: "Level transmitter", help: "" };
    const inMetres = sourceFromRange(level, { range: levelInMetres(5.0985, "m"), tankHeight: 4 });
    const inBar = sourceFromRange(level, { range: levelInMetres(0.5, "bar"), tankHeight: 4 });
    expect(inBar.linear?.engHigh).toBeCloseTo(inMetres.linear?.engHigh as number, 2);
    // A tank taller than the transmitter reaches is still said, in metres, whichever unit the label used.
    expect(rangeProblem(level, { range: levelInMetres(0.3, "bar"), tankHeight: 4 })).toContain("cannot see the top of the water");
  });
});
