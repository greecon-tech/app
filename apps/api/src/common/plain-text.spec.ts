import { describe, expect, it } from "vitest";
import { oneLine, severalLines, userText, webAddressesIn, withoutLinks } from "./plain-text";

// Text that a person typed, before it goes into a message or a screen of someone else's.

const RLO = String.fromCodePoint(0x202e); // right-to-left override: shows "kcab" as "back"
const PDF = String.fromCodePoint(0x202c);
const RLI = String.fromCodePoint(0x2067);
const ZERO_WIDTH = String.fromCodePoint(0x200b);
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);
const LINE_SEPARATOR = String.fromCodePoint(0x2028);

describe("one line of text from a person", () => {
  it("turns line breaks, tabs and other control characters into spaces, and runs of them into one", () => {
    expect(oneLine("Besa\nKrasniqi\r\n\tof\u0007the\u0000hotel ", 80)).toBe("Besa Krasniqi of the hotel");
    expect(oneLine(`first${LINE_SEPARATOR}second`, 80)).toBe("first second");
  });

  it("drops the invisible characters that reorder or hide text", () => {
    expect(oneLine(`Hotel ${RLO}kcab${PDF}${ZERO_WIDTH}${BYTE_ORDER_MARK}${RLI}`, 80)).toBe("Hotel kcab");
  });

  it("keeps every letter with its marks", () => {
    expect(oneLine("Durrës, Çamëria", 80)).toBe("Durrës, Çamëria");
  });

  it("cuts a long text to its limit in whole characters, and says it was cut", () => {
    const cut = oneLine("x".repeat(5_000), 80);
    expect(Array.from(cut)).toHaveLength(80);
    expect(cut.endsWith("…")).toBe(true);
    const faces = oneLine("\u{1F600}".repeat(50), 10);
    expect(Array.from(faces)).toHaveLength(10);
    expect(faces.isWellFormed()).toBe(true);
  });
});

describe("several lines of text from a person", () => {
  it("keeps the line breaks, at most one empty line in a row, and nothing else that a line may hide", () => {
    expect(severalLines(`Hello,\r\nwe have a hotel.${RLO}\n\n\n\n\nThanks\u0000 `, 1000)).toBe("Hello,\nwe have a hotel.\n\nThanks");
  });

  it("is cut to its limit too", () => {
    expect(Array.from(severalLines("y\n".repeat(2_000), 1000))).toHaveLength(1000);
  });
});

describe("web addresses in text from a person", () => {
  it("are written so that no phone or mail program makes a link of them", () => {
    expect(withoutLinks("Hotel https://evil.example/pay now")).toBe("Hotel https[:]//evil[.]example/pay now");
    expect(withoutLinks("see www.evil.com")).toBe("see www[.]evil[.]com");
    expect(withoutLinks("see greecon-help.com/login")).toBe("see greecon-help[.]com/login");
  });

  it("leave an email address and ordinary names alone", () => {
    const ordinary = "Write to besa@hotel.al, Dr. Ahmeti or J.R. Smith, Durrës.";
    expect(withoutLinks(ordinary)).toBe(ordinary);
  });

  it("are counted once each, however they are written", () => {
    expect(webAddressesIn("https://a.example and www.b.example and c.com")).toBe(3);
    expect(webAddressesIn("https://www.a.example/x?y=1")).toBe(1);
    expect(webAddressesIn("besa@hotel.al")).toBe(0);
    expect(webAddressesIn("Besa Krasniqi")).toBe(0);
  });

  it("go into a message as one line, cut to length, with no working link", () => {
    expect(userText(`Besa\nhttps://evil.example ${"z".repeat(200)}`, 40)).toMatch(/^Besa https\[:\]\/\/evil\[\.\]example z+…$/);
    expect(Array.from(userText("w".repeat(500), 40))).toHaveLength(40);
  });
});
