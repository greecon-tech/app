import { createHash } from "node:crypto";
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import type { EdgeConfig, GatewayHeartbeat, TelemetryMessage } from "@greecon/shared";

// The platform as a box sees it: the three routes it calls, with the same answers, over a real socket.

export interface FakePlatform {
  url: string;
  /** What the box is told to read. Change it and the next heartbeat says so. */
  config: EdgeConfig;
  heartbeats: GatewayHeartbeat[];
  messages: TelemetryMessage[];
  /** Calls to each route, in the order they came. */
  calls: string[];
  /** How the platform answers everything: normally, or not at all (down), or refusing the credential. */
  mode: "normal" | "down" | "unauthorised";
  /** What the heartbeat reply says about the box's clock. */
  clockSkewSeconds: number;
  latestAgentVersion: string;
  /** Whether the heartbeat reply says a newer version is available. */
  updateAvailable: boolean;
  /** The code that enrols a box, and what it is given for it. */
  enrolCode: string;
  /** The software the platform offers, if any. `checksum` can be made wrong on purpose. */
  bundle?: { version: string; bytes: Buffer; checksum?: string };
  close(): Promise<void>;
}

export async function startFakePlatform(config: EdgeConfig, credential = "box-secret-0123456789"): Promise<FakePlatform> {
  const state: FakePlatform = {
    url: "",
    config,
    heartbeats: [],
    messages: [],
    calls: [],
    mode: "normal",
    clockSkewSeconds: 0,
    latestAgentVersion: "0.0.0+source",
    updateAvailable: false,
    enrolCode: "GRC-ABCD-EFGH-JKLM",
    close: async () => undefined
  };

  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    request.on("end", () => {
      const route = `${request.method} ${request.url}`;
      state.calls.push(route);
      if (state.mode === "down") return void request.socket.destroy();
      if (route === "POST /edge/enrol") {
        const sent = (chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {}) as { code?: string };
        if (sent.code !== state.enrolCode) return json(response, 401, { message: "That code has already been used, has expired, or is not one of ours." });
        return json(response, 201, { apiUrl: state.url, tenantId: state.config.tenantId, siteId: state.config.siteId, gatewayId: state.config.gatewayId, gatewayName: "Plant room", secret: credential });
      }
      if (state.mode === "unauthorised" || request.headers["x-edge-device-token"] !== credential) return json(response, 401, { message: "Authentication required." });
      const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;

      if (route === "GET /edge/config") return json(response, 200, state.config);
      if (route === "GET /edge/bundle.json" && state.bundle) {
        const { version, bytes, checksum } = state.bundle;
        return json(response, 200, { version, sha256: checksum ?? createHash("sha256").update(bytes).digest("hex"), size: bytes.length, builtAtUtc: new Date().toISOString() });
      }
      if (route === "GET /edge/bundle" && state.bundle) {
        response.writeHead(200, { "content-type": "application/javascript" });
        return void response.end(state.bundle.bytes);
      }
      if (route === "POST /edge/heartbeat") {
        state.heartbeats.push(body as GatewayHeartbeat);
        return json(response, 201, {
          serverTimeUtc: new Date().toISOString(),
          configVersion: state.config.version,
          clockSkewSeconds: state.clockSkewSeconds,
          latestAgentVersion: state.latestAgentVersion,
          updateAvailable: state.updateAvailable
        });
      }
      if (route === "POST /telemetry/ingest-batch") {
        const messages = (body as { messages: TelemetryMessage[] }).messages;
        state.messages.push(...messages);
        return json(response, 201, { results: messages.map(() => ({ accepted: true, ingested: 1, errors: [] })) });
      }
      return json(response, 404, { message: `Cannot ${route}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  state.close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return state;
}
