import { ReactNode } from "react";
import { userRoles } from "@greecon/shared";
import { DEMO_ROLE } from "../lib/api";
import { roleLabel } from "../lib/roles";
import { DemoBanner } from "./DemoBanner";
import { Frame } from "./Frame";
import { UserMenu } from "./UserMenu";

// Static-export twin of Shell.tsx (see apps/web/scripts/build-static.sh). The live Shell reads a
// real session (login, logout, the actual signed-in user's name) via lib/session.ts, which
// imports a Server Action — and Shell is used by literally every page, so that import alone
// would break the entire static export, not just one route. This twin has no login concept at
// all: each of the five static builds already "is" its DEMO_ROLE by construction, and it is
// always the client's own view (the demo has no Greecon team).
export function Shell({ children, title, subtitle, action }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  // Set only by the multi-role GitHub Pages build (docs/12-deployment-github-pages.md), which
  // publishes one static snapshot per role under sibling paths — a normal SSR deployment has a
  // single live role and no sibling builds to switch to, so the menu stays hidden there.
  const siteRoot = process.env.GREECON_SITE_ROOT;
  const roleName = roleLabel(DEMO_ROLE);

  const tools =
    siteRoot !== undefined ? (
      <details className="user-menu role-switch">
        <summary aria-label={`Viewing as ${roleName}. Choose another role`}>
          <span className="user-menu__who user-menu__who--always">
            <span>Viewing as</span>
            <strong>{roleName}</strong>
          </span>
        </summary>
        <div className="user-menu__panel">
          {userRoles
            .filter((other) => other !== DEMO_ROLE)
            .map((other) => (
              <a href={`${siteRoot}${other === "operator" ? "/" : `/${other}/`}`} key={other}>
                {roleLabel(other)}
              </a>
            ))}
        </div>
      </details>
    ) : (
      <UserMenu name="Secure access" role={roleName} />
    );

  return (
    <Frame audience="client" role={DEMO_ROLE} home="/" title={title} subtitle={subtitle} action={action} tools={tools} banner={<DemoBanner />}>
      {children}
    </Frame>
  );
}
