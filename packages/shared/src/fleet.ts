import type { GatewayContact, HealthState } from "./index";

// What Greecon's own team sees of every customer's sites at once, so that a silent box is found by
// Greecon before it is found by the customer (docs/launch/05-runbooks.md, "The morning check").

/** The box at a site, as the fleet sees it. "none" is a site with no box; "waiting" has a box that has not been installed yet. */
export type FleetBoxStatus = "none" | "waiting" | GatewayContact;

export interface FleetBox {
  status: FleetBoxStatus;
  name?: string;
  lastSeenUtc?: string;
  version?: string;
  clockSkewSeconds?: number;
  bufferDepth?: number;
  /** Devices the box reaches that did not answer in its last round of reading. */
  devicesNotAnswering: number;
}

export interface FleetRow {
  clientId: string;
  client: string;
  siteId: string;
  site: string;
  /** The worse of the site's own health and, once the site is live, its box's. */
  state: HealthState;
  /** What is wrong, worst first, one plain sentence each. */
  reasons: string[];
  lastReadingAtUtc?: string;
  box: FleetBox;
  /** When the site was commissioned. Absent while it is still being set up. */
  commissionedAtUtc?: string;
  openAlerts: { actNow: number; checkToday: number };
}

const RANK: Record<HealthState, number> = { action: 3, attention: 2, unknown: 1, stable: 0 };

/** The worse of two health states. */
export function worseState(a: HealthState, b: HealthState): HealthState {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Worst first, then by client and site, so the top of the list is the first thing to look at. */
export function orderFleet(rows: readonly FleetRow[]): FleetRow[] {
  return [...rows].sort((a, b) => RANK[b.state] - RANK[a.state] || a.client.localeCompare(b.client) || a.site.localeCompare(b.site));
}
