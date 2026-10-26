import { describeAge, FleetBox } from "@greecon/shared";

/** What the box is doing, in a sentence, for the person who has to decide whether to call. */
export function boxWords(box: FleetBox, nowMs: number): string {
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

/** "Day 1" is the day a site was commissioned; the pilot's goals are measured over its first days (docs/launch/04-sales-kit.md). */
export function liveDay(commissionedAtUtc: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(commissionedAtUtc)) / 86_400_000)) + 1;
}
