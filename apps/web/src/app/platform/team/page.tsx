import { StaffMember } from "@greecon/shared";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { TeamMembers } from "../../../components/TeamMembers";
import { requirePlatformAdmin } from "../../../lib/access";
import { apiGet } from "../../../lib/api";
import { getSession } from "../../../lib/session";

export const metadata = { title: "Team" };

// Who in Greecon may open customers' accounts (docs/28-ux-definition.md, section 4.2). Everyone on the team sees the list; only the
// owner of Greecon's own account adds, turns off or resets (the API enforces it). Only for a real logged-in platform-administrator
// session; see team/page.static.tsx.
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const team = await apiGet<StaffMember[]>("/platform-admin/staff");
  return (
    <Shell title="Team" subtitle="The people at Greecon who can open a customer's account.">
      <Section title="Greecon team" aside={<span className="muted">{team.length} {team.length === 1 ? "person" : "people"}</span>}>
        <TeamMembers members={team} canChange={session?.user.role === "owner"} />
      </Section>
    </Shell>
  );
}
