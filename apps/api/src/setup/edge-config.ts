import { createHash } from "crypto";
import type { Device, EdgeConfig, EdgeConfigDevice, EdgeGateway, Point } from "@greecon/shared";

/** How often the box reads every device. Ten seconds keeps the energy picture lively without
 * flooding the platform; the totals are integrated from these readings, so a steadier cadence is
 * better than a faster one. */
export const DEFAULT_POLL_INTERVAL_MS = 10_000;

/** JSON with the keys of every object in sorted order, so equal content always gives equal text
 * whatever order it was built in (a database hands object keys back in its own order). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** What one box is told to read: the Modbus devices assigned to it that have an address, with the
 * readings that have been mapped to registers. Anything not yet described is left out, not guessed. */
export function buildEdgeConfig(gateway: EdgeGateway, devices: readonly Device[], points: readonly Point[], pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS): EdgeConfig {
  const configured: EdgeConfigDevice[] = devices
    .filter((device) => device.tenantId === gateway.tenantId && device.siteId === gateway.siteId && device.gatewayId === gateway.id)
    .filter((device) => device.protocol === "modbus" && device.connection !== undefined)
    .map((device) => ({
      deviceId: device.id,
      name: device.name,
      connection: device.connection as NonNullable<Device["connection"]>,
      points: points
        .filter((point) => point.deviceId === device.id && point.source !== undefined && point.capability !== "write")
        .map((point) => ({
          pointId: point.id,
          ...(point.assetId ? { assetId: point.assetId } : {}),
          canonicalName: point.canonicalName,
          label: point.label,
          unit: point.unit,
          source: point.source as NonNullable<Point["source"]>
        }))
        .sort((a, b) => a.pointId.localeCompare(b.pointId))
    }))
    .filter((device) => device.points.length > 0)
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));

  const body = { tenantId: gateway.tenantId, siteId: gateway.siteId, gatewayId: gateway.id, pollIntervalMs, devices: configured };
  return { version: createHash("sha256").update(canonicalJson(body)).digest("hex").slice(0, 16), ...body };
}
