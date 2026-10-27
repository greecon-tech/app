import type { ModbusConnection, PointSource } from "./modbus";
import type { DriverDeviceStatus } from "./edge";

export const GREECON_COMPANY = "Greecon Sh.p.k";
export const GREECON_DOMAIN = "greecon.earth";
export const GREECON_PUBLIC_EMAILS = ["info@greecon.earth", "eridon.manuka@greecon.earth"] as const;

export const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export const siteTypes = [
  "farm",
  "greenhouse",
  "water_facility",
  "energy_site",
  "integrated_site",
  "demo_site"
] as const;
export type SiteType = (typeof siteTypes)[number];

export const assetTypes = [
  "WaterSystem",
  "SolarSystem",
  "BatterySystem",
  "FarmZone",
  "Greenhouse",
  "TreatmentUnit",
  "PumpStation",
  "IrrigationZone",
  "WeatherStation",
  "GridConnection",
  "Gateway"
] as const;
export type AssetType = (typeof assetTypes)[number];

export const qualityFlags = ["OK", "WARN", "BAD"] as const;
export type QualityFlag = (typeof qualityFlags)[number];

export const statusLabels = [
  "OK",
  "Watch",
  "Warning",
  "Critical",
  "Offline",
  "Simulated",
  "Manual Override",
  "Unknown"
] as const;
export type StatusLabel = (typeof statusLabels)[number];

export { describeAge } from "./age";
export * from "./energy-flow";
export * from "./value";
export * from "./access-requests";
export * from "./modbus";
export * from "./edge";
export * from "./device-profiles";
export * from "./site-templates";
export * from "./setup";
export * from "./notifications";
export * from "./acknowledge-link";
export * from "./fleet";
export * from "./quick-find";
export * from "./places";

export const severityLevels = ["info", "watch", "warning", "critical"] as const;
export type SeverityLevel = (typeof severityLevels)[number];

// ---- Health: the answer to "is everything all right?" ------------------------------------------
// The contract types for what the platform says about a site and about an account. How they are
// worked out lives in gaia-core (assessSiteHealth, assessTenantHealth); the screens only show them.

export const healthStates = ["stable", "attention", "action", "unknown"] as const;
export type HealthState = (typeof healthStates)[number];

/** One distinct word per state, so no screen has to rely on colour. */
export const HEALTH_LABELS: Readonly<Record<HealthState, string>> = {
  stable: "Stable",
  attention: "Attention needed",
  action: "Action required",
  unknown: "Unknown"
};

export interface HealthReason {
  state: Exclude<HealthState, "stable">;
  /** One plain sentence: what is wrong. */
  message: string;
  /** How serious the alert behind this reason is. Absent for "we cannot tell" reasons, which are
   * not alerts. */
  severity?: SeverityLevel;
  siteId: string;
  siteName: string;
}

export interface SiteHealth {
  siteId: string;
  siteName: string;
  state: HealthState;
  /** Why the site is not stable. Empty only when it is. Worst first. */
  reasons: HealthReason[];
}

export interface TenantHealth {
  state: HealthState;
  /** The state's word: Stable, Attention needed, Action required, Unknown. */
  label: string;
  /** One sentence that answers "is everything all right?". */
  headline: string;
  /** Everything behind the headline, worst first. Empty only when everything is stable. */
  reasons: HealthReason[];
  /** How much of the account the answer rests on. "9 of 10 sites reporting" is part of the answer. */
  coverage: { sites: number; sitesReporting: number };
}

/** Whether the rules judge a current reading abnormal. */
export type ReadingConcern = "warning" | "critical";


export const incidentStatuses = ["open", "acknowledged", "investigating", "resolved", "closed"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const userRoles = ["owner", "admin", "operator", "viewer", "auditor"] as const;
export type UserRole = (typeof userRoles)[number];

export type Permission =
  | "tenant:read"
  | "tenant:manage"
  | "site:read"
  | "site:manage"
  | "asset:read"
  | "asset:manage"
  | "device:read"
  | "device:manage"
  | "point:read"
  | "telemetry:ingest"
  | "automation:read"
  | "automation:manage"
  | "command:create"
  | "command:approve"
  | "alert:read"
  | "alert:acknowledge"
  | "incident:manage"
  | "maintenance:manage"
  | "report:export"
  | "audit:read"
  | "user:manage"
  | "settings:manage";

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  owner: [
    "tenant:read",
    "tenant:manage",
    "site:read",
    "site:manage",
    "asset:read",
    "asset:manage",
    "device:read",
    "device:manage",
    "point:read",
    "telemetry:ingest",
    "automation:read",
    "automation:manage",
    "command:create",
    "command:approve",
    "alert:read",
    "alert:acknowledge",
    "incident:manage",
    "maintenance:manage",
    "report:export",
    "audit:read",
    "user:manage",
    "settings:manage"
  ],
  admin: [
    "tenant:read",
    "site:read",
    "site:manage",
    "asset:read",
    "asset:manage",
    "device:read",
    "device:manage",
    "point:read",
    "telemetry:ingest",
    "automation:read",
    "automation:manage",
    "command:create",
    "alert:read",
    "alert:acknowledge",
    "incident:manage",
    "maintenance:manage",
    "report:export",
    "audit:read",
    "user:manage",
    "settings:manage"
  ],
  operator: [
    "tenant:read",
    "site:read",
    "asset:read",
    "device:read",
    "point:read",
    "telemetry:ingest",
    "automation:read",
    "command:create",
    "alert:read",
    "alert:acknowledge",
    "incident:manage",
    "maintenance:manage"
  ],
  viewer: ["tenant:read", "site:read", "asset:read", "device:read", "point:read", "automation:read", "alert:read"],
  auditor: ["tenant:read", "site:read", "asset:read", "device:read", "point:read", "automation:read", "alert:read", "audit:read", "report:export"]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export const canonicalPoints = [
  "water.tank.level.percent",
  "water.flow.lpm",
  "water.pressure.bar",
  "water.pump.status",
  "water.pump.command",
  "energy.solar.power.kw",
  "energy.consumption.kw",
  "energy.battery.soc.percent",
  "energy.battery.power.kw",
  "energy.grid.import.kw",
  "energy.grid.export.kw",
  "agri.soil.moisture.percent",
  "agri.air.temperature.c",
  "agri.humidity.percent",
  "agri.irrigation.command",
  "system.gateway.online"
] as const;
export type CanonicalPointName = (typeof canonicalPoints)[number];

/** What each canonical point is called on screen. The one place these names live, so every page
 * and message says the same thing. The wording of the first nine is also what saved dashboard
 * preferences are keyed by (see dashboardWidgetCatalog): change one and a saved preference stops
 * matching. */
export const canonicalPointLabels: Readonly<Record<CanonicalPointName, string>> = {
  "water.tank.level.percent": "Tank level",
  "water.flow.lpm": "Water flow",
  "water.pressure.bar": "Line pressure",
  "water.pump.status": "Pump status",
  "water.pump.command": "Pump command",
  "energy.solar.power.kw": "Solar production",
  "energy.consumption.kw": "Energy consumption",
  "energy.battery.soc.percent": "Battery state",
  "energy.battery.power.kw": "Battery power",
  "energy.grid.import.kw": "Grid import",
  "energy.grid.export.kw": "Grid export",
  "agri.soil.moisture.percent": "Soil moisture",
  "agri.air.temperature.c": "Air temperature",
  "agri.humidity.percent": "Humidity",
  "agri.irrigation.command": "Irrigation command",
  "system.gateway.online": "Gateway online"
};

// ---- Limits a site sets on a reading --------------------------------------------------------
// What counts as low, dry or out of date depends on the tank, the soil, the pump and the plant, so
// it belongs to the site, not to the platform. A limit is stored on the point (`thresholdConfig`).
// These definitions are the one list of which limits exist, what each means and what is allowed:
// the form reads them to show the right fields, and the API reads them to refuse a typo that would
// otherwise silently do nothing.

export const pointLimitKeys = ["critical_low", "warning_low", "irrigate_below", "frost_below", "dry_run_lpm", "surplus_min_kw", "max_age_seconds"] as const;
export type PointLimitKey = (typeof pointLimitKeys)[number];

export interface PointLimitDefinition {
  key: PointLimitKey;
  label: string;
  /** One sentence in plain language: what happens when the reading crosses it. */
  help: string;
  unit: string;
  /** The readings it can be set on. */
  appliesTo: readonly CanonicalPointName[] | "all";
  min: number;
  max: number;
  /** What the platform uses when the site sets nothing. Null means the platform then says nothing
   * rather than guess (irrigation advice, solar surplus). */
  fallback: number | null;
}

export const pointLimitDefinitions: readonly PointLimitDefinition[] = [
  {
    key: "critical_low",
    label: "Critical below",
    help: "Below this level the tank is critical and an Act now alert opens.",
    unit: "%",
    appliesTo: ["water.tank.level.percent"],
    min: 0,
    max: 100,
    fallback: 15
  },
  {
    key: "warning_low",
    label: "Low below",
    help: "Below this level a Check today alert opens that says to plan a refill.",
    unit: "%",
    appliesTo: ["water.tank.level.percent"],
    min: 0,
    max: 100,
    fallback: 35
  },
  {
    key: "warning_low",
    label: "Low below",
    help: "Below this charge a Check today alert opens. Set it above the reserve your battery system keeps for itself.",
    unit: "%",
    appliesTo: ["energy.battery.soc.percent"],
    min: 0,
    max: 100,
    fallback: 25
  },
  {
    key: "irrigate_below",
    label: "Start irrigating below",
    help: "The reading at which irrigation should start, in this sensor's own unit. It depends on this field's soil, crop and sensor depth. Without it the platform gives no irrigation advice.",
    unit: "as the sensor reports",
    appliesTo: ["agri.soil.moisture.percent"],
    min: 0,
    max: 1000,
    fallback: null
  },
  {
    key: "frost_below",
    label: "Frost alert at or below",
    help: "When the air at the field falls to this temperature, an Act now alert opens so that the crop can be protected. It depends on the crop and how far on it is: nobody can set it for the grower, so without it the platform says nothing about frost.",
    unit: "°C",
    appliesTo: ["agri.air.temperature.c"],
    min: -30,
    max: 15,
    fallback: null
  },
  {
    key: "dry_run_lpm",
    label: "No flow at or below",
    help: "With the pump confirmed running, flow at or below this for 30 seconds means no water is moving, and an Act now alert opens. It needs the pump's running state to be read as well. Raise it only if this pump normally runs at a trickle.",
    unit: "lpm",
    appliesTo: ["water.flow.lpm"],
    min: 0,
    max: 100000,
    fallback: 0.2
  },
  {
    key: "surplus_min_kw",
    label: "Smallest useful surplus",
    help: "Solar production above consumption by at least this much counts as available surplus. Set it to what the load you would run needs. Without it the platform makes no claim about surplus.",
    unit: "kW",
    appliesTo: ["energy.solar.power.kw"],
    min: 0,
    max: 100000,
    fallback: null
  },
  {
    key: "max_age_seconds",
    label: "Out of date after",
    help: "How long this reading may go without being renewed before it is shown as out of date.",
    unit: "seconds",
    appliesTo: "all",
    min: 30,
    max: 604800,
    fallback: null
  }
];

/** The limits that can be set on a given reading. A key can appear for more than one reading with
 * its own wording and standard value (a tank's low level is not a battery's). */
export function limitsFor(canonicalName: CanonicalPointName): PointLimitDefinition[] {
  return pointLimitDefinitions.filter((definition) => definition.appliesTo === "all" || definition.appliesTo.includes(canonicalName));
}

/** What is wrong with a set of limits, in sentences a person can act on. Empty when they are valid.
 * An unknown or misplaced limit is refused, not ignored: a mistyped name would otherwise do nothing
 * and look as if it worked. */
export function validatePointLimits(canonicalName: CanonicalPointName, limits: Record<string, unknown> | undefined): string[] {
  if (!limits) return [];
  const allowed = new Map(limitsFor(canonicalName).map((definition) => [definition.key as string, definition]));
  const problems: string[] = [];

  for (const [key, value] of Object.entries(limits)) {
    const definition = allowed.get(key);
    if (!definition) {
      problems.push(`"${key}" is not a limit that can be set on ${canonicalPointLabels[canonicalName]}.`);
    } else if (typeof value !== "number" || !Number.isFinite(value)) {
      problems.push(`${definition.label} must be a number.`);
    } else if (value < definition.min || value > definition.max) {
      problems.push(`${definition.label} must be between ${definition.min} and ${definition.max} ${definition.unit}.`);
    }
  }

  const critical = limits.critical_low;
  const low = limits.warning_low;
  if (typeof critical === "number" && typeof low === "number" && critical >= low) {
    problems.push("Critical below must be lower than Low below.");
  }
  return problems;
}

export const stateKeys = [
  "water.tank.critical",
  "water.tank.low",
  "water.pump.dry_run_risk",
  "energy.surplus_available",
  "energy.battery.constrained",
  "agri.irrigation_required",
  "agri.frost_risk",
  "energy.grid.direction_suspect",
  "system.communication_degraded",
  "system.sensor_quality_bad"
] as const;
export type StateKey = (typeof stateKeys)[number];

export const dashboardWidgetSizes = ["small", "medium", "large"] as const;
export type DashboardWidgetSize = (typeof dashboardWidgetSizes)[number];

// The full set of cards the Overview page (apps/web/src/app/page.tsx) can ever render — a given
// tenant may not see all of these at once (buildMetrics there only includes a card when the
// tenant's sites actually meter it), but the customize panel on /settings needs the full catalog
// to offer a size/order/visibility control for a card even when it's temporarily absent.
export const dashboardWidgetCatalog = [
  "Solar production",
  "Battery state",
  "Energy consumption",
  "Grid import",
  "Grid export",
  "Tank level",
  "Line pressure",
  "Soil moisture",
  "Edge connectivity"
] as const;

/** One entry per Overview metric card. `key` is that card's stable label (see
 * apps/web/src/app/page.tsx's buildMetrics) — array order is display priority. Persisted per user,
 * not per tenant: two people on the same team can each arrange their own view. */
export interface DashboardWidgetPreference {
  key: string;
  visible: boolean;
  size: DashboardWidgetSize;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: "active" | "suspended";
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  status: "active" | "disabled";
}

/** A person from Greecon who may open customers' accounts to set them up (the Clients console). */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  /** True for the person asking, so the list can say "you" and not offer to turn them off. */
  isYou: boolean;
}

/** Mirrors packages/gaia-core's SafetyLimits field-for-field, duplicated rather than imported so
 * this package doesn't take a dependency on gaia-core. Every field is optional: an unset field
 * falls back to gaia-core's defaultSafetyLimits (see PlatformService.createCommand). */
export interface SiteSafetyLimits {
  maxPressureBar?: number;
  dryRunFlowLpm?: number;
  maxPumpRuntimeMinutes?: number;
  minPumpRestMinutes?: number;
  maxIrrigationRunMinutes?: number;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  type: SiteType;
  locationName: string;
  latitude?: number;
  longitude?: number;
  status: StatusLabel;
  edgeStatus: StatusLabel;
  safetyLimits?: SiteSafetyLimits;
}

export interface Asset {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  type: AssetType;
  status: StatusLabel;
}

export const deviceProtocols = ["modbus", "opc_ua", "vendor_api", "analog", "simulated"] as const;
export type DeviceProtocol = (typeof deviceProtocols)[number];

export interface Device {
  id: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  gatewayId?: string;
  name: string;
  deviceType: string;
  protocol: DeviceProtocol;
  driverType: string;
  health: StatusLabel;
  lastSeenUtc?: string;
  firmwareVersion?: string;
  secureIdentityStatus: "placeholder" | "provisioned" | "revoked";
  /** Physical placement on the site's land layout, as a percentage (0-100) of the map area —
   * where the device actually sits in the field, not a computed/schematic position. Optional
   * because it is captured during site commissioning; devices without it fall back to a
   * generated layout. */
  positionX?: number;
  positionY?: number;
  placementNote?: string;
  /** Where the box at the site reaches this device on the site's network. Absent until someone
   * has entered it: a device without a connection is listed but never read. */
  connection?: ModbusConnection;
}

/** How recently a box has been heard from, in words that need no explaining. */
export const gatewayContacts = ["online", "late", "offline", "never"] as const;
export type GatewayContact = (typeof gatewayContacts)[number];

// One real industrial PC/gateway at a site. Its `id` is what a device's optional `gatewayId`
// points at; its own credential (never sent back after creation — see EdgeGatewayWithSecret) is
// what lets that specific box authenticate to POST /telemetry/ingest without needing any
// Railway/hosting-level configuration per client (docs/14-edge-hardware-deployment.md).
export interface EdgeGateway {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  status: StatusLabel;
  /** When the box last reported in (its heartbeat). Absent if it never has. */
  lastSeenUtc?: string;
  softwareVersion?: string;
  secureIdentityStatus: "placeholder" | "provisioned" | "revoked";
  /** When a box used this gateway's enrolment code. Absent while the gateway is waiting for its box. */
  enrolledAtUtc?: string;
  /** Computed when listed, from lastSeenUtc: never, online, late or offline. */
  contact?: GatewayContact;
  /** The version of the device configuration the box said it is running. */
  configVersion?: string;
  /** Readings waiting on the box because the platform could not be reached. */
  bufferDepth?: number;
  oldestBufferedAgeSeconds?: number;
  /** The box's clock minus the platform's, as of its last heartbeat. */
  clockSkewSeconds?: number;
  /** How each device answered the box's last round of reading. */
  drivers?: DriverDeviceStatus[];
}

export const pointCapabilities = ["read", "write", "read_write"] as const;
export type PointCapability = (typeof pointCapabilities)[number];

export interface Point {
  id: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  deviceId: string;
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
  quality: QualityFlag;
  capability: PointCapability;
  thresholdConfig?: Record<string, number>;
  metadata?: Record<string, string | number | boolean>;
  /** Which register the box reads this from and how it becomes a number. Absent until mapped. */
  source?: PointSource;
}

export interface TelemetryReading {
  timestampUtc: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  deviceId: string;
  pointId: string;
  canonicalName: CanonicalPointName;
  value: number | boolean | string;
  unit: string;
  quality: QualityFlag;
  source: "edge" | "cloud" | "simulator" | "manual";
  ingestionTimestampUtc: string;
}

export interface DerivedState {
  id: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  stateKey: StateKey;
  stateValue: boolean | number | string;
  severity: SeverityLevel;
  confidence: number;
  reason: string;
  sourceTelemetryRefs?: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export const rulePriorityLevels = [
  "safety",
  "asset_protection",
  "compliance",
  "optimization",
  "efficiency",
  "advisory"
] as const;
export type RulePriorityLevel = (typeof rulePriorityLevels)[number];

export const ruleExecutionModes = ["edge", "cloud_assisted", "advisory", "simulation"] as const;
export type RuleExecutionMode = (typeof ruleExecutionModes)[number];

export interface RuleCondition {
  point?: CanonicalPointName;
  stateKey?: StateKey;
  operator: "lt" | "lte" | "gt" | "gte" | "eq" | "neq";
  value: number | boolean | string;
}

export interface RuleAction {
  type: "command" | "alert" | "recommendation";
  targetCanonicalName?: CanonicalPointName;
  value?: number | boolean | string;
  message: string;
}

export interface AutomationRule {
  id: string;
  tenantId: string;
  siteId?: string;
  name: string;
  priority: RulePriorityLevel;
  triggerType: "threshold" | "schedule" | "trend" | "multi_variable" | "forecast" | "constraint" | "failsafe";
  conditions: RuleCondition[];
  constraints: RuleCondition[];
  actions: RuleAction[];
  executionMode: RuleExecutionMode;
  explanationTemplate: string;
  rollbackBehavior: string;
  enabled: boolean;
  approvalState: "draft" | "approved" | "disabled";
  version: number;
  createdBy: string;
  updatedBy: string;
}

export interface CommandTarget {
  deviceId: string;
  pointId: string;
  canonicalName: CanonicalPointName;
}

export interface CommandMessage {
  messageType: "command";
  commandId: string;
  tenantId: string;
  siteId: string;
  target: CommandTarget;
  requestedValue: number | boolean | string;
  requestedBy: string;
  requestedByRole: UserRole;
  reason: string;
  manualOverride?: {
    durationMinutes: number;
    expiresAtUtc: string;
  };
  issuedAtUtc: string;
  correlationId: string;
}

export interface CommandAckMessage {
  messageType: "command_ack";
  commandId: string;
  tenantId: string;
  siteId: string;
  deviceId: string;
  status: "accepted" | "rejected" | "executed" | "failed";
  acknowledgementUtc: string;
  result?: string;
  failureReason?: string;
  correlationId: string;
}

export interface TelemetryMessage {
  messageType: "telemetry";
  tenantId: string;
  siteId: string;
  deviceId: string;
  readings: TelemetryReading[];
  publishedAtUtc: string;
  correlationId: string;
}

export interface DeviceHealthMessage {
  messageType: "device_health";
  tenantId: string;
  siteId: string;
  gatewayId: string;
  status: StatusLabel;
  lastSeenUtc: string;
  softwareVersion?: string;
  bufferedReadings: number;
  clockDriftMs: number;
  correlationId: string;
}

export interface EdgeSyncMessage {
  messageType: "edge_sync";
  tenantId: string;
  siteId: string;
  gatewayId: string;
  batchId: string;
  startedAtUtc: string;
  completedAtUtc?: string;
  bufferedReadings: number;
  status: "started" | "completed" | "failed";
  correlationId: string;
}

export interface AlertMessage {
  messageType: "alert";
  alertId: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  category:
    | "equipment_failure"
    | "sensor_quality_degradation"
    | "resource_threshold"
    | "water_tank_critical"
    | "water_tank_low"
    | "pump_dry_run_risk"
    | "overpressure"
    | "battery_constrained"
    | "grid_direction_suspect"
    | "frost_risk"
    | "communication_degraded"
    | "site_offline"
    | "rule_conflict"
    | "manual_override_active";
  severity: SeverityLevel;
  title: string;
  suggestedAction: string;
  createdAtUtc: string;
  correlationId: string;
}

export function mqttTelemetryTopic(tenantId: string, siteId: string, deviceId: string): string {
  return `greecon/${tenantId}/${siteId}/telemetry/${deviceId}`;
}

export function mqttHealthTopic(tenantId: string, siteId: string, gatewayId: string): string {
  return `greecon/${tenantId}/${siteId}/health/${gatewayId}`;
}

export function mqttCommandTopic(tenantId: string, siteId: string, deviceId: string): string {
  return `greecon/${tenantId}/${siteId}/commands/${deviceId}`;
}

export function mqttCommandAckTopic(tenantId: string, siteId: string, deviceId: string): string {
  return `greecon/${tenantId}/${siteId}/commands/${deviceId}/ack`;
}

export function mqttEdgeSyncTopic(tenantId: string, siteId: string, gatewayId: string): string {
  return `greecon/${tenantId}/${siteId}/edge/${gatewayId}/sync`;
}

export function mqttAlertTopic(tenantId: string, siteId: string): string {
  return `greecon/${tenantId}/${siteId}/alerts`;
}

export function isQualityFlag(value: unknown): value is QualityFlag {
  return typeof value === "string" && qualityFlags.includes(value as QualityFlag);
}

export function isCanonicalPointName(value: unknown): value is CanonicalPointName {
  return typeof value === "string" && canonicalPoints.includes(value as CanonicalPointName);
}

/** How far ahead of the receiving server's clock a reading's own timestamp may be. A little slack
 * covers ordinary clock drift between a gateway and the cloud; far more than this means the
 * gateway's clock is wrong, and accepting it would let one bad timestamp shadow every real reading
 * that follows (the platform shows the reading with the newest timestamp as 'current'). */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function validateTelemetryMessage(message: TelemetryMessage, nowMs: number = Date.now()): string[] {
  const errors: string[] = [];
  if (message.messageType !== "telemetry") errors.push("messageType must be telemetry");
  if (!message.tenantId) errors.push("tenantId is required");
  if (!message.siteId) errors.push("siteId is required");
  if (!message.deviceId) errors.push("deviceId is required");
  if (!Array.isArray(message.readings) || message.readings.length === 0) errors.push("readings are required");

  for (const [index, reading] of message.readings.entries()) {
    // Each reading carries its own tenant and site. They must agree with the message they arrived
    // in: the caller is authenticated for the message's tenant, so a reading claiming another
    // tenant must never be stored under it. (A message may carry several devices' readings, so the
    // reading's deviceId is deliberately not required to equal the message's.)
    if (reading.tenantId !== message.tenantId) {
      errors.push(`readings[${index}].tenantId must match the message tenantId`);
    }
    if (reading.siteId !== message.siteId) {
      errors.push(`readings[${index}].siteId must match the message siteId`);
    }
    if (!reading.timestampUtc || Number.isNaN(Date.parse(reading.timestampUtc))) {
      errors.push(`readings[${index}].timestampUtc must be an ISO UTC timestamp`);
    } else if (Date.parse(reading.timestampUtc) > nowMs + MAX_FUTURE_SKEW_MS) {
      errors.push(`readings[${index}].timestampUtc is in the future by more than ${MAX_FUTURE_SKEW_MS / 60000} minutes; check the gateway clock`);
    }
    if (reading.timestampUtc && !reading.timestampUtc.endsWith("Z")) {
      errors.push(`readings[${index}].timestampUtc must be normalized to UTC`);
    }
    if (!isCanonicalPointName(reading.canonicalName)) {
      errors.push(`readings[${index}].canonicalName is not canonical`);
    }
    if (!isQualityFlag(reading.quality)) {
      errors.push(`readings[${index}].quality must be OK, WARN, or BAD`);
    }
  }

  return errors;
}
