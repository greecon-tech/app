"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Audience, currentPlace, hasPermission, IconName, isWithin, placesFor, tabsFor, UserRole } from "@greecon/shared";

// Two audiences, two sets of five places (docs/28-ux-definition.md, section 3), defined in packages/shared/src/places.ts so that quick find offers
// exactly what this bar does. On a phone the same five links are the bar at the foot of the screen (see "The shell" in globals.css),
// so nothing important sits behind a menu icon.
export type { Audience };

const icons: Record<IconName, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" />
    </>
  ),
  clients: (
    <>
      <rect x="4.5" y="3" width="10" height="18" rx="1.5" />
      <path d="M14.5 9H19a1 1 0 0 1 1 1v11h-5.5M8 7.5h3M8 11.5h3M8 15.5h3" />
    </>
  ),
  requests: (
    <>
      <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 13.5h4.5l1 2.5h5l1-2.5H20" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M17.5 14.2c2.3.3 4 2.3 4 4.8" />
    </>
  ),
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
  reports: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  )
};

export function Nav({ role, audience = "client", requestsWaiting = 0 }: { role: UserRole; audience?: Audience; requestsWaiting?: number }) {
  const pathname = usePathname();
  const entries = placesFor(role, audience, requestsWaiting);
  const current = currentPlace(entries, pathname);

  return (
    <nav className="main-nav" aria-label="Sections">
      {entries.map((entry) => (
        <Link href={entry.href} key={entry.label} aria-current={entry === current ? "page" : undefined}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icons[entry.icon]}
          </svg>
          <span className="main-nav__label">{entry.label}</span>
          {entry.badge ? (
            <span className="main-nav__badge">
              {entry.badge}
              <span className="visually-hidden"> waiting</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** The tabs of the place the person is in (Downloads and Trends; Who is told, People, Audit log and Account), shown above the page. */
export function SectionTabs({ role, audience = "client" }: { role: UserRole; audience?: Audience }) {
  const pathname = usePathname();
  const tabs = tabsFor(pathname, audience).filter((tab) => !tab.requires || hasPermission(role, tab.requires));
  if (tabs.length < 2) return null;
  // The tab whose path is the longest match is the current one (/settings is also the start of /settings/people).
  const current = [...tabs].filter((tab) => isWithin(pathname, tab.href)).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="section-tabs" aria-label="In this section">
      {tabs.map((tab) => (
        <Link href={tab.href} key={tab.href} aria-current={tab === current ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
