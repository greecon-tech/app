import { HEALTH_LABELS, HealthReason, TenantHealth } from "@greecon/shared";
import { LocalClock } from "./LocalClock";
import { StatusBadge } from "./StatusBadge";

/** Why a site, or the account, is not stable: one line per reason, worst first. */
export function HealthReasons({ reasons, showSite = true }: { reasons: readonly HealthReason[]; showSite?: boolean }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="health__reasons">
      {reasons.map((reason, index) => (
        <li key={`${reason.siteId}-${index}`}>
          <StatusBadge status={HEALTH_LABELS[reason.state]} />
          <span>
            {showSite && reason.siteName ? <strong>{reason.siteName}: </strong> : null}
            {reason.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The one question the product exists to answer: is everything all right? A state in a word and a
 * shape, one sentence, what it rests on and when it was worked out, and the way to see how. */
export function HealthHeadline({ health, asOfUtc, simulatedSites }: { health: TenantHealth; asOfUtc: string; simulatedSites: number }) {
  const { sites, sitesReporting } = health.coverage;
  const sitesWord = (count: number) => (count === 1 ? "site" : "sites");
  return (
    <section className={`health health--${health.state}`} aria-label="Overall status">
      <StatusBadge status={health.label} />
      <p className="health__headline" role="status">
        {health.headline}
      </p>
      <p className="health__meta">
        {`${sitesReporting} of ${sites} ${sitesWord(sites)} reporting`}
        {" · Updated "}
        <LocalClock iso={asOfUtc} />
        {simulatedSites > 0 ? ` · Includes simulated data from ${simulatedSites} ${sitesWord(simulatedSites)}` : null}
      </p>
      <details className="health__how">
        <summary>How is this calculated?</summary>
        {health.reasons.length > 0 ? (
          <>
            <p className="health__how-title">Behind this answer right now</p>
            <HealthReasons reasons={health.reasons} />
            <p className="health__how-title">The four answers</p>
          </>
        ) : null}
        <dl>
          <dt>{HEALTH_LABELS.stable}</dt>
          <dd>Every site has sent readings recently and nothing is open against it.</dd>
          <dt>{HEALTH_LABELS.attention}</dt>
          <dd>A warning is open that someone should plan for.</dd>
          <dt>{HEALTH_LABELS.action}</dt>
          <dd>A critical alert is open. It stays until its cause clears, even after someone acknowledges it.</dd>
          <dt>{HEALTH_LABELS.unknown}</dt>
          <dd>We cannot tell. A site has never sent readings, or its readings are out of date. Silence is never counted as all well.</dd>
        </dl>
        <p>
          Across all sites the most urgent state wins, in that order: {HEALTH_LABELS.action}, then {HEALTH_LABELS.unknown}, then{" "}
          {HEALTH_LABELS.attention}, then {HEALTH_LABELS.stable}. One site that cannot be checked makes the whole answer Unknown. A failure is
          never averaged away.
        </p>
      </details>
    </section>
  );
}
