// Small, pure readers for deployment settings that change what the API exposes or how it
// identifies callers. Kept apart from main.ts so each rule can be unit-tested without booting Nest.

type Env = Record<string, string | undefined>;

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

  if (Boolean(env.EDGE_INGEST_TOKEN) !== Boolean(env.EDGE_INGEST_TENANT_ID)) {
    warnings.push("EDGE_INGEST_TOKEN and EDGE_INGEST_TENANT_ID only work as a pair, so the shared device token is switched off. Per-gateway credentials (Add gateway) are the supported route.");
  }

  if (production && env.DATABASE_URL && trustedProxyHops(env) === undefined) {
    warnings.push("TRUST_PROXY is not set. Behind Railway's proxy every caller looks like one address and shares one rate limit. Set TRUST_PROXY=1 once the API has a public domain.");
  }

  return { errors, warnings };
}
