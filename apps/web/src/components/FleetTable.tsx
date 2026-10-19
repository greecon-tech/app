import { FleetBox, FleetRow, HEALTH_LABELS, describeAge } from "@greecon/shared";
import { Ago } from "./Ago";
import { DataTable } from "./DataTable";
import { OpenForSetupButton } from "./OpenForSetupButton";
import { StatusBadge } from "./StatusBadge";

/** What the box is doing, in a sentence, for the person who has to decide whether to call. */
function boxWords(box: FleetBox, nowMs: number): string {
  const heard = box.lastSeenUtc ? describeAge(Math.max(0, (nowMs - Date.parse(box.lastSeenUtc)) / 1000)) : undefined;
  switch (box.status) {
    case "online":
      return `Online${box.version ? `, version ${box.version}` : ""}. Heard ${heard} ago.`;
    case "late":
      return `Late. Last heard ${heard} ago.`;
    case "offline":
      return `Offline. Last heard ${heard} ago.`;
    case "never":
      return "Installed, but has never reported.";
    case "waiting":
      return "Not installed yet.";
    default:
      return "No box on this site.";
  }
}

/** Every customer's sites in one list, worst first: what Greecon's team looks at each morning, and when a customer calls. */
export function FleetTable({ rows, nowMs }: { rows: readonly FleetRow[]; nowMs: number }) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No customer has a site yet. Sites appear here as soon as they are made."
      columns={[
        {
          key: "site",
          label: "Site",
          render: (row) => (
            <>
              <strong>{row.client}</strong>
              <br />
              {row.site}
            </>
          )
        },
        { key: "state", label: "State", render: (row) => <StatusBadge status={HEALTH_LABELS[row.state]} /> },
        {
          key: "reasons",
          label: "What is wrong",
          render: (row) => (row.reasons.length === 0 ? <span className="muted">Nothing.</span> : row.reasons.slice(0, 3).join(" "))
        },
        { key: "box", label: "Box", render: (row) => boxWords(row.box, nowMs) },
        { key: "lastReadingAtUtc", label: "Last reading", render: (row) => (row.lastReadingAtUtc ? <Ago iso={row.lastReadingAtUtc} /> : <span className="muted">None yet</span>) },
        {
          key: "openAlerts",
          label: "Alerts open",
          render: (row) =>
            row.openAlerts.actNow + row.openAlerts.checkToday === 0 ? (
              <span className="muted">None</span>
            ) : (
              [row.openAlerts.actNow > 0 ? `${row.openAlerts.actNow} Act now` : "", row.openAlerts.checkToday > 0 ? `${row.openAlerts.checkToday} Check today` : ""].filter(Boolean).join(", ")
            )
        },
        {
          key: "commissionedAtUtc",
          label: "Live for",
          render: (row) => (row.commissionedAtUtc ? `Day ${Math.max(0, Math.floor((nowMs - Date.parse(row.commissionedAtUtc)) / 86_400_000)) + 1}` : <span className="muted">Being set up</span>)
        },
        { key: "clientId", label: "Open", render: (row) => <OpenForSetupButton tenantId={row.clientId} name={row.client} /> }
      ]}
    />
  );
}
