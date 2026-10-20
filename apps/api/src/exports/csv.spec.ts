import { describe, expect, it } from "vitest";
import { BYTE_ORDER_MARK, csvHeader, csvLine, csvNumber, csvText, localStamp, number, slug, text, utcStamp } from "./csv";

describe("a text cell", () => {
  it("is plain when it can be", () => {
    expect(csvText("Hotel Adriatik", "standard")).toBe("Hotel Adriatik");
    expect(csvText("Durrës", "eu")).toBe("Durrës");
  });

  it("is quoted when it holds the delimiter of the style, a quote or a line break", () => {
    expect(csvText("Tank, north", "standard")).toBe('"Tank, north"');
    expect(csvText("Tank, north", "eu")).toBe("Tank, north");
    expect(csvText("Tank; north", "eu")).toBe('"Tank; north"');
    expect(csvText('The "big" one', "standard")).toBe('"The ""big"" one"');
    expect(csvText("two\nlines", "standard")).toBe('"two\nlines"');
  });

  it("can never be a formula in a spreadsheet", () => {
    for (const formula of ["=1+1", "+1", "-1", "@SUM(A1)", "\tTab", "=HYPERLINK(\"http://x\",\"y\")"]) {
      expect(csvText(formula, "standard").replace(/^"/, "")[0], formula).toBe("'");
    }
  });
});

describe("a number cell", () => {
  it("uses the style's decimal mark and at most six decimals", () => {
    expect(csvNumber(4.2135, "standard")).toBe("4.2135");
    expect(csvNumber(4.2135, "eu")).toBe("4,2135");
    expect(csvNumber(1 / 3, "standard")).toBe("0.333333");
    expect(csvNumber(-0.5, "eu")).toBe("-0,5");
    expect(csvNumber(8120, "eu")).toBe("8120");
  });

  it("is empty when there is no number", () => {
    expect(csvNumber(null, "standard")).toBe("");
    expect(csvNumber(undefined, "standard")).toBe("");
    expect(csvNumber(Number.NaN, "standard")).toBe("");
  });

  it("is not made into a formula when negative", () => {
    expect(csvNumber(-3, "standard")).toBe("-3");
  });
});

describe("a line and a header", () => {
  it("joins cells with the style's delimiter and ends with CRLF", () => {
    expect(csvLine([text("Grid meter"), number(4.2), text("kW")], "standard")).toBe("Grid meter,4.2,kW\r\n");
    expect(csvLine([text("Grid meter"), number(4.2), text("kW")], "eu")).toBe("Grid meter;4,2;kW\r\n");
  });

  it("starts the file with the byte-order mark", () => {
    expect(csvHeader(["a", "b"], "standard")).toBe(`${BYTE_ORDER_MARK}a,b\r\n`);
    expect(csvHeader(["a", "b"], "eu")).toBe(`${BYTE_ORDER_MARK}a;b\r\n`);
  });
});

describe("times and names", () => {
  it("writes a time on the site's own clock, and in UTC", () => {
    const ms = Date.parse("2026-10-19T12:05:09Z");
    expect(localStamp(ms, "Europe/Tirane")).toBe("2026-10-19 14:05:09");
    expect(localStamp(ms, "UTC")).toBe("2026-10-19 12:05:09");
    expect(utcStamp(ms)).toBe("2026-10-19 12:05:09");
  });

  it("makes a file name from a site name", () => {
    expect(slug("Hotel Adriatik, Durrës")).toBe("hotel-adriatik-durres");
    expect(slug("../../etc/passwd")).toBe("etc-passwd");
    expect(slug("***")).toBe("site");
    expect(slug("x".repeat(100))).toHaveLength(40);
  });
});
