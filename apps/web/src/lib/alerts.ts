export interface AlertRow {
  id: string;
  severity: string;
  title: string;
  status: string;
  siteId?: string;
  suggestedAction: string;
  createdAtUtc?: string;
  resolvedAtUtc?: string;
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, watch: 2, info: 3 };

/** Alerts still standing, most serious first and newest first within a level; and the most recently
 * cleared ones, kept as a log so "it went away" can be seen and checked. */
export function partitionAlerts<T extends AlertRow>(alerts: readonly T[], clearedLimit = 20): { active: T[]; cleared: T[] } {
  const time = (value: string | undefined) => (value ? Date.parse(value) : 0);
  const active = alerts
    .filter((alert) => alert.status !== "resolved")
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || time(b.createdAtUtc) - time(a.createdAtUtc));
  const cleared = alerts
    .filter((alert) => alert.status === "resolved")
    .sort((a, b) => time(b.resolvedAtUtc) - time(a.resolvedAtUtc))
    .slice(0, clearedLimit);
  return { active, cleared };
}
