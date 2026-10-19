import { describe, expect, it } from "vitest";
import { formatLocalDate, isValidTimeZone, resolvePeriod } from "./periods";

const at = (iso: string) => Date.parse(iso);

describe("periods", () => {
  it("cuts today at the site's own midnight, which in Albanian summer is two hours before UTC midnight", () => {
    // 15:30 local on 14 July (UTC+2) is 13:30 UTC.
    const period = resolvePeriod("day", at("2026-07-14T13:30:00Z"), "Europe/Tirane");
    expect(period.fromMs).toBe(at("2026-07-13T22:00:00Z"));
    expect(period.label).toBe("Today");
    expect(period.days).toBeCloseTo(15.5 / 24, 5);
  });

  it("uses one hour in winter", () => {
    const period = resolvePeriod("day", at("2026-01-10T09:00:00Z"), "Europe/Tirane");
    expect(period.fromMs).toBe(at("2026-01-09T23:00:00Z"));
  });

  it("starts the month at local midnight on the 1st, and says how much of a month has passed", () => {
    const period = resolvePeriod("month", at("2026-10-16T12:00:00Z"), "Europe/Tirane");
    // 1 October in Tirane is still on summer time (UTC+2): 22:00 UTC on 30 September.
    expect(period.fromMs).toBe(at("2026-09-30T22:00:00Z"));
    expect(period.label).toBe("October so far");
    expect(period.monthFraction).toBeGreaterThan(0.49);
    expect(period.monthFraction).toBeLessThan(0.52);
  });

  it("handles the end of the year", () => {
    const period = resolvePeriod("month", at("2026-12-31T20:00:00Z"), "Europe/Tirane");
    expect(period.fromMs).toBe(at("2026-11-30T23:00:00Z"));
    expect(period.monthFraction).toBeGreaterThan(0.99);
    expect(period.monthFraction).toBeLessThanOrEqual(1.001);
  });

  it("gives a fixed length to the rolling periods", () => {
    const now = at("2026-10-16T12:00:00Z");
    expect(resolvePeriod("week", now).toMs - resolvePeriod("week", now).fromMs).toBe(7 * 86_400_000);
    const last30 = resolvePeriod("last30", now);
    expect(last30.days).toBe(30);
    expect(last30.monthFraction).toBeCloseTo(30 / 30.4375, 6);
  });

  it("does not offer a month fraction for periods where a monthly baseline would not be fair", () => {
    expect(resolvePeriod("day", Date.now()).monthFraction).toBeUndefined();
    expect(resolvePeriod("week", Date.now()).monthFraction).toBeUndefined();
  });

  it("writes a date as the site's own people would, in the site's own zone", () => {
    // 22:00 UTC on 30 September is already 1 October in Tirane.
    expect(formatLocalDate(at("2026-09-30T22:00:00Z"), "Europe/Tirane")).toBe("1 Oct 2026");
    expect(formatLocalDate(at("2026-09-30T22:00:00Z"), "UTC")).toBe("30 Sept 2026");
  });

  it("falls back to the default zone for a zone that does not exist, rather than failing", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("Europe/Tirane")).toBe(true);
    const now = at("2026-07-14T13:30:00Z");
    expect(resolvePeriod("day", now, "Mars/Olympus").fromMs).toBe(resolvePeriod("day", now, "Europe/Tirane").fromMs);
  });
});
