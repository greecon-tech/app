import { DEMO_ROLE, isStaticExport } from "../lib/api";
import { Frame } from "../components/Frame";
import { UserMenu } from "../components/UserMenu";
import { roleLabel } from "../lib/roles";
import { getSession } from "../lib/session";

// What is shown while a page is being fetched (docs/28-ux-definition.md, section 5): the frame stays where it is, with the blocks the
// page will fill, so a slow connection never shows a blank screen and the bar at the foot of a phone does not vanish and come back.
export default async function Loading() {
  const session = await getSession();
  // A visitor with no session is on a public page (sign-in, request access, help, an alert link): those are light, and must not flash the app's frame.
  if (!session && !isStaticExport()) return null;
  const role = session?.user.role ?? DEMO_ROLE;
  const audience = session?.user.isPlatformAdmin && !session.user.support ? "team" : "client";

  return (
    <Frame
      audience={audience}
      role={role}
      home={audience === "team" ? "/today" : "/"}
      title={<span className="skeleton skeleton--title" aria-hidden="true" />}
      tools={<UserMenu name={session?.user.name ?? "Secure access"} role={roleLabel(role)} />}
    >
      <div className="skeleton-page" aria-busy="true">
        <p className="visually-hidden" role="status">
          Loading the page…
        </p>
        <div className="skeleton skeleton--hero" aria-hidden="true" />
        <div className="skeleton skeleton--block" aria-hidden="true" />
        <div className="skeleton skeleton--block" aria-hidden="true" />
      </div>
    </Frame>
  );
}
