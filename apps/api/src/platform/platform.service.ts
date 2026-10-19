import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { generateTemporaryPassword } from "../common/generate-password";
import {
  AlertMessage,
  Asset,
  AutomationRule,
  CanonicalPointName,
  CommandAckMessage,
  CommandMessage,
  DashboardWidgetPreference,
  DEMO_TENANT_ID,
  DerivedState,
  Device,
  EdgeGateway,
  EdgeSyncMessage,
  EnergyFlowView,
  FlowReading,
  Point,
  QualityFlag,
  RuleAction,
  RuleCondition,
  RuleExecutionMode,
  RulePriorityLevel,
  Site,
  StateKey,
  StatusLabel,
  TelemetryMessage,
  TelemetryReading,
  Tenant,
  User,
  UserRole,
  deriveEnergyFlow,
  hasPermission,
  validatePointLimits,
  validateTelemetryMessage
} from "@greecon/shared";
import {
  alertConditionsFromStates,
  assessSensorAge,
  assessSiteHealth,
  assessTenantHealth,
  concernForReading,
  defaultSafetyLimits,
  evaluableCategories,
  deriveOperationalStates,
  evaluateCommandSafety,
  normalizeTelemetryTimestamp,
  reconcileAlerts,
  simulateRule,
  statusLabelFor,
  type AlertChange,
  type Concern,
  type HealthState,
  type SensorSnapshot,
  type SensorSnapshotValue,
  type SiteHealth,
  type StateSnapshot
} from "@greecon/gaia-core";
import { Principal } from "../common/principal";
import { generateGatewaySecret, hashGatewaySecret } from "../common/gateway-secret";
import { DatabaseService } from "../database/database.service";

/** A latest reading as the Overview presents it: the value, where it came from, and how old it is. */
export interface OverviewReading {
  value: number | boolean | string;
  unit: string;
  siteId: string;
  siteName: string;
  /** When the measurement was taken, by the source's own clock. */
  asOfUtc: string;
  /** How old that is, in seconds. Absent when the reading carries no usable timestamp. */
  ageSeconds?: number;
  /** "current" while it can still be relied on. "out_of_date" once it cannot: the last value is
   * kept, because it is worth seeing, but it must never look live. */
  freshness: "current" | "out_of_date";
  quality: QualityFlag;
  /** Set only for a current reading the rules judge abnormal. */
  concern?: Concern;
}

/** A site as it is shown: its record with status computed from the evidence, its own health, and
 * when it last reported (absent if it never has). */
export type SiteView = Site & { health: SiteHealth; lastReadingAtUtc?: string };

/** A point's latest reading, with its age, whether it can still be relied on, and, for a current
 * reading, whether the rules judge it abnormal. */
export type LatestReading = TelemetryReading & { ageSeconds?: number; freshness: "current" | "out_of_date"; concern?: Concern };

function newestTimestamp(readings: ReadonlyArray<TelemetryReading>): string | undefined {
  return readings.reduce<string | undefined>(
    (latest, item) => (latest === undefined || Date.parse(item.timestampUtc) > Date.parse(latest) ? item.timestampUtc : latest),
    undefined
  );
}

const OVERVIEW_STATUS: Record<HealthState, string> = {
  stable: "System stable",
  attention: "Attention needed",
  action: "Action required",
  unknown: "Status unknown"
};

export interface CreateRuleInput {
  siteId?: string;
  name: string;
  priority: RulePriorityLevel;
  triggerType: string;
  conditions: RuleCondition[];
  constraints: RuleCondition[];
  actions: RuleAction[];
  executionMode: RuleExecutionMode;
  explanationTemplate: string;
  rollbackBehavior: string;
}

export type UpdateRuleInput = Partial<Omit<CreateRuleInput, "siteId">>;

export interface CreateTenantInput {
  name: string;
  domain: string;
  ownerName: string;
  ownerEmail: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserInput {
  role?: UserRole;
  status?: User["status"];
}

export interface CreateSiteInput {
  name: string;
  type: Site["type"];
  locationName: string;
  latitude?: number;
  longitude?: number;
}

export type UpdateSiteInput = Partial<CreateSiteInput> & {
  status?: Site["status"];
  edgeStatus?: Site["edgeStatus"];
  safetyLimits?: Site["safetyLimits"];
};

export interface CreateAssetInput {
  siteId: string;
  name: string;
  type: Asset["type"];
}

export type UpdateAssetInput = Partial<Omit<CreateAssetInput, "siteId">>;

export interface CreateDeviceInput {
  siteId: string;
  assetId?: string;
  gatewayId?: string;
  name: string;
  deviceType: string;
  protocol: Device["protocol"];
  driverType: string;
  positionX?: number;
  positionY?: number;
  placementNote?: string;
}

export interface CreateGatewayInput {
  siteId: string;
  name: string;
}

export type UpdateDeviceInput = Partial<Omit<CreateDeviceInput, "siteId">> & { health?: Device["health"] };

export interface CreatePointInput {
  siteId: string;
  assetId?: string;
  deviceId: string;
  canonicalName: Point["canonicalName"];
  label: string;
  unit: string;
  capability: Point["capability"];
  thresholdConfig?: Record<string, number>;
}

export type UpdatePointInput = Partial<Omit<CreatePointInput, "siteId" | "deviceId" | "canonicalName">> & { quality?: Point["quality"] };

export interface CreateMaintenanceTaskInput {
  siteId: string;
  assetId?: string;
  incidentId?: string;
  title: string;
  notes?: string;
  dueAtUtc?: string;
}

export interface UpdateMaintenanceTaskInput {
  title?: string;
  notes?: string;
  dueAtUtc?: string;
  status?: MaintenanceTask["status"];
  completionLog?: string;
}

export interface CommandRecord {
  id: string;
  tenantId: string;
  siteId: string;
  targetDeviceId: string;
  targetPointId: string;
  canonicalName: string;
  requestedValue: number | boolean | string;
  requestedBy: string;
  requestedByRole: UserRole;
  reason: string;
  safetyEvaluation: ReturnType<typeof evaluateCommandSafety>;
  /** Whether this command could reach equipment. Every command is "simulated" in this build: the
   * request, the checks and the person are recorded, and nothing is sent. "live" is added only when
   * the release gate for the first real write has been met (docs/23-safety-and-security-case.md). */
  executionMode: "simulated";
  dispatchStatus: "blocked" | "simulated_dispatch" | "acknowledged" | "failed";
  acknowledgement?: CommandAckMessage;
  result?: string;
  failureReason?: string;
  rollbackStatus?: string;
  auditEventId: string;
  correlationId: string;
  createdAtUtc: string;
}

export interface AlertRecord {
  id: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  category: AlertMessage["category"];
  severity: AlertMessage["severity"];
  status: "open" | "acknowledged" | "resolved";
  title: string;
  suggestedAction: string;
  createdAtUtc: string;
  /** Set when a person acknowledged it. */
  acknowledgedAtUtc?: string;
  /** Set when the condition behind it cleared. */
  resolvedAtUtc?: string;
}

export interface IncidentRecord {
  id: string;
  tenantId: string;
  siteId: string;
  alertId?: string;
  status: "open" | "acknowledged" | "investigating" | "resolved" | "closed";
  severity: AlertMessage["severity"];
  title: string;
  investigationNotes?: string;
  updatedAtUtc: string;
}

export interface MaintenanceTask {
  id: string;
  tenantId: string;
  siteId: string;
  assetId?: string;
  incidentId?: string;
  title: string;
  notes?: string;
  dueAtUtc?: string;
  completedAtUtc?: string;
  completionLog?: string;
  status: "open" | "complete";
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  eventType: string;
  siteId?: string;
  assetId?: string;
  entityType: string;
  entityId?: string;
  beforeMetadata?: Record<string, unknown>;
  afterMetadata?: Record<string, unknown>;
  reason?: string;
  createdAtUtc: string;
}

export interface CreateCommandInput {
  siteId: string;
  targetDeviceId: string;
  targetPointId: string;
  requestedValue: number | boolean | string;
  reason: string;
  manualOverride?: {
    durationMinutes: number;
    reason: string;
  };
}

export interface ReportExportInput {
  siteId?: string;
  reportType: "operational" | "sustainability" | "audit" | "incident";
  parameters?: Record<string, string | number | boolean>;
}

export interface EdgeSyncInput {
  siteId: string;
  gatewayId: string;
  status: EdgeSyncMessage["status"];
  bufferedReadings: number;
  startedAtUtc: string;
  completedAtUtc?: string;
}

// How often every site's states are re-derived against the clock, so a gateway that has gone quiet is
// noticed within about a minute even though nothing is arriving to trigger a refresh.
const HEALTH_MONITOR_INTERVAL_MS = 60_000;

@Injectable()
export class PlatformService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PlatformService.name);
  private healthMonitor?: ReturnType<typeof setInterval>;

  constructor(private readonly db: DatabaseService) {}

  // Starts after hydration (onModuleInit) so the first pass sees real data. Derived states are not
  // stored, so without this a restart would leave every site with no states until its next reading.
  async onApplicationBootstrap(): Promise<void> {
    await this.refreshAllDerivedStates();
    this.startHealthMonitor();
  }

  onApplicationShutdown(): void {
    this.stopHealthMonitor();
  }

  startHealthMonitor(intervalMs: number = HEALTH_MONITOR_INTERVAL_MS): void {
    if (this.healthMonitor) return;
    this.healthMonitor = setInterval(() => {
      // One bad pass must not take the API down; the next tick tries again.
      void Promise.resolve()
        .then(() => this.refreshAllDerivedStates())
        .catch((error: unknown) => {
          this.logger.warn(`Health monitor pass failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    }, intervalMs);
    // The monitor must never be the reason the process stays alive.
    this.healthMonitor.unref?.();
  }

  stopHealthMonitor(): void {
    if (!this.healthMonitor) return;
    clearInterval(this.healthMonitor);
    this.healthMonitor = undefined;
  }

  async onModuleInit(): Promise<void> {
    // Every domain with a real mutating endpoint (sites/assets/devices/points, rules, telemetry,
    // commands, alerts, incidents, edge-sync, report exports, audit, maintenance tasks) hydrates
    // from Postgres here and dual-writes on every mutation, so a restart doesn't lose real pilot
    // data. When no DATABASE_URL is set (the static GitHub Pages demo, or local dev without a
    // database), all of this falls back to the hardcoded seed data below exactly as before.
    if (!this.db.isConfigured()) return;

    const tenantRows = await this.db.query<TenantRow>("SELECT * FROM tenants ORDER BY created_at ASC");
    if (tenantRows.rows.length > 0) this.tenants = tenantRows.rows.map((row) => mapTenantRow(row));

    const userRows = await this.db.query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.status, m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id
       ORDER BY u.created_at ASC`
    );
    if (userRows.rows.length > 0) this.users = userRows.rows.map((row) => mapUserRow(row));

    // Sites/assets/devices/points hydrate first, in that dependency order, since commands below
    // looks up canonical point names via this.points — it must see the real hydrated points, not
    // the hardcoded seed array, or a pilot's real command history would show the wrong names.
    const siteRows = await this.db.query<SiteRow>("SELECT * FROM sites ORDER BY created_at ASC");
    if (siteRows.rows.length > 0) this.sites = siteRows.rows.map((row) => mapSiteRow(row));

    const assetRows = await this.db.query<AssetRow>("SELECT * FROM assets ORDER BY created_at ASC");
    if (assetRows.rows.length > 0) this.assets = assetRows.rows.map((row) => mapAssetRow(row));

    const deviceRows = await this.db.query<DeviceRow>("SELECT * FROM devices ORDER BY created_at ASC");
    if (deviceRows.rows.length > 0) this.devices = deviceRows.rows.map((row) => mapDeviceRow(row));

    const pointRows = await this.db.query<PointRow>("SELECT * FROM points ORDER BY created_at ASC");
    if (pointRows.rows.length > 0) this.points = pointRows.rows.map((row) => mapPointRow(row));

    // secret_hash is deliberately excluded from this SELECT — it never needs to exist in memory
    // beyond the moment it's written at creation, and PrincipalGuard queries it directly from
    // Postgres per request rather than through this in-memory list.
    const gatewayRows = await this.db.query<EdgeGatewayRow>(
      "SELECT id, tenant_id, site_id, name, status, last_seen_utc, software_version, secure_identity_status FROM edge_gateways ORDER BY created_at ASC"
    );
    if (gatewayRows.rows.length > 0) this.gateways = gatewayRows.rows.map((row) => mapGatewayRow(row));

    const rows = await this.db.query<RuleRow>("SELECT * FROM rules ORDER BY created_at ASC");
    if (rows.rows.length > 0) this.rules = rows.rows.map((row) => mapRuleRow(row));

    const telemetryRows = await this.db.query<TelemetryRow>("SELECT DISTINCT ON (point_id) * FROM telemetry_readings ORDER BY point_id, timestamp_utc DESC");
    if (telemetryRows.rows.length > 0) this.telemetry = telemetryRows.rows.map((row) => mapTelemetryRow(row));

    const commandRows = await this.db.query<CommandRow>("SELECT * FROM commands ORDER BY created_at DESC LIMIT 500");
    if (commandRows.rows.length > 0) this.commands = commandRows.rows.map((row) => mapCommandRow(row, this.points));

    const alertRows = await this.db.query<AlertRow>("SELECT * FROM alerts ORDER BY created_at DESC");
    if (alertRows.rows.length > 0) this.alerts = alertRows.rows.map((row) => mapAlertRow(row));

    const incidentRows = await this.db.query<IncidentRow>("SELECT * FROM incidents ORDER BY created_at DESC");
    if (incidentRows.rows.length > 0) this.incidents = incidentRows.rows.map((row) => mapIncidentRow(row));

    const auditRows = await this.db.query<AuditRow>("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 500");
    if (auditRows.rows.length > 0) this.auditEvents = auditRows.rows.map((row) => mapAuditRow(row));

    const edgeSyncRows = await this.db.query<EdgeSyncRow>("SELECT * FROM edge_sync_batches ORDER BY created_at DESC LIMIT 200");
    if (edgeSyncRows.rows.length > 0) this.edgeSyncBatches = edgeSyncRows.rows.map((row) => mapEdgeSyncRow(row));

    const reportRows = await this.db.query<ReportExportRow>("SELECT * FROM report_exports ORDER BY created_at DESC LIMIT 200");
    if (reportRows.rows.length > 0) this.reportExports = reportRows.rows.map((row) => mapReportExportRow(row));

    const maintenanceRows = await this.db.query<MaintenanceTaskRow>("SELECT * FROM maintenance_tasks ORDER BY created_at ASC");
    if (maintenanceRows.rows.length > 0) this.maintenanceTasks = maintenanceRows.rows.map((row) => mapMaintenanceTaskRow(row));
  }

  private tenants: Tenant[] = [
    { id: DEMO_TENANT_ID, name: "Greecon Demo", domain: "demo.greecon.earth", status: "active" }
  ];

  private users: User[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      tenantId: DEMO_TENANT_ID,
      email: "eridon.manuka@greecon.earth",
      name: "Eridon Manuka",
      role: "owner",
      status: "active"
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      tenantId: DEMO_TENANT_ID,
      email: "operator@greecon.earth",
      name: "Demo Operator",
      role: "operator",
      status: "active"
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      tenantId: DEMO_TENANT_ID,
      email: "auditor@greecon.earth",
      name: "Demo Auditor",
      role: "auditor",
      status: "active"
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
      tenantId: DEMO_TENANT_ID,
      email: "admin@greecon.earth",
      name: "Demo Admin",
      role: "admin",
      status: "active"
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
      tenantId: DEMO_TENANT_ID,
      email: "viewer@greecon.earth",
      name: "Demo Viewer",
      role: "viewer",
      status: "active"
    }
  ];

  private sites: Site[] = [
    {
      id: "22222222-2222-4222-8222-222222222201",
      tenantId: DEMO_TENANT_ID,
      name: "Integrated Farm Site",
      type: "integrated_site",
      locationName: "Durana Tech Park, Albania",
      latitude: 41.368786,
      longitude: 19.615673,
      status: "OK",
      edgeStatus: "OK"
    },
    {
      id: "22222222-2222-4222-8222-222222222202",
      tenantId: DEMO_TENANT_ID,
      name: "Water Management Site",
      type: "water_facility",
      locationName: "Albania",
      status: "Watch",
      edgeStatus: "OK"
    },
    {
      id: "22222222-2222-4222-8222-222222222203",
      tenantId: DEMO_TENANT_ID,
      name: "Solar + Battery Site",
      type: "energy_site",
      locationName: "Albania",
      status: "OK",
      edgeStatus: "Simulated"
    }
  ];

  private assets: Asset[] = [
    { id: "33333333-3333-4333-8333-333333333301", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", name: "Solar Array A", type: "SolarSystem", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333302", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222203", name: "Battery Bank A", type: "BatterySystem", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333303", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", name: "Primary Water Tank", type: "WaterSystem", status: "Watch" },
    { id: "33333333-3333-4333-8333-333333333304", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", name: "Pump Station North", type: "PumpStation", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333305", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", name: "Irrigation Zone 1", type: "IrrigationZone", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333306", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", name: "Greenhouse Block A", type: "Greenhouse", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333307", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", name: "Weather Station", type: "WeatherStation", status: "OK" },
    { id: "33333333-3333-4333-8333-333333333308", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", name: "Grid Connection", type: "GridConnection", status: "OK" }
  ];

  private devices: Device[] = [
    {
      id: "44444444-4444-4444-8444-444444444401",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      assetId: "33333333-3333-4333-8333-333333333301",
      gatewayId: "77777777-7777-4777-8777-777777777701",
      name: "Solar Inverter A",
      deviceType: "inverter",
      protocol: "simulated",
      driverType: "simulated-solar-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 18,
      positionY: 22,
      placementNote: "Roof-mounted array, north field corner"
    },
    {
      id: "44444444-4444-4444-8444-444444444402",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222203",
      assetId: "33333333-3333-4333-8333-333333333302",
      gatewayId: "77777777-7777-4777-8777-777777777703",
      name: "Battery Controller A",
      deviceType: "battery_controller",
      protocol: "simulated",
      driverType: "simulated-battery-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 50,
      positionY: 50,
      placementNote: "Battery enclosure, site plant room"
    },
    {
      id: "44444444-4444-4444-8444-444444444403",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      assetId: "33333333-3333-4333-8333-333333333303",
      gatewayId: "77777777-7777-4777-8777-777777777702",
      name: "Tank Level Sensor",
      deviceType: "level_sensor",
      protocol: "simulated",
      driverType: "simulated-water-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 28,
      positionY: 32,
      placementNote: "Mounted on Primary Water Tank"
    },
    {
      id: "44444444-4444-4444-8444-444444444404",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      assetId: "33333333-3333-4333-8333-333333333304",
      gatewayId: "77777777-7777-4777-8777-777777777702",
      name: "Pump Station PLC",
      deviceType: "plc",
      protocol: "simulated",
      driverType: "simulated-pump-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 68,
      positionY: 58,
      placementNote: "Pump House North"
    },
    {
      id: "44444444-4444-4444-8444-444444444405",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      assetId: "33333333-3333-4333-8333-333333333305",
      gatewayId: "77777777-7777-4777-8777-777777777701",
      name: "Irrigation Controller",
      deviceType: "irrigation_controller",
      protocol: "simulated",
      driverType: "simulated-irrigation-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 48,
      positionY: 72,
      placementNote: "Irrigation Zone 1, valve manifold"
    },
    {
      id: "44444444-4444-4444-8444-444444444406",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      assetId: "33333333-3333-4333-8333-333333333307",
      gatewayId: "77777777-7777-4777-8777-777777777701",
      name: "Weather Station Node",
      deviceType: "weather_station",
      protocol: "simulated",
      driverType: "simulated-climate-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 85,
      positionY: 12,
      placementNote: "Open field, east boundary"
    },
    {
      id: "44444444-4444-4444-8444-444444444407",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      assetId: "33333333-3333-4333-8333-333333333308",
      gatewayId: "77777777-7777-4777-8777-777777777701",
      name: "Grid Meter",
      deviceType: "grid_meter",
      protocol: "simulated",
      driverType: "simulated-grid-meter-driver",
      health: "OK",
      lastSeenUtc: nowIso(),
      firmwareVersion: "sim-1.0.0",
      secureIdentityStatus: "placeholder",
      positionX: 12,
      positionY: 82,
      placementNote: "Utility interconnection point, site entrance"
    }
  ];

  // Empty by default — unlike sites/devices/points, no demo gateway was ever seeded (the demo
  // tenant's devices reference opaque gatewayId strings with no backing row at all, purely for
  // display grouping). A real gateway only ever comes from createGateway() below.
  private gateways: EdgeGateway[] = [];

  private points: Point[] = [
    { id: "55555555-5555-4555-8555-555555555501", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333301", deviceId: "44444444-4444-4444-8444-444444444401", canonicalName: "energy.solar.power.kw", label: "Solar production", unit: "kW", quality: "OK", capability: "read", thresholdConfig: { watch_low: 2, surplus_min_kw: 1.5 } },
    { id: "55555555-5555-4555-8555-555555555502", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222203", assetId: "33333333-3333-4333-8333-333333333302", deviceId: "44444444-4444-4444-8444-444444444402", canonicalName: "energy.battery.soc.percent", label: "Battery SOC", unit: "%", quality: "OK", capability: "read", thresholdConfig: { warning_low: 25 } },
    { id: "55555555-5555-4555-8555-555555555503", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", assetId: "33333333-3333-4333-8333-333333333303", deviceId: "44444444-4444-4444-8444-444444444403", canonicalName: "water.tank.level.percent", label: "Tank level", unit: "%", quality: "WARN", capability: "read", thresholdConfig: { critical_low: 15, warning_low: 35 } },
    { id: "55555555-5555-4555-8555-555555555504", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", assetId: "33333333-3333-4333-8333-333333333304", deviceId: "44444444-4444-4444-8444-444444444404", canonicalName: "water.flow.lpm", label: "Pump flow", unit: "lpm", quality: "OK", capability: "read", thresholdConfig: { dry_run_lpm: 0.2 } },
    { id: "55555555-5555-4555-8555-555555555505", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", assetId: "33333333-3333-4333-8333-333333333304", deviceId: "44444444-4444-4444-8444-444444444404", canonicalName: "water.pressure.bar", label: "Line pressure", unit: "bar", quality: "OK", capability: "read", thresholdConfig: { max_bar: 5.5 } },
    { id: "55555555-5555-4555-8555-555555555506", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333305", deviceId: "44444444-4444-4444-8444-444444444405", canonicalName: "agri.soil.moisture.percent", label: "Soil moisture", unit: "%", quality: "OK", capability: "read", thresholdConfig: { irrigate_below: 28 } },
    { id: "55555555-5555-4555-8555-555555555507", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333307", deviceId: "44444444-4444-4444-8444-444444444406", canonicalName: "agri.air.temperature.c", label: "Air temperature", unit: "C", quality: "OK", capability: "read" },
    { id: "55555555-5555-4555-8555-555555555508", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333307", deviceId: "44444444-4444-4444-8444-444444444406", canonicalName: "agri.humidity.percent", label: "Humidity", unit: "%", quality: "OK", capability: "read" },
    { id: "55555555-5555-4555-8555-555555555509", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222202", assetId: "33333333-3333-4333-8333-333333333304", deviceId: "44444444-4444-4444-8444-444444444404", canonicalName: "water.pump.command", label: "Pump command", unit: "state", quality: "OK", capability: "write" },
    // Grid metering lives on Integrated Farm Site, which has no battery — proving grid
    // import/export/consumption is tracked independently of battery presence, not derived from it.
    { id: "55555555-5555-4555-8555-555555555510", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333308", deviceId: "44444444-4444-4444-8444-444444444407", canonicalName: "energy.grid.import.kw", label: "Grid import", unit: "kW", quality: "OK", capability: "read", thresholdConfig: { watch_high: 20 } },
    { id: "55555555-5555-4555-8555-555555555511", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333308", deviceId: "44444444-4444-4444-8444-444444444407", canonicalName: "energy.grid.export.kw", label: "Grid export", unit: "kW", quality: "OK", capability: "read" },
    { id: "55555555-5555-4555-8555-555555555512", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333308", deviceId: "44444444-4444-4444-8444-444444444407", canonicalName: "energy.consumption.kw", label: "Site consumption", unit: "kW", quality: "OK", capability: "read" },
    // Irrigation actuation point — referenced by the "Irrigate when soil moisture is low" rule
    // and by manual irrigation control, but previously had no backing point at all.
    { id: "55555555-5555-4555-8555-555555555513", tenantId: DEMO_TENANT_ID, siteId: "22222222-2222-4222-8222-222222222201", assetId: "33333333-3333-4333-8333-333333333305", deviceId: "44444444-4444-4444-8444-444444444405", canonicalName: "agri.irrigation.command", label: "Irrigation command", unit: "state", quality: "OK", capability: "write", thresholdConfig: { max_runtime_minutes: 120, max_starts_per_day: 6 } }
  ];

  private telemetry: TelemetryReading[] = [
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333301", "44444444-4444-4444-8444-444444444401", "55555555-5555-4555-8555-555555555501", "energy.solar.power.kw", 18.6, "kW", "OK", 10),
    reading("22222222-2222-4222-8222-222222222203", "33333333-3333-4333-8333-333333333302", "44444444-4444-4444-8444-444444444402", "55555555-5555-4555-8555-555555555502", "energy.battery.soc.percent", 68, "%", "OK", 9),
    reading("22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333303", "44444444-4444-4444-8444-444444444403", "55555555-5555-4555-8555-555555555503", "water.tank.level.percent", 38, "%", "WARN", 8),
    reading("22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333304", "44444444-4444-4444-8444-444444444404", "55555555-5555-4555-8555-555555555504", "water.flow.lpm", 11.7, "lpm", "OK", 7),
    reading("22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333304", "44444444-4444-4444-8444-444444444404", "55555555-5555-4555-8555-555555555505", "water.pressure.bar", 2.8, "bar", "OK", 6),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333305", "44444444-4444-4444-8444-444444444405", "55555555-5555-4555-8555-555555555506", "agri.soil.moisture.percent", 24, "%", "OK", 5),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333307", "44444444-4444-4444-8444-444444444406", "55555555-5555-4555-8555-555555555507", "agri.air.temperature.c", 24.5, "C", "OK", 4),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333307", "44444444-4444-4444-8444-444444444406", "55555555-5555-4555-8555-555555555508", "agri.humidity.percent", 62, "%", "OK", 3),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333308", "44444444-4444-4444-8444-444444444407", "55555555-5555-4555-8555-555555555510", "energy.grid.import.kw", 0, "kW", "OK", 2),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333308", "44444444-4444-4444-8444-444444444407", "55555555-5555-4555-8555-555555555511", "energy.grid.export.kw", 6.6, "kW", "OK", 2),
    reading("22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333308", "44444444-4444-4444-8444-444444444407", "55555555-5555-4555-8555-555555555512", "energy.consumption.kw", 12.0, "kW", "OK", 2)
  ];

  private derivedStates: DerivedState[] = [
    state("water.tank.low", true, "warning", "22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333303", "Tank level is below the refill planning threshold."),
    state("energy.surplus_available", true, "watch", "22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333301", "Solar production is above current load estimate."),
    state("agri.irrigation_required", true, "watch", "22222222-2222-4222-8222-222222222201", "33333333-3333-4333-8333-333333333305", "Soil moisture is below the irrigation threshold.")
  ];

  private rules: AutomationRule[] = demoRules();
  private commands: CommandRecord[] = [];
  private reportExports: Array<ReportExportInput & { id: string; status: string; requestedBy: string; createdAtUtc: string }> = [];
  private edgeSyncBatches: Array<EdgeSyncInput & { id: string; tenantId: string; createdAtUtc: string }> = [];

  private alerts: AlertRecord[] = [
    {
      id: "99999999-9999-4999-8999-999999999901",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      assetId: "33333333-3333-4333-8333-333333333303",
      category: "resource_threshold",
      severity: "warning",
      status: "open",
      title: "Water tank approaching low threshold",
      suggestedAction: "Review refill timing and solar surplus availability.",
      createdAtUtc: nowIso()
    },
    {
      id: "99999999-9999-4999-8999-999999999902",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      assetId: "33333333-3333-4333-8333-333333333305",
      category: "resource_threshold",
      severity: "watch",
      status: "open",
      title: "Soil moisture below irrigation threshold",
      suggestedAction: "Simulate irrigation rule and confirm safety conditions.",
      createdAtUtc: nowIso()
    }
  ];

  private incidents: IncidentRecord[] = [
    {
      id: "abababab-abab-4aba-8aba-ababababab01",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      alertId: "99999999-9999-4999-8999-999999999901",
      status: "acknowledged",
      severity: "warning",
      title: "Water storage planning review",
      investigationNotes: "Demo incident linked to low tank alert.",
      updatedAtUtc: nowIso()
    }
  ];

  private maintenanceTasks: MaintenanceTask[] = [
    {
      id: "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcd01",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      assetId: "33333333-3333-4333-8333-333333333304",
      incidentId: "abababab-abab-4aba-8aba-ababababab01",
      title: "Inspect pump station pressure sensor",
      notes: "Confirm pressure sensor calibration before enabling cloud-assisted pump rules.",
      dueAtUtc: addDaysIso(7),
      status: "open"
    }
  ];

  private auditEvents: AuditEvent[] = [
    audit("rule.approved", "rule", "88888888-8888-4888-8888-888888888801", "Initial MVP safety baseline.", "22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333304"),
    audit("rule.approved", "rule", "88888888-8888-4888-8888-888888888802", "Initial MVP safety baseline.", "22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333304"),
    audit("alert.acknowledged", "alert", "99999999-9999-4999-8999-999999999901", "Operator acknowledged demo low tank alert.", "22222222-2222-4222-8222-222222222202", "33333333-3333-4333-8333-333333333303")
  ];

  session(principal: Principal) {
    return {
      principal,
      company: "Greecon Sh.p.k",
      domain: "greecon.earth",
      publicEmails: ["info@greecon.earth", "eridon.manuka@greecon.earth"],
      access: {
        canCommand: hasPermission(principal.role, "command:create"),
        canManageRules: hasPermission(principal.role, "automation:manage"),
        canReadAudit: hasPermission(principal.role, "audit:read")
      }
    };
  }

  // An empty array means "never customized, use the built-in default order" — the web app's
  // applyDashboardPreferences treats an empty list the same as nothing saved. Deliberately never
  // returns a bare `null`: NestJS's Express adapter treats a null/undefined controller return
  // value as "send no body at all" (an empty response), which crashed the client's JSON parser —
  // exactly the failure this method's very first version caused for literally every user, since
  // nobody has a saved preference yet. No database configured (local dev, static export) means no
  // persisted preference exists to read, same reasoning as everywhere else this pattern appears.
  async getDashboardPreferences(principal: Principal): Promise<DashboardWidgetPreference[]> {
    if (!this.db.isConfigured()) return [];

    const result = await this.db.query<{ widgets: DashboardWidgetPreference[] }>(
      `SELECT widgets FROM dashboard_preferences WHERE user_id = $1 AND tenant_id = $2`,
      [principal.userId, principal.tenantId]
    );

    return result.rows[0]?.widgets ?? [];
  }

  async saveDashboardPreferences(widgets: DashboardWidgetPreference[], principal: Principal): Promise<DashboardWidgetPreference[]> {
    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO dashboard_preferences (user_id, tenant_id, widgets, updated_at) VALUES ($1,$2,$3,now())
         ON CONFLICT (user_id) DO UPDATE SET widgets = EXCLUDED.widgets, tenant_id = EXCLUDED.tenant_id, updated_at = now()`,
        [principal.userId, principal.tenantId, JSON.stringify(widgets)]
      );
    }

    return widgets;
  }

  listTenants(principal: Principal): Tenant[] {
    return this.tenants.filter((tenant) => tenant.id === principal.tenantId);
  }

  // Cross-tenant — every client, not just the caller's own. Gated on isPlatformAdmin, not a
  // tenant-scoped role, since this is Greecon staff managing clients, not a client managing
  // itself (see docs/15-master-roadmap.md, Phase 2 "Tenant-level administration").
  //
  // Paginated and search-filtered server-side: at pilot scale ("about to have 1600 customers or
  // more") this list is the one screen in the whole app that cannot stay a full unpaginated
  // fetch-and-render without becoming unusable.
  listAllTenants(
    principal: Principal,
    options?: { search?: string; page?: number; pageSize?: number }
  ): { tenants: Array<Tenant & { userCount: number; siteCount: number }>; total: number; page: number; pageSize: number } {
    if (!principal.isPlatformAdmin) {
      throw new ForbiddenException("This action requires Greecon platform-administrator access.");
    }

    const search = options?.search?.trim().toLowerCase();
    const matching = search
      ? this.tenants.filter(
          (tenant) =>
            tenant.name.toLowerCase().includes(search) ||
            tenant.domain.toLowerCase().includes(search) ||
            tenant.status.toLowerCase().includes(search)
        )
      : this.tenants;

    const pageSize = Math.min(Math.max(options?.pageSize ?? 25, 1), 100);
    const page = Math.max(options?.page ?? 1, 1);
    const start = (page - 1) * pageSize;

    const tenants = matching.slice(start, start + pageSize).map((tenant) => ({
      ...tenant,
      userCount: this.users.filter((user) => user.tenantId === tenant.id).length,
      siteCount: this.sites.filter((site) => site.tenantId === tenant.id).length
    }));

    return { tenants, total: matching.length, page, pageSize };
  }

  async createTenant(input: CreateTenantInput, principal: Principal): Promise<{ tenant: Tenant; owner: User; temporaryPassword: string }> {
    if (!principal.isPlatformAdmin) {
      throw new ForbiddenException("This action requires Greecon platform-administrator access.");
    }

    const domain = input.domain.trim().toLowerCase();
    if (this.tenants.some((existing) => existing.domain.toLowerCase() === domain)) {
      throw new ConflictException("A client with this domain already exists.");
    }

    const tenant: Tenant = {
      id: randomUUID(),
      name: input.name,
      domain,
      status: "active"
    };

    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const owner: User = {
      id: randomUUID(),
      tenantId: tenant.id,
      email: ownerEmail,
      name: input.ownerName,
      role: "owner",
      status: "active"
    };

    if (this.db.isConfigured()) {
      await this.db.query(`INSERT INTO tenants (id, name, domain, status) VALUES ($1,$2,$3,$4)`, [tenant.id, tenant.name, tenant.domain, tenant.status]);
      await this.db.query(
        `INSERT INTO users (id, tenant_id, email, name, status, password_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
        [owner.id, owner.tenantId, owner.email, owner.name, owner.status, passwordHash]
      );
      await this.db.query(`INSERT INTO memberships (id, tenant_id, user_id, role) VALUES ($1,$2,$3,$4)`, [
        randomUUID(),
        tenant.id,
        owner.id,
        owner.role
      ]);
    }

    this.tenants.push(tenant);
    this.users.push(owner);

    await this.recordAudit({
      tenantId: tenant.id,
      userId: principal.userId,
      eventType: "tenant.created",
      entityType: "tenant",
      entityId: tenant.id,
      afterMetadata: { name: tenant.name, domain: tenant.domain, ownerEmail },
      reason: `Client "${tenant.name}" onboarded by platform administrator.`
    });

    return { tenant, owner, temporaryPassword };
  }

  listUsers(principal: Principal): User[] {
    return this.scope(this.users, principal.tenantId);
  }

  async createUser(input: CreateUserInput, principal: Principal): Promise<{ user: User; temporaryPassword: string }> {
    if (!hasPermission(principal.role, "user:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const email = input.email.trim().toLowerCase();
    if (this.users.some((existing) => existing.tenantId === principal.tenantId && existing.email.toLowerCase() === email)) {
      throw new ConflictException("A user with this email already exists in this tenant.");
    }

    // There is no self-service reset flow yet (docs/15-master-roadmap.md, Phase 0) — the
    // temporary password is returned once, here, and never stored or logged anywhere else.
    // Whoever creates the account is responsible for passing it to the new user out of band.
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user: User = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      email,
      name: input.name,
      role: input.role,
      status: "active"
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO users (id, tenant_id, email, name, status, password_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.id, user.tenantId, user.email, user.name, user.status, passwordHash]
      );
      await this.db.query(`INSERT INTO memberships (id, tenant_id, user_id, role) VALUES ($1,$2,$3,$4)`, [
        randomUUID(),
        user.tenantId,
        user.id,
        user.role
      ]);
    }

    this.users.push(user);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "user.created",
      entityType: "user",
      entityId: user.id,
      afterMetadata: { email: user.email, role: user.role },
      reason: `User "${user.email}" created with role ${user.role}.`
    });

    return { user, temporaryPassword };
  }

  // Stands in for a self-service "forgot password" flow, which would need a real email-sending
  // integration this deployment doesn't have yet (docs/15-master-roadmap.md, Phase 0) — an admin
  // generates a fresh temporary password on the user's behalf and passes it along out of band,
  // same one-time-disclosure handling as createUser.
  async resetUserPassword(userId: string, principal: Principal): Promise<{ user: User; temporaryPassword: string }> {
    if (!hasPermission(principal.role, "user:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const user = this.requireUser(userId, principal.tenantId);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [passwordHash, user.id]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "user.password_reset",
      entityType: "user",
      entityId: user.id,
      reason: `Password reset for "${user.email}" by ${principal.email}.`
    });

    return { user, temporaryPassword };
  }

  async updateUser(userId: string, input: UpdateUserInput, principal: Principal): Promise<User> {
    if (!hasPermission(principal.role, "user:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const user = this.requireUser(userId, principal.tenantId);
    if (user.id === principal.userId && input.status === "disabled") {
      throw new ForbiddenException("You cannot disable your own account.");
    }
    if (user.id === principal.userId && input.role && input.role !== user.role) {
      throw new ForbiddenException("You cannot change your own role.");
    }

    const nextRole = input.role ?? user.role;
    const nextStatus = input.status ?? user.status;

    if (this.db.isConfigured()) {
      if (input.role) {
        await this.db.query(`UPDATE memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3`, [nextRole, principal.tenantId, user.id]);
      }
      if (input.status) {
        await this.db.query(`UPDATE users SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`, [nextStatus, user.id, principal.tenantId]);
      }
    }

    user.role = nextRole;
    user.status = nextStatus;

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "user.updated",
      entityType: "user",
      entityId: user.id,
      afterMetadata: { role: user.role, status: user.status },
      reason: `User "${user.email}" updated (role: ${user.role}, status: ${user.status}).`
    });

    return user;
  }

  /** The one question the product exists to answer: is everything all right? `health` is the
   * answer (one state, one sentence, what it rests on); the rest is the evidence behind it.
   * `nowMs` is injectable so a test can move the clock. */
  overview(principal: Principal, nowMs: number = Date.now()) {
    const tenantSites = this.listSites(principal, nowMs);
    const health = assessTenantHealth(tenantSites.map((site) => site.health));
    // Everything not yet resolved: an acknowledged alert is still standing until its condition clears.
    const activeAlerts = this.listAlerts(principal).filter((alert) => alert.status !== "resolved");
    return {
      tenant: this.requireTenant(principal.tenantId),
      // The older one-line status, kept in step with `health` for anything that still reads it.
      status: OVERVIEW_STATUS[health.state],
      asOfUtc: new Date(nowMs).toISOString(),
      health,
      sites: tenantSites,
      // Where the energy is going at each site that measures any, so one screen can show it moving.
      energy: tenantSites
        .map((site) => ({ siteId: site.id, siteName: site.name, flow: this.energyFlowOf(principal.tenantId, site.id, nowMs) }))
        .filter((entry) => entry.flow.hasEnergy),
      summaries: {
        energy: {
          // Data-driven from whatever energy.* points a tenant's sites actually have — a site
          // with no battery still reports grid import/export/consumption, and a site with no
          // grid connection still reports solar/battery. Every field is optional by design so
          // the UI can render only what's actually metered per deployment.
          solarPowerKw: this.latestNumber(principal.tenantId, "energy.solar.power.kw"),
          batterySocPercent: this.latestNumber(principal.tenantId, "energy.battery.soc.percent"),
          batteryPowerKw: this.latestNumber(principal.tenantId, "energy.battery.power.kw"),
          consumptionKw: this.latestNumber(principal.tenantId, "energy.consumption.kw"),
          gridImportKw: this.latestNumber(principal.tenantId, "energy.grid.import.kw"),
          gridExportKw: this.latestNumber(principal.tenantId, "energy.grid.export.kw"),
          // Absent when it cannot be judged (no readings, or they are out of date): neither
          // "Available" nor "Constrained" is true then.
          surplusState: this.stateFlag(principal.tenantId, "energy.surplus_available", "Available", "Constrained")
        },
        water: {
          tankLevelPercent: this.latestNumber(principal.tenantId, "water.tank.level.percent"),
          flowLpm: this.latestNumber(principal.tenantId, "water.flow.lpm"),
          pressureBar: this.latestNumber(principal.tenantId, "water.pressure.bar")
        },
        agriculture: {
          soilMoisturePercent: this.latestNumber(principal.tenantId, "agri.soil.moisture.percent"),
          temperatureC: this.latestNumber(principal.tenantId, "agri.air.temperature.c"),
          humidityPercent: this.latestNumber(principal.tenantId, "agri.humidity.percent")
        },
        automation: {
          enabledRules: this.rules.filter((rule) => rule.tenantId === principal.tenantId && rule.enabled).length,
          simulatedRules: this.rules.filter((rule) => rule.tenantId === principal.tenantId && rule.executionMode === "simulation").length,
          lastAction: this.scope(this.commands, principal.tenantId)[0]?.dispatchStatus ?? "No command dispatched"
        },
        edge: {
          connectedSites: tenantSites.filter((site) => site.edgeStatus === "OK").length,
          simulatedSites: tenantSites.filter((site) => site.edgeStatus === "Simulated").length
        }
      },
      // The same latest values, each with where it came from and how old it is, so a screen can
      // show "62% · Hotel plant · 3 minutes ago" and "out of date" instead of a bare number.
      readings: this.overviewReadings(principal.tenantId, nowMs),
      activeAlerts
    };
  }

  /** The tenant's sites with their status computed from what is known, not from a label stored
   * when the site was created, plus each site's own health and when it last reported. */
  listSites(principal: Principal, nowMs: number = Date.now()): SiteView[] {
    return this.scope(this.sites, principal.tenantId).map((stored) => this.assessSite(stored, nowMs));
  }

  siteDetail(siteId: string, principal: Principal, nowMs: number = Date.now()) {
    const { health, lastReadingAtUtc, ...site } = this.assessSite(this.requireSite(siteId, principal.tenantId), nowMs);
    return {
      site,
      health,
      lastReadingAtUtc,
      assets: this.assets.filter((asset) => asset.tenantId === principal.tenantId && asset.siteId === siteId),
      devices: this.listDevices(principal, siteId, nowMs),
      points: this.points.filter((point) => point.tenantId === principal.tenantId && point.siteId === siteId),
      gateways: this.gateways.filter((gateway) => gateway.tenantId === principal.tenantId && gateway.siteId === siteId),
      latestTelemetry: this.latestTelemetry(principal, siteId, nowMs),
      energyFlow: this.energyFlowOf(principal.tenantId, siteId, nowMs),
      derivedStates: this.listDerivedStates(principal, siteId),
      alerts: this.listAlerts(principal, siteId),
      rules: this.listRules(principal, siteId),
      audit: this.listAudit(principal, siteId)
    };
  }

  listAssets(principal: Principal, siteId?: string): Asset[] {
    return this.scope(this.assets, principal.tenantId).filter((asset) => !siteId || asset.siteId === siteId);
  }

  /** Devices with their health and last-seen time worked out from what they have reported, not
   * from the values stored when they were registered. */
  listDevices(principal: Principal, siteId?: string, nowMs: number = Date.now()): Device[] {
    return this.scope(this.devices, principal.tenantId)
      .filter((device) => !siteId || device.siteId === siteId)
      .map((device) => this.assessDevice(device, nowMs));
  }

  listPoints(principal: Principal, deviceId?: string): Point[] {
    return this.scope(this.points, principal.tenantId).filter((point) => !deviceId || point.deviceId === deviceId);
  }

  listGateways(principal: Principal, siteId?: string): EdgeGateway[] {
    return this.scope(this.gateways, principal.tenantId).filter((gateway) => !siteId || gateway.siteId === siteId);
  }

  // The one credential a real edge box needs to send telemetry — generated here and returned
  // exactly once, the same one-time-disclosure handling as a new user's temporary password. Only
  // its SHA-256 hash is ever persisted (see gateway-secret.ts for why not bcrypt); losing the
  // plaintext after this call means generating a new one, the same as losing a password.
  async createGateway(input: CreateGatewayInput, principal: Principal): Promise<{ gateway: EdgeGateway; secret: string }> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);

    const secret = generateGatewaySecret();
    const secretHash = hashGatewaySecret(secret);

    const gateway: EdgeGateway = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      name: input.name,
      status: "OK",
      secureIdentityStatus: "provisioned"
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO edge_gateways (id, tenant_id, site_id, name, status, secure_identity_status, secret_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [gateway.id, gateway.tenantId, gateway.siteId, gateway.name, gateway.status, gateway.secureIdentityStatus, secretHash]
      );
    }

    this.gateways.push(gateway);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "gateway.created",
      siteId: gateway.siteId,
      entityType: "gateway",
      entityId: gateway.id,
      afterMetadata: { name: gateway.name },
      reason: `Gateway "${gateway.name}" created.`
    });

    return { gateway, secret };
  }

  // Safe to delete freely, unlike a site or device with things registered under it — a device's
  // gatewayId is ON DELETE SET NULL (001_schema.sql), so any device pointed at this gateway just
  // loses that association rather than being blocked or cascading away. The box itself keeps
  // running; this only revokes its credential and removes it from the list. There is no way to
  // read the secret back before this, by design (see gateway-secret.ts) — deleting and creating a
  // fresh one is also how you'd rotate a compromised or lost credential.
  async deleteGateway(gatewayId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const gateway = this.requireGateway(gatewayId, principal.tenantId);

    if (this.db.isConfigured()) {
      await this.db.query(`DELETE FROM edge_gateways WHERE id=$1 AND tenant_id=$2`, [gateway.id, principal.tenantId]);
    }

    this.gateways = this.gateways.filter((candidate) => candidate.id !== gateway.id);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "gateway.deleted",
      siteId: gateway.siteId,
      entityType: "gateway",
      entityId: gateway.id,
      beforeMetadata: { name: gateway.name },
      reason: `Gateway "${gateway.name}" deleted.`
    });

    return { deleted: true };
  }

  async createSite(input: CreateSiteInput, principal: Principal): Promise<Site> {
    if (!hasPermission(principal.role, "site:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const site: Site = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      name: input.name,
      type: input.type,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      // Placeholders only: what is shown for a site is computed from its readings (assessSite),
      // so a new site reads "Unknown" and "Offline" until it has reported, never "OK".
      status: "Unknown",
      edgeStatus: "Offline"
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO sites (id, tenant_id, name, type, location_name, latitude, longitude, status, edge_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [site.id, site.tenantId, site.name, site.type, site.locationName, site.latitude ?? null, site.longitude ?? null, site.status, site.edgeStatus]
      );
    }

    this.sites.push(site);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "site.created",
      siteId: site.id,
      entityType: "site",
      entityId: site.id,
      afterMetadata: { name: site.name, type: site.type },
      reason: `Site "${site.name}" created.`
    });

    return site;
  }

  async updateSite(siteId: string, input: UpdateSiteInput, principal: Principal): Promise<Site> {
    if (!hasPermission(principal.role, "site:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const site = this.requireSite(siteId, principal.tenantId);
    const before = { ...site };
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(site, patch);

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE sites SET name=$1, type=$2, location_name=$3, latitude=$4, longitude=$5, status=$6, edge_status=$7, safety_limits=$8, updated_at=now()
         WHERE id=$9 AND tenant_id=$10`,
        [
          site.name,
          site.type,
          site.locationName,
          site.latitude ?? null,
          site.longitude ?? null,
          site.status,
          site.edgeStatus,
          JSON.stringify(site.safetyLimits ?? {}),
          site.id,
          principal.tenantId
        ]
      );
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "site.updated",
      siteId: site.id,
      entityType: "site",
      entityId: site.id,
      beforeMetadata: { name: before.name, status: before.status },
      afterMetadata: { name: site.name, status: site.status },
      reason: `Site "${site.name}" updated.`
    });

    return site;
  }

  async deleteSite(siteId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "site:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const site = this.requireSite(siteId, principal.tenantId);
    const remainingDevices = this.devices.filter((device) => device.siteId === siteId && device.tenantId === principal.tenantId);
    if (remainingDevices.length > 0) {
      // The schema cascades a site delete down through assets/devices/points/telemetry/rules —
      // silently destroying that much data as a side effect of one call is exactly the kind of
      // surprising blast radius worth blocking outright rather than just documenting.
      throw new ForbiddenException(`Cannot delete a site with ${remainingDevices.length} device(s) still registered. Remove its devices first.`);
    }

    // Audit first, then delete — unlike every other delete* method here, this audit event's own
    // siteId is the row about to disappear. audit_events.site_id is ON DELETE SET NULL precisely
    // so a historical entry can outlive the site it was about, but that only works if the row
    // exists to satisfy the foreign key at INSERT time; inserting after the DELETE fails outright
    // (found by actually running this against Postgres, not by inspection).
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "site.deleted",
      siteId: site.id,
      entityType: "site",
      entityId: site.id,
      beforeMetadata: { name: site.name },
      reason: `Site "${site.name}" deleted.`
    });

    if (this.db.isConfigured()) {
      await this.db.query(`DELETE FROM sites WHERE id=$1 AND tenant_id=$2`, [site.id, principal.tenantId]);
    }

    this.sites = this.sites.filter((candidate) => candidate.id !== site.id);

    return { deleted: true };
  }

  async createAsset(input: CreateAssetInput, principal: Principal): Promise<Asset> {
    if (!hasPermission(principal.role, "asset:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);

    const asset: Asset = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      name: input.name,
      type: input.type,
      status: "OK"
    };

    if (this.db.isConfigured()) {
      await this.db.query(`INSERT INTO assets (id, tenant_id, site_id, name, type, status) VALUES ($1,$2,$3,$4,$5,$6)`, [
        asset.id,
        asset.tenantId,
        asset.siteId,
        asset.name,
        asset.type,
        asset.status
      ]);
    }

    this.assets.push(asset);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "asset.created",
      siteId: asset.siteId,
      entityType: "asset",
      entityId: asset.id,
      afterMetadata: { name: asset.name, type: asset.type },
      reason: `Asset "${asset.name}" created.`
    });

    return asset;
  }

  async updateAsset(assetId: string, input: UpdateAssetInput, principal: Principal): Promise<Asset> {
    if (!hasPermission(principal.role, "asset:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const asset = this.requireAsset(assetId, principal.tenantId);
    const before = { ...asset };
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(asset, patch);

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE assets SET name=$1, type=$2, status=$3, updated_at=now() WHERE id=$4 AND tenant_id=$5`, [
        asset.name,
        asset.type,
        asset.status,
        asset.id,
        principal.tenantId
      ]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "asset.updated",
      siteId: asset.siteId,
      entityType: "asset",
      entityId: asset.id,
      beforeMetadata: { name: before.name, status: before.status },
      afterMetadata: { name: asset.name, status: asset.status },
      reason: `Asset "${asset.name}" updated.`
    });

    return asset;
  }

  async deleteAsset(assetId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "asset:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const asset = this.requireAsset(assetId, principal.tenantId);

    if (this.db.isConfigured()) {
      await this.db.query(`DELETE FROM assets WHERE id=$1 AND tenant_id=$2`, [asset.id, principal.tenantId]);
    }

    this.assets = this.assets.filter((candidate) => candidate.id !== asset.id);
    // Devices referencing this asset aren't deleted (assets.id -> devices.asset_id is ON DELETE
    // SET NULL) — clear it in memory too so the in-memory state matches what the database now has.
    for (const device of this.devices) {
      if (device.assetId === asset.id) device.assetId = undefined;
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "asset.deleted",
      siteId: asset.siteId,
      entityType: "asset",
      entityId: asset.id,
      beforeMetadata: { name: asset.name },
      reason: `Asset "${asset.name}" deleted.`
    });

    return { deleted: true };
  }

  async createDevice(input: CreateDeviceInput, principal: Principal): Promise<Device> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);

    const device: Device = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      assetId: input.assetId,
      gatewayId: input.gatewayId,
      name: input.name,
      deviceType: input.deviceType,
      protocol: input.protocol,
      driverType: input.driverType,
      health: "OK",
      lastSeenUtc: nowIso(),
      secureIdentityStatus: "placeholder",
      positionX: input.positionX,
      positionY: input.positionY,
      placementNote: input.placementNote
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO devices (id, tenant_id, site_id, asset_id, gateway_id, name, device_type, protocol, driver_type, health, last_seen_utc, secure_identity_status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          device.id,
          device.tenantId,
          device.siteId,
          device.assetId ?? null,
          device.gatewayId ?? null,
          device.name,
          device.deviceType,
          device.protocol,
          device.driverType,
          device.health,
          device.lastSeenUtc,
          device.secureIdentityStatus,
          JSON.stringify(devicePlacementMetadata(device))
        ]
      );
    }

    this.devices.push(device);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "device.created",
      siteId: device.siteId,
      entityType: "device",
      entityId: device.id,
      afterMetadata: { name: device.name, deviceType: device.deviceType, protocol: device.protocol },
      reason: `Device "${device.name}" created.`
    });

    return device;
  }

  async updateDevice(deviceId: string, input: UpdateDeviceInput, principal: Principal): Promise<Device> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const device = this.requireDevice(deviceId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);
    const before = { ...device };
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(device, patch);

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE devices SET asset_id=$1, gateway_id=$2, name=$3, device_type=$4, protocol=$5, driver_type=$6, health=$7, metadata=$8, updated_at=now()
         WHERE id=$9 AND tenant_id=$10`,
        [
          device.assetId ?? null,
          device.gatewayId ?? null,
          device.name,
          device.deviceType,
          device.protocol,
          device.driverType,
          device.health,
          JSON.stringify(devicePlacementMetadata(device)),
          device.id,
          principal.tenantId
        ]
      );
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "device.updated",
      siteId: device.siteId,
      entityType: "device",
      entityId: device.id,
      beforeMetadata: { name: before.name, health: before.health },
      afterMetadata: { name: device.name, health: device.health },
      reason: `Device "${device.name}" updated.`
    });

    return device;
  }

  async deleteDevice(deviceId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const device = this.requireDevice(deviceId, principal.tenantId);

    if (this.db.isConfigured()) {
      // Cascades to this device's points and telemetry history at the database level — that's
      // the expected, unsurprising consequence of decommissioning a device, unlike a site
      // cascading through everything beneath it.
      await this.db.query(`DELETE FROM devices WHERE id=$1 AND tenant_id=$2`, [device.id, principal.tenantId]);
    }

    this.devices = this.devices.filter((candidate) => candidate.id !== device.id);
    this.points = this.points.filter((point) => point.deviceId !== device.id);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "device.deleted",
      siteId: device.siteId,
      entityType: "device",
      entityId: device.id,
      beforeMetadata: { name: device.name },
      reason: `Device "${device.name}" deleted.`
    });

    return { deleted: true };
  }

  async createPoint(input: CreatePointInput, principal: Principal): Promise<Point> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);
    const device = this.requireDevice(input.deviceId, principal.tenantId);
    if (device.siteId !== input.siteId) {
      throw new ForbiddenException("Device does not belong to the given site.");
    }
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);
    this.assertValidLimits(input.canonicalName, input.thresholdConfig);

    const point: Point = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      assetId: input.assetId,
      deviceId: input.deviceId,
      canonicalName: input.canonicalName,
      label: input.label,
      unit: input.unit,
      quality: "OK",
      capability: input.capability,
      thresholdConfig: input.thresholdConfig
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO points (id, tenant_id, site_id, asset_id, device_id, canonical_name, label, unit, quality, capability, threshold_config)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          point.id,
          point.tenantId,
          point.siteId,
          point.assetId ?? null,
          point.deviceId,
          point.canonicalName,
          point.label,
          point.unit,
          point.quality,
          point.capability,
          JSON.stringify(point.thresholdConfig ?? {})
        ]
      );
    }

    this.points.push(point);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "point.created",
      siteId: point.siteId,
      entityType: "point",
      entityId: point.id,
      afterMetadata: { canonicalName: point.canonicalName, capability: point.capability },
      reason: `Point "${point.label}" created on device ${device.name}.`
    });

    return point;
  }

  async updatePoint(pointId: string, input: UpdatePointInput, principal: Principal): Promise<Point> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const point = this.requirePoint(pointId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);
    if (input.thresholdConfig !== undefined) this.assertValidLimits(point.canonicalName, input.thresholdConfig);
    const before = { ...point };
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(point, patch);
    const limitsChanged = JSON.stringify(before.thresholdConfig ?? {}) !== JSON.stringify(point.thresholdConfig ?? {});

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE points SET label=$1, unit=$2, capability=$3, quality=$4, threshold_config=$5, updated_at=now() WHERE id=$6 AND tenant_id=$7`, [
        point.label,
        point.unit,
        point.capability,
        point.quality,
        JSON.stringify(point.thresholdConfig ?? {}),
        point.id,
        principal.tenantId
      ]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "point.updated",
      siteId: point.siteId,
      entityType: "point",
      entityId: point.id,
      // A change of limits is what decides when people are alerted, so it is recorded with the old
      // and the new values, not just "updated".
      beforeMetadata: { label: before.label, capability: before.capability, ...(limitsChanged ? { thresholdConfig: before.thresholdConfig ?? {} } : {}) },
      afterMetadata: { label: point.label, capability: point.capability, ...(limitsChanged ? { thresholdConfig: point.thresholdConfig ?? {} } : {}) },
      reason: limitsChanged ? `Limits for point "${point.label}" changed.` : `Point "${point.label}" updated.`
    });

    // The states and alerts follow the new limits now, not at the next reading.
    if (limitsChanged) {
      const nowMs = Date.now();
      this.refreshDerivedStates(point.tenantId, point.siteId, nowMs);
      await this.reconcileSiteAlerts(point.tenantId, point.siteId, nowMs);
    }

    return point;
  }

  // A limit that is misspelt, out of range or set on the wrong reading is refused rather than
  // ignored: ignored, it would do nothing and look as if it had worked.
  private assertValidLimits(canonicalName: CanonicalPointName, limits: Record<string, number> | undefined): void {
    const problems = validatePointLimits(canonicalName, limits);
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
  }

  async deletePoint(pointId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const point = this.requirePoint(pointId, principal.tenantId);

    if (this.db.isConfigured()) {
      await this.db.query(`DELETE FROM points WHERE id=$1 AND tenant_id=$2`, [point.id, principal.tenantId]);
    }

    this.points = this.points.filter((candidate) => candidate.id !== point.id);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "point.deleted",
      siteId: point.siteId,
      entityType: "point",
      entityId: point.id,
      beforeMetadata: { label: point.label },
      reason: `Point "${point.label}" deleted.`
    });

    return { deleted: true };
  }

  // Every other telemetry consumer in this service works off this.telemetry, which only ever
  // holds the latest reading per point (see upsertLatestTelemetry) — there was previously no way
  // to see a trend over time anywhere in the platform, only instantaneous values. This queries
  // real history straight from Postgres rather than the in-memory snapshot. Without a database
  // configured (local dev, the static GitHub Pages export) there's no history to query at all, so
  // it falls back to today's one latest point per canonical name rather than erroring — enough for
  // a chart to still render something, just flat.
  async telemetryHistory(principal: Principal, siteId: string | undefined, hours: number): Promise<TelemetryReading[]> {
    if (siteId) this.requireSite(siteId, principal.tenantId);

    if (!this.db.isConfigured()) {
      return this.latestTelemetry(principal, siteId);
    }

    const params: unknown[] = [principal.tenantId, hours];
    let siteFilter = "";
    if (siteId) {
      params.push(siteId);
      siteFilter = "AND site_id = $3";
    }

    const result = await this.db.query<TelemetryRow>(
      `SELECT * FROM telemetry_readings
       WHERE tenant_id = $1 AND timestamp_utc >= now() - ($2 || ' hours')::interval ${siteFilter}
       ORDER BY timestamp_utc ASC
       LIMIT 20000`,
      params
    );

    return result.rows.map((row) => mapTelemetryRow(row));
  }

  /** The newest reading of each point, each stamped with how old it is and whether it can still be
   * relied on. */
  latestTelemetry(principal: Principal, siteId?: string, nowMs: number = Date.now()): LatestReading[] {
    return this.latestReadings(this.telemetry.filter((item) => item.tenantId === principal.tenantId && (!siteId || item.siteId === siteId))).map((item) => {
      const view = this.viewReading(item, nowMs);
      return { ...item, ageSeconds: view.ageSeconds, freshness: view.freshness, concern: view.concern };
    });
  }

  // How old a reading is, whether it can still be relied on, and what the rules concluded about it.
  // An out-of-date reading carries no verdict: what was concluded from it is no longer about the
  // present.
  private viewReading(item: TelemetryReading, nowMs: number): { ageSeconds?: number; freshness: "current" | "out_of_date"; concern?: Concern } {
    const age = assessSensorAge(item.canonicalName, this.sensorValue(item), nowMs);
    if (age.freshness !== "fresh") return { ageSeconds: age.ageSeconds, freshness: "out_of_date" };
    const trueStates = new Set<StateKey>(
      this.derivedStates
        .filter((state) => state.tenantId === item.tenantId && state.siteId === item.siteId && state.stateValue === true)
        .map((state) => state.stateKey)
    );
    return { ageSeconds: age.ageSeconds, freshness: "current", concern: concernForReading(item.canonicalName, trueStates) };
  }

  async ingestTelemetry(message: TelemetryMessage, principal: Principal) {
    if (principal.tenantId !== message.tenantId) {
      throw new ForbiddenException("Telemetry tenant does not match request context.");
    }

    const errors = validateTelemetryMessage(message);
    if (errors.length > 0) {
      return {
        accepted: false,
        errors
      };
    }

    const normalized = message.readings.map((item) => normalizeTelemetryTimestamp(item));
    for (const item of normalized) {
      this.requireSite(item.siteId, principal.tenantId);
      // A real gateway can send a typo'd or unprovisioned deviceId/pointId — reject it here with
      // a clear 404 rather than let it reach Postgres and surface as an opaque FK-violation 500.
      this.requireDevice(item.deviceId, principal.tenantId);
      const point = this.requirePoint(item.pointId, principal.tenantId);
      // A reading replayed late (for example from an edge buffer after an outage) is stored in
      // history but must not replace a newer 'latest' value or the point's current quality.
      if (this.upsertLatestTelemetry(item)) point.quality = item.quality;
    }

    if (this.db.isConfigured()) {
      for (const item of normalized) {
        await this.persistTelemetryReading(item);
      }
    }

    this.refreshDerivedStates(principal.tenantId, message.siteId);
    await this.reconcileSiteAlerts(principal.tenantId, message.siteId, Date.now());

    return {
      accepted: true,
      ingested: normalized.length,
      errors: []
    };
  }

  listDerivedStates(principal: Principal, siteId?: string): DerivedState[] {
    return this.scope(this.derivedStates, principal.tenantId).filter((stateValue) => !siteId || stateValue.siteId === siteId);
  }

  listRules(principal: Principal, siteId?: string): AutomationRule[] {
    return this.scope(this.rules, principal.tenantId).filter((rule) => !siteId || !rule.siteId || rule.siteId === siteId);
  }

  simulateRules(principal: Principal, siteId?: string) {
    const sensors = this.sensorSnapshot(principal.tenantId, siteId);
    const states = this.stateSnapshot(principal.tenantId, siteId);
    return this.listRules(principal, siteId).map((rule) => simulateRule(rule, sensors, states));
  }

  async createRule(input: CreateRuleInput, principal: Principal): Promise<AutomationRule> {
    if (!hasPermission(principal.role, "automation:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    if (input.siteId) this.requireSite(input.siteId, principal.tenantId);

    const rule: AutomationRule = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      name: input.name,
      priority: input.priority,
      triggerType: input.triggerType as AutomationRule["triggerType"],
      conditions: input.conditions,
      constraints: input.constraints,
      actions: input.actions,
      executionMode: input.executionMode,
      explanationTemplate: input.explanationTemplate,
      rollbackBehavior: input.rollbackBehavior,
      enabled: false,
      approvalState: "draft",
      version: 1,
      createdBy: principal.userId,
      updatedBy: principal.userId
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO rules (id, tenant_id, site_id, name, priority, trigger_type, conditions, constraints, actions, execution_mode, explanation_template, rollback_behavior, enabled, approval_state, version, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          rule.id,
          rule.tenantId,
          rule.siteId ?? null,
          rule.name,
          rule.priority,
          rule.triggerType,
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.constraints),
          JSON.stringify(rule.actions),
          rule.executionMode,
          rule.explanationTemplate,
          rule.rollbackBehavior,
          rule.enabled,
          rule.approvalState,
          rule.version,
          rule.createdBy,
          rule.updatedBy
        ]
      );
    }

    this.rules.push(rule);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "rule.created",
      siteId: rule.siteId,
      entityType: "rule",
      entityId: rule.id,
      afterMetadata: { name: rule.name, priority: rule.priority },
      reason: `Rule "${rule.name}" created as draft.`
    });

    return rule;
  }

  async updateRule(ruleId: string, input: UpdateRuleInput, principal: Principal): Promise<AutomationRule> {
    if (!hasPermission(principal.role, "automation:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const rule = this.requireRule(ruleId, principal.tenantId);
    const before = { ...rule };
    // class-transformer initializes every declared (even optional) UpdateRuleDto field as an
    // own property, so an omitted field arrives here as `undefined` rather than absent —
    // Object.assign would otherwise overwrite it and blank out that column.
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(rule, patch, {
      version: rule.version + 1,
      updatedBy: principal.userId
    });

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE rules SET name=$1, priority=$2, trigger_type=$3, conditions=$4, constraints=$5, actions=$6, execution_mode=$7, explanation_template=$8, rollback_behavior=$9, enabled=$10, approval_state=$11, version=$12, updated_by=$13, updated_at=now()
         WHERE id=$14 AND tenant_id=$15`,
        [
          rule.name,
          rule.priority,
          rule.triggerType,
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.constraints),
          JSON.stringify(rule.actions),
          rule.executionMode,
          rule.explanationTemplate,
          rule.rollbackBehavior,
          rule.enabled,
          rule.approvalState,
          rule.version,
          rule.updatedBy,
          rule.id,
          principal.tenantId
        ]
      );
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "rule.updated",
      siteId: rule.siteId,
      entityType: "rule",
      entityId: rule.id,
      beforeMetadata: { name: before.name, conditions: before.conditions, actions: before.actions },
      afterMetadata: { name: rule.name, conditions: rule.conditions, actions: rule.actions },
      reason: `Rule "${rule.name}" updated (v${rule.version}).`
    });

    return rule;
  }

  async setRuleApprovalState(ruleId: string, approvalState: AutomationRule["approvalState"], reason: string, principal: Principal): Promise<AutomationRule> {
    if (!hasPermission(principal.role, "automation:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const rule = this.requireRule(ruleId, principal.tenantId);
    const previousState = rule.approvalState;
    rule.approvalState = approvalState;
    rule.enabled = approvalState === "approved";
    rule.updatedBy = principal.userId;

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE rules SET approval_state=$1, enabled=$2, updated_by=$3, updated_at=now() WHERE id=$4 AND tenant_id=$5`, [
        rule.approvalState,
        rule.enabled,
        principal.userId,
        rule.id,
        principal.tenantId
      ]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: approvalState === "approved" ? "rule.approved" : approvalState === "disabled" ? "rule.disabled" : "rule.reverted_to_draft",
      siteId: rule.siteId,
      entityType: "rule",
      entityId: rule.id,
      beforeMetadata: { approvalState: previousState },
      afterMetadata: { approvalState },
      reason
    });

    return rule;
  }

  async deleteRule(ruleId: string, principal: Principal): Promise<{ deleted: true }> {
    if (!hasPermission(principal.role, "automation:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const rule = this.requireRule(ruleId, principal.tenantId);

    if (this.db.isConfigured()) {
      await this.db.query(`DELETE FROM rules WHERE id=$1 AND tenant_id=$2`, [rule.id, principal.tenantId]);
    }

    this.rules = this.rules.filter((candidate) => candidate.id !== rule.id);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "rule.deleted",
      siteId: rule.siteId,
      entityType: "rule",
      entityId: rule.id,
      beforeMetadata: { name: rule.name },
      reason: `Rule "${rule.name}" deleted.`
    });

    return { deleted: true };
  }

  async createCommand(input: CreateCommandInput, principal: Principal): Promise<CommandRecord> {
    if (!hasPermission(principal.role, "command:create")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const device = this.requireDevice(input.targetDeviceId, principal.tenantId);
    const point = this.requirePoint(input.targetPointId, principal.tenantId);
    const site = this.requireSite(input.siteId, principal.tenantId);

    if (device.siteId !== input.siteId || point.deviceId !== device.id) {
      throw new ForbiddenException("Command target is outside the selected site/device scope.");
    }

    const issuedAtUtc = nowIso();
    const commandMessage: CommandMessage = {
      messageType: "command",
      commandId: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      target: {
        deviceId: device.id,
        pointId: point.id,
        canonicalName: point.canonicalName
      },
      requestedValue: input.requestedValue,
      requestedBy: principal.userId,
      requestedByRole: principal.role,
      reason: input.manualOverride?.reason ?? input.reason,
      manualOverride: input.manualOverride
        ? {
            durationMinutes: input.manualOverride.durationMinutes,
            expiresAtUtc: addMinutesIso(input.manualOverride.durationMinutes)
          }
        : undefined,
      issuedAtUtc,
      correlationId: randomUUID()
    };

    const safetyEvaluation = evaluateCommandSafety({
      command: commandMessage,
      sensors: this.sensorSnapshot(principal.tenantId, input.siteId),
      states: this.stateSnapshot(principal.tenantId, input.siteId),
      // A site with no explicit override falls back to defaultSafetyLimits field-by-field — a
      // site that's only overridden, say, maxPressureBar still gets every other default untouched.
      limits: { ...defaultSafetyLimits, ...site.safetyLimits },
      systemMode: "automatic"
    });

    const auditEvent = await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: safetyEvaluation.allowed ? "command.simulated_dispatch" : "command.blocked",
      siteId: input.siteId,
      assetId: point.assetId,
      entityType: "command",
      afterMetadata: {
        requestedValue: input.requestedValue,
        safetyEvaluation
      },
      reason: commandMessage.reason
    });

    const record: CommandRecord = {
      id: commandMessage.commandId,
      tenantId: principal.tenantId,
      siteId: input.siteId,
      targetDeviceId: device.id,
      targetPointId: point.id,
      canonicalName: point.canonicalName,
      requestedValue: input.requestedValue,
      requestedBy: principal.userId,
      requestedByRole: principal.role,
      reason: commandMessage.reason,
      safetyEvaluation,
      executionMode: "simulated",
      dispatchStatus: safetyEvaluation.allowed ? "simulated_dispatch" : "blocked",
      failureReason: safetyEvaluation.allowed ? undefined : safetyEvaluation.reasons.join(" "),
      rollbackStatus: safetyEvaluation.allowed ? "not_required" : "not_dispatched",
      auditEventId: auditEvent.id,
      correlationId: commandMessage.correlationId,
      createdAtUtc: issuedAtUtc
    };

    this.commands.unshift(record);
    if (this.db.isConfigured()) await this.persistCommand(record);

    if (input.manualOverride) {
      await this.recordAudit({
        tenantId: principal.tenantId,
        userId: principal.userId,
        eventType: "manual_override.requested",
        siteId: input.siteId,
        assetId: point.assetId,
        entityType: "manual_override",
        entityId: record.id,
        afterMetadata: {
          durationMinutes: input.manualOverride.durationMinutes,
          expiresAtUtc: commandMessage.manualOverride?.expiresAtUtc,
          safetyEvaluation
        },
        reason: input.manualOverride.reason
      });
    }

    return record;
  }

  listCommands(principal: Principal): CommandRecord[] {
    return this.scope(this.commands, principal.tenantId);
  }

  async acknowledgeCommand(commandId: string, ack: CommandAckMessage, principal: Principal): Promise<CommandRecord> {
    const command = this.commands.find((candidate) => candidate.id === commandId && candidate.tenantId === principal.tenantId);
    if (!command) throw new NotFoundException("Command not found.");

    command.acknowledgement = ack;
    command.dispatchStatus = ack.status === "failed" || ack.status === "rejected" ? "failed" : "acknowledged";
    command.failureReason = ack.failureReason;
    command.result = ack.result;

    if (this.db.isConfigured()) await this.persistCommand(command);

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "command.acknowledged",
      siteId: command.siteId,
      entityType: "command",
      entityId: command.id,
      afterMetadata: { acknowledgement: ack },
      reason: ack.failureReason ?? ack.result ?? "Command acknowledgement received."
    });

    return command;
  }

  listAlerts(principal: Principal, siteId?: string): AlertRecord[] {
    return this.scope(this.alerts, principal.tenantId).filter((alert) => !siteId || alert.siteId === siteId);
  }

  async acknowledgeAlert(alertId: string, principal: Principal): Promise<AlertRecord> {
    const alert = this.alerts.find((candidate) => candidate.id === alertId && candidate.tenantId === principal.tenantId);
    if (!alert) throw new NotFoundException("Alert not found.");
    const before = { status: alert.status };
    alert.status = "acknowledged";
    alert.acknowledgedAtUtc = new Date().toISOString();

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE alerts SET status=$1, acknowledged_at=now() WHERE id=$2 AND tenant_id=$3`, [alert.status, alert.id, principal.tenantId]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "alert.acknowledged",
      siteId: alert.siteId,
      assetId: alert.assetId,
      entityType: "alert",
      entityId: alert.id,
      beforeMetadata: before,
      afterMetadata: { status: alert.status },
      reason: "Alert acknowledged by operator."
    });

    return alert;
  }

  listIncidents(principal: Principal): IncidentRecord[] {
    return this.scope(this.incidents, principal.tenantId);
  }

  async updateIncidentStatus(id: string, status: IncidentRecord["status"], principal: Principal): Promise<IncidentRecord> {
    const incident = this.incidents.find((candidate) => candidate.id === id && candidate.tenantId === principal.tenantId);
    if (!incident) throw new NotFoundException("Incident not found.");
    const before = { status: incident.status };
    incident.status = status;
    incident.updatedAtUtc = nowIso();

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE incidents SET status=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3`, [incident.status, incident.id, principal.tenantId]);
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "incident.status_changed",
      siteId: incident.siteId,
      entityType: "incident",
      entityId: incident.id,
      beforeMetadata: before,
      afterMetadata: { status },
      reason: "Incident lifecycle updated."
    });
    return incident;
  }

  listMaintenance(principal: Principal): MaintenanceTask[] {
    return this.scope(this.maintenanceTasks, principal.tenantId);
  }

  async createMaintenanceTask(input: CreateMaintenanceTaskInput, principal: Principal): Promise<MaintenanceTask> {
    if (!hasPermission(principal.role, "maintenance:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);

    const task: MaintenanceTask = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      assetId: input.assetId,
      incidentId: input.incidentId,
      title: input.title,
      notes: input.notes,
      dueAtUtc: input.dueAtUtc,
      status: "open"
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO maintenance_tasks (id, tenant_id, site_id, asset_id, incident_id, title, notes, due_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [task.id, task.tenantId, task.siteId, task.assetId ?? null, task.incidentId ?? null, task.title, task.notes ?? null, task.dueAtUtc ?? null, task.status]
      );
    }

    this.maintenanceTasks.push(task);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "maintenance.created",
      siteId: task.siteId,
      assetId: task.assetId,
      entityType: "maintenance_task",
      entityId: task.id,
      afterMetadata: { title: task.title },
      reason: `Maintenance task "${task.title}" created.`
    });

    return task;
  }

  async updateMaintenanceTask(taskId: string, input: UpdateMaintenanceTaskInput, principal: Principal): Promise<MaintenanceTask> {
    if (!hasPermission(principal.role, "maintenance:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const task = this.requireMaintenanceTask(taskId, principal.tenantId);
    const before = { ...task };
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(task, patch);
    if (task.status === "complete" && before.status !== "complete") {
      task.completedAtUtc = nowIso();
    } else if (task.status === "open") {
      task.completedAtUtc = undefined;
    }

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE maintenance_tasks SET title=$1, notes=$2, due_at=$3, status=$4, completion_log=$5, completed_at=$6, updated_at=now()
         WHERE id=$7 AND tenant_id=$8`,
        [task.title, task.notes ?? null, task.dueAtUtc ?? null, task.status, task.completionLog ?? null, task.completedAtUtc ?? null, task.id, principal.tenantId]
      );
    }

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: task.status === "complete" && before.status !== "complete" ? "maintenance.completed" : "maintenance.updated",
      siteId: task.siteId,
      assetId: task.assetId,
      entityType: "maintenance_task",
      entityId: task.id,
      beforeMetadata: { status: before.status },
      afterMetadata: { status: task.status },
      reason: `Maintenance task "${task.title}" updated.`
    });

    return task;
  }

  reportTemplates() {
    return [
      "Operational report",
      "Sustainability report",
      "Audit report",
      "Incident report"
    ];
  }

  async createReportExport(input: ReportExportInput, principal: Principal) {
    // A report is for the caller's own site. Without this, one tenant could request an export (and
    // write an audit entry) naming another tenant's site, and a real export would hand its data over.
    if (input.siteId) this.requireSite(input.siteId, principal.tenantId);

    const auditEvent = await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "report.export_requested",
      siteId: input.siteId,
      entityType: "report_export",
      afterMetadata: { reportType: input.reportType, parameters: input.parameters ?? {} },
      reason: "Report export placeholder requested."
    });

    const exportRecord = {
      ...input,
      id: randomUUID(),
      status: "queued_placeholder",
      requestedBy: principal.userId,
      createdAtUtc: auditEvent.createdAtUtc
    };
    this.reportExports.unshift(exportRecord);

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO report_exports (id, tenant_id, site_id, requested_by, report_type, parameters, export_status, audit_event_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          exportRecord.id,
          principal.tenantId,
          exportRecord.siteId ?? null,
          principal.userId,
          exportRecord.reportType,
          JSON.stringify(exportRecord.parameters ?? {}),
          exportRecord.status,
          auditEvent.id,
          exportRecord.createdAtUtc
        ]
      );
    }

    return exportRecord;
  }

  listAudit(principal: Principal, siteId?: string): AuditEvent[] {
    return this.scope(this.auditEvents, principal.tenantId).filter((event) => !siteId || event.siteId === siteId);
  }

  async recordEdgeSync(input: EdgeSyncInput, principal: Principal) {
    this.requireSite(input.siteId, principal.tenantId);
    const batch = {
      ...input,
      id: randomUUID(),
      tenantId: principal.tenantId,
      createdAtUtc: nowIso()
    };
    this.edgeSyncBatches.unshift(batch);

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO edge_sync_batches (id, tenant_id, site_id, gateway_id, status, buffered_readings, started_at, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [batch.id, batch.tenantId, batch.siteId, batch.gatewayId, batch.status, batch.bufferedReadings, batch.startedAtUtc, batch.completedAtUtc ?? null, batch.createdAtUtc]
      );
    }

    return batch;
  }

  health() {
    return {
      service: "greecon-api",
      status: "OK",
      timeUtc: nowIso(),
      modules: [
        "auth",
        "tenants",
        "users",
        "sites",
        "assets",
        "devices",
        "points",
        "telemetry",
        "derived-states",
        "rules",
        "commands",
        "alerts",
        "incidents",
        "maintenance",
        "reports",
        "audit",
        "edge-sync",
        "health"
      ]
    };
  }

  private scope<T extends { tenantId: string }>(records: T[], tenantId: string): T[] {
    return records.filter((record) => record.tenantId === tenantId);
  }

  private requireTenant(tenantId: string): Tenant {
    const tenant = this.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant) throw new ForbiddenException("Tenant is not available in this context.");
    return tenant;
  }

  // Used by TenantStatusGuard on every authenticated request, not just this one lookup path —
  // deliberately tolerant of an unknown tenantId (returns false) rather than throwing, since a
  // guard rejecting with the wrong exception type is worse than it just failing closed.
  isTenantActive(tenantId: string): boolean {
    return this.tenants.find((candidate) => candidate.id === tenantId)?.status === "active";
  }

  async updateTenantStatus(tenantId: string, status: Tenant["status"], principal: Principal): Promise<Tenant> {
    if (!principal.isPlatformAdmin) {
      throw new ForbiddenException("This action requires Greecon platform-administrator access.");
    }

    const tenant = this.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant) throw new NotFoundException("Client not found.");

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE tenants SET status = $1, updated_at = now() WHERE id = $2`, [status, tenantId]);
    }
    tenant.status = status;

    await this.recordAudit({
      tenantId,
      userId: principal.userId,
      eventType: status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
      entityType: "tenant",
      entityId: tenantId,
      afterMetadata: { status },
      reason: `Client "${tenant.name}" ${status === "suspended" ? "suspended" : "reactivated"} by a Greecon platform administrator.`
    });

    return tenant;
  }

  private requireUser(userId: string, tenantId: string): User {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) throw new NotFoundException("User not found.");
    if (user.tenantId !== tenantId) throw new ForbiddenException("User is outside tenant scope.");
    return user;
  }

  private requireSite(siteId: string, tenantId: string): Site {
    const site = this.sites.find((candidate) => candidate.id === siteId);
    if (!site) throw new NotFoundException("Site not found.");
    if (site.tenantId !== tenantId) throw new ForbiddenException("Site is outside tenant scope.");
    return site;
  }

  private requireAsset(assetId: string, tenantId: string): Asset {
    const asset = this.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new NotFoundException("Asset not found.");
    if (asset.tenantId !== tenantId) throw new ForbiddenException("Asset is outside tenant scope.");
    return asset;
  }

  private requireDevice(deviceId: string, tenantId: string): Device {
    const device = this.devices.find((candidate) => candidate.id === deviceId);
    if (!device) throw new NotFoundException("Device not found.");
    if (device.tenantId !== tenantId) throw new ForbiddenException("Device is outside tenant scope.");
    return device;
  }

  private requireGateway(gatewayId: string, tenantId: string): EdgeGateway {
    const gateway = this.gateways.find((candidate) => candidate.id === gatewayId);
    if (!gateway) throw new NotFoundException("Gateway not found.");
    if (gateway.tenantId !== tenantId) throw new ForbiddenException("Gateway is outside tenant scope.");
    return gateway;
  }

  private requirePoint(pointId: string, tenantId: string): Point {
    const point = this.points.find((candidate) => candidate.id === pointId);
    if (!point) throw new NotFoundException("Point not found.");
    if (point.tenantId !== tenantId) throw new ForbiddenException("Point is outside tenant scope.");
    return point;
  }

  private requireRule(ruleId: string, tenantId: string): AutomationRule {
    const rule = this.rules.find((candidate) => candidate.id === ruleId);
    if (!rule) throw new NotFoundException("Rule not found.");
    if (rule.tenantId !== tenantId) throw new ForbiddenException("Rule is outside tenant scope.");
    return rule;
  }

  private requireMaintenanceTask(taskId: string, tenantId: string): MaintenanceTask {
    const task = this.maintenanceTasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new NotFoundException("Maintenance task not found.");
    if (task.tenantId !== tenantId) throw new ForbiddenException("Maintenance task is outside tenant scope.");
    return task;
  }

  private latestReadings(readings: TelemetryReading[]): TelemetryReading[] {
    const latest = new Map<string, TelemetryReading>();
    for (const item of readings) {
      const existing = latest.get(item.pointId);
      if (!existing || Date.parse(item.timestampUtc) > Date.parse(existing.timestampUtc)) {
        latest.set(item.pointId, item);
      }
    }
    return [...latest.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  }

  // this.telemetry only ever holds one row per point (the latest) — every consumer already
  // reduces to latest-per-point via latestReadings, so keeping full history in memory would only
  // grow unbounded for no benefit. Full history lives in Postgres once DATABASE_URL is set.
  // Returns whether `item` became the latest value for its point (it does unless a newer reading
  // is already held).
  private upsertLatestTelemetry(item: TelemetryReading): boolean {
    const index = this.telemetry.findIndex((existing) => existing.pointId === item.pointId);
    if (index < 0) {
      this.telemetry.push(item);
      return true;
    }

    const existing = this.telemetry[index] as TelemetryReading;
    if (Date.parse(item.timestampUtc) < Date.parse(existing.timestampUtc)) return false;

    this.telemetry[index] = item;
    return true;
  }

  private async persistTelemetryReading(item: TelemetryReading): Promise<void> {
    await this.db.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, value_text, value_bool, unit, quality, source, ingestion_timestamp_utc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        item.timestampUtc,
        item.tenantId,
        item.siteId,
        item.assetId ?? null,
        item.deviceId,
        item.pointId,
        item.canonicalName,
        typeof item.value === "number" ? item.value : null,
        typeof item.value === "string" ? item.value : null,
        typeof item.value === "boolean" ? item.value : null,
        item.unit,
        item.quality,
        item.source,
        item.ingestionTimestampUtc
      ]
    );
  }

  private async persistCommand(record: CommandRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO commands (id, tenant_id, site_id, target_device_id, target_point_id, requested_value, requested_by, requested_by_role, reason, safety_evaluation, dispatch_status, acknowledgement, result, failure_reason, rollback_status, audit_event_id, correlation_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
       ON CONFLICT (id) DO UPDATE SET
         dispatch_status=EXCLUDED.dispatch_status,
         acknowledgement=EXCLUDED.acknowledgement,
         result=EXCLUDED.result,
         failure_reason=EXCLUDED.failure_reason,
         rollback_status=EXCLUDED.rollback_status,
         updated_at=now()`,
      [
        record.id,
        record.tenantId,
        record.siteId,
        record.targetDeviceId,
        record.targetPointId,
        JSON.stringify(record.requestedValue),
        record.requestedBy,
        record.requestedByRole,
        record.reason,
        JSON.stringify(record.safetyEvaluation),
        record.dispatchStatus,
        record.acknowledgement ? JSON.stringify(record.acknowledgement) : null,
        record.result ?? null,
        record.failureReason ?? null,
        record.rollbackStatus ?? null,
        record.auditEventId,
        record.correlationId,
        record.createdAtUtc
      ]
    );
  }

  /** Where the energy at one site is going, from its newest readings. Only what is measured and
   * current is shown as flowing (see deriveEnergyFlow). */
  private energyFlowOf(tenantId: string, siteId: string, nowMs: number): EnergyFlowView {
    const readings = this.latestReadings(this.telemetry.filter((item) => item.tenantId === tenantId && item.siteId === siteId));
    const pick = (name: CanonicalPointName): FlowReading | undefined => {
      const item = readings.find((candidate) => candidate.canonicalName === name);
      if (!item || typeof item.value !== "number") return undefined;
      const view = this.viewReading(item, nowMs);
      return { value: item.value, fresh: view.freshness === "current", ageSeconds: view.ageSeconds, simulated: item.source === "simulator" };
    };
    return deriveEnergyFlow({
      solarKw: pick("energy.solar.power.kw"),
      consumptionKw: pick("energy.consumption.kw"),
      gridImportKw: pick("energy.grid.import.kw"),
      gridExportKw: pick("energy.grid.export.kw"),
      batteryKw: pick("energy.battery.power.kw"),
      batterySocPercent: pick("energy.battery.soc.percent")
    });
  }

  // Both helpers take the tenant explicitly. They used to read every tenant's data, so one
  // customer's Overview could show another customer's numbers (this.telemetry and
  // this.derivedStates hold all tenants in memory).
  private latestNumber(tenantId: string, canonicalName: string): number | undefined {
    const readingValue = this.latestReadings(this.telemetry.filter((item) => item.tenantId === tenantId)).find(
      (item) => item.canonicalName === canonicalName
    );
    return typeof readingValue?.value === "number" ? readingValue.value : undefined;
  }

  /** One of two words for a yes/no state across the tenant's sites, or undefined when the state
   * does not exist: it could not be judged (nothing reports it, or its readings are out of date). */
  private stateFlag<A extends string, B extends string>(tenantId: string, stateKey: StateKey, whenTrue: A, whenFalse: B): A | B | undefined {
    const states = this.derivedStates.filter((state) => state.tenantId === tenantId && state.stateKey === stateKey);
    if (states.length === 0) return undefined;
    return states.some((state) => state.stateValue === true) ? whenTrue : whenFalse;
  }

  private sensorValue(item: TelemetryReading): SensorSnapshotValue {
    return {
      value: item.value,
      unit: item.unit,
      quality: item.quality,
      timestampUtc: item.timestampUtc,
      // Simulated readings (the demo tenant, the edge simulator) measure nothing that can go
      // quiet, so they are never out of date. Real readings use the point's own max_age_seconds
      // threshold if it sets one, else the default for their kind (gaia-core's freshness.ts).
      maxAgeSeconds: item.source === "simulator" ? Number.POSITIVE_INFINITY : undefined,
      // The point's configured thresholds (critical_low, irrigate_below, ...) are what the
      // derived states are judged against; before this they were stored but never read.
      thresholds: this.points.find((point) => point.id === item.pointId)?.thresholdConfig
    };
  }

  private sensorSnapshot(tenantId: string, siteId?: string): SensorSnapshot {
    const snapshot: SensorSnapshot = {};
    const readings = this.latestReadings(this.telemetry.filter((item) => item.tenantId === tenantId && (!siteId || item.siteId === siteId)));
    for (const item of readings) snapshot[item.canonicalName] = this.sensorValue(item);
    return snapshot;
  }

  // What is true of one site right now, worked out from the readings and alerts it has: whether it
  // has ever reported, whether it has gone quiet, what is standing against it. Its stored `status`
  // and `edgeStatus` are not consulted: a label somebody typed once says nothing about now.
  private assessSite(stored: Site, nowMs: number): SiteView {
    const readings = this.latestReadings(this.telemetry.filter((item) => item.tenantId === stored.tenantId && item.siteId === stored.id));
    const quiet = deriveOperationalStates(this.sensorSnapshot(stored.tenantId, stored.id), { nowMs, limits: stored.safetyLimits }).find(
      (state) => state.stateKey === "system.communication_degraded" && state.stateValue === true
    );
    const health = assessSiteHealth({
      siteId: stored.id,
      siteName: stored.name,
      readingCount: readings.length,
      communicationProblem: quiet !== undefined,
      communicationDetail: quiet?.reason,
      alerts: this.alerts.filter((alert) => alert.tenantId === stored.tenantId && alert.siteId === stored.id)
    });
    return { ...stored, status: statusLabelFor(health), edgeStatus: this.edgeStatusOf(readings, nowMs), health, lastReadingAtUtc: newestTimestamp(readings) };
  }

  private assessDevice(stored: Device, nowMs: number): Device {
    const readings = this.latestReadings(this.telemetry.filter((item) => item.tenantId === stored.tenantId && item.deviceId === stored.id));
    return { ...stored, health: this.edgeStatusOf(readings, nowMs), lastSeenUtc: newestTimestamp(readings) };
  }

  // The gateway is online if something real has been heard from it lately; "Simulated" if the only
  // readings are simulated ones; offline if nothing has ever arrived or what did has gone quiet.
  private edgeStatusOf(readings: TelemetryReading[], nowMs: number): StatusLabel {
    if (readings.length === 0) return "Offline";
    const real = readings.filter((item) => item.source !== "simulator");
    if (real.length === 0) return "Simulated";
    const heardLately = real.some((item) => assessSensorAge(item.canonicalName, this.sensorValue(item), nowMs).freshness === "fresh");
    return heardLately ? "OK" : "Offline";
  }

  /** The newest reading of each kind across the tenant's sites, with its age at `nowMs`. */
  private overviewReadings(tenantId: string, nowMs: number): Partial<Record<CanonicalPointName, OverviewReading>> {
    const newest = new Map<CanonicalPointName, TelemetryReading>();
    for (const item of this.latestReadings(this.telemetry.filter((candidate) => candidate.tenantId === tenantId))) {
      const held = newest.get(item.canonicalName);
      if (!held || Date.parse(item.timestampUtc) > Date.parse(held.timestampUtc)) newest.set(item.canonicalName, item);
    }

    const readings: Partial<Record<CanonicalPointName, OverviewReading>> = {};
    for (const [name, item] of [...newest.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const view = this.viewReading(item, nowMs);
      readings[name] = {
        value: item.value,
        unit: item.unit,
        siteId: item.siteId,
        siteName: this.sites.find((site) => site.id === item.siteId)?.name ?? "",
        asOfUtc: item.timestampUtc,
        ageSeconds: view.ageSeconds,
        freshness: view.freshness,
        quality: item.quality,
        concern: view.concern
      };
    }
    return readings;
  }

  private stateSnapshot(tenantId: string, siteId?: string): StateSnapshot {
    const snapshot: StateSnapshot = {};
    for (const item of this.derivedStates.filter((stateValue) => stateValue.tenantId === tenantId && (!siteId || stateValue.siteId === siteId))) {
      snapshot[item.stateKey] = item;
    }
    return snapshot;
  }

  /** Re-derives every site's states against the clock. Telemetry arriving is not the only thing
   * that changes the picture: a gateway that goes quiet changes it by saying nothing, so this runs
   * on a timer as well as on ingestion. Exposed (with an injectable clock) so tests can move time. */
  async refreshAllDerivedStates(nowMs: number = Date.now()): Promise<void> {
    for (const site of [...this.sites]) {
      this.refreshDerivedStates(site.tenantId, site.id, nowMs);
      await this.reconcileSiteAlerts(site.tenantId, site.id, nowMs);
    }
  }

  private refreshDerivedStates(tenantId: string, siteId: string, nowMs: number = Date.now()): void {
    const site = this.sites.find((candidate) => candidate.id === siteId && candidate.tenantId === tenantId);
    const sensors = this.sensorSnapshot(tenantId, siteId);
    const generated = deriveOperationalStates(sensors, { nowMs, limits: site?.safetyLimits });
    const at = new Date(nowMs).toISOString();

    // A state keeps its start time for as long as its value holds, so "how long has this been true"
    // is answerable (an alert can require a condition to persist before it fires). It starts again
    // when the value changes.
    const previous = new Map(
      this.derivedStates.filter((state) => state.tenantId === tenantId && state.siteId === siteId).map((state) => [state.stateKey, state] as const)
    );

    // Replace the site's whole set, not just the keys generated this time: a state that is no
    // longer derived (its reading went out of date) must disappear, not linger with its last value.
    this.derivedStates = this.derivedStates.filter((stateValue) => stateValue.tenantId !== tenantId || stateValue.siteId !== siteId);
    for (const item of generated) {
      const before = previous.get(item.stateKey);
      const unchanged = before !== undefined && before.stateValue === item.stateValue;
      this.derivedStates.push({
        id: unchanged ? before.id : randomUUID(),
        tenantId,
        siteId,
        stateKey: item.stateKey,
        stateValue: item.stateValue,
        severity: item.severity,
        confidence: item.confidence,
        reason: item.reason,
        createdAtUtc: unchanged ? before.createdAtUtc : at,
        updatedAtUtc: at
      });
    }
  }

  // Brings a site's alerts into line with what is true now (see gaia-core's alerts.ts for the rules).
  // The in-memory list is updated first and synchronously, so two passes running close together
  // cannot both open the same alert; only then is the database written. A failed write is logged and
  // does not fail the caller: telemetry ingestion must never break because an alert row could not
  // be stored, and the next pass sees the in-memory truth.
  private async reconcileSiteAlerts(tenantId: string, siteId: string, nowMs: number): Promise<void> {
    const siteStates = this.derivedStates
      .filter((state) => state.tenantId === tenantId && state.siteId === siteId)
      .map((state) => ({ stateKey: state.stateKey, stateValue: state.stateValue, severity: state.severity, sinceUtc: state.createdAtUtc }));
    const conditions = alertConditionsFromStates(siteStates, nowMs);
    const existing = this.alerts.filter((alert) => alert.tenantId === tenantId && alert.siteId === siteId);
    // Only close an alert because its condition cleared if that condition can actually be seen.
    const changes = reconcileAlerts(conditions, existing, nowMs, undefined, evaluableCategories(siteStates));
    if (changes.length === 0) return;

    const at = new Date(nowMs).toISOString();
    const writes: Array<() => Promise<unknown>> = [];

    for (const change of changes) {
      const alert = this.applyAlertChange(change, tenantId, siteId, at);
      if (alert) writes.push(() => (change.type === "open" ? this.insertAlert(alert) : this.updateAlertRow(alert)));
    }

    if (!this.db.isConfigured()) return;
    for (const write of writes) {
      try {
        await write();
      } catch (error) {
        this.logger.warn(`Could not store an alert change: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private applyAlertChange(change: AlertChange, tenantId: string, siteId: string, at: string): AlertRecord | undefined {
    if (change.type === "open") {
      const alert: AlertRecord = {
        id: randomUUID(),
        tenantId,
        siteId,
        category: change.condition.category,
        severity: change.condition.severity,
        status: "open",
        title: change.condition.title,
        suggestedAction: change.condition.suggestedAction,
        createdAtUtc: at
      };
      this.alerts.unshift(alert);
      return alert;
    }

    const alert = this.alerts.find((candidate) => candidate.id === change.alertId && candidate.tenantId === tenantId);
    if (!alert) return undefined;

    if (change.type === "resolve") {
      alert.status = "resolved";
      alert.resolvedAtUtc = at;
      return alert;
    }

    alert.severity = change.condition.severity;
    alert.title = change.condition.title;
    alert.suggestedAction = change.condition.suggestedAction;
    if (change.type === "reopen") {
      alert.status = "open";
      alert.resolvedAtUtc = undefined;
    } else if (change.type === "escalate" && change.reopen) {
      // It got worse after someone acknowledged it: they need to hear about it again.
      alert.status = "open";
    }
    return alert;
  }

  private async insertAlert(alert: AlertRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO alerts (id, tenant_id, site_id, asset_id, category, severity, status, title, suggested_action, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [alert.id, alert.tenantId, alert.siteId, alert.assetId ?? null, alert.category, alert.severity, alert.status, alert.title, alert.suggestedAction, alert.createdAtUtc]
    );
  }

  private async updateAlertRow(alert: AlertRecord): Promise<void> {
    await this.db.query(
      `UPDATE alerts SET status=$1, severity=$2, title=$3, suggested_action=$4, resolved_at=$5 WHERE id=$6 AND tenant_id=$7`,
      [alert.status, alert.severity, alert.title, alert.suggestedAction, alert.resolvedAtUtc ?? null, alert.id, alert.tenantId]
    );
  }

  // Awaited (not fire-and-forget) because commands and report exports store this event's id as
  // a foreign key immediately after — a background write here could lose the race and violate
  // that constraint.
  private async recordAudit(event: Omit<AuditEvent, "id" | "createdAtUtc">): Promise<AuditEvent> {
    const auditEvent: AuditEvent = {
      ...event,
      id: randomUUID(),
      createdAtUtc: nowIso()
    };
    this.auditEvents.unshift(auditEvent);

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO audit_events (id, tenant_id, user_id, event_type, site_id, asset_id, entity_type, entity_id, before_metadata, after_metadata, reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          auditEvent.id,
          auditEvent.tenantId,
          auditEvent.userId,
          auditEvent.eventType,
          auditEvent.siteId ?? null,
          auditEvent.assetId ?? null,
          auditEvent.entityType,
          auditEvent.entityId ?? null,
          auditEvent.beforeMetadata ? JSON.stringify(auditEvent.beforeMetadata) : null,
          auditEvent.afterMetadata ? JSON.stringify(auditEvent.afterMetadata) : null,
          auditEvent.reason ?? null,
          auditEvent.createdAtUtc
        ]
      );
    }

    return auditEvent;
  }
}

/** devices.metadata is a general-purpose jsonb column with no other current use — real physical
 * placement (docs/13-pilot-readiness.md, "Sensor map showed a computed layout, not real
 * placement") is stored there so it survives a restart once a database is configured, instead of
 * only living in the hardcoded in-memory seed data. */
function devicePlacementMetadata(device: Device): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (device.positionX !== undefined) metadata.positionX = device.positionX;
  if (device.positionY !== undefined) metadata.positionY = device.positionY;
  if (device.placementNote !== undefined) metadata.placementNote = device.placementNote;
  return metadata;
}

interface TenantRow {
  id: string;
  name: string;
  domain: string;
  status: string;
}

function mapTenantRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    status: row.status as Tenant["status"]
  };
}

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  status: string;
  role: string;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    status: row.status as User["status"]
  };
}

interface SiteRow {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  location_name: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  edge_status: string;
  safety_limits: Site["safetyLimits"] | null;
}

function mapSiteRow(row: SiteRow): Site {
  const safetyLimits = row.safety_limits && Object.keys(row.safety_limits).length > 0 ? row.safety_limits : undefined;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    type: row.type as Site["type"],
    locationName: row.location_name,
    latitude: row.latitude !== null ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null ? Number(row.longitude) : undefined,
    status: row.status as Site["status"],
    edgeStatus: row.edge_status as Site["edgeStatus"],
    safetyLimits
  };
}

interface AssetRow {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  type: string;
  status: string;
}

function mapAssetRow(row: AssetRow): Asset {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    type: row.type as Asset["type"],
    status: row.status as Asset["status"]
  };
}

interface DeviceRow {
  id: string;
  tenant_id: string;
  site_id: string;
  asset_id: string | null;
  gateway_id: string | null;
  name: string;
  device_type: string;
  protocol: string;
  driver_type: string;
  health: string;
  last_seen_utc: string | null;
  firmware_version: string | null;
  secure_identity_status: string;
  metadata: { positionX?: number; positionY?: number; placementNote?: string } | null;
}

function mapDeviceRow(row: DeviceRow): Device {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    assetId: row.asset_id ?? undefined,
    gatewayId: row.gateway_id ?? undefined,
    name: row.name,
    deviceType: row.device_type,
    protocol: row.protocol as Device["protocol"],
    driverType: row.driver_type,
    health: row.health as Device["health"],
    lastSeenUtc: row.last_seen_utc ?? undefined,
    firmwareVersion: row.firmware_version ?? undefined,
    secureIdentityStatus: row.secure_identity_status as Device["secureIdentityStatus"],
    positionX: row.metadata?.positionX,
    positionY: row.metadata?.positionY,
    placementNote: row.metadata?.placementNote
  };
}

interface EdgeGatewayRow {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  status: string;
  last_seen_utc: string | null;
  software_version: string | null;
  secure_identity_status: string;
}

function mapGatewayRow(row: EdgeGatewayRow): EdgeGateway {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    status: row.status as EdgeGateway["status"],
    lastSeenUtc: row.last_seen_utc ?? undefined,
    softwareVersion: row.software_version ?? undefined,
    secureIdentityStatus: row.secure_identity_status as EdgeGateway["secureIdentityStatus"]
  };
}

interface PointRow {
  id: string;
  tenant_id: string;
  site_id: string;
  asset_id: string | null;
  device_id: string;
  canonical_name: string;
  label: string;
  unit: string;
  quality: string;
  capability: string;
  threshold_config: Record<string, number> | null;
}

function mapPointRow(row: PointRow): Point {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    assetId: row.asset_id ?? undefined,
    deviceId: row.device_id,
    canonicalName: row.canonical_name as Point["canonicalName"],
    label: row.label,
    unit: row.unit,
    quality: row.quality as Point["quality"],
    capability: row.capability as Point["capability"],
    thresholdConfig: row.threshold_config ?? undefined
  };
}

interface RuleRow {
  id: string;
  tenant_id: string;
  site_id: string | null;
  name: string;
  priority: string;
  trigger_type: string;
  conditions: RuleCondition[];
  constraints: RuleCondition[];
  actions: RuleAction[];
  execution_mode: string;
  explanation_template: string;
  rollback_behavior: string;
  enabled: boolean;
  approval_state: string;
  version: number;
  created_by: string | null;
  updated_by: string | null;
}

function mapRuleRow(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id ?? undefined,
    name: row.name,
    priority: row.priority as RulePriorityLevel,
    triggerType: row.trigger_type as AutomationRule["triggerType"],
    conditions: row.conditions,
    constraints: row.constraints,
    actions: row.actions,
    executionMode: row.execution_mode as RuleExecutionMode,
    explanationTemplate: row.explanation_template,
    rollbackBehavior: row.rollback_behavior,
    enabled: row.enabled,
    approvalState: row.approval_state as AutomationRule["approvalState"],
    version: row.version,
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? ""
  };
}

interface TelemetryRow {
  timestamp_utc: string;
  tenant_id: string;
  site_id: string;
  asset_id: string | null;
  device_id: string;
  point_id: string;
  canonical_name: string;
  value_numeric: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  unit: string;
  quality: string;
  source: string;
  ingestion_timestamp_utc: string;
}

function mapTelemetryRow(row: TelemetryRow): TelemetryReading {
  const value = row.value_numeric ?? row.value_bool ?? row.value_text ?? "";
  return {
    timestampUtc: row.timestamp_utc,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    assetId: row.asset_id ?? undefined,
    deviceId: row.device_id,
    pointId: row.point_id,
    canonicalName: row.canonical_name as TelemetryReading["canonicalName"],
    value,
    unit: row.unit,
    quality: row.quality as TelemetryReading["quality"],
    source: row.source as TelemetryReading["source"],
    ingestionTimestampUtc: row.ingestion_timestamp_utc
  };
}

interface CommandRow {
  id: string;
  tenant_id: string;
  site_id: string;
  target_device_id: string;
  target_point_id: string;
  requested_value: number | boolean | string;
  requested_by: string;
  requested_by_role: string;
  reason: string;
  safety_evaluation: CommandRecord["safetyEvaluation"];
  dispatch_status: string;
  acknowledgement: CommandAckMessage | null;
  result: string | null;
  failure_reason: string | null;
  rollback_status: string | null;
  audit_event_id: string;
  correlation_id: string;
  created_at: string;
}

function mapCommandRow(row: CommandRow, points: readonly Point[]): CommandRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    targetDeviceId: row.target_device_id,
    targetPointId: row.target_point_id,
    canonicalName: points.find((point) => point.id === row.target_point_id)?.canonicalName ?? row.target_point_id,
    requestedValue: row.requested_value,
    requestedBy: row.requested_by,
    requestedByRole: row.requested_by_role as UserRole,
    reason: row.reason,
    safetyEvaluation: row.safety_evaluation,
    executionMode: "simulated",
    dispatchStatus: row.dispatch_status as CommandRecord["dispatchStatus"],
    acknowledgement: row.acknowledgement ?? undefined,
    result: row.result ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    rollbackStatus: row.rollback_status ?? undefined,
    auditEventId: row.audit_event_id,
    correlationId: row.correlation_id,
    createdAtUtc: row.created_at
  };
}

interface AlertRow {
  id: string;
  tenant_id: string;
  site_id: string;
  asset_id: string | null;
  category: string;
  severity: string;
  status: string;
  title: string;
  suggested_action: string;
  created_at: string | Date;
  acknowledged_at?: string | Date | null;
  resolved_at?: string | Date | null;
}

// pg hands back Date objects for timestamptz columns even though the row types say string; normalise
// so comparisons and JSON output are always an ISO string.
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function mapAlertRow(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    assetId: row.asset_id ?? undefined,
    category: row.category as AlertRecord["category"],
    severity: row.severity as AlertRecord["severity"],
    status: row.status as AlertRecord["status"],
    title: row.title,
    suggestedAction: row.suggested_action,
    createdAtUtc: toIso(row.created_at),
    acknowledgedAtUtc: row.acknowledged_at ? toIso(row.acknowledged_at) : undefined,
    resolvedAtUtc: row.resolved_at ? toIso(row.resolved_at) : undefined
  };
}

interface IncidentRow {
  id: string;
  tenant_id: string;
  site_id: string;
  alert_id: string | null;
  status: string;
  severity: string;
  title: string;
  investigation_notes: string | null;
  updated_at: string;
}

function mapIncidentRow(row: IncidentRow): IncidentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    alertId: row.alert_id ?? undefined,
    status: row.status as IncidentRecord["status"],
    severity: row.severity as IncidentRecord["severity"],
    title: row.title,
    investigationNotes: row.investigation_notes ?? undefined,
    updatedAtUtc: row.updated_at
  };
}

interface AuditRow {
  id: string;
  tenant_id: string;
  user_id: string;
  event_type: string;
  site_id: string | null;
  asset_id: string | null;
  entity_type: string;
  entity_id: string | null;
  before_metadata: Record<string, unknown> | null;
  after_metadata: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

function mapAuditRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    eventType: row.event_type,
    siteId: row.site_id ?? undefined,
    assetId: row.asset_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    beforeMetadata: row.before_metadata ?? undefined,
    afterMetadata: row.after_metadata ?? undefined,
    reason: row.reason ?? undefined,
    createdAtUtc: row.created_at
  };
}

interface EdgeSyncRow {
  id: string;
  tenant_id: string;
  site_id: string;
  gateway_id: string;
  status: string;
  buffered_readings: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

function mapEdgeSyncRow(row: EdgeSyncRow): EdgeSyncInput & { id: string; tenantId: string; createdAtUtc: string } {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    gatewayId: row.gateway_id,
    status: row.status as EdgeSyncMessage["status"],
    bufferedReadings: row.buffered_readings,
    startedAtUtc: row.started_at,
    completedAtUtc: row.completed_at ?? undefined,
    createdAtUtc: row.created_at
  };
}

interface ReportExportRow {
  id: string;
  tenant_id: string;
  site_id: string | null;
  requested_by: string;
  report_type: string;
  parameters: Record<string, string | number | boolean>;
  export_status: string;
  created_at: string;
}

function mapReportExportRow(row: ReportExportRow): ReportExportInput & { id: string; status: string; requestedBy: string; createdAtUtc: string } {
  return {
    id: row.id,
    siteId: row.site_id ?? undefined,
    reportType: row.report_type as ReportExportInput["reportType"],
    parameters: row.parameters,
    status: row.export_status,
    requestedBy: row.requested_by,
    createdAtUtc: row.created_at
  };
}

interface MaintenanceTaskRow {
  id: string;
  tenant_id: string;
  site_id: string;
  asset_id: string | null;
  incident_id: string | null;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  completion_log: string | null;
  status: string;
}

function mapMaintenanceTaskRow(row: MaintenanceTaskRow): MaintenanceTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    assetId: row.asset_id ?? undefined,
    incidentId: row.incident_id ?? undefined,
    title: row.title,
    notes: row.notes ?? undefined,
    dueAtUtc: row.due_at ?? undefined,
    completedAtUtc: row.completed_at ?? undefined,
    completionLog: row.completion_log ?? undefined,
    status: row.status as MaintenanceTask["status"]
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function reading(
  siteId: string,
  assetId: string,
  deviceId: string,
  pointId: string,
  canonicalName: TelemetryReading["canonicalName"],
  value: number,
  unit: string,
  quality: TelemetryReading["quality"],
  minutesAgo: number
): TelemetryReading {
  return {
    timestampUtc: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    tenantId: DEMO_TENANT_ID,
    siteId,
    assetId,
    deviceId,
    pointId,
    canonicalName,
    value,
    unit,
    quality,
    source: "simulator",
    ingestionTimestampUtc: nowIso()
  };
}

function state(
  stateKey: DerivedState["stateKey"],
  stateValue: boolean,
  severity: DerivedState["severity"],
  siteId: string,
  assetId: string,
  reason: string
): DerivedState {
  return {
    id: randomUUID(),
    tenantId: DEMO_TENANT_ID,
    siteId,
    assetId,
    stateKey,
    stateValue,
    severity,
    confidence: 0.9,
    reason,
    createdAtUtc: nowIso(),
    updatedAtUtc: nowIso()
  };
}

function audit(
  eventType: string,
  entityType: string,
  entityId: string,
  reason: string,
  siteId?: string,
  assetId?: string
): AuditEvent {
  return {
    id: randomUUID(),
    tenantId: DEMO_TENANT_ID,
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    eventType,
    siteId,
    assetId,
    entityType,
    entityId,
    afterMetadata: { seeded: true },
    reason,
    createdAtUtc: nowIso()
  };
}

function demoRules(): AutomationRule[] {
  return [
    {
      id: "88888888-8888-4888-8888-888888888801",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      name: "Dry-run protection",
      priority: "safety",
      triggerType: "failsafe",
      conditions: [{ point: "water.flow.lpm", operator: "lte", value: 0.2 }],
      constraints: [],
      actions: [{ type: "command", targetCanonicalName: "water.pump.command", value: "OFF", message: "Stop pump because flow is below dry-run threshold." }],
      executionMode: "edge",
      explanationTemplate: "Pump protection is applied locally at the edge.",
      rollbackBehavior: "Keep pump stopped until flow and sensor quality are valid.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      updatedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    },
    {
      id: "88888888-8888-4888-8888-888888888802",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      name: "Overpressure cutoff",
      priority: "safety",
      triggerType: "threshold",
      conditions: [{ point: "water.pressure.bar", operator: "gte", value: 5.5 }],
      constraints: [],
      actions: [{ type: "command", targetCanonicalName: "water.pump.command", value: "OFF", message: "Stop pump because pressure exceeds safety limit." }],
      executionMode: "edge",
      explanationTemplate: "Overpressure cutoff is enforced locally and cannot be bypassed remotely.",
      rollbackBehavior: "Stop pump and require inspection before restart.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      updatedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    },
    {
      id: "88888888-8888-4888-8888-888888888803",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      name: "Irrigate when soil moisture is low",
      priority: "optimization",
      triggerType: "threshold",
      conditions: [{ stateKey: "agri.irrigation_required", operator: "eq", value: true }],
      constraints: [{ stateKey: "system.sensor_quality_bad", operator: "neq", value: true }],
      actions: [{ type: "command", targetCanonicalName: "agri.irrigation.command", value: "ON", message: "Start irrigation when soil moisture remains below threshold." }],
      executionMode: "simulation",
      explanationTemplate: "Irrigation starts only when sensor quality and safety constraints are satisfied.",
      rollbackBehavior: "Stop irrigation and return to previous schedule.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      updatedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    },
    {
      id: "88888888-8888-4888-8888-888888888804",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222202",
      name: "Refill tank when solar surplus exists",
      priority: "efficiency",
      triggerType: "multi_variable",
      conditions: [
        { stateKey: "water.tank.low", operator: "eq", value: true },
        { stateKey: "energy.surplus_available", operator: "eq", value: true }
      ],
      constraints: [{ stateKey: "system.sensor_quality_bad", operator: "neq", value: true }],
      actions: [{ type: "command", targetCanonicalName: "water.pump.command", value: "ON", message: "Refill water tank during solar surplus window." }],
      executionMode: "simulation",
      explanationTemplate: "Tank refill is aligned with available renewable energy.",
      rollbackBehavior: "Stop pump and return to minimum safe state.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      updatedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    },
    {
      id: "88888888-8888-4888-8888-888888888805",
      tenantId: DEMO_TENANT_ID,
      siteId: "22222222-2222-4222-8222-222222222201",
      name: "Advisory: reduce irrigation if rain forecast placeholder is true",
      priority: "advisory",
      triggerType: "forecast",
      conditions: [{ stateKey: "agri.irrigation_required", operator: "eq", value: true }],
      constraints: [],
      actions: [{ type: "recommendation", message: "Check rain forecast placeholder before irrigation." }],
      executionMode: "advisory",
      explanationTemplate: "Forecast integration is planned; the MVP only records the recommendation.",
      rollbackBehavior: "No actuation is dispatched.",
      enabled: true,
      approvalState: "approved",
      version: 1,
      createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      updatedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    }
  ];
}
