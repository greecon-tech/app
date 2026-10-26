import { HowAlertsReach } from "../../../components/people/HowAlertsReach";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { requirePermission } from "../../../lib/access";
import { DEMO_ROLE } from "../../../lib/api";

export const metadata = { title: "Who is told" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The list of people and the settings
// are Server Actions that need the live platform, and the demo sends nobody a message.
export default function PeoplePage() {
  requirePermission(DEMO_ROLE, "settings:manage");
  return (
    <Shell title="Who is told" subtitle="The people Greecon messages when something needs a person, in the order it tells them.">
      <Section title="In the demo">
        <p className="muted">The demo sends no messages. On the live platform this page holds the list of people, their email addresses and phone numbers, and a log of everything sent.</p>
      </Section>
      <Section title="How alerts reach people">
        <HowAlertsReach />
      </Section>
    </Shell>
  );
}
