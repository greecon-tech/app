type Env = Record<string, string | undefined>;

/** The address a box at a customer's site can reach this API at, for the install command and the
 * installer. The address the API sees for itself is not enough: the web service reaches it on a private
 * address, and a box on the customer's network cannot. In production it is set (PUBLIC_API_URL); in
 * development it is whatever the request came in on. */
export function publicApiUrl(env: Env, request: { protocol: string; get(name: string): string | undefined }): string {
  const configured = configuredPublicApiUrl(env);
  if (configured) return configured;
  const host = request.get("host") ?? "localhost";
  return `${request.protocol}://${host}`;
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
