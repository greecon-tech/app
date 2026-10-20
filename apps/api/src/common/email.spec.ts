import { describe, expect, it } from "vitest";
import { canonicalEmail } from "./email";

describe("the one way an account's address is written", () => {
  it("is lower case and trimmed", () => {
    expect(canonicalEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });

  it("refuses anything that is not plain ASCII, because the database and JavaScript lower-case some other letters differently", () => {
    // "İ" lower-cases to "i" in a database with a Unicode collation and to "i" plus an accent in JavaScript:
    // one account would be reachable, and counted by the rate limit, under many spellings.
    expect(canonicalEmail("İlir@example.com")).toBeNull();
    expect(canonicalEmail("ilir@exämple.com")).toBeNull();
    expect(canonicalEmail("ilir@example.com​")).toBeNull();
  });

  it("refuses what cannot be an address at all", () => {
    for (const value of [undefined, null, 42, "", "ab", "no-at-sign.example.com", "has space@example.com", `${"a".repeat(250)}@example.com`]) {
      expect(canonicalEmail(value), String(value)).toBeNull();
    }
  });
});
