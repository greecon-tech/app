import { ReactNode } from "react";

export type Status = "OK" | "Watch" | "Warning" | "Critical" | "Offline" | "Simulated" | "Manual Override" | "Unknown";

export interface Metric {
  label: string;
  value: string;
  unit?: string;
  /** A word shown beside the value only when there is something to say: "Out of date", "Warning",
   * "Critical". Absent means nothing is wrong, and no "OK" is claimed. */
  status?: Status | string;
  /** Where the value came from and how old it is. Never a claim about whether it is good. */
  note: ReactNode;
  /** The value is the last one received, not a current one: drawn quieter so it cannot pass for live. */
  stale?: boolean;
  /** Display size on the Overview grid — set from a saved dashboard preference
   * (lib/dashboard-preferences.ts); omitted means the default medium size. */
  size?: "small" | "medium" | "large";
}
