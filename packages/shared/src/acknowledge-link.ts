// The "I have seen this" link in an alert message. Whoever holds it may say, for that one alert and nothing else, that
// they have seen it, from a phone and without signing in. Opening the page behind it changes nothing (mail and text
// scanners open links); pressing its button acknowledges the alert exactly as Acknowledge in Greecon does.
// The routes are GET and POST /public/acknowledge/:token (apps/api/src/modules/alerts/acknowledge-link.controller.ts).

/** Where the alert stands: still open, acknowledged by someone, or cleared by the readings. */
export type AcknowledgeLinkState = "open" | "acknowledged" | "cleared";

export interface AcknowledgeLinkAlert {
  title: string;
  siteName: string;
  /** The priority word a person reads: "Act now", "Check today" or "For your information". */
  priority: string;
  raisedAtUtc: string;
  state: AcknowledgeLinkState;
}

/** The answer to both routes. A link that is malformed, altered, expired, or for an alert or account that is no longer
 * there is `{ valid: false }`, the same answer for every one of them. */
export interface AcknowledgeLinkView {
  valid: boolean;
  alert?: AcknowledgeLinkAlert;
}
