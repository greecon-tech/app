import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "./generate-password";
import { problemWithNewPassword } from "./password-policy";

describe("a temporary password", () => {
  it("is three groups of four plain letters and digits, easy to read aloud", () => {
    for (let i = 0; i < 200; i++) expect(generateTemporaryPassword()).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
  });

  it("never uses a character that is easily mistaken for another", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTemporaryPassword()).join("").replace(/-/g, ""));
    for (const confusing of ["0", "o", "1", "l", "i"]) expect(seen.has(confusing), confusing).toBe(false);
  });

  it("is not one anybody could guess: no repeats in a large sample, and every position uses the whole alphabet", () => {
    const sample = Array.from({ length: 20_000 }, () => generateTemporaryPassword());
    expect(new Set(sample).size).toBe(sample.length);
    for (let position = 0; position < 14; position++) {
      if (position === 4 || position === 9) continue;
      expect(new Set(sample.map((password) => password[position])).size, `position ${position}`).toBe(31);
    }
  });

  it("is itself an acceptable password, so a person who keeps it is not left with a weak one", () => {
    expect(problemWithNewPassword(generateTemporaryPassword())).toBeUndefined();
  });
});
