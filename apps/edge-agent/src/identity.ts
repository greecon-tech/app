import { readFileSync } from "node:fs";

// Who this box is: which platform it talks to, which site and gateway it is, and its credential. It is
// written once, by `greecon-edge enrol`, when the box uses its enrolment code; nobody types it.

export interface EdgeIdentity {
  apiUrl: string;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  /** The box's own credential. Never logged, never sent anywhere but the platform it names. */
  secret: string;
}

export const DEFAULT_IDENTITY_FILE = "/etc/greecon/edge.json";

export class IdentityError extends Error {}

/** True for an address that only exists inside a private network: this machine, the usual private
 * ranges, a link-local address, a name with no dot (a laptop on the same desk), or a .local or
 * .internal name. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
    const [a, b] = octets as [number, number, number, number];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return /^(fc|fd|fe80)/.test(host);
}

/** The platform's address, tidied to scheme, host and port. A box sends its credential and its readings
 * there and takes its own software from there, so the address must be https. Plain http is accepted only
 * for a platform on the same private network, which is how a rehearsal on a desk runs: on the open
 * internet anyone on the path could read the credential, or hand the box software of their own. */
export function platformAddress(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("not http or https");
  } catch {
    throw new IdentityError(`The platform address "${raw}" is not a web address such as https://api.greecon.earth.`);
  }
  if (url.protocol === "http:" && !isPrivateHost(url.hostname)) {
    throw new IdentityError(`The platform address "${raw}" is not https. A box sends its credential and takes its software from that address, so it must start with https:// (plain http is accepted only for a platform on the same private network).`);
  }
  return `${url.protocol}//${url.host}`;
}

type Env = Record<string, string | undefined>;

/** The identity from the file the installer wrote, or, for development against a local platform, from
 * the environment. Says what is missing and what to do about it. */
export function loadIdentity(env: Env = process.env, read: (path: string) => string = (path) => readFileSync(path, "utf8")): EdgeIdentity {
  const path = env.GREECON_EDGE_CONFIG ?? DEFAULT_IDENTITY_FILE;
  let raw: Record<string, unknown> | undefined;
  try {
    raw = JSON.parse(read(path)) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new IdentityError(`${path} cannot be read as the box's identity (${error instanceof Error ? error.message : String(error)}). Enrol the box again with a new code from the site's setup page.`);
    }
  }

  const source = raw ?? { apiUrl: env.API_URL, tenantId: env.TENANT_ID, siteId: env.SITE_ID, gatewayId: env.GATEWAY_ID, secret: env.EDGE_TOKEN };
  const missing = (["apiUrl", "tenantId", "siteId", "gatewayId", "secret"] as const).filter((key) => typeof source[key] !== "string" || (source[key] as string).trim() === "");
  if (missing.length > 0) {
    throw new IdentityError(
      raw
        ? `${path} is missing ${missing.join(", ")}. Enrol the box again with a new code from the site's setup page.`
        : `Nothing tells this box who it is: there is no ${path}. Run the install command from the site's setup page.`
    );
  }

  const apiUrl = platformAddress(String(source.apiUrl));
  const secret = String(source.secret).trim();
  if (secret.length < 16) throw new IdentityError("The box's credential is too short to be real. Enrol the box again with a new code from the site's setup page.");

  return { apiUrl, tenantId: String(source.tenantId).trim(), siteId: String(source.siteId).trim(), gatewayId: String(source.gatewayId).trim(), secret };
}
