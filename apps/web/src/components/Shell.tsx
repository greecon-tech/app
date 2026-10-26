import Link from "next/link";
import { ReactNode } from "react";
import { AccessRequest, DEMO_TENANT_ID, userRoles } from "@greecon/shared";
import { apiGet, DEMO_ROLE } from "../lib/api";
import { logoutAction } from "../app/login/actions";
import { leaveSetupAction } from "../app/platform/actions";
import { roleLabel } from "../lib/roles";
import { getSession } from "../lib/session";
import { DemoBanner } from "./DemoBanner";
import { Frame } from "./Frame";
import { UserMenu } from "./UserMenu";

/** How many requests for access nobody has looked at yet, for the badge on Requests. It must never be the reason a page fails. */
async function requestsWaiting(): Promise<number> {
  try {
    return (await apiGet<AccessRequest[]>("/platform-admin/access-requests")).filter((request) => request.status === "new").length;
  } catch (error) {
    // A session the platform no longer accepts is sent to the sign-in page (apiGet redirects); that is the page's business, not something to swallow here.
    if (typeof error === "object" && error !== null && String((error as { digest?: unknown }).digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
    return 0;
  }
}

/**
 * The frame of every page, with the person it is for filled in (docs/28-ux-definition.md, section 5).
 *
 * Greecon's team has its own five places and its own home (Today); everyone else has the client's. A member of the team who is
 * inside a customer's account to set it up sees that customer's places, under a banner that says whose account it is.
 */
export async function Shell({ children, title, subtitle, action }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  // Set only by the multi-role GitHub Pages build (docs/12-deployment-github-pages.md), which
  // publishes one static snapshot per role under sibling paths — a normal SSR deployment has a
  // single live role and no sibling builds to switch to, so the menu stays hidden there.
  const siteRoot = process.env.GREECON_SITE_ROOT;
  // The static export never has a session (see lib/session.ts); the live deployment always does,
  // since middleware.ts already redirected anyone without one to /login before this rendered.
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  const roleName = roleLabel(role);
  const audience = session?.user.isPlatformAdmin && !session.user.support ? "team" : "client";
  const waiting = audience === "team" ? await requestsWaiting() : 0;
  const home = audience === "team" ? "/today" : "/";

  const isDemoAccount = session?.user.tenantId === DEMO_TENANT_ID;
  const banner = session?.user.support ? (
    <div className="support-banner" role="status">
      <p>
        You are in <strong>{session.user.customer ?? "a customer's account"}</strong> as Greecon staff, setting it up. What you do here is recorded under your name in their audit trail.
        You cannot add people to the account or change their passwords.
      </p>
      <form action={leaveSetupAction}>
        <button type="submit" className="button-ghost">
          Back to the Greecon console
        </button>
      </form>
    </div>
  ) : isDemoAccount ? (
    <DemoBanner />
  ) : undefined;

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
    ) : session ? (
      <UserMenu
        name={session.user.name}
        role={roleName}
        email={session.user.email}
        logout={
          <form action={logoutAction}>
            <button type="submit" className="button-ghost">
              Log out
            </button>
          </form>
        }
      />
    ) : (
      <UserMenu name="Secure access" role={roleName} />
    );

  return (
    <Frame audience={audience} role={role} home={home} waiting={waiting} title={title} subtitle={subtitle} action={action} tools={tools} banner={banner}>
      {children}
    </Frame>
  );
}
