import Link from "next/link";
import { GREECON_COMPANY, GREECON_PUBLIC_EMAILS, HEALTH_LABELS } from "@greecon/shared";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { isStaticExport } from "../../lib/api";
import { getSession } from "../../lib/session";

export const metadata = { title: "Help" };

// Help is public (a person who cannot sign in needs it most) and also lives inside the app, so it draws its own frame when nobody is
// signed in and the app's frame when somebody is (docs/28-ux-definition.md, section 4.1). It has no Server Action, so the demo build
// needs no twin: there, the app's frame is always right.
export default async function HelpPage() {
  const session = await getSession();
  const inApp = isStaticExport() || Boolean(session);
  const forTeam = Boolean(session?.user.isPlatformAdmin);
  const email = GREECON_PUBLIC_EMAILS[0];

  const content = <HelpContent email={email} forTeam={forTeam} />;
  if (inApp) {
    return (
      <Shell title="Help" subtitle="What things mean, what to do first, and who to call.">
        {content}
      </Shell>
    );
  }
  return (
    <main className="privacy help-public">
      <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
      <p className="eyebrow">Help</p>
      <h1>What things mean, what to do first, and who to call</h1>
      {content}
      <p>
        <Link className="standalone-link" href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}

function HelpContent({ email, forTeam }: { email: string; forTeam: boolean }) {
  return (
    <>
      <nav className="help-jump" aria-label="On this page">
        <a href="#status">What the status words mean</a>
        <a href="#alert">An alert arrived</a>
        <a href="#call">Who to call</a>
        <a href="#data">Your data</a>
        <a href="#words">Words Greecon uses</a>
        {forTeam ? <a href="#team">For Greecon&apos;s team</a> : null}
      </nav>

      <Section title="What the status words mean" id="status">
        <p className="muted">Every site, and the whole account, is always in one of these. Each has its own word and its own shape, so you never have to rely on a colour.</p>
        <dl className="help-list">
          <dt>
            <StatusBadge status={HEALTH_LABELS.stable} />
          </dt>
          <dd>Every site has sent readings recently and nothing is open against it. Nothing for you to do.</dd>
          <dt>
            <StatusBadge status={HEALTH_LABELS.attention} />
          </dt>
          <dd>A warning is open. Nothing is wrong yet, but someone should plan to look at it today or this week.</dd>
          <dt>
            <StatusBadge status={HEALTH_LABELS.action} />
          </dt>
          <dd>Something serious is open. It stays on the screen until its cause is gone, even after somebody has said they have seen it.</dd>
          <dt>
            <StatusBadge status={HEALTH_LABELS.unknown} />
          </dt>
          <dd>Greecon cannot tell. A site has never sent readings, or its readings are out of date. Silence is never counted as &ldquo;all well&rdquo;.</dd>
          <dt>
            <StatusBadge status="Simulated" />
          </dt>
          <dd>The numbers are made up, to show how Greecon looks. Real sites never show this.</dd>
        </dl>
        <p className="muted">
          Across several sites the most urgent answer wins: Action required, then Unknown, then Attention needed, then Stable. A problem at one site is never averaged away by the others.
        </p>
      </Section>

      <Section title="An alert arrived: what to do first" id="alert">
        <ol className="help-steps">
          <li>
            <strong>Read what it says, and where.</strong> The alert names the site and says what is wrong, in a sentence.
          </li>
          <li>
            <strong>Do the first thing it tells you to check.</strong> If it says <em>Act now</em> and it is safe to go there, go. If it is not, or you are not the right person, call whoever looks after
            that equipment.
          </li>
          <li>
            <strong>Press Acknowledge</strong> on the alert in <Link href="/alerts">Alerts</Link>. That tells Greecon someone has seen it, so it stops reminding the next person. Acknowledging does not
            fix anything and does not hide it: the alert stays until its cause is gone.
          </li>
          <li>
            <strong>If you cannot tell what to do</strong>, write to <a href={`mailto:${email}`}>{email}</a> and say the site&apos;s name. A person at Greecon reads it.
          </li>
        </ol>
        <h3>Who is told, and when</h3>
        <ul className="help-bullets">
          <li>
            <strong>Act now:</strong> an email at once to the first person on the list. If nobody has acknowledged after 10 minutes, a text message. After 30 minutes, the next person, by email and text.
          </li>
          <li>
            <strong>Check today:</strong> one email to the first person, held back through the night (22:00 to 07:00).
          </li>
          <li>
            <strong>For your information:</strong> shown on the screen and in the morning message, never pushed.
          </li>
          <li>
            <strong>The morning message:</strong> one email at 07:30 saying whether everything is all right.
          </li>
        </ul>
        <p className="muted">
          Greecon only reads your site. It cannot switch anything on or off, and it is not a safety system: the protection built into your equipment stays in charge.
        </p>
      </Section>

      <Section title="Who to call" id="call">
        <p>
          Write to <a href={`mailto:${email}`}>{email}</a>. Say who you are, which site, and what you see. {GREECON_COMPANY} answers on working days; for something that cannot wait, say so at the start of
          the message.
        </p>
        <p className="muted">
          If you are the account&apos;s owner and cannot sign in, write to the same address. If you are not the owner, ask the owner first: they can turn your access on again and give you a new temporary
          password.
        </p>
      </Section>

      <Section title="Your data" id="data">
        <p>
          Your readings, your alerts, your audit log and how your account is set up are yours. Download them whenever you like from <Link href="/reports">Reports</Link>, as a file that opens in a
          spreadsheet. If you ever stop using Greecon, write to <a href={`mailto:${email}`}>{email}</a> and every reading Greecon holds is sent to you, and deleted if you ask.
        </p>
        <p>
          What Greecon keeps and why is in plain words on the <Link href="/privacy">Privacy</Link> page.
        </p>
      </Section>

      <Section title="Words Greecon uses" id="words">
        <dl className="help-list help-list--words">
          <dt>Account</dt>
          <dd>Your organisation&apos;s place in Greecon: its people, its sites and its history.</dd>
          <dt>Site</dt>
          <dd>One place that Greecon watches: a hotel, a solar plant, a farm, a water tank and pump.</dd>
          <dt>Box</dt>
          <dd>The small computer Greecon installs at a site. It reads the meters and sensors and sends the readings. If it is switched off or loses the internet, it keeps the readings and sends them when it can.</dd>
          <dt>Equipment</dt>
          <dd>The meters, inverters, sensors and pumps the box reads.</dd>
          <dt>Reading</dt>
          <dd>One measured number (for example, solar power in kW) with the time it was taken. Every number on screen says how old it is.</dd>
          <dt>Alert</dt>
          <dd>Something the readings show that a person should know about. It has a priority: Act now, Check today or For your information.</dd>
          <dt>Acknowledge</dt>
          <dd>&ldquo;I have seen this.&rdquo; It stops the reminders. It does not clear the alert.</dd>
          <dt>Value</dt>
          <dd>What your own solar kept on site, and what your water costs, at your own prices, from real readings. It is never a guess about the future.</dd>
        </dl>
      </Section>

      {forTeam ? (
        <Section title="For Greecon's team" id="team">
          <ul className="help-bullets">
            <li>
              <strong>Today</strong> is the morning check: what needs a look, who has asked for Greecon, what is being set up.
            </li>
            <li>
              <strong>Clients → Open for setup</strong> takes you into a customer&apos;s account. Everything you do there is written under your name in their audit log. The banner at the top has the way back.
            </li>
            <li>
              A new site starts from <strong>Sites → Add a site</strong>; its <strong>Setup list</strong> and <strong>Handover sheet</strong> are the project manager&apos;s tools.
            </li>
            <li>
              The step-by-step guides (PDF) are in <code>docs/launch/pdf</code> in the Greecon repository: the founder&apos;s go-live, the project manager&apos;s manual and the hardware kits. The runbooks say what
              to do when an alert about the platform itself arrives.
            </li>
          </ul>
        </Section>
      ) : null}
    </>
  );
}
