import Link from "next/link";
import { ReactNode } from "react";
import { SiteValue } from "@greecon/shared";
import { formatMoney, formatQuantity, periodOptions, valueHeadline, valueMetrics } from "../lib/value";
import { MetricGrid } from "./MetricGrid";
import { StatusBadge } from "./StatusBadge";

/** What this site's own readings are worth, at the prices the site entered. Leads with one sentence,
 * keeps the figures under it and the working one click further: the same pattern as everywhere.
 * Holds nothing that can change a price, so the static demo can show it too; the form is added by
 * ValueSection, which only the live app uses. */
export function ValueView({
  value,
  periodHref,
  canEdit,
  children
}: {
  value: SiteValue;
  /** Builds the link for a period. Absent in the static demo, which shows one period. */
  periodHref?: (period: string) => string;
  /** Whether the person looking can enter prices; decides what a missing price says. */
  canEdit?: boolean;
  children?: ReactNode;
}) {
  const metrics = valueMetrics(value);
  const comparisons = [value.comparison?.energy, value.comparison?.water].filter((item) => item !== undefined);
  const since = value.coverage.dataStartUtc ? new Intl.DateTimeFormat("en-GB", { timeZone: value.timezone, day: "numeric", month: "short" }).format(new Date(value.coverage.dataStartUtc)) : undefined;

  return (
    <div className="value">
      <p className="value__headline">
        {valueHeadline(value)}
        {value.simulated ? <StatusBadge status="Simulated" /> : null}
      </p>

      {periodHref ? (
        <nav className="value__periods" aria-label="Period">
          {periodOptions.map((option) => (
            <Link key={option.key} href={periodHref(option.key)} aria-current={option.key === value.period.key ? "true" : undefined} scroll={false}>
              {option.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {metrics.length > 0 ? <MetricGrid metrics={metrics} /> : null}

      {comparisons.map((comparison, index) =>
        comparison.available ? (
          <p key={index} className="value__comparison">
            <strong>Compared with a typical month before:</strong>{" "}
            {comparison.differenceAmount >= 0 ? "less" : "more"} by {formatQuantity(Math.abs(comparison.differenceAmount))} {comparison.unit} (
            {comparison.differencePercent >= 0 ? "−" : "+"}
            {formatQuantity(Math.abs(comparison.differencePercent))}%)
            {comparison.differenceValue !== undefined ? `, about ${formatMoney(Math.abs(comparison.differenceValue), value.currency)}` : ""}. Before: {formatQuantity(comparison.baselineAmount)}{" "}
            {comparison.unit}; now: {formatQuantity(comparison.actualAmount)} {comparison.unit}.
          </p>
        ) : (
          <p key={index} className="muted">
            {comparison.reason}
          </p>
        )
      )}

      {metrics.length > 0 ? (
        <p className="muted">
          Readings were there for {Math.round(value.coverage.sinceDataStart * 100)}% of the time{since ? ` since ${since}` : ""}.
        </p>
      ) : null}

      {value.missing.length > 0 ? (
        <ul className="value__missing">
          {value.missing.map((item) => (
            <li key={item.what}>
              <strong>{item.what}.</strong> {canEdit ? item.how : "Ask an owner or an administrator of the account to enter it."}
            </li>
          ))}
        </ul>
      ) : null}

      {value.assumptions.length > 0 ? (
        <details className="value__how">
          <summary>How this is worked out</summary>
          <ul>
            {value.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {children}
    </div>
  );
}

/** The account's value this month, for the Overview: one sentence per site that measures anything. */
export function ValueSummary({ entries }: { entries: Array<{ siteId: string; siteName: string; value: SiteValue }> }) {
  const several = entries.length > 1;
  return (
    <div className="panel value-summary">
      {entries.map((entry) => (
        <p key={entry.siteId} className="value__headline">
          {several ? <strong>{entry.siteName}. </strong> : null}
          {valueHeadline(entry.value)}
          {entry.value.simulated ? <StatusBadge status="Simulated" /> : null}
          <Link href={`/sites/${entry.siteId}#value`} className="value-summary__more">
            Details<span className="visually-hidden"> of {entry.siteName}</span> →
          </Link>
        </p>
      ))}
    </div>
  );
}
