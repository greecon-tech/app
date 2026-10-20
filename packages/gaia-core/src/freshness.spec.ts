import { describe, expect, it } from "vitest";
import { assessReadingAge, defaultMaxAgeSeconds, describeAge } from "./freshness";

const NOW = Date.parse("2026-10-13T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("assessReadingAge", () => {
  it("calls a reading fresh up to and including its limit, and stale beyond it", () => {
    expect(assessReadingAge(minutesAgo(4), NOW, 300)).toMatchObject({ freshness: "fresh", ageSeconds: 240 });
    expect(assessReadingAge(minutesAgo(5), NOW, 300)).toMatchObject({ freshness: "fresh", ageSeconds: 300 });
    expect(assessReadingAge(minutesAgo(6), NOW, 300)).toMatchObject({ freshness: "stale", ageSeconds: 360 });
  });

  it("says unknown, not fresh, when there is no usable timestamp", () => {
    expect(assessReadingAge(undefined, NOW, 300).freshness).toBe("unknown");
    expect(assessReadingAge("not a date", NOW, 300).freshness).toBe("unknown");
    expect(assessReadingAge("", NOW, 300).freshness).toBe("unknown");
  });

  it("treats a timestamp slightly ahead of the clock as just received, never as negative age", () => {
    const result = assessReadingAge(new Date(NOW + 30_000).toISOString(), NOW, 300);
    expect(result.freshness).toBe("fresh");
    expect(result.ageSeconds).toBe(0);
  });

  it("carries the limit it applied, so a caller can explain the verdict", () => {
    expect(assessReadingAge(minutesAgo(1), NOW, 123).maxAgeSeconds).toBe(123);
  });
});

describe("defaultMaxAgeSeconds", () => {
  it("expects process variables to report within minutes", () => {
    for (const name of ["water.flow.lpm", "water.pressure.bar", "water.tank.level.percent", "energy.solar.power.kw", "energy.grid.import.kw"] as const) {
      expect(defaultMaxAgeSeconds(name)).toBe(5 * 60);
    }
  });

  it("allows slow field sensors (soil, air) hours, because they commonly report every 15-60 minutes", () => {
    for (const name of ["agri.soil.moisture.percent", "agri.air.temperature.c", "agri.humidity.percent"] as const) {
      expect(defaultMaxAgeSeconds(name)).toBe(3 * 60 * 60);
    }
  });
});

describe("describeAge", () => {
  it("writes a plain-language age", () => {
    expect(describeAge(20)).toBe("20 seconds");
    expect(describeAge(60)).toBe("1 minute");
    expect(describeAge(125)).toBe("2 minutes");
    expect(describeAge(3600)).toBe("1 hour");
    expect(describeAge(3 * 3600 + 20 * 60)).toBe("3 hours");
    expect(describeAge(2 * 86400)).toBe("2 days");
  });
});
