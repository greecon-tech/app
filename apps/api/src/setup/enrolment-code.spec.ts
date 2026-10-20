import { describe, expect, it } from "vitest";
import { formatEnrolmentCode, generateEnrolmentCode, hashEnrolmentCode, normaliseEnrolmentCode } from "./enrolment-code";

describe("enrolment codes", () => {
  it("are shaped GRC-XXXX-XXXX-XXXX and use only symbols people do not confuse", () => {
    const code = generateEnrolmentCode();
    expect(code).toMatch(/^GRC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (let i = 0; i < 200; i += 1) expect(generateEnrolmentCode()).not.toMatch(/[01IO]/);
  });

  it("do not repeat", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateEnrolmentCode()));
    expect(seen.size).toBe(2000);
  });

  it("are read back from whatever was typed", () => {
    const code = generateEnrolmentCode();
    const body = normaliseEnrolmentCode(code) as string;
    expect(body).toHaveLength(12);
    expect(normaliseEnrolmentCode(code.toLowerCase())).toBe(body);
    expect(normaliseEnrolmentCode(`  ${code}\n`)).toBe(body);
    expect(normaliseEnrolmentCode(body)).toBe(body);
    expect(normaliseEnrolmentCode(code.replace(/-/g, " "))).toBe(body);
    expect(formatEnrolmentCode(body)).toBe(code);
  });

  it("refuse what cannot be a code", () => {
    expect(normaliseEnrolmentCode(undefined)).toBeUndefined();
    expect(normaliseEnrolmentCode(42)).toBeUndefined();
    expect(normaliseEnrolmentCode("")).toBeUndefined();
    expect(normaliseEnrolmentCode("GRC-ABCD-EFGH")).toBeUndefined();
    expect(normaliseEnrolmentCode("GRC-ABCD-EFGH-JKL0")).toBeUndefined();
    expect(normaliseEnrolmentCode("GRC-ABCD-EFGH-JKLMN")).toBeUndefined();
    expect(normaliseEnrolmentCode("x".repeat(65))).toBeUndefined();
    expect(normaliseEnrolmentCode("GRC-ABCD-EFGH-JK!M")).toBeUndefined();
  });

  it("hash the same way every time and differently for different codes", () => {
    const a = hashEnrolmentCode("ABCDEFGHJKLM");
    expect(a).toBe(hashEnrolmentCode("ABCDEFGHJKLM"));
    expect(a).not.toBe(hashEnrolmentCode("ABCDEFGHJKLN"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
