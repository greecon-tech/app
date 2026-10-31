import type { DiscoveryResult, EdgeConfig, EnrolResponse, GatewayHeartbeat, HeartbeatReply } from "@greecon/shared";
import { platformAddress, type EdgeIdentity } from "./identity";

// What the box says to the platform besides readings: asking what to read, saying how it is, and
// presenting a code to get its credential.

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new PlatformError(`the platform could not be reached (${error instanceof Error ? error.message : String(error)})`);
  }
  const text = await response.text().catch(() => "");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const said = (body as { message?: unknown } | undefined)?.message;
    const detail = typeof said === "string" ? said : Array.isArray(said) ? said.join(" ") : `status ${response.status}`;
    if (response.status === 401) throw new PlatformError("the platform does not recognise this box's credential. Run the install command again with a new code from the site's setup page.", 401);
    throw new PlatformError(`the platform answered: ${detail}`, response.status);
  }
  return body;
}

export class PlatformClient {
  constructor(
    private readonly identity: EdgeIdentity,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  private headers(): Record<string, string> {
    return { "x-edge-device-token": this.identity.secret, "content-type": "application/json" };
  }

  async fetchConfig(): Promise<EdgeConfig> {
    const body = (await send(this.fetchImpl, `${this.identity.apiUrl}/edge/config`, { method: "GET", headers: this.headers() }, this.timeoutMs)) as EdgeConfig | undefined;
    if (!body || typeof body.version !== "string" || !Array.isArray(body.devices)) throw new PlatformError("the platform's configuration was not in the form expected.");
    return body;
  }

  async heartbeat(heartbeat: GatewayHeartbeat): Promise<HeartbeatReply> {
    const body = (await send(this.fetchImpl, `${this.identity.apiUrl}/edge/heartbeat`, { method: "POST", headers: this.headers(), body: JSON.stringify(heartbeat) }, this.timeoutMs)) as HeartbeatReply | undefined;
    if (!body || typeof body.configVersion !== "string") throw new PlatformError("the platform's answer to the heartbeat was not in the form expected.");
    return body;
  }

  /** What the box found when it was asked to look at the site's network. */
  async postDiscovery(result: DiscoveryResult): Promise<void> {
    await send(this.fetchImpl, `${this.identity.apiUrl}/edge/discovery`, { method: "POST", headers: this.headers(), body: JSON.stringify(result) }, this.timeoutMs);
  }
}

/** Presents an enrolment code and gets the box's identity. Used once, by `greecon-edge enrol`. */
export async function enrol(apiUrl: string, code: string, fetchImpl: typeof fetch = fetch, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<EnrolResponse> {
  const base = platformAddress(apiUrl);
  const body = (await send(fetchImpl, `${base}/edge/enrol`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }, timeoutMs).catch((error: unknown) => {
    // A 401 here is not "wrong credential": the box has none yet. It is the code.
    if (error instanceof PlatformError && error.status === 401) throw new PlatformError("that code has been used, has expired, or is not one of ours. Make a new one on the site's setup page.", 401);
    throw error;
  })) as EnrolResponse | undefined;
  if (!body || typeof body.secret !== "string" || typeof body.gatewayId !== "string") throw new PlatformError("the platform's answer to the code was not in the form expected.");
  return body;
}
