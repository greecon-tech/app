import Link from "next/link";
import { GREECON_PUBLIC_EMAILS } from "@greecon/shared";
import { Shell } from "../components/Shell";

// One friendly page for "there is no such page" and for "your role does not open it" (a page a role may not use answers as not found, so
// its existence is not revealed): docs/28-ux-definition.md, section 5.
export default function NotFound() {
  return (
    <Shell title="Page not found" subtitle="There is nothing at this address, or your role does not open it.">
      <div className="state-card">
        <p>
          The page may have moved, or the link may be old. If you were sent here by something in Greecon, write to <a href={`mailto:${GREECON_PUBLIC_EMAILS[0]}`}>{GREECON_PUBLIC_EMAILS[0]}</a> and say
          which link it was.
        </p>
        <p>
          <Link href="/" className="button-primary">
            Go to the start
          </Link>
        </p>
      </div>
    </Shell>
  );
}
