"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { hasPermission, Permission, UserRole } from "@greecon/shared";

// Five places to go, not thirteen. Everything else is a tab inside one of them (SECTIONS below) or
// lives under Account. Icon paths are the brand icon set (Greecon Icon Library), reproduced inline
// with stroke="currentColor" so hover and active states still recolor them correctly.
interface Entry {
  href: string;
  label: string;
  icon: ReactNode;
  requires?: Permission;
  platformOnly?: boolean;
}

const icons = {
  overview: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </>
  ),
  sites: (
    <>
      <path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  alerts: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2.5H4z" />
      <path d="M10 21h4" />
    </>
  ),
  automation: (
    <>
      <rect x="3" y="4" width="7" height="6" rx="1.5" />
      <rect x="14" y="14" width="7" height="6" rx="1.5" />
      <path d="M10 7h1.5a3.5 3.5 0 0 1 3.5 3.5V14" />
    </>
  ),
  reports: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6" />
};

// The tabs that sit together under one destination. A destination highlights while any of its
// tabs is open, and the tab row shows above the page.
const SECTIONS: ReadonlyArray<{ tabs: ReadonlyArray<{ href: string; label: string; requires?: Permission }> }> = [
  {
    tabs: [
      { href: "/sites", label: "Sites" },
      { href: "/monitoring", label: "Monitoring" },
      { href: "/devices", label: "Devices" },
      { href: "/maintenance", label: "Maintenance", requires: "maintenance:manage" }
    ]
  },
  {
    tabs: [
      { href: "/analytics", label: "Analytics" },
      { href: "/reports", label: "Reports", requires: "report:export" }
    ]
  }
];

const ACCOUNT: ReadonlyArray<Omit<Entry, "icon">> = [
  { href: "/settings", label: "Settings", requires: "settings:manage" },
  { href: "/settings/people", label: "Who is told", requires: "settings:manage" },
  { href: "/admin", label: "Admin", requires: "user:manage" },
  { href: "/audit", label: "Audit log", requires: "audit:read" },
  { href: "/platform", label: "Clients", platformOnly: true }
];

const isWithin = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
const sectionOf = (pathname: string) => SECTIONS.find((section) => section.tabs.some((tab) => isWithin(pathname, tab.href)));

function destinations(role: UserRole): Entry[] {
  const canExport = hasPermission(role, "report:export");
  return [
    { href: "/", label: "Overview", icon: icons.overview },
    { href: "/sites", label: "Sites", icon: icons.sites },
    { href: "/alerts", label: "Alerts", icon: icons.alerts },
    { href: "/automation", label: "Automation", icon: icons.automation },
    // Anyone may see the trends; only roles that may export see the reports page, so they land on it.
    { href: canExport ? "/reports" : "/analytics", label: "Reports", icon: icons.reports }
  ];
}

export function Nav({ role, isPlatformAdmin = false }: { role: UserRole; isPlatformAdmin?: boolean }) {
  const pathname = usePathname();
  const account = ACCOUNT.filter((item) => (!item.requires || hasPermission(role, item.requires)) && (!item.platformOnly || isPlatformAdmin));
  const accountOpen = account.some((item) => isWithin(pathname, item.href));
  const current = account.filter((item) => isWithin(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <nav className="main-nav" aria-label="Sections">
        {destinations(role).map((item) => {
          const section = sectionOf(item.href);
          const active = isWithin(pathname, item.href) || (section ? sectionOf(pathname) === section : false);
          return (
            <Link href={item.href} key={item.label} aria-current={active ? "page" : undefined}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {account.length > 0 ? (
        <details className="account-nav" open={accountOpen}>
          <summary>Account</summary>
          <nav aria-label="Account">
            {account.map((item) => (
              <Link href={item.href} key={item.href} aria-current={item.href === current ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      ) : null}
    </>
  );
}

/** The tabs of the destination the person is in (Sites, Monitoring, Devices ...), shown above the page. */
export function SectionTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const tabs = section?.tabs.filter((tab) => !tab.requires || hasPermission(role, tab.requires)) ?? [];
  if (tabs.length < 2) return null;

  return (
    <nav className="section-tabs" aria-label="In this section">
      {tabs.map((tab) => (
        <Link href={tab.href} key={tab.href} aria-current={isWithin(pathname, tab.href) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
