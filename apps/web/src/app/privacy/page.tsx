import Link from "next/link";
import { GREECON_COMPANY, GREECON_PUBLIC_EMAILS } from "@greecon/shared";

export const metadata = { title: "Privacy" };

// Public, like the sign-in page: the people whose details Greecon keeps should be able to read what it keeps without an account.
// A plain statement of what the platform does today, written to be true of it; a lawyer reads it before the first customer signs
// (docs/launch/04-sales-kit.md), and it changes when the platform does.
export default function PrivacyPage() {
  const email = GREECON_PUBLIC_EMAILS[0];
  return (
    <main className="privacy">
      <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
      <p className="eyebrow">Privacy</p>
      <h1>What Greecon keeps about you, and why</h1>
      <p>
        This is {GREECON_COMPANY}, Durana Tech Park, Albania. For anything about your data, write to <a href={`mailto:${email}`}>{email}</a>.
      </p>

      <h2>What Greecon keeps</h2>
      <ul>
        <li>
          <strong>People who sign in:</strong> name, email address and role. The password is kept only in a scrambled form that cannot be read back. This lets you in, and records who did what.
        </li>
        <li>
          <strong>People to be told:</strong> the names, email addresses and mobile numbers that your account lists to receive alerts. This is so that messages can be sent to them.
        </li>
        <li>
          <strong>Readings:</strong> what your meters and sensors measure, and the alerts made from them. This is to show you your site and tell you when it needs attention.
        </li>
        <li>
          <strong>A record of actions:</strong> who changed what and when, including each time Greecon staff open your account to set it up, under their own name. This is to keep an honest record.
        </li>
        <li>
          <strong>Messages sent:</strong> which message went to whom, when, and what the email or text service answered. This is to show you what was sent.
        </li>
        <li>
          <strong>Requests for access:</strong> the name, company, email address, telephone number, kind of site and message you give on the Request access page. This is to answer you.
        </li>
      </ul>

      <h2>Who sees it</h2>
      <p>
        The people in your own account, by the roles it gives them. Greecon&apos;s team opens your account to set it up or to help, and each time is written in your audit log under their own name. Its team can
        also see, without opening it, how your sites stand (state, alerts, box status, last reading) and who has a login. No other customer sees any of it.
      </p>

      <h2>Who handles it for Greecon</h2>
      <p>
        Greecon uses a hosting service to run the platform and its database, an email service to send email, and a text-message service to send texts. They handle the data only to do that job. Greecon
        will give you their names on request.
      </p>

      <h2>How long, and how to leave</h2>
      <p>
        Readings and records are kept while you are a customer. You can download, whenever you like, from <strong>Reports</strong>: every reading for the last 31 days, hourly averages for up to a year, your
        alerts, your audit log and how your account is set up. If you stop, Greecon also gives you every reading it holds, as a file, on request. When you have your copy, you can ask in writing for your
        account and everything in it to be deleted. Copies in backups disappear when the backups expire, which is within weeks.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, download or delete your data by writing to <a href={`mailto:${email}`}>{email}</a>. You may also complain to the Albanian data protection authority.
      </p>

      <h2>Cookies</h2>
      <p>Greecon sets only the cookies it needs to keep you signed in. It sets no advertising or tracking cookies and uses no tracking services.</p>

      <h2>Security</h2>
      <p>
        If you find a security problem, please write to <a href={`mailto:${email}`}>{email}</a>. We will answer within two working days and will not hold it against you.
      </p>

      <p className="muted">
        This page is a plain summary of what the platform does today. It does not replace the agreement between you and Greecon, and it changes as the platform does. Last changed 19 October 2026.
      </p>
      <p>
        <Link className="standalone-link" href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
