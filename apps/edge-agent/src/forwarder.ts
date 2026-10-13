import { TelemetryMessage } from "@greecon/shared";
import { DeliveryError, OfflineBuffer } from "./offline-buffer";

export interface ForwarderLog {
  info(message: string): void;
  error(message: string): void;
}

export interface ForwarderOptions {
  apiUrl: string;
  /** Credentials and any fixed headers; the agent never adds identity of its own. */
  headers: Record<string, string>;
  buffer: OfflineBuffer<TelemetryMessage>;
  log: ForwarderLog;
  /** Longest a single request may take before it counts as a failed (temporary) attempt. Without
   * this a hung connection would stall delivery indefinitely. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

// 4xx answers that say "try again later or after someone fixes the setup", not "this message is
// wrong": request timeout / too early / rate limited, and the credential problems (401, 403) —
// readings held while a gateway secret is wrong or not yet rotated are worth keeping, because
// fixing the credential then delivers them.
const RETRYABLE_CLIENT_ERRORS = new Set([401, 403, 408, 425, 429]);

/** Whether an HTTP status means this exact message can never be accepted. */
export function isPermanentRejection(status: number): boolean {
  return status >= 400 && status < 500 && !RETRYABLE_CLIENT_ERRORS.has(status);
}

export class TelemetryForwarder {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ForwarderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  /** Sends one message to the API, or throws a DeliveryError saying whether retrying can help. */
  async ingest(message: TelemetryMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.apiUrl}/telemetry/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.options.headers },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new DeliveryError(`API unreachable: ${error instanceof Error ? error.message : String(error)}`, false);
    }

    if (!response.ok) {
      throw new DeliveryError(`ingest failed with status ${response.status}`, isPermanentRejection(response.status));
    }

    // A success status is not enough: the API validates a message and can answer 2xx with
    // { accepted: false, errors }. Treating that as delivered silently discards the data, so read
    // the answer and surface it.
    const body = (await response.json().catch(() => undefined)) as { accepted?: boolean; errors?: string[] } | undefined;
    if (body && body.accepted === false) {
      throw new DeliveryError(`rejected by the API: ${(body.errors ?? ["no reason given"]).join("; ")}`, true);
    }
  }

  /** Delivers now if possible; otherwise holds the message for the next flush. */
  async forward(message: TelemetryMessage): Promise<void> {
    try {
      await this.ingest(message);
    } catch (error) {
      if (error instanceof DeliveryError && error.permanent) {
        this.options.log.error(`Telemetry for device ${message.deviceId} refused and discarded: ${error.message}`);
        return;
      }

      this.options.buffer.append(message);
      this.options.log.error(
        `API unreachable, buffering reading (backlog: ${this.options.buffer.size()}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async flush(): Promise<void> {
    if (this.options.buffer.size() === 0) return;

    const result = await this.options.buffer.flush((message) => this.ingest(message));
    if (result.sent > 0 || result.dropped > 0) {
      this.options.log.info(
        `Flushed ${result.sent} buffered reading(s)${result.dropped > 0 ? `, discarded ${result.dropped} the API refused` : ""}, ${result.retained} still pending.`
      );
    }
  }
}
