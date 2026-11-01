import { alertPriorityWords } from "@greecon/shared";

/** The rules, in the words a customer's owner would use to explain them to a colleague. They are the rules the
 * platform follows (apps/api/src/notifications/plan.ts), so they are stated here once and nowhere else. */
export function HowAlertsReach({ forTeam = false }: { forTeam?: boolean }) {
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
          Pressing Acknowledge on an alert in Greecon stops it going further down the list, and tells the people who were already told who took it. So does the link in each alert message
          (&ldquo;I have seen this&rdquo;): it opens a page with one button, needs no sign-in, works for 72 hours, and is written in the account&apos;s audit log. Opening the link changes
          nothing; only the button does.
        </dd>
        <dt>Clearing</dt>
        <dd>
          When the readings no longer show an Act now alert and stay clear for fifteen minutes, the people who were told get one email to say so. If it comes
          back within those fifteen minutes it is the same alert and nobody is told twice.
        </dd>
        {forTeam ? (
          <>
            <dt>A customer&apos;s box goes silent</dt>
            <dd>
              Greecon&apos;s own team, and only the team, is told: the client, the site, since when, and the last reading. Once for each silence. By day it is sent as soon as the box has been
              silent for a quarter of an hour; in the team&apos;s quiet hours it waits in the list below, marked Waiting with the time it is due, and goes when they end. If three or more boxes
              go silent within ten minutes it is one message that says so, because that is usually Greecon&apos;s platform or a provider, not the customers. Nothing is sent to the customer by
              it. For a few minutes after the platform itself restarts nothing is called silent.
            </dd>
          </>
        ) : null}
      </dl>
      <p className="muted">
        Greecon watches the equipment and tells you. The protection built into your equipment remains the safety layer. A message that a provider has
        accepted can still be late or land in spam, which is why every person is asked to confirm a test message arrived.
      </p>
    </div>
  );
}
