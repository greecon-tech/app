import { describe, expect, it } from "vitest";
import { RAW_HISTORY_MAX_HOURS, historyBucketMinutes } from "./history";

describe("how much history a chart is given", () => {
  it("shows a short window reading by reading", () => {
    expect(historyBucketMinutes(1)).toBe(0);
    expect(historyBucketMinutes(RAW_HISTORY_MAX_HOURS)).toBe(0);
  });

  it("averages a longer window into about as many points as a chart can show", () => {
    for (const hours of [7, 12, 24, 72, 168, 336, 720, 2160]) {
      const minutes = historyBucketMinutes(hours);
      const points = (hours * 60) / minutes;
      expect(minutes, `${hours} hours`).toBeGreaterThan(0);
      expect(points, `${hours} hours`).toBeLessThanOrEqual(288);
    }
  });

  it("gives the windows people ask for buckets they would choose", () => {
    expect(historyBucketMinutes(24)).toBe(5);
    expect(historyBucketMinutes(168)).toBe(60);
    expect(historyBucketMinutes(720)).toBe(180);
    expect(historyBucketMinutes(2160)).toBe(720);
  });

  it("never asks for buckets wider than a day", () => {
    expect(historyBucketMinutes(24 * 365 * 5)).toBe(1440);
  });
});
