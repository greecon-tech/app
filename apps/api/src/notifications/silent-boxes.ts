import { GATEWAY_LATE_WITHIN_SECONDS } from "@greecon/shared";

// Telling Greecon's own team at once when a customer's box goes silent, so that the team hears of it before the customer
// does and not only in the next morning's message. Silent is what the fleet calls "offline": a box not heard from for
// longer than GATEWAY_LATE_WITHIN_SECONDS (shared/setup.ts), counted only from when the platform could hear it
// (platform/restart-grace.ts). One message for each silence: a box that stays silent is not told again, even across a
// restart, because its last word names the silence; one that reports and later goes silent again is a new silence. Many
// boxes going silent together is one message about them all. Pure: the service plans and sends what this decides.

/** A box at a customer's live (commissioned) site that has stopped reporting. */
export interface QuietBox {
  tenantId: string;
  client: string;
  siteId: string;
  site: string;
  gatewayId: string;
  box: string;
  /** "late": not heard from for a couple of minutes. "offline": silent, as the fleet says it. */
  status: "late" | "offline";
  /** Its last word: when this silence began. */
  lastSeenUtc: string;
  /** When the silence began as far as the platform could hear it: the last word, or the moment the platform started listening. */
  silentSinceMs: number;
  /** The newest reading from the site, if it has any. */
  lastReadingAtUtc?: string;
  /** The customer's own standing alerts that the site's readings are out of date: what says whether the customer was told. */
  outOfDateAlertIds: string[];
}

/** This many boxes going silent within STORM_WINDOW_MS of each other is one message, not one each: that many customers do
 * not lose their power or their internet in the same ten minutes; Greecon's platform, or a provider they share, does. */
export const STORM_BOXES = 3;
export const STORM_WINDOW_MS = 10 * 60_000;
/** A box that has just gone silent waits this long, at most, for others that stopped at the same moment and are only late
 * yet, so that one outage is one message and not a message and then another. In an outage they all stop within a heartbeat
 * (30 seconds) of each other; a box going silent on its own, with nobody else late, is told at once. */
export const STORM_SETTLE_MS = 2 * 60_000;
/** A box silent for longer than this is not newly silent: the fleet and the morning message already say so. */
export const NEWLY_SILENT_WITHIN_MS = 24 * 3_600_000;

const OFFLINE_AFTER_MS = GATEWAY_LATE_WITHIN_SECONDS * 1_000;

/** The key of one silence of one box. Its last word names the silence, so the same silence is told once, whatever restarts. */
export function silenceKey(box: Pick<QuietBox, "gatewayId" | "lastSeenUtc">): string {
  return `box-silent:${box.gatewayId}:${Date.parse(box.lastSeenUtc)}`;
}

/** The key of the message to one person about several boxes told together, named after the first of them. */
export function togetherKey(first: Pick<QuietBox, "gatewayId" | "lastSeenUtc">, contactId: string): string {
  return `boxes-silent:${first.gatewayId}:${Date.parse(first.lastSeenUtc)}:${contactId}`;
}

/** Whether a key is that of a message about several boxes told together. */
export function isTogetherKey(key: string): boolean {
  return key.startsWith("boxes-silent:");
}

/** The box and the silence a key names, from silenceKey or a message keyed after it. */
export function silenceOfKey(key: string): { gatewayId: string; lastSeenMs: number } | undefined {
  const found = /^box(?:es)?-silent:([0-9a-f-]{36}):(\d+)(?::|$)/i.exec(key);
  return found ? { gatewayId: (found[1] as string).toLowerCase(), lastSeenMs: Number(found[2]) } : undefined;
}

/** What to say now: each box alone, or many as one message. */
export type SilenceToTell = { together: false; boxes: [QuietBox] } | { together: true; boxes: QuietBox[] };

/** Of the boxes that have newly gone silent and that nobody has been told about, what to tell now: those whose silence began
 * within STORM_WINDOW_MS of each other are one group, told as one message when there are STORM_BOXES or more, and each on its
 * own otherwise. A group that may be about to grow (another box stopped at the same moment and is only late yet) waits, for
 * STORM_SETTLE_MS at most, whatever its size. `quiet` is every box that has stopped reporting, late or silent. */
export function silencesToTell(untold: readonly QuietBox[], quiet: readonly QuietBox[], nowMs: number): SilenceToTell[] {
  const groups: QuietBox[][] = [];
  for (const box of [...untold].sort((a, b) => a.silentSinceMs - b.silentSinceMs)) {
    const group = groups[groups.length - 1];
    if (group && box.silentSinceMs - (group[0] as QuietBox).silentSinceMs <= STORM_WINDOW_MS) group.push(box);
    else groups.push([box]);
  }
  return groups.flatMap((group): SilenceToTell[] => {
    // Even a group already big enough waits for the others still catching up, or they would be told as a message of their own.
    if (mayStillGrow(group, quiet, nowMs)) return [];
    if (group.length >= STORM_BOXES) return [{ together: true, boxes: group }];
    return group.map((box) => ({ together: false, boxes: [box] }));
  });
}

/** Whether another box stopped at about the same moment as this group and will be silent within the settling time. */
function mayStillGrow(group: readonly QuietBox[], quiet: readonly QuietBox[], nowMs: number): boolean {
  const began = (group[0] as QuietBox).silentSinceMs;
  if (nowMs - (began + OFFLINE_AFTER_MS) >= STORM_SETTLE_MS) return false;
  return quiet.some((box) => box.status === "late" && box.silentSinceMs - began <= STORM_SETTLE_MS);
}
