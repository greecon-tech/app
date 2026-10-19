import { GREECON_PUBLIC_EMAILS, normaliseEmail } from "@greecon/shared";

// The two ways a message leaves Greecon: email through Resend and SMS through Twilio. Each is a small
// adapter so that the rest of the platform neither knows nor cares who carries the message, and so that a
// platform without keys says so plainly instead of pretending. A provider "accepting" a message is not the
// same as the person reading it, and the log says "sent" only for the first.

export type SendResult = { ok: true; providerId?: string } | { ok: false; transient: boolean; error: string };

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  /** The same key sent twice makes one email: a retry after a lost answer must not double a page. */
  idempotencyKey: string;
}

export interface EmailChannel {
  send(message: OutgoingEmail): Promise<SendResult>;
}

export interface SmsChannel {
  send(message: { to: string; body: string }): Promise<SendResult>;
}

export interface Channels {
  email?: EmailChannel;
  sms?: SmsChannel;
  /** What is wrong with the settings, for the log at start-up. Empty when each channel is either off or fully set. */
  problems: string[];
}

export const NOTIFICATION_CHANNELS = "NOTIFICATION_CHANNELS";

const TIMEOUT_MS = 15_000;

const summarise = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, 200);

/** 429 and server errors are the provider's trouble and pass; the rest (a bad address, a wrong key) will fail the same way again. */
function transientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await response.text());
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function resendChannel(options: { apiKey: string; from: string; replyTo: string; baseUrl?: string; fetchImpl?: typeof fetch }): EmailChannel {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(message) {
      try {
        const response = await fetchImpl(`${options.baseUrl ?? "https://api.resend.com"}/emails`, {
          method: "POST",
          headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json", "idempotency-key": message.idempotencyKey },
          body: JSON.stringify({ from: options.from, to: [message.to], reply_to: options.replyTo, subject: message.subject, text: message.body }),
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        const json = await readJson(response);
        if (response.ok) return { ok: true, providerId: typeof json.id === "string" ? json.id : undefined };
        const why = typeof json.message === "string" ? json.message : response.statusText;
        return { ok: false, transient: transientStatus(response.status), error: `The email service answered ${response.status}: ${summarise(why)}` };
      } catch (error) {
        return { ok: false, transient: true, error: `The email service could not be reached: ${summarise(error instanceof Error ? error.message : String(error))}` };
      }
    }
  };
}

export function twilioChannel(options: { accountSid: string; authToken: string; from?: string; messagingServiceSid?: string; baseUrl?: string; fetchImpl?: typeof fetch }): SmsChannel {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = Buffer.from(`${options.accountSid}:${options.authToken}`).toString("base64");
  return {
    async send(message) {
      const form = new URLSearchParams({ To: message.to, Body: message.body });
      if (options.messagingServiceSid) form.set("MessagingServiceSid", options.messagingServiceSid);
      else if (options.from) form.set("From", options.from);
      try {
        const response = await fetchImpl(`${options.baseUrl ?? "https://api.twilio.com"}/2010-04-01/Accounts/${encodeURIComponent(options.accountSid)}/Messages.json`, {
          method: "POST",
          headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
          body: form.toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        const json = await readJson(response);
        if (response.ok) return { ok: true, providerId: typeof json.sid === "string" ? json.sid : undefined };
        const why = typeof json.message === "string" ? json.message : response.statusText;
        return { ok: false, transient: transientStatus(response.status), error: `The text-message service answered ${response.status}: ${summarise(why)}` };
      } catch (error) {
        return { ok: false, transient: true, error: `The text-message service could not be reached: ${summarise(error instanceof Error ? error.message : String(error))}` };
      }
    }
  };
}

/** The providers' own addresses are the default. They can be pointed elsewhere (RESEND_API_URL, TWILIO_API_URL) for a
 * rehearsal against a stand-in that records what would have been sent, without touching a real account. */
function baseUrlOf(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : undefined;
}

/** Which channels this platform can use, from its settings (docs/11-deployment-railway.md). A channel
 * with some of its keys but not all is reported as a problem and left off, not half-switched on. */
export function createChannels(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): Channels {
  const problems: string[] = [];
  const channels: Channels = { problems };

  const resendKey = env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const fromAddress = normaliseEmail(env.ALERT_FROM_EMAIL?.trim() || "alerts@greecon.earth");
    const replyTo = normaliseEmail(env.ALERT_REPLY_TO?.trim() || GREECON_PUBLIC_EMAILS[0]);
    if (!fromAddress) problems.push("ALERT_FROM_EMAIL is not an email address, so email is off.");
    else if (!replyTo) problems.push("ALERT_REPLY_TO is not an email address, so email is off.");
    else channels.email = resendChannel({ apiKey: resendKey, from: `${env.ALERT_FROM_NAME?.trim() || "Greecon"} <${fromAddress}>`, replyTo, baseUrl: baseUrlOf(env.RESEND_API_URL), fetchImpl });
  }

  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_FROM?.trim();
  const service = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (sid || token || from || service) {
    if (!sid || !token) problems.push("Text messages need both TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, so text messages are off.");
    else if (!from && !service) problems.push("Text messages need TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID, so text messages are off.");
    else channels.sms = twilioChannel({ accountSid: sid, authToken: token, from, messagingServiceSid: service, baseUrl: baseUrlOf(env.TWILIO_API_URL), fetchImpl });
  }
  return channels;
}
