"use server";

import { acknowledgeThroughLink } from "../../lib/ack-link";
import { visitorHeaders } from "../../lib/visitor";

/** "Yes, I have seen it", from the link in a message. Public: the link itself is the proof, and it is good for one alert only. */
export async function acknowledgeByLinkAction(token: string): Promise<{ error?: string; state?: "open" | "acknowledged" | "cleared" }> {
  const result = await acknowledgeThroughLink(token, await visitorHeaders());
  if (result.tooMany) return { error: "Too many tries just now. Wait a minute and press the button again." };
  if (!result.ok) return { error: "That did not work: the link may have expired. Sign in to Greecon and acknowledge the alert there, or write to info@greecon.earth." };
  return { state: result.state };
}
