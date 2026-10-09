"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { hasPermission, Permission, UserRole } from "@greecon/shared";

// Icon paths below are the brand icon set (Greecon Icon Library), reproduced inline with
// stroke="currentColor" so nav hover/active states still recolor them correctly.
const navItems: ReadonlyArray<{ href: string; label: string; icon: ReactNode; requires?: Permission; platformOnly?: boolean }> = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </>
    )
  },
  {
    href: "/sites/22222222-2222-4222-8222-222222222201",
    label: "Sites",
    icon: (
      <>
        <path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z" />
        <circle cx="12" cy="10" r="2.3" />
      </>
    )
  },
  {
    href: "/monitoring",
    label: "Monitoring",
    icon: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5.2 5.2a9.7 9.7 0 0 0 0 13.6M18.8 5.2a9.7 9.7 0 0 1 0 13.6" />
      </>
    )
  },
  {
    href: "/automation",
    label: "Automation",
    icon: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
        <path d="M10 7h1.5a3.5 3.5 0 0 1 3.5 3.5V14" />
      </>
    )
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: (
      <>
        <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2.5H4z" />
        <path d="M10 21h4" />
      </>
    )
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    requires: "maintenance:manage",
    icon: (
      <>
        <path d="M12 3l8 3v6c0 4.8-3.3 8.2-8 9.5-4.7-1.3-8-4.7-8-9.5V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </>
    )
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 6-7" />
      </>
    )
  },
  {
    href: "/devices",
    label: "Devices",
    icon: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <rect x="10" y="10" width="4" height="4" rx="1" />
        <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" />
      </>
    )
  },
  {
    href: "/reports",
    label: "Reports",
    requires: "report:export",
    icon: (
      <>
        <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6" />
      </>
    )
  },
  {
    href: "/audit",
    label: "Audit",
    requires: "audit:read",
    icon: <path d="M4 7h2M9 7h11M4 12h2M9 12h11M4 17h2M9 17h11" />
  },
  {
    href: "/admin",
    label: "Admin",
    requires: "user:manage",
    icon: (
      <>
        <circle cx="12" cy="12" r="2.5" />
        <circle cx="12" cy="3.8" r="1.5" />
        <circle cx="12" cy="20.2" r="1.5" />
        <circle cx="3.8" cy="12" r="1.5" />
        <circle cx="20.2" cy="12" r="1.5" />
        <path d="M12 9.5V5.3M12 14.5v4.2M9.5 12H5.3M14.5 12h4.2" />
      </>
    )
  },
  {
    href: "/platform",
    label: "Clients",
    platformOnly: true,
    icon: <path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.3 1.5A3.8 3.8 0 0 1 17.5 18z" />
  },
  {
    href: "/settings",
    label: "Settings",
    requires: "settings:manage",
    icon: (
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2" />
      </>
    )
  }
];

export function Nav({ role, isPlatformAdmin = false }: { role: UserRole; isPlatformAdmin?: boolean }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter(
    (item) => (!item.requires || hasPermission(role, item.requires)) && (!item.platformOnly || isPlatformAdmin)
  );

  return (
    <nav className="main-nav" aria-label="Sections">
      {visibleItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
