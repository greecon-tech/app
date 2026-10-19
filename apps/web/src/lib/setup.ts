import type { GatewayContact, SetupStep, SetupStepStatus } from "@greecon/shared";

// Words for the setup screens. A status is always a word first; the badge's shape and colour follow
// from the word (see the .status-* rules in globals.css).

export const STEP_STATUS_WORDS: Record<SetupStepStatus, string> = {
  done: "Done",
  todo: "To do",
  waiting: "Waiting",
  attention: "Needs attention"
};

export const CONTACT_WORDS: Record<GatewayContact, string> = {
  online: "Online",
  late: "Late",
  offline: "Offline",
  never: "Not connected yet"
};

/** The step to do next: the first that is not done and that holds up commissioning; if only optional ones
 * are left, the first of those. Undefined when everything is done. */
export function nextStep(steps: readonly SetupStep[]): SetupStep | undefined {
  return steps.find((step) => step.status !== "done" && !step.optional) ?? steps.find((step) => step.status !== "done");
}
