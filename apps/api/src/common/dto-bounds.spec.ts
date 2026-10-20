import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getMetadataStorage } from "class-validator";
import { describe, expect, it } from "vitest";

// Everything a person or a box sends is limited in size: a piece of text has a maximum length and a list a
// maximum count, so that no single request can be as large as the body limit's worth of a note, and a loop of
// requests cannot grow the platform's memory without end. This was not true of most request classes until a review
// found that the published demo login could fill the platform with them. The test reads the validation rules of
// every request class in the API and fails for one added later without a limit.

function dtoFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return dtoFiles(path);
    return name.endsWith(".dto.ts") ? [path] : [];
  });
}

/** What already bounds a text: a fixed set of values, a format of fixed shape, or an explicit maximum. */
const BOUNDED_TEXT = new Set(["maxLength", "isIn", "isEnum", "isUuid", "isIso8601", "isDateString", "matches"]);

describe("every request the API accepts has a limit on its size", () => {
  it("gives each piece of text a maximum length and each list a maximum count", async () => {
    const files = dtoFiles(resolve(__dirname, "..", "modules"));
    expect(files.length).toBeGreaterThan(30);

    const unbounded: string[] = [];
    for (const file of files) {
      const exported = (await import(file)) as Record<string, unknown>;
      for (const [name, candidate] of Object.entries(exported)) {
        if (typeof candidate !== "function") continue;
        const rules = getMetadataStorage().getTargetValidationMetadatas(candidate as new () => object, "", false, false);
        if (rules.length === 0) continue;
        const byProperty = new Map<string, Set<string>>();
        for (const rule of rules) {
          const names = byProperty.get(rule.propertyName) ?? new Set<string>();
          names.add(rule.name ?? rule.type);
          byProperty.set(rule.propertyName, names);
        }
        for (const [property, names] of byProperty) {
          if (names.has("isString") && ![...names].some((rule) => BOUNDED_TEXT.has(rule))) unbounded.push(`${name}.${property} is text with no maximum length`);
          if (names.has("isArray") && !names.has("arrayMaxSize")) unbounded.push(`${name}.${property} is a list with no maximum count`);
        }
      }
    }
    expect(unbounded).toEqual([]);
  });
});
