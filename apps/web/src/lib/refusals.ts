// What to tell a person when the platform will not let them in: why, and what to do (docs/29, S10). Only a wrong password reads as one: a
// suspended client, too many attempts and a platform that did not answer each have their own words, so that nobody resets a password that
// was right, or waits for an account that Greecon has turned off.

export const SUSPENDED_SENTENCE = "This account has been suspended by Greecon, so nobody in it can sign in for now. Write to info@greecon.earth to have it turned back on.";

/** Whether the API's answer says the person's client is suspended. The API says so only to someone who proved who they are (a right
 * password at sign-in, a valid session afterwards), so the sentence tells nothing to a person guessing. */
export function isSuspendedRefusal(status: number, apiMessage: unknown): boolean {
  return (status === 401 || status === 403) && typeof apiMessage === "string" && /has been suspended/i.test(apiMessage);
}

/** The words for a sign-in the platform did not accept. */
export function signInRefusal(status: number, apiMessage: unknown): string {
  if (isSuspendedRefusal(status, apiMessage)) return SUSPENDED_SENTENCE;
  if (status === 429) return "Too many sign-in attempts. Wait a minute, then try again.";
  if (status >= 500) return "Greecon could not sign you in just now. It is not your password. Try again in a minute; if it keeps happening, write to info@greecon.earth.";
  return "Invalid email or password.";
}

/** The message in an API refusal's JSON body, if it has one. */
export function messageOfBody(raw: string): unknown {
  try {
    return (JSON.parse(raw) as { message?: unknown }).message;
  } catch {
    return undefined;
  }
}
