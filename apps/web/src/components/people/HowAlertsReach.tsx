import { alertPriorityWords } from "@greecon/shared";

/** The rules, in the words a customer's owner would use to explain them to a colleague. They are the rules the
 * platform follows (apps/api/src/notifications/plan.ts), so they are stated here once and nowhere else. */
export function HowAlertsReach() {
  return (
    <div className="stack">
      <dl className="people-rules">
        <dt>{alertPriorityWords.act_now}</dt>
        <dd>
          The first person on the list gets an email at once and a text message ten minutes later if nobody has acknowledged the alert. If it is still not
          acknowledged thirty minutes after it began, the next person gets an email and a text, and so on down the list. Quiet hours do not hold it back.
        </dd>
        <dt>{alertPriorityWords.check_today}</dt>
        <dd>One email, to the first person who has an email address. During quiet hours it waits until they end. No text message.</dd>
        <dt>{alertPriorityWords.fyi}</dt>
        <dd>Never sent on its own. It appears in Greecon and in the morning message.</dd>
        <dt>Acknowledging</dt>
        <dd>
          Pressing Acknowledge on an alert in Greecon stops it going further down the list, and tells the people who were already told who took it.
        </dd>
        <dt>Clearing</dt>
        <dd>
          When the readings no longer show an Act now alert and stay clear for fifteen minutes, the people who were told get one email to say so. If it comes
          back within those fifteen minutes it is the same alert and nobody is told twice.
        </dd>
      </dl>
      <p className="muted">
        Greecon watches the equipment and tells you. The protection built into your equipment remains the safety layer. A message that a provider has
        accepted can still be late or land in spam, which is why every person is asked to confirm a test message arrived.
      </p>
    </div>
  );
}
