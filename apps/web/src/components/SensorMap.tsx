import type { CSSProperties } from "react";
import { readingStatus } from "../lib/readings";
import { normalizeStatus, StatusBadge } from "./StatusBadge";

interface SensorMapDevice {
  id: string;
  name: string;
  deviceType: string;
  protocol: string;
  health: string;
  lastSeenUtc?: string;
  positionX?: number;
  positionY?: number;
  placementNote?: string;
}

interface SensorMapPoint {
  id: string;
  deviceId: string;
  label: string;
  unit: string;
}

interface SensorMapReading {
  pointId: string;
  value: number | boolean | string;
  quality: string;
  /** "out_of_date" once the reading is too old to rely on. */
  freshness?: "current" | "out_of_date";
  /** Set when the platform's rules judge a current reading abnormal. */
  concern?: "warning" | "critical";
}

// Worst last. "Unknown" outranks a warning: not being able to tell is worse than a known small
// problem, and only a known critical one is worse than not knowing.
const LEGEND_ORDER = ["ok", "simulated", "watch", "warning", "unknown", "critical"];
const LEGEND_LABEL: Record<string, string> = {
  ok: "Normal",
  simulated: "Simulated",
  watch: "Watch",
  warning: "Warning",
  unknown: "Unknown",
  critical: "Critical"
};
const BUCKET_RANK: Record<string, number> = { ok: 0, simulated: 1, watch: 2, warning: 3, unknown: 4, critical: 5 };

export function SensorMap({
  devices,
  points,
  readings
}: {
  devices: readonly SensorMapDevice[];
  points: readonly SensorMapPoint[];
  readings: readonly SensorMapReading[];
}) {
  if (devices.length === 0) {
    return <div className="empty-state">No devices registered for this site</div>;
  }

  const readingByPoint = new Map(readings.map((reading) => [reading.pointId, reading]));
  const { placed: devicesWithPosition, columns } = layoutDevices(devices);
  const deviceBuckets = new Map(devices.map((device) => [device.id, worstBucket(device, points, readingByPoint)]));
  const presentStatuses = new Set(deviceBuckets.values());
  const hasSurveyedPlacement = devices.some((device) => device.positionX !== undefined && device.positionY !== undefined);

  return (
    <div className="site-map-block">
      <div
        className={`site-map${hasSurveyedPlacement ? " site-map--field" : ""}`}
        style={{ "--site-map-columns": columns } as CSSProperties}
        role="img"
        aria-label={hasSurveyedPlacement ? "Map of where each sensor is physically placed on site" : "Schematic layout of site devices by status"}
      >
        {devicesWithPosition.map(({ device, x, y }) => {
          const bucket = deviceBuckets.get(device.id) ?? "ok";
          return (
            <div
              className="site-map__node"
              key={device.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${device.name}${device.placementNote ? ` — ${device.placementNote}` : ""} — ${LEGEND_LABEL[bucket]}`}
            >
              <span className={`site-map__dot status-${bucket}`} />
              <span className="site-map__label">{device.name}</span>
            </div>
          );
        })}
      </div>
      <p className="muted site-map__caption">
        {hasSurveyedPlacement ? "Positions reflect where each sensor is physically installed on site." : "Real installed positions are not yet recorded for this site — showing a generated layout."}
      </p>
      <div className="site-map__legend">
        {LEGEND_ORDER.filter((bucket) => presentStatuses.has(bucket)).map((bucket) => (
          <span className="site-map__legend-item" key={bucket}>
            <span className={`site-map__dot status-${bucket}`} />
            {LEGEND_LABEL[bucket]}
          </span>
        ))}
      </div>
      <div className="sensor-map">
        {devices.map((device) => {
          const devicePoints = points.filter((point) => point.deviceId === device.id);
          return (
            <article className="sensor-node" key={device.id}>
              <div className="sensor-node__header">
                <div>
                  <strong>{device.name}</strong>
                  <p>{formatDeviceType(device.deviceType)} · {device.protocol}</p>
                </div>
                <StatusBadge status={device.health} />
              </div>
              <div className="sensor-node__readings">
                {devicePoints.length === 0 ? (
                  <p className="muted">No points configured</p>
                ) : (
                  devicePoints.map((point) => {
                    const reading = readingByPoint.get(point.id);
                    return (
                      <div className="sensor-node__reading" key={point.id}>
                        <span>{point.label}</span>
                        <div className="sensor-node__reading-value">
                          <strong>
                            {reading ? formatValue(reading.value) : "—"}
                            {point.unit ? <small> {point.unit}</small> : null}
                          </strong>
                          {reading ? <ReadingChip reading={reading} /> : <span className="muted">No data</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {device.lastSeenUtc ? <p className="sensor-node__meta">Last seen {formatTimestamp(device.lastSeenUtc)}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Prefers each device's real surveyed placement (positionX/positionY, captured at site
 * commissioning) so the map shows where the sensor actually sits in the field. Only devices
 * missing that data fall back to a deterministic generated grid, so an unsurveyed device still
 * appears on the map without pretending to know its real location. */
function layoutDevices(devices: readonly SensorMapDevice[]): { placed: Array<{ device: SensorMapDevice; x: number; y: number }>; columns: number } {
  const positioned = devices.filter((device) => device.positionX !== undefined && device.positionY !== undefined);
  const unpositioned = devices.filter((device) => device.positionX === undefined || device.positionY === undefined);

  const placed: Array<{ device: SensorMapDevice; x: number; y: number }> = positioned.map((device) => ({
    device,
    x: device.positionX as number,
    y: device.positionY as number
  }));

  const count = unpositioned.length;
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));

  let index = 0;
  for (let row = 0; row < rows; row++) {
    const itemsInRow = Math.min(columns, count - row * columns);
    for (let col = 0; col < itemsInRow; col++) {
      const device = unpositioned[index];
      if (device) {
        placed.push({
          device,
          x: ((col + 1) / (itemsInRow + 1)) * 100,
          y: ((row + 1) / (rows + 1)) * 100
        });
      }
      index++;
    }
  }

  // How many devices sit side by side in the widest row: a label is kept shorter than the space between two of them (see .site-map__node).
  return { placed, columns };
}

/** A word beside a reading only when it has something to say: nothing is claimed for a reading
 * that is merely fine. */
function ReadingChip({ reading }: { reading: SensorMapReading }) {
  const status = readingStatus(reading);
  return status ? <StatusBadge status={status} /> : null;
}

function legendBucket(status: string): string {
  switch (normalizeStatus(status)) {
    case "ok":
    case "stable":
      return "ok";
    case "simulated":
    case "manual-override":
      return "simulated";
    case "watch":
      return "watch";
    case "warning":
    case "uncertain":
    case "bad-data":
    case "attention-needed":
      return "warning";
    case "critical":
    case "action-required":
      return "critical";
    default:
      // Offline, Unknown, Out of date: we cannot tell, which is not the same as fine or as failed.
      return "unknown";
  }
}

/** A device can look healthy (health: OK) while one of its readings has degraded quality —
 * the map should surface whichever is worse so a problem reading isn't hidden behind a green dot. */
function worstBucket(device: SensorMapDevice, points: readonly SensorMapPoint[], readingByPoint: Map<string, SensorMapReading>): string {
  let bucket = legendBucket(device.health);
  for (const point of points) {
    if (point.deviceId !== device.id) continue;
    const reading = readingByPoint.get(point.id);
    if (!reading) continue;
    const readingBucket = legendBucket(readingStatus(reading) ?? "OK");
    if ((BUCKET_RANK[readingBucket] ?? 0) > (BUCKET_RANK[bucket] ?? 0)) bucket = readingBucket;
  }
  return bucket;
}

function formatDeviceType(deviceType: string): string {
  const spaced = deviceType.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: number | boolean | string): string {
  if (typeof value === "number") return value.toFixed(1);
  return String(value);
}

function formatTimestamp(timestampUtc: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestampUtc));
}
