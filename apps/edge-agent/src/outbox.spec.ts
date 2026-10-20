import { mkdtempSync, rmSync } from "node:fs";
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TelemetryMessage } from "@greecon/shared";
import { OfflineBuffer } from "./offline-buffer";
import { Outbox } from "./outbox";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222201";
const T0 = Date.parse("2026-10-19T10:00:00Z");

/** One device's message at a time, `seconds` after the start. */
function message(device: string, seconds: number, value: number | boolean | string = 1, quality: "OK" | "WARN" | "BAD" = "OK"): TelemetryMessage {
  const at = new Date(T0 + seconds * 1000).toISOString();
  return {
    messageType: "telemetry",
    tenantId: TENANT,
    siteId: SITE,
    deviceId: device,
    publishedAtUtc: at,
    correlationId: `c-${device}-${seconds}`,
    readings: [{ timestampUtc: at, tenantId: TENANT, siteId: SITE, deviceId: device, pointId: `${device}-p`, canonicalName: "energy.grid.import.kw", value, unit: "kW", quality, source: "edge", ingestionTimestampUtc: at }]
  };
}

interface FakeApi {
  url: string;
  requests: Array<{ headers: IncomingMessage["headers"]; messages: TelemetryMessage[] }>;
  /** Every message received, in the order received. */
  received(): TelemetryMessage[];
  respond(handler: (request: IncomingMessage, response: ServerResponse, messages: TelemetryMessage[]) => void): void;
  close(): Promise<void>;
}

const accepting = (_request: IncomingMessage, response: ServerResponse, messages: TelemetryMessage[]) => {
  response.writeHead(201, { "content-type": "application/json" });
  response.end(JSON.stringify({ results: messages.map(() => ({ accepted: true, ingested: 1, errors: [] })) }));
};

const status = (code: number, body: unknown = {}) => (_request: IncomingMessage, response: ServerResponse) => {
  response.writeHead(code, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

async function startFakeApi(): Promise<FakeApi> {
  const requests: FakeApi["requests"] = [];
  let handler: Parameters<FakeApi["respond"]>[0] = accepting;
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    request.on("end", () => {
      const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { messages?: TelemetryMessage[] };
      const messages = parsed.messages ?? [];
      requests.push({ headers: request.headers, messages });
      handler(request, response, messages);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    received: () => requests.flatMap((request) => request.messages),
    respond: (next) => {
      handler = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

/** The network between the box and the platform, which can be up or down. One outbox sits on it, as in life. */
function switchable(initiallyUp: boolean) {
  const state = { up: initiallyUp };
  const fetchImpl = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    state.up ? fetch(input, init) : Promise.reject(new TypeError("fetch failed: connection refused"))) as typeof fetch;
  return { state, fetchImpl };
}

describe("sending readings to the platform", () => {
  let api: FakeApi;
  let buffer: OfflineBuffer<TelemetryMessage>;
  let infos: string[];
  let warnings: string[];
  let errors: string[];

  const outboxFor = (overrides: Partial<ConstructorParameters<typeof Outbox>[0]> = {}) =>
    new Outbox({
      apiUrl: api.url,
      headers: { "x-edge-device-token": "box-secret" },
      buffer,
      timeoutMs: 2000,
      log: { info: (line) => infos.push(line), warn: (line) => warnings.push(line), error: (line) => errors.push(line) },
      ...overrides
    });

  beforeEach(async () => {
    api = await startFakeApi();
    buffer = new OfflineBuffer<TelemetryMessage>();
    infos = [];
    warnings = [];
    errors = [];
  });

  afterEach(async () => {
    await api.close();
  });

  it("sends a round in one request, with the box's credential, and keeps nothing", async () => {
    const outbox = outboxFor();
    await outbox.submit([message("a", 0), message("b", 0), message("c", 0)]);

    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]?.headers["x-edge-device-token"]).toBe("box-secret");
    expect(api.received().map((entry) => entry.deviceId)).toEqual(["a", "b", "c"]);
    expect(outbox.pending()).toBe(0);
  });

  describe("when the platform cannot be reached", () => {
    it("keeps the readings in order, says so once, and sends them when it is back", async () => {
      const network = switchable(false);
      const outbox = outboxFor({ fetchImpl: network.fetchImpl, thinMs: 1 });
      await outbox.submit([message("a", 0)]);
      await outbox.submit([message("a", 10)]);
      await outbox.submit([message("a", 20)]);
      await outbox.drain();
      expect(outbox.pending()).toBe(3);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("could not be reached");

      network.state.up = true;
      await outbox.drain();
      expect(outbox.pending()).toBe(0);
      expect(api.received().map((entry) => entry.publishedAtUtc)).toEqual([0, 10, 20].map((s) => new Date(T0 + s * 1000).toISOString()));
      expect(infos.join(" ")).toContain("Delivered 3 waiting message(s)");
    });

    it("keeps readings through a server error", async () => {
      api.respond(status(503, { message: "restarting" }));
      const outbox = outboxFor();
      await outbox.submit([message("a", 0)]);
      expect(outbox.pending()).toBe(1);
    });

    it("keeps readings when the credential is not recognised, and says what to do", async () => {
      api.respond(status(401, { message: "Authentication required." }));
      const outbox = outboxFor();
      await outbox.submit([message("a", 0)]);
      expect(outbox.pending()).toBe(1);
      expect(warnings.join(" ")).toContain("does not recognise this box's credential");
    });

    it("keeps readings when the route is not there, because that is a wrong address and not wrong readings", async () => {
      api.respond(status(404, { message: "Cannot POST /telemetry/ingest-batch" }));
      const outbox = outboxFor();
      await outbox.submit([message("a", 0), message("b", 0)]);
      expect(outbox.pending()).toBe(2);
      expect(errors).toEqual([]);
    });

    it("gives up on a request that hangs, and keeps the readings", async () => {
      api.respond(() => undefined);
      const outbox = outboxFor({ timeoutMs: 150 });
      const started = Date.now();
      await outbox.submit([message("a", 0)]);
      expect(Date.now() - started).toBeLessThan(2000);
      expect(outbox.pending()).toBe(1);
    });

    it("does not take an answer that is not an answer to this request for a delivery", async () => {
      api.respond(status(201, { ok: true }));
      const outbox = outboxFor();
      await outbox.submit([message("a", 0)]);
      expect(outbox.pending()).toBe(1);
      api.respond((_request, response, messages) => {
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ results: [{ accepted: true }, { accepted: true }].slice(0, messages.length + 1) }));
      });
      await outbox.drain();
      expect(outbox.pending()).toBe(1);
    });
  });

  describe("when the platform refuses something", () => {
    it("discards, loudly, only the message it says is wrong, and takes the rest", async () => {
      api.respond((_request, response, messages) => {
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ results: messages.map((entry) => (entry.deviceId === "bad" ? { accepted: false, ingested: 0, errors: ["Device not found."] } : { accepted: true, ingested: 1, errors: [] })) }));
      });
      const outbox = outboxFor();
      await outbox.submit([message("a", 0), message("bad", 0), message("c", 0)]);
      expect(outbox.pending()).toBe(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("device bad");
      expect(errors[0]).toContain("Device not found.");
    });

    it("finds the one message that sinks a whole request, by halving, and delivers the others in order", async () => {
      api.respond((request, response, messages) => {
        if (messages.some((entry) => entry.deviceId === "poison")) return status(400, { message: "readings[0].value must not be empty" })(request, response);
        accepting(request, response, messages);
      });
      const outbox = outboxFor();
      const round = ["a", "b", "c", "poison", "e", "f", "g", "h"].map((device) => message(device, 0));
      await outbox.submit(round);

      expect(outbox.pending()).toBe(0);
      const accepted = api.requests.filter((request) => !request.messages.some((entry) => entry.deviceId === "poison")).flatMap((request) => request.messages.map((entry) => entry.deviceId));
      expect(accepted).toEqual(["a", "b", "c", "e", "f", "g", "h"]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("device poison");
      // Finding one in eight takes a handful of requests, not eight.
      expect(api.requests.length).toBeLessThanOrEqual(8);
    });

    it("keeps the order when the platform goes away part way through isolating a bad message", async () => {
      let calls = 0;
      api.respond((request, response, messages) => {
        calls += 1;
        if (messages.some((entry) => entry.deviceId === "poison")) return status(400)(request, response);
        // After a few requests the platform restarts.
        if (calls >= 4) return status(503)(request, response);
        accepting(request, response, messages);
      });
      const outbox = outboxFor();
      await outbox.submit(["a", "b", "poison", "d", "e"].map((device) => message(device, 0)));
      const order = buffer.snapshot().map((entry) => entry.deviceId);
      // Whatever is still waiting is waiting in the order it was taken, and the bad one is not in it.
      expect(order).not.toContain("poison");
      expect(order).toEqual(["a", "b", "poison", "d", "e"].filter((device) => order.includes(device)));
      const delivered = api.requests.filter((request) => !request.messages.some((entry) => entry.deviceId === "poison")).flatMap((request) => request.messages.map((entry) => entry.deviceId));
      expect([...delivered, ...order].sort()).toEqual(["a", "b", "d", "e"].sort());
    });
  });

  describe("order", () => {
    it("sends a backlog before anything newer, however fast the platform comes back", async () => {
      const network = switchable(false);
      const outbox = outboxFor({ fetchImpl: network.fetchImpl, thinMs: 1 });
      await outbox.submit([message("old", 0)]);
      await outbox.submit([message("old", 10)]);
      await outbox.drain();
      expect(outbox.pending()).toBe(2);

      // The platform is back, and a new reading arrives at once, before anyone has asked for the backlog.
      network.state.up = true;
      await outbox.submit([message("new", 20)]);
      await outbox.drain();

      expect(api.received().map((entry) => `${entry.deviceId}@${(Date.parse(entry.publishedAtUtc) - T0) / 1000}`)).toEqual(["old@0", "old@10", "new@20"]);
      expect(outbox.pending()).toBe(0);
    });

    it("does not make a round wait while a long backlog is being sent", async () => {
      const network = switchable(false);
      const outbox = outboxFor({ fetchImpl: network.fetchImpl, batchSize: 10 });
      for (let index = 0; index < 60; index += 1) await outbox.submit([message("old", index * 60)]);
      await outbox.drain();
      expect(outbox.pending()).toBe(60);

      network.state.up = true;
      api.respond((request, response, messages) => setTimeout(() => accepting(request, response, messages), 80));
      const draining = outbox.drain();
      const started = Date.now();
      await outbox.submit([message("new", 99_999)]);
      expect(Date.now() - started).toBeLessThan(60);
      await draining;
      await outbox.drain();

      const received = api.received();
      expect(received.map((entry) => entry.deviceId).slice(0, 60)).toEqual(Array.from({ length: 60 }, () => "old"));
      expect(received[received.length - 1]?.deviceId).toBe("new");
      expect(outbox.pending()).toBe(0);
    });

    it("keeps two rounds submitted together in the order they were submitted", async () => {
      api.respond((request, response, messages) => setTimeout(() => accepting(request, response, messages), 30));
      const outbox = outboxFor();
      await Promise.all([outbox.submit([message("first", 0)]), outbox.submit([message("second", 10)]), outbox.submit([message("third", 20)])]);
      expect(api.received().map((entry) => entry.deviceId)).toEqual(["first", "second", "third"]);
    });

    it("stops at the first temporary failure while sending a backlog and loses nothing", async () => {
      const network = switchable(false);
      const outbox = outboxFor({ fetchImpl: network.fetchImpl, batchSize: 5 });
      for (let index = 0; index < 20; index += 1) await outbox.submit([message("d", index * 60)]);
      await outbox.drain();

      network.state.up = true;
      let calls = 0;
      const accepted: number[] = [];
      api.respond((request, response, messages) => {
        calls += 1;
        if (calls > 2) return status(503)(request, response);
        accepted.push(...messages.map((entry) => (Date.parse(entry.publishedAtUtc) - T0) / 60_000));
        accepting(request, response, messages);
      });
      await outbox.drain();

      // Two requests of five went through; the platform then stopped answering and the rest stayed, in order.
      expect(outbox.pending()).toBe(10);
      expect(accepted).toEqual(Array.from({ length: 10 }, (_, index) => index));
      expect(buffer.snapshot().map((entry) => (Date.parse(entry.publishedAtUtc) - T0) / 60_000)).toEqual(Array.from({ length: 10 }, (_, index) => index + 10));
    });
  });

  describe("sizes", () => {
    it("sends no more than a hundred messages in a request", async () => {
      const outbox = outboxFor();
      await outbox.submit(Array.from({ length: 250 }, (_, index) => message(`d${index}`, 0)));
      expect(api.requests.map((request) => request.messages.length)).toEqual([100, 100, 50]);
    });

    it("keeps a request under the byte limit", async () => {
      const outbox = outboxFor({ maxBatchBytes: 1500 });
      await outbox.submit(Array.from({ length: 12 }, (_, index) => message(`device-${index}`, 0)));
      expect(api.requests.length).toBeGreaterThan(1);
      expect(api.requests.every((request) => JSON.stringify({ messages: request.messages }).length < 2200)).toBe(true);
      expect(api.received()).toHaveLength(12);
    });
  });

  describe("a long outage", () => {
    it("keeps a reading a minute for each point, not every one", async () => {
      const outbox = outboxFor({ fetchImpl: switchable(false).fetchImpl });
      // Two minutes of readings every ten seconds.
      for (let second = 0; second <= 120; second += 10) await outbox.submit([message("a", second)]);
      await outbox.drain();
      expect(buffer.snapshot().map((entry) => (Date.parse(entry.publishedAtUtc) - T0) / 1000)).toEqual([0, 60, 120]);
    });

    it("still keeps a reading that is not fine, and a switch that changed", async () => {
      const outbox = outboxFor({ fetchImpl: switchable(false).fetchImpl });
      await outbox.submit([message("a", 0, 1)]);
      await outbox.submit([message("a", 10, 2, "WARN")]);
      await outbox.submit([message("a", 20, 3)]);
      await outbox.submit([message("s", 0, false)]);
      await outbox.submit([message("s", 10, false)]);
      await outbox.submit([message("s", 20, true)]);
      await outbox.drain();
      expect(buffer.snapshot().map((entry) => `${entry.deviceId}:${entry.readings[0]?.value}`)).toEqual(["a:1", "a:2", "s:false", "s:true"]);
    });

    it("starts keeping every reading again once the queue has been emptied", async () => {
      const network = switchable(false);
      const outbox = outboxFor({ fetchImpl: network.fetchImpl });
      await outbox.submit([message("a", 0)]);
      await outbox.submit([message("a", 10)]);
      await outbox.drain();
      expect(outbox.pending()).toBe(1);

      network.state.up = true;
      await outbox.drain();
      expect(outbox.pending()).toBe(0);

      // A fresh outage starts from scratch: the first reading of it is kept, the next within a minute is not.
      network.state.up = false;
      await outbox.submit([message("a", 20)]);
      await outbox.submit([message("a", 30)]);
      await outbox.drain();
      expect(buffer.snapshot().map((entry) => (Date.parse(entry.publishedAtUtc) - T0) / 1000)).toEqual([20]);
    });

    it("reports how much is waiting and how old it is, even while a send is in progress", async () => {
      const outbox = outboxFor({ fetchImpl: switchable(false).fetchImpl });
      expect(outbox.oldestPendingAgeSeconds(T0 + 100_000)).toBeUndefined();
      await outbox.submit([message("a", 0)]);
      await outbox.submit([message("a", 60)]);
      expect(outbox.pending()).toBe(2);
      expect(outbox.oldestPendingAgeSeconds(T0 + 300_000)).toBe(300);
      await outbox.drain();
      expect(outbox.pending()).toBe(2);
      expect(outbox.oldestPendingAgeSeconds(T0 + 300_000)).toBe(300);
    });

    it("survives a restart: what was waiting is sent, in order", async () => {
      const directory = mkdtempSync(join(tmpdir(), "greecon-outbox-"));
      try {
        const path = join(directory, "buffer.jsonl");
        const first = new OfflineBuffer<TelemetryMessage>({ persistPath: path });
        const down = outboxFor({ fetchImpl: switchable(false).fetchImpl, buffer: first });
        await down.submit([message("a", 0)]);
        await down.submit([message("a", 60)]);
        await down.drain();

        const restarted = new OfflineBuffer<TelemetryMessage>({ persistPath: path });
        expect(restarted.size()).toBe(2);
        const back = outboxFor({ buffer: restarted });
        await back.drain();
        expect(api.received().map((entry) => (Date.parse(entry.publishedAtUtc) - T0) / 1000)).toEqual([0, 60]);
        expect(new OfflineBuffer<TelemetryMessage>({ persistPath: path }).size()).toBe(0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });
});
