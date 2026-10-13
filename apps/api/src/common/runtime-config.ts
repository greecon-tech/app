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
