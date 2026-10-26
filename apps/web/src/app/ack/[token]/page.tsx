import Link from "next/link";
import { GREECON_PUBLIC_EMAILS } from "@greecon/shared";
import { AcknowledgeByLinkForm } from "../../../components/AcknowledgeByLinkForm";
import { StatusBadge } from "../../../components/StatusBadge";
import { lookUpAckLink } from "../../../lib/ack-link";
import { priorityWord } from "../../../lib/health";
import { visitorHeaders } from "../../../lib/visitor";

export const metadata = { title: "Have you seen this alert?" };
// Never a stored page: it says what is true of the alert now.
export const dynamic = "force-dynamic";

const KNOWN_SEVERITIES = ["critical", "warning", "watch", "info"];

/** The page a message's "I have seen this" link opens. Public: whoever has the link may answer for this one alert, from a phone, without
 * signing in. Opening the page changes nothing; pressing the button does. */
export default async function AcknowledgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await lookUpAckLink(token, await visitorHeaders());
  const email = GREECON_PUBLIC_EMAILS[0];
  const alert = view.valid ? view.alert : undefined;

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Alert">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        {alert ? (
          <>
            <div>
              <p className="eyebrow">Alert at {alert.siteName}</p>
              <h1>{alert.state === "open" ? "Have you seen this?" : alert.state === "acknowledged" ? "Already acknowledged" : "This alert has cleared"}</h1>
            </div>
            <div className="alert-item">
              <div className="alert-item__head">
                <StatusBadge status={KNOWN_SEVERITIES.includes(alert.priority) ? priorityWord(alert.priority) : alert.priority} />
                <strong>{alert.title}</strong>
              </div>
              <p className="muted">{alert.siteName}</p>
            </div>
            {alert.state === "open" ? (
              <>
                <AcknowledgeByLinkForm token={token} />
                <p className="muted">
                  Pressing the button tells Greecon that someone has seen this, so it stops reminding the next person. It does not fix anything, and the alert stays open until its cause is
                  gone.
                </p>
              </>
            ) : alert.state === "acknowledged" ? (
              <p>Someone has already said they have seen it. Nothing more to do here.</p>
            ) : (
              <p>Whatever caused it is over. Nothing more to do.</p>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="eyebrow">Alert link</p>
              <h1>This link no longer works</h1>
            </div>
            <p>It may have expired, or the alert may be gone. Sign in to see what is open now, or write to Greecon.</p>
            <p>
              <Link href="/login" className="button-primary">
                Sign in
              </Link>
            </p>
            <p className="muted">
              Questions: <a href={`mailto:${email}`}>{email}</a>
            </p>
          </>
        )}
        <p className="muted">
          <Link href="/help">Help</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </section>
    </main>
  );
}
