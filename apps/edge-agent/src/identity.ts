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

  let apiUrl: string;
  try {
    const url = new URL(String(source.apiUrl).trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("not http or https");
    apiUrl = `${url.protocol}//${url.host}`;
  } catch {
    throw new IdentityError(`The platform address "${String(source.apiUrl)}" is not a web address such as https://api.greecon.earth.`);
  }
  const secret = String(source.secret).trim();
  if (secret.length < 16) throw new IdentityError("The box's credential is too short to be real. Enrol the box again with a new code from the site's setup page.");

  return { apiUrl, tenantId: String(source.tenantId).trim(), siteId: String(source.siteId).trim(), gatewayId: String(source.gatewayId).trim(), secret };
}
