import type { NotificationLogEntry } from "@greecon/shared";
import { KIND_WORDS, SEND_STATUS_WORDS } from "../../lib/people";
import { Ago } from "../Ago";
import { DataTable } from "../DataTable";
import { StatusBadge } from "../StatusBadge";

/** What was sent, to whom, and what became of it: every message that was, or was meant to be, sent. */
export function MessageLog({ entries }: { entries: NotificationLogEntry[] }) {
  return (
    <DataTable
      rows={entries}
      emptyLabel="Nothing has been sent yet. Messages appear here the moment they are planned, whether or not they could be sent."
      columns={[
        { key: "createdAtUtc", label: "When", render: (row) => (row.status === "planned" ? `due ${row.dueAtUtc.slice(11, 16)} UTC` : <Ago iso={row.sentAtUtc ?? row.createdAtUtc} />) },
        { key: "kind", label: "What", render: (row) => KIND_WORDS[row.kind] },
        { key: "contactName", label: "To", render: (row) => (row.destination ? `${row.contactName}, ${row.destination}` : row.contactName) },
        { key: "channel", label: "By", render: (row) => (row.channel === "email" ? "Email" : "Text message") },
        { key: "status", label: "Result", render: (row) => <StatusBadge status={SEND_STATUS_WORDS[row.status]} /> },
        { key: "error", label: "Why", render: (row) => row.error ?? (row.subject ? row.subject : "") }
      ]}
    />
  );
}
