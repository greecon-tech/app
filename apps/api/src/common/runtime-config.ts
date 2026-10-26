// Small, pure readers for deployment settings that change what the API exposes or how it
// identifies callers. Kept apart from main.ts so each rule can be unit-tested without booting Nest.

import { createChannels } from "../notifications/channels";
import { RESTART_GRACE_MS } from "../platform/restart-grace";
import { configuredPublicApiUrl, configuredPublicWebUrl } from "./public-url";

type Env = Record<string, string | undefined>;

/** The longest grace after a start that can be asked for: longer would hide a real silence for too long. */
export const MAX_RESTART_GRACE_MINUTES = 60;

/** RESTART_GRACE_MINUTES as given, when it is a whole number of minutes from 0 to the maximum; otherwise undefined. */
function restartGraceMinutes(env: Env): number | undefined {
  const raw = env.RESTART_GRACE_MINUTES?.trim();
  if (!raw || !/^\d{1,2}$/.test(raw)) return undefined;
  const minutes = Number(raw);
  return minutes <= MAX_RESTART_GRACE_MINUTES ? minutes : undefined;
}

/** How long, after the platform starts listening, it waits before it calls a box silent or a reading out of date
 * (platform/restart-grace.ts): RESTART_GRACE_MINUTES in whole minutes, 0 to switch the wait off. Unset, or not a whole
 * number of minutes from 0 to 60: the standard ten minutes. */
export function restartGraceMs(env: Env): number {
  const minutes = restartGraceMinutes(env);
  return minutes === undefined ? RESTART_GRACE_MS : minutes * 60_000;
}

/** The Swagger UI and the machine-readable spec (/docs, /docs-yaml, /docs-json) describe every
 * route. They are useful while building, but a public deployment has no need to hand that map to
 * strangers, so they are off in production unless ENABLE_API_DOCS=true says otherwise.
 * An explicit ENABLE_API_DOCS always wins, either way. */
export function apiDocsEnabled(env: Env): boolean {
  const explicit = env.ENABLE_API_DOCS?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return env.NODE_ENV !== "production";
}

/** How many reverse proxies sit in front of the API and can be trusted to report the caller's real
 * address in X-Forwarded-For (Express's "trust proxy" as a hop count). Unset means none: the API
 * then sees the address of whatever connects to it, which behind a proxy is the proxy itself, so
 * every caller shares one rate-limit bucket. Set it only to the exact number of trusted hops —
 * trusting more than exist lets a caller choose their own address by forging the header.
 * Returns undefined (leave Express's default) for unset, "0", "false" or anything that is not a
 * small non-negative integer. */
export function trustedProxyHops(env: Env): number | undefined {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || raw.toLowerCase() === "false") return undefined;
  if (!/^\d{1,2}$/.test(raw)) return undefined;

  const hops = Number(raw);
  return hops > 0 ? hops : undefined;
}

export interface ConfigReport {
  /** Settings that make a production deployment unsafe or unable to work. Boot stops. */
  errors: string[];
  /** Settings worth fixing that do not stop it. */
  warnings: string[];
}

/** The placeholder in .env.example. Fine on a laptop, never on a deployment. */
const EXAMPLE_JWT_SECRET = "local-dev-only-change-me";
export const MINIMUM_JWT_SECRET_LENGTH = 32;

/** Looks at the deployment's settings once, at boot, and says what is wrong in words the person
 * deploying can act on. A weak or missing signing secret is an error in production, not a warning:
 * with it, anyone could mint a session for any account. */
export function checkRuntimeConfig(env: Env): ConfigReport {
  const production = env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];
  const problem = (message: string): void => void (production ? errors : warnings).push(message);

  if (env.DATABASE_URL) {
    const secret = env.JWT_SECRET ?? "";
    if (!secret) {
      problem("JWT_SECRET is not set, so nobody can sign in. Set it to a long random value, for example the output of: openssl rand -base64 32");
    } else if (secret === EXAMPLE_JWT_SECRET) {
      problem("JWT_SECRET is still the example value from .env.example. Anyone who has read the repository could create a session. Set a long random value.");
    } else if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
      problem(`JWT_SECRET is shorter than ${MINIMUM_JWT_SECRET_LENGTH} characters. Use a long random value, for example the output of: openssl rand -base64 32`);
    }
  }

  const bootstrapEmail = env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const bootstrapPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
    warnings.push("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD only work as a pair; set both or neither.");
  }

  if (env.RESTART_GRACE_MINUTES?.trim() && restartGraceMinutes(env) === undefined) {
    warnings.push(`RESTART_GRACE_MINUTES is not a whole number of minutes from 0 to ${MAX_RESTART_GRACE_MINUTES}, so the standard ${RESTART_GRACE_MS / 60_000} minutes are used.`);
  }

  if (Boolean(env.EDGE_INGEST_TOKEN) !== Boolean(env.EDGE_INGEST_TENANT_ID)) {
    warnings.push("EDGE_INGEST_TOKEN and EDGE_INGEST_TENANT_ID only work as a pair, so the shared device token is switched off. Per-gateway credentials (Add gateway) are the supported route.");
  }

  if (production && env.DATABASE_URL) {
    const publicUrl = configuredPublicApiUrl(env);
    if (!publicUrl) {
      warnings.push(
        "PUBLIC_API_URL is not set (or is not an address), so the install command shown for a new box would name this service's private address, which a box on the customer's network cannot reach. Set it to the API's public address, for example https://api.greecon.earth."
      );
    } else if (!publicUrl.startsWith("https://")) {
      warnings.push("PUBLIC_API_URL is not https. A box sends its credential and its readings to this address; use an https address.");
    }
  }

  // Telling people is what a customer is paying for when something goes wrong, so a deployment that cannot do it
  // says so at every start, not only in the logs of the first alert that nobody received.
  if (production && env.DATABASE_URL) {
    const channels = createChannels(env);
    warnings.push(...channels.problems);
    if (!channels.email && !channels.sms) {
      warnings.push("Alert messages are OFF: neither email (RESEND_API_KEY) nor text messages (TWILIO_*) are set up, so alerts show in Greecon and nobody is sent a message. A site cannot be commissioned until one is.");
    } else if (!channels.email) {
      warnings.push("Email (RESEND_API_KEY) is not set up. Only Act now reaches people, by text; Check today and the morning message are not sent.");
    }
    if (!configuredPublicWebUrl(env)) {
      warnings.push(
        "PUBLIC_WEB_URL is not set (or is not an address), so the messages have no link back to Greecon and no link to acknowledge an alert. Set it to the web app's public address, for example https://app.greecon.earth."
      );
    }
    if ((env.SALES_NOTIFY_EMAIL ?? "").trim() === "") {
      warnings.push("SALES_NOTIFY_EMAIL is not set, so a new request for access waits in the inbox until someone looks. Set it to the address that should hear of each one.");
    }
  }

  if (production && env.DATABASE_URL && trustedProxyHops(env) === undefined) {
    warnings.push("TRUST_PROXY is not set. Behind Railway's proxy every caller looks like one address and shares one rate limit. Set TRUST_PROXY=1 once the API has a public domain.");
  }

  return { errors, warnings };
}
