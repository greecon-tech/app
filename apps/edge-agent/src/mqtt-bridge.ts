import mqtt from "mqtt";
import type { TelemetryMessage } from "@greecon/shared";
import type { EdgeIdentity } from "./identity";
import type { Outbox } from "./outbox";
import type { RuntimeLog } from "./runtime";

/** An optional way in for readings from something else on the box (the simulator, a future driver):
 * whatever it publishes on the site's telemetry topic goes out through the same queue as the box's own
 * readings. Off unless MQTT_URL is set; a real site needs no broker. */
export function startMqttBridge(url: string, identity: EdgeIdentity, outbox: Outbox, log: RuntimeLog): { stop(): Promise<void> } {
  const topic = `greecon/${identity.tenantId}/${identity.siteId}/telemetry/+`;
  const client = mqtt.connect(url, { clientId: `greecon-edge-${identity.gatewayId}`, clean: true, reconnectPeriod: 3000 });

  client.on("connect", () => {
    client.subscribe(topic);
    log.info(`Listening on ${url} for readings from other software on this box (${topic}).`);
  });
  client.on("error", (error) => log.error(`MQTT connection error: ${error.message}`));
  client.on("message", (_topic, payload) => {
    let message: TelemetryMessage;
    try {
      message = JSON.parse(payload.toString()) as TelemetryMessage;
    } catch (error) {
      log.error(`Discarding a malformed message from MQTT: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    void outbox.submit([message]);
  });

  return { stop: () => client.endAsync().then(() => undefined) };
}
