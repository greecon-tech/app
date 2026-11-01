import Link from "next/link";
import { GREECON_PUBLIC_EMAILS, hasPermission, UserRole } from "@greecon/shared";

/**
 * What an account with no site in it says (docs/29-apple-notion-standards.md: an empty place explains itself): what is not here and
 * why, what happens next and who does it, and the one thing the person can do now. Used by the Overview and by Sites, so a new
 * owner sees the same three steps wherever they look first.
 */
export function FirstRun({ role }: { role: UserRole }) {
  const mayChooseWhoIsTold = hasPermission(role, "settings:manage");
  const mayAddSite = hasPermission(role, "site:manage");
  const email = GREECON_PUBLIC_EMAILS[0];

  return (
    <div className="first-run">
      <p>
        <strong>Your account is ready, and nothing is being watched yet.</strong> A site is one place Greecon watches: a hotel, a solar plant, a farm, a tank and its pump. This is what happens next.
      </p>
      <ol className="getting-started">
        <li>
          <strong>Greecon sets up your first site.</strong>
          <span className="muted">
            A project manager makes it from a template, fits a small box next to your equipment, and checks every reading against the real thing. You do not touch the equipment.
          </span>
        </li>
        <li>
          <strong>You say who is told when something needs a person.</strong>
          <span className="muted">An email, a text, or both, in the order they should be tried. This can be done now, before the site exists.</span>
          {mayChooseWhoIsTold ? (
            <Link href="/settings/people" className="button-ghost">
              Choose who is told
            </Link>
          ) : (
            <span className="muted">The owner of the account can do this.</span>
          )}
        </li>
        <li>
          <strong>The first readings arrive.</strong>
          <span className="muted">Usually within minutes of the box being switched on. Until a site has sent a reading, Greecon shows it as Unknown, never as fine.</span>
        </li>
      </ol>
      <p className="muted">
        {mayAddSite ? (
          <>
            Know exactly what you have already? <Link href="/sites/new">Add a site yourself</Link>. Questions: {email}.
          </>
        ) : (
          <>Questions: {email}.</>
        )}
      </p>
    </div>
  );
}
