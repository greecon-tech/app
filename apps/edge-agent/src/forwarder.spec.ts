import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { isPermanentRejection, TelemetryForwarder } from "./forwarder";
import { DeliveryError, OfflineBuffer } from "./offline-buffer";

function message(n: number): TelemetryMessage {
  const now = new Date().toISOString();
  return {
    messageType: "telemetry",
    tenantId: DEMO_TENANT_ID,
    siteId: "site-1",
    deviceId: `device-${n}`,
    publishedAtUtc: now,
    correlationId: `corr-${n}`,
    readings: []
  };
}

// A real HTTP server standing in for the cloud API, so the forwarder is exercised over an actual
// connection (status codes, bodies, timeouts) rather than against a hand-written fake of fetch.
interface FakeApi {
  url: string;
  received: Array<{ headers: IncomingMessage["headers"]; body: TelemetryMessage }>;
  respond: (handler: (request: IncomingMessage, response: ServerResponse) => void) => void;
  close: () => Promise<void>;
}

async function startFakeApi(): Promise<FakeApi> {
  const received: FakeApi["received"] = [];
  let handler: (request: IncomingMessage, response: ServerResponse) => void = (_request, response) => {
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ accepted: true, ingested: 1, errors: [] }));
  };

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    request.on("end", () => {
      received.push({ headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") as TelemetryMessage });
      handler(request, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    received,
    respond: (next) => {
      handler = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

function replyWith(status: number, body: unknown) {
  return (_request: IncomingMessage, response: ServerResponse) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
}

describe("isPermanentRejection", () => {
  it("treats malformed or unknown-target answers as permanent", () => {
    for (const status of [400, 404, 409, 413, 422]) expect(isPermanentRejection(status)).toBe(true);
  });

  it("keeps readings through credential problems, rate limits and server errors", () => {
    for (const status of [401, 403, 408, 425, 429, 500, 502, 503]) expect(isPermanentRejection(status)).toBe(false);
  });
});

describe("TelemetryForwarder", () => {
  let api: FakeApi;
  let buffer: OfflineBuffer<TelemetryMessage>;
  let errors: string[];
  let infos: string[];

  const forwarderFor = (overrides: { apiUrl?: string; timeoutMs?: number } = {}) =>
    new TelemetryForwarder({
      apiUrl: overrides.apiUrl ?? api.url,
      headers: { "x-edge-device-token": "secret-token" },
      buffer,
      timeoutMs: overrides.timeoutMs ?? 2_000,
      log: { info: (line) => infos.push(line), error: (line) => errors.push(line) }
    });

  beforeEach(async () => {
    api = await startFakeApi();
    buffer = new OfflineBuffer<TelemetryMessage>();
    errors = [];
    infos = [];
  });

  afterEach(async () => {
    await api.close();
  });

  it("delivers a message with the gateway credential and leaves nothing buffered", async () => {
    await forwarderFor().forward(message(1));

    expect(api.received).toHaveLength(1);
    expect(api.received[0]?.headers["x-edge-device-token"]).toBe("secret-token");
    expect(api.received[0]?.body.deviceId).toBe("device-1");
    expect(buffer.size()).toBe(0);
  });

  it("buffers a message when the API cannot be reached, and delivers it when it returns", async () => {
    const down = forwarderFor({ apiUrl: "http://127.0.0.1:1" });
    await down.forward(message(1));
    expect(buffer.size()).toBe(1);
    expect(errors.join(" ")).toContain("buffering reading");

    await forwarderFor().flush();
    expect(buffer.size()).toBe(0);
    expect(api.received.map((entry) => entry.body.deviceId)).toEqual(["device-1"]);
    expect(infos.join(" ")).toContain("Flushed 1 buffered reading");
  });

  it("buffers on a server error, which is temporary", async () => {
    api.respond(replyWith(503, { message: "restarting" }));
    await forwarderFor().forward(message(1));
    expect(buffer.size()).toBe(1);
  });

  it("buffers on a credential failure so readings are kept until the secret is fixed", async () => {
    api.respond(replyWith(401, { message: "Authentication required." }));
    await forwarderFor().forward(message(1));
    expect(buffer.size()).toBe(1);
  });

  it("discards, loudly, a message the API says is wrong (unknown device), instead of retrying it forever", async () => {
    api.respond(replyWith(404, { message: "Device not found." }));
    await forwarderFor().forward(message(1));

    expect(buffer.size()).toBe(0);
    expect(errors.join(" ")).toContain("refused and discarded");
    expect(errors.join(" ")).toContain("status 404");
  });

  it("treats a 2xx answer carrying accepted:false as a refusal, not a delivery", async () => {
    api.respond(replyWith(201, { accepted: false, errors: ["readings[0].timestampUtc is in the future by more than 5 minutes; check the gateway clock"] }));
    await forwarderFor().forward(message(1));

    expect(buffer.size()).toBe(0);
    expect(errors.join(" ")).toContain("check the gateway clock");
  });

  it("gives up on a request that hangs, and keeps the reading", async () => {
    api.respond(() => {
      // Never answers.
    });
    const startedAt = Date.now();
    await forwarderFor({ timeoutMs: 150 }).forward(message(1));

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(buffer.size()).toBe(1);
  });

  it("flushes a backlog in order and reports what it discarded", async () => {
    buffer.append(message(1));
    buffer.append(message(2));
    buffer.append(message(3));
    api.respond((request, response) => {
      // The second message is permanently refused.
      const last = api.received[api.received.length - 1]?.body.deviceId;
      replyWith(last === "device-2" ? 422 : 201, last === "device-2" ? { message: "bad" } : { accepted: true, errors: [] })(request, response);
    });

    await forwarderFor().flush();

    expect(api.received.map((entry) => entry.body.deviceId)).toEqual(["device-1", "device-2", "device-3"]);
    expect(buffer.size()).toBe(0);
    expect(infos.join(" ")).toContain("Flushed 2 buffered reading(s), discarded 1");
  });

  it("surfaces the DeliveryError classification from ingest directly", async () => {
    api.respond(replyWith(400, { message: "bad request" }));
    await expect(forwarderFor().ingest(message(1))).rejects.toMatchObject({ permanent: true });

    api.respond(replyWith(500, { message: "oops" }));
    await expect(forwarderFor().ingest(message(1))).rejects.toBeInstanceOf(DeliveryError);
    await expect(forwarderFor().ingest(message(1))).rejects.toMatchObject({ permanent: false });
  });
});
