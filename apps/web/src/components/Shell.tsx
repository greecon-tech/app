import Link from "next/link";
import { ReactNode } from "react";
import { GREECON_COMPANY, GREECON_DOMAIN, userRoles } from "@greecon/shared";
import { DEMO_ROLE } from "../lib/api";
import { logoutAction } from "../app/login/actions";
import { getSession } from "../lib/session";
import { Nav, SectionTabs } from "./Nav";

export async function Shell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  // Set only by the multi-role GitHub Pages build (docs/12-deployment-github-pages.md), which
  // publishes one static snapshot per role under sibling paths — a normal SSR deployment has a
  // single live role and no sibling builds to switch to, so the menu stays hidden there.
  const siteRoot = process.env.GREECON_SITE_ROOT;
  // The static export never has a session (see lib/session.ts); the live deployment always does,
  // since middleware.ts already redirected anyone without one to /login before this rendered.
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const roleLabel = titleCase(role);
  const isPlatformAdmin = session?.user.isPlatformAdmin ?? false;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand">
          <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="" width="22" height="31" />
          <span>Greecon</span>
        </Link>
        <Nav role={role} isPlatformAdmin={isPlatformAdmin} />
        <div className="sidebar-foot">
          <p>{GREECON_COMPANY}</p>
          <span>{GREECON_DOMAIN}</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Greecon Platform</p>
            <h1>{title}</h1>
            {subtitle ? <p className="topbar__subtitle">{subtitle}</p> : null}
          </div>
          {siteRoot !== undefined ? (
            <details className="role-switch">
              <summary className="access-chip">
                <div>
                  <span>Viewing as</span>
                  <strong>{roleLabel}</strong>
                </div>
              </summary>
              <div className="role-switch__menu">
                {userRoles
                  .filter((role) => role !== DEMO_ROLE)
                  .map((role) => (
                    <a href={`${siteRoot}${role === "operator" ? "/" : `/${role}/`}`} key={role}>
                      {titleCase(role)}
                    </a>
                  ))}
              </div>
            </details>
          ) : (
            <div className="access-chip">
              <div>
                <span>{session ? session.user.name : "Secure access"}</span>
                <strong>{roleLabel}</strong>
              </div>
              {session ? (
                <form action={logoutAction}>
                  <button type="submit" className="button-ghost">
                    Log out
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </header>
        <SectionTabs role={role} />
        <main>{children}</main>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
