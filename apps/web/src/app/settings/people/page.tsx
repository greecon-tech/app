import type { NotificationContact, NotificationLogEntry, NotificationSettings, NotificationStatusView } from "@greecon/shared";
import { HowAlertsReach } from "../../../components/people/HowAlertsReach";
import { ContactsForm } from "../../../components/people/ContactsForm";
import { MessageLog } from "../../../components/people/MessageLog";
import { SettingsForm } from "../../../components/people/SettingsForm";
import { LiveRefresh } from "../../../components/LiveRefresh";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { StatusBadge } from "../../../components/StatusBadge";
import { requirePermission } from "../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../lib/api";
import { getSession } from "../../../lib/session";

// The forms are Server Actions, so this page is rendered on request (page.static.tsx is the GitHub Pages copy).
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await getSession();
  requirePermission(session?.user.role ?? DEMO_ROLE, "settings:manage");
  const [status, contacts, settings, log] = await Promise.all([
    apiGet<NotificationStatusView>("/notifications/status"),
    apiGet<NotificationContact[]>("/notifications/contacts"),
    apiGet<NotificationSettings>("/notifications/settings"),
    apiGet<NotificationLogEntry[]>("/notifications/log?limit=40")
  ]);
  const canSend = status.email.configured || status.sms.configured;

  return (
    <Shell title="Who is told" subtitle="The people Greecon messages when something needs a person, in the order it tells them.">
      <LiveRefresh everySeconds={30} />
      <Section title="Can Greecon send messages?" aside={<StatusBadge status={canSend ? "On" : "Off"} />}>
        <div className="setup-guidance">
          {status.words.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Section>
      <Section title="People">
        <ContactsForm initial={contacts} />
      </Section>
      <Section title="Quiet hours and the morning message">
        <SettingsForm initial={settings} />
      </Section>
      <Section title="How alerts reach people">
        <HowAlertsReach />
      </Section>
      <Section title="What was sent">
        <MessageLog entries={log} />
      </Section>
    </Shell>
  );
}
