import { Status } from "../lib/types";

/** A status as a word and a shape. `label` says it in other words where the standard one would mislead ("Not connected yet" for
 * equipment that has never answered, which is not the same as equipment that has gone offline); the look stays the status's own. */
export function StatusBadge({ status, label }: { status: Status | string; label?: string }) {
  const className = `status status-${normalizeStatus(status)}`;
  return <span className={className}>{label ?? status}</span>;
}

export function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}
