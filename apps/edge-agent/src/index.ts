import mqtt from "mqtt";
import { DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { TelemetryForwarder } from "./forwarder";
import { OfflineBuffer } from "./offline-buffer";

// Bridges the on-site MQTT broker to the cloud API. Telemetry published locally by drivers or
// the edge simulator (docs/04-edge-runtime.md) has nowhere to go without this: the API only
// exposes POST /telemetry/ingest over HTTP, nothing on this stack subscribes to MQTT directly.
// This is the missing link between "a gateway is publishing on the local broker" and "the reading
// shows up on the dashboard" — see docs/14-edge-hardware-deployment.md for the full deployment.
const tenantId = process.env.TENANT_ID ?? DEMO_TENANT_ID;
const siteId = process.env.SITE_ID ?? "22222222-2222-4222-8222-222222222201";
const gatewayId = process.env.GATEWAY_ID ?? "77777777-7777-4777-8777-777777777701";
const mqttUrl = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const apiUrl = process.env.API_URL ?? "http://localhost:4000";
// Real device credential (docs/07-security-and-rbac.md) — the API only accepts this on POST
// /telemetry/ingest, scoped server-side to whatever tenant EDGE_INGEST_TENANT_ID names there.
// Unset (local dev without a real deployment) falls back to the old header-trust path, which the
// API only still honors when it isn't running in production.
const edgeToken = process.env.EDGE_TOKEN;
const apiRole = process.env.API_ROLE ?? "operator";
const flushIntervalMs = Number(process.env.FLUSH_INTERVAL_MS ?? 10_000);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000);
// Where readings the API could not take are kept so a restart or power cut does not lose them.
// Unset keeps them in memory only (local development).
const bufferPath = process.env.BUFFER_PATH;
const bufferMaxItems = Number(process.env.BUFFER_MAX_ITEMS ?? 50_000);

const telemetryTopic = `greecon/${tenantId}/${siteId}/telemetry/+`;
const healthTopic = `greecon/${tenantId}/${siteId}/health/+`;

const log = {
  info: (message: string) => process.stdout.write(`${message}\n`),
  error: (message: string) => process.stderr.write(`${message}\n`)
};

// Readings lost to the size cap are counted and reported once per flush interval, not logged one
// by one: during a long outage that would be one line per reading.
let discardedSinceReport = 0;
const buffer = new OfflineBuffer<TelemetryMessage>({
  maxItems: bufferMaxItems,
  persistPath: bufferPath,
  onDrop: (_item, reason) => {
    if (reason.startsWith("buffer full")) discardedSinceReport += 1;
  }
});

const forwarder = new TelemetryForwarder({
  apiUrl,
  headers: edgeToken ? { "x-edge-device-token": edgeToken } : { "x-user-role": apiRole, "x-tenant-id": tenantId },
  buffer,
  log,
  timeoutMs: requestTimeoutMs
});

const client = mqtt.connect(mqttUrl, {
  clientId: `greecon-edge-agent-${gatewayId}`,
  clean: true,
  reconnectPeriod: 3000
});

client.on("connect", () => {
  client.subscribe([telemetryTopic, healthTopic]);
  log.info(`Edge agent connected to ${mqttUrl}, bridging ${telemetryTopic} -> ${apiUrl}/telemetry/ingest`);
  void forwarder.flush();
});

client.on("error", (error) => {
  log.error(`MQTT connection error: ${error.message}`);
});

client.on("message", (topic, payload) => {
  if (topic.includes("/health/")) {
    log.info(`[health] ${payload.toString()}`);
    return;
  }

  let message: TelemetryMessage;
  try {
    message = JSON.parse(payload.toString()) as TelemetryMessage;
  } catch (error) {
    log.error(`Discarding malformed telemetry payload on ${topic}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  void forwarder.forward(message);
});

setInterval(() => {
  if (discardedSinceReport > 0) {
    log.error(`Buffer full: discarded ${discardedSinceReport} oldest reading(s) since the last report. The API has been unreachable for a long time.`);
    discardedSinceReport = 0;
  }
  void forwarder.flush();
}, flushIntervalMs);

log.info(
  `Greecon edge agent starting for ${tenantId}/${siteId}, gateway ${gatewayId}. ` +
    `Buffer: ${bufferPath ? `${bufferPath} (${buffer.size()} reading(s) restored)` : "memory only"}, up to ${bufferMaxItems}.`
);
