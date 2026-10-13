import { AlertMessage, CanonicalPointName, SeverityLevel, StateKey, StatusLabel } from "@greecon/shared";

// The answer to "is everything all right?", for one site and for a whole account. Pure: it is given
// facts (how many readings are current, whether the site has gone quiet, which alerts stand) and says
// what they add up to. Nothing here reads a clock or a database.
//
// Four states, each with its own word, so it never relies on colour (docs/20-design-and-interaction.md):
//
//   stable     every site is reporting current readings and nothing is open
//   attention  something is drifting that someone should plan for (a warning or watch alert)
//   action     something needs a person now (a critical alert, acknowledged or not)
//   unknown    we cannot tell: no readings, or the readings are out of date
//
// "Unknown" is a first-class answer, not a shade of "stable". A site that has gone quiet is not a
// site that is fine. And a failure is never averaged away: one site out of ten that cannot be
// verified makes the account "unknown", not "mostly stable".

export type HealthState = "stable" | "attention" | "action" | "unknown";

export const HEALTH_LABELS: Readonly<Record<HealthState, string>> = {
  stable: "Stable",
  attention: "Attention needed",
  action: "Action required",
  unknown: "Unknown"
};

/** Worst first. When states differ, the one nearest the front wins. */
const HEALTH_PRECEDENCE: ReadonlyArray<HealthState> = ["action", "unknown", "attention", "stable"];

export interface HealthReason {
  state: Exclude<HealthState, "stable">;
  /** One plain sentence: what is wrong. */
  message: string;
  /** How serious the alert behind this reason is. Absent for "we cannot tell" reasons, which are
   * not alerts. */
  severity?: SeverityLevel;
  siteId: string;
  siteName: string;
}

export interface SiteHealthInput {
  siteId: string;
  siteName: string;
  /** How many readings from this site are current (not out of date). Zero means we have nothing
   * to base an "all is well" on. */
  readingCount: number;
  /** True when readings that should be arriving are out of date. */
  communicationProblem: boolean;
  /** What exactly is out of date, in a sentence ("2 readings are out of date; the oldest was taken
   * 5 hours ago."). Used as the reason when given. */
  communicationDetail?: string;
  /** The site's alerts. Resolved ones are ignored. */
  alerts: ReadonlyArray<{
    severity: SeverityLevel;
    title: string;
    category?: AlertMessage["category"];
    status: "open" | "acknowledged" | "resolved" | string;
  }>;
}

export interface SiteHealth {
  siteId: string;
  siteName: string;
  state: HealthState;
  /** Why the site is not stable. Empty only when it is. Worst first. */
  reasons: HealthReason[];
}

const rank = (state: HealthState): number => HEALTH_PRECEDENCE.indexOf(state);

function worst(states: ReadonlyArray<HealthState>): HealthState {
  return states.reduce<HealthState>((current, state) => (rank(state) < rank(current) ? state : current), "stable");
}

export function assessSiteHealth(input: SiteHealthInput): SiteHealth {
  const reasons: HealthReason[] = [];
  const reason = (state: HealthReason["state"], message: string, severity?: SeverityLevel) =>
    reasons.push({ state, message, severity, siteId: input.siteId, siteName: input.siteName });

  // When the site is reported as quiet, the "out of date" alert is the same fact as the
  // communication reason below: say it once. When it is not, the alert is the only thing saying so
  // and must count like any other.
  const standing = input.alerts.filter(
    (alert) => alert.status !== "resolved" && !(input.communicationProblem && alert.category === "communication_degraded")
  );

  for (const alert of standing) {
    if (alert.severity === "critical") reason("action", alert.title, alert.severity);
  }

  if (input.readingCount === 0) reason("unknown", "No readings have been received from this site yet.");
  else if (input.communicationProblem) {
    reason("unknown", input.communicationDetail ?? "Readings from this site are out of date, so its current state is not known.");
  }

  for (const alert of standing) {
    if (alert.severity === "warning" || alert.severity === "watch") reason("attention", alert.title, alert.severity);
  }

  const state = worst(reasons.map((item) => item.state));
  return { siteId: input.siteId, siteName: input.siteName, state, reasons };
}

/** The older seven-word status vocabulary (OK, Watch, Warning, Critical, ...), for screens and
 * stored records that predate the four health states. */
export function statusLabelFor(health: SiteHealth): StatusLabel {
  switch (health.state) {
    case "action":
      return "Critical";
    case "unknown":
      return "Unknown";
    case "attention":
      return health.reasons.some((item) => item.state === "attention" && item.severity === "warning") ? "Warning" : "Watch";
    default:
      return "OK";
  }
}

export type Concern = "warning" | "critical";

// Which derived state judges which reading, worst first. A card for a reading is flagged by what
// the rules concluded about it, so the page needs no thresholds of its own.
const READING_CONCERNS: Partial<Record<CanonicalPointName, ReadonlyArray<{ stateKey: StateKey; concern: Concern }>>> = {
  "water.tank.level.percent": [
    { stateKey: "water.tank.critical", concern: "critical" },
    { stateKey: "water.tank.low", concern: "warning" }
  ],
  "energy.battery.soc.percent": [{ stateKey: "energy.battery.constrained", concern: "warning" }],
  "water.flow.lpm": [{ stateKey: "water.pump.dry_run_risk", concern: "critical" }]
};

/** Whether the rules currently judge this reading abnormal, given the states that are true now.
 * Only meaningful for a current reading: an out-of-date one is flagged as out of date instead. */
export function concernForReading(name: CanonicalPointName, trueStates: ReadonlySet<StateKey>): Concern | undefined {
  return READING_CONCERNS[name]?.find((candidate) => trueStates.has(candidate.stateKey))?.concern;
}

export interface TenantHealth {
  state: HealthState;
  /** The state's word: Stable, Attention needed, Action required, Unknown. */
  label: string;
  /** One sentence that answers "is everything all right?". */
  headline: string;
  /** Everything behind the headline, worst first. Empty only when everything is stable. */
  reasons: HealthReason[];
  /** How much of the account the answer rests on. "9 of 10 sites reporting" is part of the answer. */
  coverage: { sites: number; sitesReporting: number };
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function assessTenantHealth(sites: ReadonlyArray<SiteHealth>): TenantHealth {
  if (sites.length === 0) {
    return {
      state: "unknown",
      label: HEALTH_LABELS.unknown,
      headline: "There is nothing to report on yet.",
      reasons: [{ state: "unknown", message: "No sites yet. Add a site to start seeing its status here.", siteId: "", siteName: "" }],
      coverage: { sites: 0, sitesReporting: 0 }
    };
  }

  const reasons = sites
    .flatMap((site) => site.reasons)
    .sort((a, b) => rank(a.state) - rank(b.state));
  const state = worst(sites.map((site) => site.state));
  const count = (wanted: HealthReason["state"]) => reasons.filter((item) => item.state === wanted).length;

  // "Reporting" means we can tell how the site is: it has current readings and has not gone quiet.
  const notReporting = new Set(sites.filter((site) => site.reasons.some((item) => item.state === "unknown")).map((site) => site.siteId));
  const coverage = { sites: sites.length, sitesReporting: sites.length - notReporting.size };

  let headline: string;
  switch (state) {
    case "action": {
      const needsAction = reasons.filter((item) => item.state === "action");
      const first = needsAction[0];
      headline =
        needsAction.length === 1 && first
          ? `Action required: ${first.message} at ${first.siteName}.`
          : `${needsAction.length} things need action now.`;
      break;
    }
    case "unknown": {
      const first = reasons.find((item) => item.state === "unknown");
      headline =
        notReporting.size === 1 && first
          ? `We can't tell how ${first.siteName || "your site"} is doing right now.`
          : `We can't tell how ${notReporting.size} of your ${sites.length} sites are doing right now.`;
      break;
    }
    case "attention": {
      const needsAttention = count("attention");
      headline = `${needsAttention} ${plural(needsAttention, "thing needs", "things need")} attention.`;
      break;
    }
    default:
      headline = "Everything is running normally.";
  }

  return { state, label: HEALTH_LABELS[state], headline, reasons, coverage };
}
