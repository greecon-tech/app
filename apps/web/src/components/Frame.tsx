import Link from "next/link";
import { ReactNode } from "react";
import { GREECON_COMPANY, GREECON_DOMAIN, UserRole } from "@greecon/shared";
import { Audience, Nav, SectionTabs } from "./Nav";

/**
 * The frame of every page (docs/28-ux-definition.md, section 5): on a desk, a bar on the left and the title and the person's menu above
 * the page; on a phone, a slim top bar and the five places as a bar at the foot of the screen. It only draws. Where the person's menu,
 * the banner and the page's own content come from is the caller's business, so that the live Shell, its demo twin and the loading
 * screen all share one frame without any of them importing what only one of them may (a Server Action).
 */
export function Frame({
  audience,
  role,
  home,
  waiting = 0,
  title,
  subtitle,
  action,
  tools,
  banner,
  children
}: {
  audience: Audience;
  role: UserRole;
  home: string;
  /** Requests nobody has looked at yet, for the badge on Requests. Greecon's team only. */
  waiting?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** The person's menu (or the demo's "viewing as" switch), at the right of the top bar. */
  tools: ReactNode;
  /** A line above the top bar, such as "You are in X's account as Greecon staff". */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const logo = `${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`;

  return (
    <div className="app-shell" data-audience={audience}>
      <a className="skip-link" href="#main">
        Skip to the page
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href={home} className="brand">
          <img src={logo} alt="" width="22" height="31" />
          <span>Greecon</span>
        </Link>
        <Nav role={role} audience={audience} requestsWaiting={waiting} />
        <div className="sidebar-foot">
          <p>{GREECON_COMPANY}</p>
          <span>{GREECON_DOMAIN}</span>
          <span className="sidebar-foot__links">
            <Link href="/help">Help</Link> · <Link href="/privacy">Privacy</Link>
          </span>
        </div>
      </aside>
      <div className="workspace">
        {banner}
        <header className="topbar">
          <Link href={home} className="topbar__brand" aria-label="Greecon, home">
            <img src={logo} alt="" width="20" height="28" />
            <span>Greecon</span>
          </Link>
          <div className="topbar__title">
            <h1>{title}</h1>
            {subtitle ? <p className="topbar__subtitle">{subtitle}</p> : null}
          </div>
          <div className="topbar__tools">
            {action ? <div className="topbar__action">{action}</div> : null}
            {tools}
          </div>
        </header>
        <SectionTabs role={role} audience={audience} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
