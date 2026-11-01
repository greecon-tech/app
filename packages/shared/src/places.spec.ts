import { describe, expect, it } from "vitest";
import { actionsForFind, currentPlace, pagesForFind, placesFor, tabsFor } from "./places";

const labels = (role: Parameters<typeof placesFor>[0], audience: Parameters<typeof placesFor>[1]) => pagesForFind(role, audience).map((entry) => entry.label);

describe("the places a person can go", () => {
  it("gives a client five places, and Greecon's team its own five", () => {
    expect(placesFor("owner", "client").map((place) => place.label)).toEqual(["Overview", "Sites", "Alerts", "Reports", "Settings"]);
    expect(placesFor("owner", "team").map((place) => place.label)).toEqual(["Today", "Clients", "Requests", "Team", "Settings"]);
  });

  it("sends a role to the first tab it may open: Who is told only where it may change who is told, Trends where it may not download", () => {
    expect(placesFor("owner", "client").find((place) => place.label === "Settings")?.href).toBe("/settings/people");
    expect(placesFor("operator", "client").find((place) => place.label === "Settings")?.href).toBe("/settings");
    expect(placesFor("owner", "client").find((place) => place.label === "Reports")?.href).toBe("/reports");
    expect(placesFor("viewer", "client").find((place) => place.label === "Reports")?.href).toBe("/analytics");
  });

  it("says which place a page belongs to, the longest match winning: Requests is not Clients", () => {
    const team = placesFor("owner", "team");
    expect(currentPlace(team, "/platform/requests")?.label).toBe("Requests");
    expect(currentPlace(team, "/platform")?.label).toBe("Clients");
    expect(currentPlace(placesFor("owner", "client"), "/sites/abc/setup")?.label).toBe("Sites");
    expect(currentPlace(placesFor("owner", "client"), "/audit")?.label).toBe("Settings");
  });

  it("shows the tabs of the place the person is in, and none elsewhere", () => {
    expect(tabsFor("/audit", "client").map((tab) => tab.label)).toEqual(["Who is told", "People", "Audit log", "Account"]);
    expect(tabsFor("/audit", "team").map((tab) => tab.label)).toEqual(["Who is told", "Audit log", "Account"]);
    expect(tabsFor("/analytics", "client").map((tab) => tab.label)).toEqual(["Downloads", "Trends"]);
    expect(tabsFor("/sites", "client")).toEqual([]);
  });
});

describe("what quick find offers a person to open", () => {
  it("offers an owner every place and tab, and the two pages that are always there", () => {
    expect(labels("owner", "client")).toEqual(expect.arrayContaining(["Overview", "Sites", "Alerts", "Reports", "Settings", "Who is told", "People", "Audit log", "Account", "Downloads", "Trends", "Help", "Privacy"]));
  });

  it("offers a role only what it may open: a finder that offers a page and then says no would be worse than a menu", () => {
    const operator = labels("operator", "client");
    expect(operator).toEqual(expect.arrayContaining(["Overview", "Sites", "Alerts", "Trends", "Account", "Help", "Privacy"]));
    for (const refused of ["Who is told", "People", "Audit log", "Downloads"]) expect(operator).not.toContain(refused);
  });

  it("offers Greecon's team its own pages and not a client's", () => {
    const team = labels("owner", "team");
    expect(team).toEqual(expect.arrayContaining(["Today", "Clients", "Requests", "Team", "Who is told", "Audit log"]));
    expect(team).not.toContain("Overview");
    expect(team).not.toContain("People");
  });

  it("gives every entry an address and a name, and finds Settings and its first tab as two names for one place", () => {
    const entries = pagesForFind("owner", "client");
    expect(entries.every((entry) => entry.href.startsWith("/") && entry.label.length > 0 && entry.kind === "Page")).toBe(true);
    expect(entries.filter((entry) => entry.href === "/settings/people").map((entry) => entry.label).sort()).toEqual(["Settings", "Who is told"]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("offers the actions a person may take from anywhere", () => {
    expect(actionsForFind("owner", "team").map((entry) => entry.label)).toEqual(["Onboard a client"]);
    expect(actionsForFind("owner", "client").map((entry) => entry.label)).toEqual(["Add a site"]);
    expect(actionsForFind("viewer", "client")).toEqual([]);
  });
});
