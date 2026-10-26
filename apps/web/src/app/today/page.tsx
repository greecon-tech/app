import Link from "next/link";
import { AccessRequest, FleetRow, HEALTH_LABELS, HealthState, orderFleet, requestedSiteTypeLabels, worseState } from "@greecon/shared";
import { Ago } from "../../components/Ago";
import { LocalClock } from "../../components/LocalClock";
import { OpenForSetupButton } from "../../components/OpenForSetupButton";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { StatusBadge } from "../../components/StatusBadge";
import { requirePlatformAdmin } from "../../lib/access";
import { apiGet } from "../../lib/api";
import { boxWords, liveDay } from "../../lib/fleet-words";
import { getSession } from "../../lib/session";

export const metadata = { title: "Today" };

// Greecon's team starts here (docs/28-ux-definition.md, section 4.2): is every customer all right, and what is there to do today?
// The answer first, then what needs a look (worst first), who has asked for Greecon, and what is still being set up.
// Only reachable by a real logged-in platform-administrator session; see today/page.static.tsx for the static twin.
export const dynamic = "force-dynamic";

const sitesWord = (count: number) => (count === 1 ? "site" : "sites");

/** A reason is one sentence, but not every one the platform writes ends with a full stop; a few joined together must still read as sentences. */
const asSentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

export default async function TodayPage() {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const [fleet, requests] = await Promise.all([apiGet<FleetRow[]>("/platform-admin/fleet"), apiGet<AccessRequest[]>("/platform-admin/access-requests")]);
  const nowMs = Date.now();
  const rows = orderFleet(fleet);
  const live = rows.filter((row) => row.commissionedAtUtc);
  const settingUp = rows.filter((row) => !row.commissionedAtUtc);
  const needLook = live.filter((row) => row.state !== "stable");
  const fine = live.filter((row) => row.state === "stable");
  const waiting = requests.filter((request) => request.status === "new" || request.status === "contacted");

  const worst: HealthState = needLook.reduce<HealthState>((state, row) => worseState(state, row.state), "stable");
  const state: HealthState = live.length === 0 ? "unknown" : worst;
  const headline =
    live.length === 0
      ? "No customer site is live yet."
      : needLook.length === 0
        ? `${live.length === 1 ? "The site is" : `All ${live.length} sites are`} fine.`
        : `${needLook.length} of ${live.length} ${sitesWord(live.length)} ${needLook.length === 1 ? "needs" : "need"} a look.`;

  return (
    <Shell title="Today" subtitle="Is every customer all right, and what is there to do?">
      <section className={`health health--${state}`} aria-label="Overall status">
        <StatusBadge status={live.length === 0 ? "Nothing live" : HEALTH_LABELS[state]} />
        <p className="health__headline" role="status">
          {headline}
        </p>
        <p className="health__meta">
          {`${live.length} ${sitesWord(live.length)} live · ${settingUp.length} being set up · ${waiting.length} ${waiting.length === 1 ? "request" : "requests"} waiting · Updated `}
          <LocalClock iso={new Date(nowMs).toISOString()} />
        </p>
      </section>

      {needLook.length > 0 ? (
        <Section title="Needs a look" aside={<span className="muted">Worst first</span>}>
          <ul className="today-list">
            {needLook.map((row) => (
              <li key={row.siteId} className="today-item">
                <div className="today-item__main">
                  <p className="today-item__title">
                    {row.client}
                    <span className="muted"> · {row.site}</span>
                  </p>
                  <p>
                    <StatusBadge status={HEALTH_LABELS[row.state]} />
                  </p>
                  <p>
                    {row.reasons.length === 0 ? "Nothing to say beyond the state." : row.reasons.slice(0, 3).map(asSentence).join(" ")}
                    {row.reasons.length > 3 ? ` And ${row.reasons.length - 3} more.` : ""}
                  </p>
                  <p className="today-item__meta">
                    {row.commissionedAtUtc ? `Day ${liveDay(row.commissionedAtUtc, nowMs)}. ` : ""}
                    {boxWords(row.box, nowMs)} Last reading {row.lastReadingAtUtc ? <Ago iso={row.lastReadingAtUtc} /> : "none yet"}.
                    {row.openAlerts.actNow + row.openAlerts.checkToday > 0
                      ? ` Open: ${[row.openAlerts.actNow > 0 ? `${row.openAlerts.actNow} Act now` : "", row.openAlerts.checkToday > 0 ? `${row.openAlerts.checkToday} Check today` : ""].filter(Boolean).join(", ")}.`
                      : ""}
                  </p>
                </div>
                <OpenForSetupButton tenantId={row.clientId} name={row.client} label="Open account" primary />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="Requests waiting"
        aside={
          <Link href="/platform/requests" className="button-ghost">
            All requests
          </Link>
        }
      >
        {waiting.length === 0 ? (
          <div className="empty-state">No one is waiting. A request made on the sign-in page appears here, and as a message to the team.</div>
        ) : (
          <ul className="today-list">
            {waiting.slice(0, 3).map((request) => (
              <li key={request.id} className="today-item">
                <div className="today-item__main">
                  <p className="today-item__title">
                    {request.company}
                    <span className="muted"> · {request.name}</span>
                  </p>
                  <p className="today-item__meta">
                    {requestedSiteTypeLabels[request.siteType]} · {request.status === "new" ? "New" : "Contacted"} · <Ago iso={request.createdAtUtc} />
                  </p>
                </div>
                <Link href={`/platform?onboard=${request.id}#onboard`} className="button-primary">
                  Onboard
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {settingUp.length > 0 ? (
        <Section title="Being set up">
          <ul className="today-list">
            {settingUp.map((row) => (
              <li key={row.siteId} className="today-item">
                <div className="today-item__main">
                  <p className="today-item__title">
                    {row.client}
                    <span className="muted"> · {row.site}</span>
                  </p>
                  <p className="today-item__meta">Not commissioned yet. {boxWords(row.box, nowMs)}</p>
                </div>
                <OpenForSetupButton tenantId={row.clientId} name={row.client} label="Continue setup" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {fine.length > 0 ? (
        <details className="panel today-fine">
          <summary>
            {fine.length} {sitesWord(fine.length)} {fine.length === 1 ? "is" : "are"} fine
          </summary>
          <ul className="today-fine__list">
            {fine.map((row) => (
              <li key={row.siteId}>
                <strong>{row.client}</strong> · {row.site}. {row.commissionedAtUtc ? `Day ${liveDay(row.commissionedAtUtc, nowMs)}. ` : ""}{boxWords(row.box, nowMs)} Last reading {row.lastReadingAtUtc ? <Ago iso={row.lastReadingAtUtc} /> : "none yet"}.
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {rows.length === 0 && waiting.length === 0 ? (
        <Section title="Start here">
          <div className="empty-state">
            No customer has a site yet.{" "}
            <Link href="/platform?onboard=new#onboard" className="button-primary">
              Onboard a client
            </Link>
          </div>
        </Section>
      ) : null}
    </Shell>
  );
}
