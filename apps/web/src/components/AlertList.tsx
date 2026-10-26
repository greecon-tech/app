import { ReactNode } from "react";
import { priorityWord } from "../lib/health";
import { Ago } from "./Ago";
import { StatusBadge } from "./StatusBadge";

export interface AlertItem {
  id: string;
  severity: string;
  title: string;
  status: string;
  siteId: string;
  suggestedAction?: string;
  createdAtUtc?: string;
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, watch: 2, info: 3 };

/** What needs a person, most serious first. Each alert says what is wrong, where, how long it has
 * stood and the first thing to do. An acknowledged alert stays: acknowledging it did not fix it.
 * `action` is what goes under an alert (the live Alerts page puts the Acknowledge button there); it is a
 * prop so that the pages the demo shares do not import a Server Action. */
export function AlertList({ alerts, siteNames, action }: { alerts: readonly AlertItem[]; siteNames: ReadonlyMap<string, string>; action?: (alert: AlertItem) => ReactNode }) {
  const ordered = [...alerts].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || Date.parse(b.createdAtUtc ?? "") - Date.parse(a.createdAtUtc ?? "")
  );
  return (
    <ul className="alert-list">
      {ordered.map((alert) => (
        <li className="alert-item" key={alert.id}>
          <div className="alert-item__head">
            <StatusBadge status={priorityWord(alert.severity)} />
            <strong>{alert.title}</strong>
          </div>
          <p className="muted">
            {[siteNames.get(alert.siteId), alert.status === "acknowledged" ? "Acknowledged, not yet cleared" : "Open"].filter(Boolean).join(" · ")}
            {alert.createdAtUtc ? <> · since <Ago iso={alert.createdAtUtc} /></> : null}
          </p>
          {alert.suggestedAction ? (
            <p>
              <strong>First: </strong>
              {alert.suggestedAction}
            </p>
          ) : null}
          {action ? action(alert) : null}
        </li>
      ))}
    </ul>
  );
}
