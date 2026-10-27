import { describe, expect, it } from "vitest";
import { findEntries, foldForFind, type FindEntry } from "./quick-find";

const page = (label: string, href: string, extra: Partial<FindEntry> = {}): FindEntry => ({ id: href, kind: "Page", label, href, ...extra });
const site = (label: string, detail: string, id: string): FindEntry => ({ id, kind: "Site", label, detail, href: `/sites/${id}` });

const entries: FindEntry[] = [
  page("Overview", "/"),
  page("Sites", "/sites"),
  page("Alerts", "/alerts"),
  page("Who is told", "/settings/people", { keywords: ["settings", "people", "email", "text"] }),
  page("Audit log", "/audit", { keywords: ["settings", "history"] }),
  site("Hotel Adriatik", "Durrës, Albania · Hotel or guesthouse", "a1"),
  site("Vila Mare", "Vlorë, Albania · Solar plant", "a2"),
  site("Serra Bardhi", "Lushnjë, Albania · Farm or greenhouse", "a3")
];

describe("foldForFind", () => {
  it("takes out accents, capitals and the marks between words", () => {
    expect(foldForFind("Durrës")).toBe("durres");
    expect(foldForFind("Who's  told?")).toBe("whos told");
    expect(foldForFind("  Lushnjë – Albania ")).toBe("lushnje albania");
  });
});

describe("findEntries", () => {
  it("gives the suggestions, in the order given, when nothing is typed", () => {
    expect(findEntries(entries, "", 3).map((entry) => entry.label)).toEqual(["Overview", "Sites", "Alerts"]);
    expect(findEntries(entries, "   ", 2)).toHaveLength(2);
  });

  it("finds a site by the start of its name, without regard to capitals or accents", () => {
    expect(findEntries(entries, "hot")[0]?.label).toBe("Hotel Adriatik");
    expect(findEntries(entries, "DURRES")[0]?.label).toBe("Hotel Adriatik");
  });

  it("needs every word to be found, in any order", () => {
    expect(findEntries(entries, "adriatik hotel").map((entry) => entry.label)).toEqual(["Hotel Adriatik"]);
    expect(findEntries(entries, "hotel vlore")).toEqual([]);
  });

  it("finds a page by a word that is not on it, but ranks a name above a keyword", () => {
    const found = findEntries(entries, "settings").map((entry) => entry.label);
    expect(found).toEqual(["Who is told", "Audit log"]);
    expect(findEntries(entries, "people")[0]?.label).toBe("Who is told");
  });

  it("ranks the start of a name above a match inside it, and a name above a detail", () => {
    const things: FindEntry[] = [site("Old farm", "Near the Vila", "x"), site("Vila Mare", "Vlorë", "y"), site("Casa Vilar", "Elbasan", "z")];
    expect(findEntries(things, "vila").map((entry) => entry.id)).toEqual(["y", "z", "x"]);
  });

  it("keeps the given order for entries that answer equally well, and stops at the limit", () => {
    const same = [page("Alerts one", "/1"), page("Alerts two", "/2"), page("Alerts three", "/3")];
    expect(findEntries(same, "alerts").map((entry) => entry.href)).toEqual(["/1", "/2", "/3"]);
    expect(findEntries(same, "alerts", 2)).toHaveLength(2);
  });

  it("finds nothing when nothing answers", () => {
    expect(findEntries(entries, "zzz")).toEqual([]);
  });
});
