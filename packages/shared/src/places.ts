import { GREECON_PUBLIC_EMAILS, hasPermission, Permission, UserRole } from "./index";
import type { FindEntry } from "./quick-find";

// The places a person can go (docs/28-ux-definition.md, section 3), in one module with no screen in it, so that the bar, the tabs and
// quick find (docs/29-apple-notion-standards.md) cannot disagree about what exists, and so that what a role may open is tested. The frame,
// which is drawn on the server, builds quick find's list of pages from it; the bar, which is drawn in the browser, uses the same.

/** Two audiences, two sets of five places. Greecon's team has its own: what a project manager does in a day is nothing like what a hotel owner does. */
export type Audience = "team" | "client";

export type IconName = "today" | "clients" | "requests" | "team" | "overview" | "sites" | "alerts" | "reports" | "settings";

export interface Place {
  label: string;
  /** Where the link goes. */
  href: string;
  /** Every path this place owns: the place is "current" while the page is in any of them. The longest match wins. */
  owns: readonly string[];
  icon: IconName;
  /** A number to show beside the name (requests waiting). */
  badge?: number;
}

export interface Tab {
  href: string;
  label: string;
  requires?: Permission;
}

/** The tabs of the Settings place. Which of them a person sees follows what their role may do. */
export const SETTINGS_TABS: readonly Tab[] = [
  { href: "/settings/people", label: "Who is told", requires: "settings:manage" },
  { href: "/admin", label: "People", requires: "user:manage" },
  { href: "/audit", label: "Audit log", requires: "audit:read" },
  { href: "/settings", label: "Account" }
];

export const REPORT_TABS: readonly Tab[] = [
  { href: "/reports", label: "Downloads", requires: "report:export" },
  { href: "/analytics", label: "Trends" }
];

export const isWithin = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** The tabs that go with the place the person is in, or none. */
export function tabsFor(pathname: string, audience: Audience): readonly Tab[] {
  if (SETTINGS_TABS.some((tab) => isWithin(pathname, tab.href))) return audience === "team" ? SETTINGS_TABS.filter((tab) => tab.href !== "/admin") : SETTINGS_TABS;
  if (REPORT_TABS.some((tab) => isWithin(pathname, tab.href))) return REPORT_TABS;
  return [];
}

export function placesFor(role: UserRole, audience: Audience, requestsWaiting = 0): Place[] {
  const settingsHref = hasPermission(role, "settings:manage") ? "/settings/people" : "/settings";
  const settings: Place = { label: "Settings", href: settingsHref, owns: ["/settings", "/admin", "/audit", "/change-password"], icon: "settings" };
  if (audience === "team") {
    return [
      { label: "Today", href: "/today", owns: ["/today"], icon: "today" },
      { label: "Clients", href: "/platform", owns: ["/platform"], icon: "clients" },
      { label: "Requests", href: "/platform/requests", owns: ["/platform/requests"], icon: "requests", badge: requestsWaiting },
      { label: "Team", href: "/platform/team", owns: ["/platform/team"], icon: "team" },
      settings
    ];
  }
  // Anyone may see the trends; only roles that may export see the downloads, so they land on the trends.
  const reportsHref = hasPermission(role, "report:export") ? "/reports" : "/analytics";
  return [
    { label: "Overview", href: "/", owns: ["/"], icon: "overview" },
    // Devices and maintenance are staff tools reached from a site's equipment page; they belong to Sites, not to a place of their own.
    { label: "Sites", href: "/sites", owns: ["/sites", "/devices", "/maintenance"], icon: "sites" },
    { label: "Alerts", href: "/alerts", owns: ["/alerts"], icon: "alerts" },
    { label: "Reports", href: reportsHref, owns: ["/reports", "/analytics"], icon: "reports" },
    settings
  ];
}

/** The place whose path matches the page most closely, so /platform/requests is Requests and not Clients. */
export function currentPlace(entries: readonly Place[], pathname: string): Place | undefined {
  let best: { entry: Place; length: number } | undefined;
  for (const entry of entries) {
    for (const path of entry.owns) {
      if (!isWithin(pathname, path)) continue;
      const length = path === "/" ? 1 : path.length;
      if (!best || length > best.length) best = { entry, length };
    }
  }
  return best?.entry;
}

/** Words that find a page without being on it ("email" finds Who is told). Kept short: quick find is for names people remember. */
const PAGE_WORDS: Record<string, readonly string[]> = {
  "/": ["home", "status", "dashboard"],
  "/today": ["home", "morning", "needs a look"],
  "/platform": ["customers", "accounts", "onboard", "setup"],
  "/platform/requests": ["sign up", "access", "leads", "inbox"],
  "/platform/team": ["staff", "project managers", "colleagues"],
  "/sites": ["places", "plants", "tanks", "farms", "hotels"],
  "/alerts": ["problems", "warnings", "acknowledge", "notifications"],
  "/reports": ["download", "export", "csv", "data"],
  "/analytics": ["charts", "graphs", "history", "readings"],
  "/settings/people": ["email", "text", "sms", "notify", "quiet hours", "morning message", "recipients", "contacts"],
  "/admin": ["users", "accounts", "passwords", "roles", "team"],
  "/audit": ["history", "who did what", "log", "changes"],
  "/settings": ["password", "profile", "sign out", "log out", "my account"],
  "/help": ["guide", "support", "contact", "how do i", "shortcuts", "keyboard"],
  "/privacy": ["data", "gdpr", "cookies", "terms"]
};

/**
 * Everything the person may open from the bar and the tabs, and the two always-there pages (Help, Privacy), as entries for quick find.
 * What a role may not open is not in the list: a finder that offers a page and then says "no access" would be a worse lie than a menu.
 */
export function pagesForFind(role: UserRole, audience: Audience): FindEntry[] {
  const entries: FindEntry[] = [];
  const seen = new Set<string>();
  const add = (label: string, href: string, detail?: string) => {
    // "Settings" and its first tab can lead to the same address, and are two names a person may look for.
    const id = `${href}|${label}`;
    if (seen.has(id)) return;
    seen.add(id);
    entries.push({ id, kind: "Page", label, href, detail, keywords: PAGE_WORDS[href] });
  };
  for (const place of placesFor(role, audience)) add(place.label, place.href);
  const tabs = [...SETTINGS_TABS, ...REPORT_TABS].filter((tab) => !(audience === "team" && tab.href === "/admin"));
  for (const tab of tabs) if (!tab.requires || hasPermission(role, tab.requires)) add(tab.label, tab.href, SETTINGS_TABS.includes(tab) ? "Settings" : "Reports");
  add("Help", "/help", `Guides, and ${GREECON_PUBLIC_EMAILS[0]}`);
  add("Privacy", "/privacy");
  return entries;
}

/** The few things a person may want to start from anywhere, by what they will do. */
export function actionsForFind(role: UserRole, audience: Audience): FindEntry[] {
  const actions: FindEntry[] = [];
  if (audience === "team") {
    actions.push({ id: "action:onboard", kind: "Action", label: "Onboard a client", href: "/platform?onboard=new#onboard", detail: "Make a customer's account", keywords: ["new", "add", "create", "customer"] });
  } else if (hasPermission(role, "site:manage")) {
    actions.push({ id: "action:add-site", kind: "Action", label: "Add a site", href: "/sites/new", detail: "Start from a template", keywords: ["new", "create", "template", "hotel", "solar", "farm", "water"] });
  }
  return actions;
}
