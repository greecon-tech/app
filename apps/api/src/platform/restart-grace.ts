// A calm restart. When the platform itself has been down (a deploy, a crash, a database outage), every box's last word
// is older than usual for a few minutes because the platform was not listening, not because the boxes are silent. They
// keep what they read and send it when they reconnect (about three days of it), so nothing is lost: they only need a
// moment. Until they have had it, nothing that comes from MISSING data (a silent box, a reading out of date) is raised
// or messaged. What comes from a MEASURED value (a tank that is critical, a pump running dry) is never held back: a
// reading that arrives in the first second after a start is judged, and alerted on, at once.

/** How long after it starts listening the platform waits before it calls anything silent (RESTART_GRACE_MINUTES). */
export const RESTART_GRACE_MS = 10 * 60_000;

/** What the screens say, while the grace lasts, in place of "out of date" or "offline". */
export const RECONNECTING = "Greecon was just restarted; boxes are reconnecting.";

/** When the platform started listening, and how long its grace lasts from then. */
export interface Listening {
  sinceMs: number;
  graceMs: number;
}

/** Whether `nowMs` is inside the grace window that follows a start. */
export function inRestartGrace(listening: Listening | undefined, nowMs: number): boolean {
  return listening !== undefined && nowMs < listening.sinceMs + listening.graceMs;
}

/** When the silence the platform could have heard began: the later of the last word from a box or a reading and the
 * moment the platform started listening. The time the platform itself was away is not counted against a box. */
export function heardSilenceSince(lastHeardMs: number, listening: Listening | undefined): number {
  return listening === undefined ? lastHeardMs : Math.max(lastHeardMs, listening.sinceMs);
}
