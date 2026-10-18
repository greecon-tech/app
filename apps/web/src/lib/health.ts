import { HealthState } from "@greecon/shared";

const RANK: Record<HealthState, number> = { action: 0, unknown: 1, attention: 2, stable: 3 };

/** Sites that need a person first, then ones we cannot tell about, then the rest; by name within a
 * state. The same order the roll-up uses, so the list reads top to bottom as "what to look at". */
export function worstFirst<T extends { name: string; health: { state: HealthState } }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => RANK[a.health.state] - RANK[b.health.state] || a.name.localeCompare(b.name));
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
