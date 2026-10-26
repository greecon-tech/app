type Env = Record<string, string | undefined>;

/** The address a box at a customer's site can reach this API at, for the install command and the
 * installer. The address the API sees for itself is not enough: the web service reaches it on a private
 * address, and a box on the customer's network cannot. In production it is set (PUBLIC_API_URL); in
 * development it is whatever the request came in on. */
export function publicApiUrl(env: Env, request: { protocol: string; get(name: string): string | undefined }): string {
  const configured = configuredPublicApiUrl(env);
  if (configured) return configured;
  // The Host header is whatever the caller sent. The address ends up in a command and a script that a
  // person runs as root, so only something that is plainly a host name or address is used.
  const host = request.get("host");
  const plain = host !== undefined && /^([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i.test(host);
  return `${request.protocol === "https" ? "https" : "http"}://${plain ? host : "localhost"}`;
}

/** PUBLIC_WEB_URL, if it is a usable address: http or https, with no trailing slash. It is the start of every link in the
 * messages Greecon sends; anything that is not an address is no address, and a message then has no link at all rather
 * than one that does not work. */
export function configuredPublicWebUrl(env: Env): string | undefined {
  const raw = env.PUBLIC_WEB_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}

/** PUBLIC_API_URL, if it is a usable address: http or https, no path, no trailing slash. */
export function configuredPublicApiUrl(env: Env): string | undefined {
  const raw = env.PUBLIC_API_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  return `${url.protocol}//${url.host}`;
}
