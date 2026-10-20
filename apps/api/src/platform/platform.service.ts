import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { forgetUser } from "../common/active-users";
import { generateTemporaryPassword } from "../common/generate-password";
import { computeSiteValue } from "../value/compute-value";
import { createEnergyLedger } from "../value/create-ledger";
import { EnergyLedger, INTEGRATED_POINTS } from "../value/energy-ledger";
import { demoHistory, demoProfiles, DEMO_FARM_SITE } from "../value/demo";
import { DEFAULT_TIME_ZONE, isValidTimeZone, periodKeys, PeriodKey, resolvePeriod } from "../value/periods";
import {
  AlertMessage,
  Asset,
  AutomationRule,
  CanonicalPointName,
  CurrencyCode,
  currencyCodes,
  CommandAckMessage,
  CommandMessage,
  DashboardWidgetPreference,
  DEMO_TENANT_ID,
  DerivedState,
  Device,
  DriverDeviceStatus,
  EdgeGateway,
  EdgeSyncMessage,
  EnergyFlowView,
  FleetBox,
  FleetBoxStatus,
  FleetRow,
  FlowReading,
  GREECON_DOMAIN,
  GatewayHeartbeat,
  ModbusConnection,
  Point,
  PointSource,
  QualityFlag,
  RuleAction,
  RuleCondition,
  RuleExecutionMode,
  RulePriorityLevel,
  Site,
  SiteProfile,
  SiteValue,
  StaffMember,
  StateKey,
  StatusLabel,
  TelemetryMessage,
  TelemetryReading,
  Tenant,
  User,
  UserRole,
  deriveEnergyFlow,
  alertPriority,
  describeAge,
  describeConnection,
  describeSource,
  gatewayContact,
  hasPermission,
  orderFleet,
  worseState,
  validateConnection,
  validatePointLimits,
  validatePointSource,
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
import { buildEdgeConfig } from "../setup/edge-config";
import type { Confirmation } from "../setup/setup-checklist";
import { historyBucketMinutes } from "./history";
import type { DigestFacts } from "../notifications/messages";
import type { AlertView } from "../notifications/notifications.service";
import type { AlertEvent } from "../notifications/plan";

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

/** What a box that has gone quiet means, in a sentence. Nothing when it is reporting. */
function boxSilenceWords(box: FleetBox, nowMs: number): string | undefined {
  const age = box.lastSeenUtc ? describeAge(Math.max(0, (nowMs - Date.parse(box.lastSeenUtc)) / 1000)) : undefined;
  switch (box.status) {
    case "offline":
      return `The box has not reported for ${age}: it is offline. Check its power and its network.`;
    case "late":
      return `The box last reported ${age} ago.`;
    case "never":
      return "The box has been installed but has never reported.";
    case "waiting":
      return "The box has not been installed yet.";
    case "none":
      return "No box has been added to this site.";
    default:
      return undefined;
  }
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
  /** Left out, one is made from the name. */
  domain?: string;
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

/** What a site pays and what it used before. A field left out is left as it is; null clears it. */
export interface UpdateSiteProfileInput {
  timezone?: string;
  currency?: CurrencyCode;
  importPricePerKwh?: number | null;
  exportPricePerKwh?: number | null;
  waterPricePerM3?: number | null;
  baselineMonthlyImportKwh?: number | null;
  baselineMonthlyWaterM3?: number | null;
  baselineNote?: string | null;
  zeroExport?: boolean;
}

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
  /** Where the box reaches the device on the site's network. Modbus devices only. */
  connection?: ModbusConnection;
}

export interface CreateGatewayInput {
  siteId: string;
  name: string;
}

/** `connection: null` takes the address away again. */
export type UpdateDeviceInput = Partial<Omit<CreateDeviceInput, "siteId" | "connection">> & { health?: Device["health"]; connection?: ModbusConnection | null };

export interface CreatePointInput {
  siteId: string;
  assetId?: string;
  deviceId: string;
  canonicalName: Point["canonicalName"];
  label: string;
  unit: string;
  capability: Point["capability"];
  thresholdConfig?: Record<string, number>;
  /** Which register the box reads this from. Readings of Modbus devices only. */
  source?: PointSource;
}

/** `source: null` takes the register mapping away again. */
export type UpdatePointInput = Partial<Omit<CreatePointInput, "siteId" | "deviceId" | "canonicalName" | "source">> & { quality?: Point["quality"]; source?: PointSource | null };

/** What was said and confirmed by hand while setting a site up (docs/27-setup-guide.md): the template
 * it was made from, and the steps a person checked, with who and when. */
export interface SiteSetupRecord {
  siteId: string;
  tenantId: string;
  templateKey?: string;
  confirmations: Record<string, Confirmation>;
}

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

export interface EdgeSyncInput {
  siteId: string;
  gatewayId: string;
  status: EdgeSyncMessage["status"];
  bufferedReadings: number;
  startedAtUtc: string;
  completedAtUtc?: string;
}

/** What a call to ingest may be told to do beyond the readings themselves. */
export interface IngestOptions {
  /** False keeps the readings out of history (the demo feed saves its own, sparser, history). */
  persistRaw?: boolean;
  /** Keep at most one reading a point this often in history. Unset keeps every reading. */
  rawHistoryEveryMs?: number;
}

export interface IngestBatchResult {
  accepted: boolean;
  ingested: number;
  errors: string[];
}

/** A box reads every ten seconds; history keeps a reading a minute. */
export const RAW_HISTORY_EVERY_MS = 60_000;

// What a person's actions may add to the platform's memory, per account. The limits on each piece of text
// bound how large one entry can be; these bound how many, so a loop that creates entries cannot grow the
// process until it falls over, taking every customer's alerting with it. The database keeps everything: only
// what the process holds is bounded, and downloads read the database.
export const MAX_MAINTENANCE_TASKS_PER_ACCOUNT = 5_000;
const MAX_COMMANDS_IN_MEMORY_PER_ACCOUNT = 500;
const MAX_AUDIT_EVENTS_IN_MEMORY_PER_ACCOUNT = 1_000;
const MAX_EDGE_SYNC_BATCHES_IN_MEMORY = 200;

/** A newest-first list with only the newest `max` entries of one account's kept; other accounts' are untouched. */
function keepNewestOf<T extends { tenantId: string }>(list: T[], tenantId: string, max: number): T[] {
  let seen = 0;
  return list.length <= max ? list : list.filter((entry) => entry.tenantId !== tenantId || ++seen <= max);
}

// How often every site's states are re-derived against the clock, so a gateway that has gone quiet is
// noticed within about a minute even though nothing is arriving to trigger a refresh.
const HEALTH_MONITOR_INTERVAL_MS = 60_000;

@Injectable()
export class PlatformService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PlatformService.name);
  private healthMonitor?: ReturnType<typeof setInterval>;
  private ledgerTimer?: ReturnType<typeof setInterval>;
  private siteProfiles: SiteProfile[] = [];
  private siteSetup: SiteSetupRecord[] = [];
  /** The people who work for Greecon and may open a customer's account. They sit in Greecon's own account. */
  private staffIds = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: EnergyLedger = createEnergyLedger(db)
  ) {}

  // Starts after hydration (onModuleInit) so the first pass sees real data. Derived states are not
  // stored, so without this a restart would leave every site with no states until its next reading.
  async onApplicationBootstrap(): Promise<void> {
    await this.refreshAllDerivedStates();
    this.startHealthMonitor();
    this.startLedgerFlush();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.saveBeforeStopping();
  }

  private stoppedAndSaved = false;

  /** Stops the background work and saves what has been counted since the last save, so a deploy loses nothing.
   * main.ts calls it as soon as the process is asked to stop, while the database is still open (Nest closes the
   * database before it runs onApplicationShutdown); asked twice, it does it once. */
  async saveBeforeStopping(): Promise<void> {
    if (this.stoppedAndSaved) return;
    this.stoppedAndSaved = true;
    this.stopHealthMonitor();
    this.stopLedgerFlush();
    let saved = true;
    await this.ledger.flush().catch((error: unknown) => {
      saved = false;
      this.logger.warn(`Could not save energy totals at shutdown: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (saved) this.logger.log("Saved the energy and water counted since the last save.");
  }

  // Counted energy and water are saved in small batches. A failed save keeps the counts and tries
  // again, so a database that is briefly away costs nothing.
  startLedgerFlush(intervalMs: number = 30_000): void {
    if (this.ledgerTimer) return;
    this.ledgerTimer = setInterval(() => {
      void this.ledger.flush().catch((error: unknown) => {
        this.logger.warn(`Could not save energy totals: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, intervalMs);
    this.ledgerTimer.unref?.();
  }

  stopLedgerFlush(): void {
    if (!this.ledgerTimer) return;
    clearInterval(this.ledgerTimer);
    this.ledgerTimer = undefined;
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
    if (!this.db.isConfigured()) {
      await this.seedDemoValue();
      return;
    }

    const tenantRows = await this.db.query<TenantRow>("SELECT * FROM tenants ORDER BY created_at ASC");
    if (tenantRows.rows.length > 0) this.tenants = tenantRows.rows.map((row) => mapTenantRow(row));

    const userRows = await this.db.query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.status, m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id
       ORDER BY u.created_at ASC`
    );
    if (userRows.rows.length > 0) this.users = userRows.rows.map((row) => mapUserRow(row));
    this.staffIds = new Set((await this.db.query<{ id: string }>("SELECT id FROM users WHERE is_platform_admin = true")).rows.map((row) => row.id));

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

    const profileRows = await this.db.query<SiteProfileRow>("SELECT * FROM site_profiles");
    this.siteProfiles = profileRows.rows.map((row) => mapSiteProfileRow(row));

    // secret_hash is deliberately excluded from this SELECT — it never needs to exist in memory
    // beyond the moment it's written at creation, and PrincipalGuard queries it directly from
    // Postgres per request rather than through this in-memory list.
    const gatewayRows = await this.db.query<EdgeGatewayRow>(
      `SELECT id, tenant_id, site_id, name, status, last_seen_utc, software_version, secure_identity_status,
              enrolled_at, config_version, buffer_depth, oldest_buffered_age_seconds, clock_skew_seconds, driver_status
       FROM edge_gateways ORDER BY created_at ASC`
    );
    if (gatewayRows.rows.length > 0) this.gateways = gatewayRows.rows.map((row) => mapGatewayRow(row));

    const setupRows = await this.db.query<SiteSetupRow>("SELECT site_id, tenant_id, template_key, confirmations FROM site_setup");
    this.siteSetup = setupRows.rows.map((row) => mapSiteSetupRow(row));

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

    const auditRows = await this.db.query<AuditRow>(
      `SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS position FROM audit_events) newest
       WHERE position <= ${MAX_AUDIT_EVENTS_IN_MEMORY_PER_ACCOUNT} ORDER BY created_at DESC`
    );
    if (auditRows.rows.length > 0) this.auditEvents = auditRows.rows.map((row) => mapAuditRow(row));

    const edgeSyncRows = await this.db.query<EdgeSyncRow>("SELECT * FROM edge_sync_batches ORDER BY created_at DESC LIMIT 200");
    if (edgeSyncRows.rows.length > 0) this.edgeSyncBatches = edgeSyncRows.rows.map((row) => mapEdgeSyncRow(row));


    const maintenanceRows = await this.db.query<MaintenanceTaskRow>("SELECT * FROM maintenance_tasks ORDER BY created_at ASC");
    if (maintenanceRows.rows.length > 0) this.maintenanceTasks = maintenanceRows.rows.map((row) => mapMaintenanceTaskRow(row));

    await this.seedDemoValue();
  }

  /** The demo tenant starts with a month of history and prices of its own, written once, so a first
   * look at the Value screens shows what they are for. All of it is simulated and labelled so. */
  private async seedDemoValue(): Promise<void> {
    if (!this.sites.some((site) => site.id === DEMO_FARM_SITE && site.tenantId === DEMO_TENANT_ID)) return;
    if (await this.ledger.hasTotals(DEMO_FARM_SITE)) return;

    const nowMs = Date.now();
    const history = demoHistory(nowMs);
    await this.ledger.seed(history);
    for (const profile of demoProfiles(history, nowMs)) {
      if (this.siteProfiles.some((existing) => existing.siteId === profile.siteId)) continue;
      if (this.db.isConfigured()) {
        await this.db.query(
          `INSERT INTO site_profiles (site_id, tenant_id, timezone, currency, import_price_per_kwh, export_price_per_kwh, water_price_per_m3, baseline_monthly_import_kwh, baseline_monthly_water_m3, baseline_note, zero_export, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (site_id) DO NOTHING`,
          [
            profile.siteId,
            profile.tenantId,
            profile.timezone,
            profile.currency,
            profile.importPricePerKwh ?? null,
            profile.exportPricePerKwh ?? null,
            profile.waterPricePerM3 ?? null,
            profile.baselineMonthlyImportKwh ?? null,
            profile.baselineMonthlyWaterM3 ?? null,
            profile.baselineNote ?? null,
            profile.zeroExport,
            profile.updatedAtUtc
          ]
        );
      }
      this.siteProfiles.push(profile);
    }
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

    const requestedDomain = input.domain?.trim().toLowerCase();
    if (requestedDomain && this.tenants.some((existing) => existing.domain.toLowerCase() === requestedDomain)) {
      throw new ConflictException("A client with this domain already exists.");
    }
    this.assertEmailIsFree(input.ownerEmail);
    const domain = requestedDomain || this.clientDomainFor(input.name);

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
        `INSERT INTO users (id, tenant_id, email, name, status, password_hash, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,true)`,
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

  // A client's domain is only an identifier that must be unique. When nobody supplies one it is made
  // from the company name, so the project manager does not have to invent it.
  private clientDomainFor(name: string): string {
    const slug =
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "client";
    let candidate = `${slug}.clients.greecon.earth`;
    for (let suffix = 2; this.tenants.some((existing) => existing.domain.toLowerCase() === candidate); suffix += 1) candidate = `${slug}-${suffix}.clients.greecon.earth`;
    return candidate;
  }

  listUsers(principal: Principal): User[] {
    return this.scope(this.users, principal.tenantId);
  }

  /** Greecon staff open a customer's account to set it up. The customer's own audit trail says so, with
   * the staff member's address, before anything is done in it. The session this leads to can configure
   * sites and equipment as an administrator can, and cannot change who may sign in (see assertNotSupport). */
  async beginSupportSession(tenantId: string, principal: Principal): Promise<{ tenant: Tenant; staffName: string }> {
    if (!principal.isPlatformAdmin || principal.support) {
      throw new ForbiddenException("This action requires Greecon platform-administrator access.");
    }
    const tenant = this.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant) throw new NotFoundException("Client not found.");
    if (tenant.status !== "active") throw new ConflictException("This client's account is not active, so it cannot be opened for setup.");

    const staff = this.users.find((user) => user.id === principal.userId);
    await this.recordAudit({
      tenantId: tenant.id,
      userId: principal.userId,
      eventType: "support.session_started",
      entityType: "support_session",
      reason: `Greecon staff (${principal.email}) opened this account to set it up.`
    });
    return { tenant, staffName: staff?.name ?? principal.email };
  }

  // ---- Greecon's own team ------------------------------------------------------------------------------
  // A project manager needs a login of their own to open customers' accounts: the founder's cannot be
  // shared, and a person must show under their own name in a customer's trail. Anyone on the team can see
  // who is on it; only the owner of Greecon's account adds or removes people, so a team member cannot
  // make more team members.

  private assertTeamMember(principal: Principal): void {
    if (!principal.isPlatformAdmin || principal.support) {
      throw new ForbiddenException("This action requires Greecon platform-administrator access.");
    }
  }

  private assertTeamOwner(principal: Principal): void {
    this.assertTeamMember(principal);
    if (!hasPermission(principal.role, "tenant:manage")) {
      throw new ForbiddenException("Only the owner of Greecon's own account can add people to the team, remove them or reset their passwords.");
    }
  }

  private requireStaff(userId: string): User {
    const user = this.users.find((candidate) => candidate.id === userId && this.staffIds.has(candidate.id));
    if (!user) throw new NotFoundException("There is no such person on the Greecon team.");
    return user;
  }

  /** One account to an email address: signing in looks the account up by it. Said once for every way an account is made. */
  private assertEmailIsFree(email: string): void {
    const wanted = email.trim().toLowerCase();
    if (this.users.some((existing) => existing.email.toLowerCase() === wanted)) {
      throw new ConflictException("Someone already has an account with this email address. Each person signs in with one address, so use another address, or add this person's sites to the client they already belong to.");
    }
  }

  listStaff(principal: Principal): StaffMember[] {
    this.assertTeamMember(principal);
    return this.users
      .filter((user) => this.staffIds.has(user.id))
      .map((user) => ({ id: user.id, name: user.name, email: user.email, status: user.status, isYou: user.id === principal.userId }));
  }

  async addStaffMember(input: { name: string; email: string }, principal: Principal): Promise<{ member: StaffMember; temporaryPassword: string }> {
    this.assertTeamOwner(principal);
    if (!this.db.isConfigured()) throw new ConflictException("Team members need a database: this deployment has none.");
    const email = input.email.trim().toLowerCase();
    this.assertEmailIsFree(email);

    // Shown once, never stored: the person is given it directly and must choose their own at first sign-in.
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user: User = { id: randomUUID(), tenantId: principal.tenantId, email, name: input.name.trim(), role: "admin", status: "active" };

    await this.db.query(
      `INSERT INTO users (id, tenant_id, email, name, status, password_hash, must_change_password, is_platform_admin) VALUES ($1,$2,$3,$4,$5,$6,true,true)`,
      [user.id, user.tenantId, user.email, user.name, user.status, passwordHash]
    );
    await this.db.query(`INSERT INTO memberships (id, tenant_id, user_id, role) VALUES ($1,$2,$3,$4)`, [randomUUID(), user.tenantId, user.id, user.role]);
    this.users.push(user);
    this.staffIds.add(user.id);

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "staff.added",
      entityType: "user",
      entityId: user.id,
      afterMetadata: { email: user.email },
      reason: `${user.name} (${user.email}) added to the Greecon team by ${principal.email}.`
    });
    return { member: { id: user.id, name: user.name, email: user.email, status: user.status, isYou: false }, temporaryPassword };
  }

  async setStaffStatus(userId: string, status: User["status"], principal: Principal): Promise<StaffMember> {
    this.assertTeamOwner(principal);
    const user = this.requireStaff(userId);
    if (user.id === principal.userId) throw new ForbiddenException("You cannot turn off your own access.");

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE users SET status = $1, sessions_valid_after = $3, updated_at = now() WHERE id = $2`, [status, user.id, new Date()]);
    }
    user.status = status;
    forgetUser(user.id);

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "staff.updated",
      entityType: "user",
      entityId: user.id,
      afterMetadata: { status },
      reason: `${user.email} ${status === "disabled" ? "turned off" : "turned back on"} on the Greecon team by ${principal.email}.`
    });
    return { id: user.id, name: user.name, email: user.email, status: user.status, isYou: false };
  }

  async resetStaffPassword(userId: string, principal: Principal): Promise<{ member: StaffMember; temporaryPassword: string }> {
    this.assertTeamOwner(principal);
    const user = this.requireStaff(userId);
    if (user.id === principal.userId) throw new ForbiddenException("Choose your own new password in Settings.");

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE users SET password_hash = $1, must_change_password = true, sessions_valid_after = $3, updated_at = now() WHERE id = $2`, [passwordHash, user.id, new Date()]);
    }
    forgetUser(user.id);

    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "staff.password_reset",
      entityType: "user",
      entityId: user.id,
      reason: `Password reset for ${user.email} on the Greecon team by ${principal.email}.`
    });
    return { member: { id: user.id, name: user.name, email: user.email, status: user.status, isYou: false }, temporaryPassword };
  }

  // ---- A customer's person who is locked out -------------------------------------------------------------------
  // Staff inside a customer's account cannot touch who may sign in (that is the customer's), and there is no
  // self-service reset: it would need an email round trip that an owner who cannot sign in is the least able to
  // use. So when an owner calls in, locked out, the owner of Greecon's account resets their password from the Clients
  // console, after confirming by phone who is asking. It is a stronger power than a support session, so it is the
  // team owner's alone, and it is written in the customer's own audit trail under the staff member's name.

  listClientPeople(tenantId: string, principal: Principal): User[] {
    this.assertTeamMember(principal);
    if (!this.tenants.some((tenant) => tenant.id === tenantId)) throw new NotFoundException("Client not found.");
    return this.users.filter((user) => user.tenantId === tenantId && !this.staffIds.has(user.id));
  }

  async resetClientPersonPassword(tenantId: string, userId: string, principal: Principal): Promise<{ user: User; temporaryPassword: string }> {
    this.assertTeamOwner(principal);
    const tenant = this.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant) throw new NotFoundException("Client not found.");
    const user = this.users.find((candidate) => candidate.id === userId && candidate.tenantId === tenantId && !this.staffIds.has(candidate.id));
    if (!user) throw new NotFoundException("That person is not in this client's account.");

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE users SET password_hash = $1, must_change_password = true, sessions_valid_after = $4, updated_at = now() WHERE id = $2 AND tenant_id = $3`, [passwordHash, user.id, tenantId, new Date()]);
    }
    forgetUser(user.id);

    // In the customer's own trail, where their owner can see that Greecon did it and who at Greecon.
    await this.recordAudit({
      tenantId,
      userId: principal.userId,
      eventType: "user.password_reset",
      entityType: "user",
      entityId: user.id,
      reason: `Password reset for "${user.email}" by Greecon staff (${principal.email}), at the customer's request.`
    });
    return { user, temporaryPassword };
  }

  // ---- Every customer's sites at once -------------------------------------------------------------------------

  /** Where every customer's sites stand, worst first: for Greecon's team to look at each morning and whenever a
   * customer calls. The demo account is simulated and Greecon's own has no sites, so neither is in it. */
  fleet(principal: Principal, nowMs: number = Date.now()): FleetRow[] {
    this.assertTeamMember(principal);
    return this.fleetRows(nowMs);
  }

  private fleetRows(nowMs: number): FleetRow[] {
    const rows: FleetRow[] = [];
    for (const tenant of this.tenants) {
      if (tenant.id === DEMO_TENANT_ID || tenant.domain === GREECON_DOMAIN || tenant.status !== "active") continue;
      for (const stored of this.sites.filter((site) => site.tenantId === tenant.id)) {
        const site = this.assessSite(stored, nowMs);
        const box = this.fleetBoxOf(tenant.id, stored.id, nowMs);
        const commissioned = this.siteSetup.find((record) => record.tenantId === tenant.id && record.siteId === stored.id)?.confirmations.commissioned;
        const alerts = this.alerts.filter((alert) => alert.tenantId === tenant.id && alert.siteId === stored.id && alert.status !== "resolved");

        const reasons = site.health.reasons.map((reason) => reason.message);
        let state = site.health.state;
        // A box that has stopped reporting is a problem on a site that is working. On one still being set up it is
        // only what setting up looks like, so it never makes the morning list longer.
        if (commissioned) {
          const silence = boxSilenceWords(box, nowMs);
          if (silence) {
            reasons.unshift(silence);
            state = worseState(state, "attention");
          }
          if (box.devicesNotAnswering > 0) {
            reasons.push(`${box.devicesNotAnswering === 1 ? "A device does" : `${box.devicesNotAnswering} devices do`} not answer the box.`);
            state = worseState(state, "attention");
          }
        }

        rows.push({
          clientId: tenant.id,
          client: tenant.name,
          siteId: stored.id,
          site: stored.name,
          state,
          reasons,
          ...(site.lastReadingAtUtc ? { lastReadingAtUtc: site.lastReadingAtUtc } : {}),
          box,
          ...(commissioned ? { commissionedAtUtc: commissioned.atUtc } : {}),
          openAlerts: {
            actNow: alerts.filter((alert) => alertPriority(alert.severity) === "act_now").length,
            checkToday: alerts.filter((alert) => alertPriority(alert.severity) === "check_today").length
          }
        });
      }
    }
    return orderFleet(rows);
  }

  /** The worst of a site's boxes: offline before never-reported before late before waiting before online. */
  private fleetBoxOf(tenantId: string, siteId: string, nowMs: number): FleetBox {
    const order: FleetBoxStatus[] = ["offline", "never", "late", "waiting", "online", "none"];
    const gateways = this.gateways.filter((gateway) => gateway.tenantId === tenantId && gateway.siteId === siteId).map((gateway) => this.assessGateway(gateway, nowMs));
    if (gateways.length === 0) return { status: "none", devicesNotAnswering: 0 };

    const statusOf = (gateway: EdgeGateway): FleetBoxStatus => (gateway.enrolledAtUtc === undefined && gateway.secureIdentityStatus !== "provisioned" ? "waiting" : (gateway.contact ?? "never"));
    const worst = [...gateways].sort((a, b) => order.indexOf(statusOf(a)) - order.indexOf(statusOf(b)))[0] as EdgeGateway;
    return {
      status: statusOf(worst),
      name: worst.name,
      ...(worst.lastSeenUtc ? { lastSeenUtc: worst.lastSeenUtc } : {}),
      ...(worst.softwareVersion ? { version: worst.softwareVersion } : {}),
      ...(worst.clockSkewSeconds !== undefined ? { clockSkewSeconds: worst.clockSkewSeconds } : {}),
      ...(worst.bufferDepth !== undefined ? { bufferDepth: worst.bufferDepth } : {}),
      devicesNotAnswering: gateways.reduce((count, gateway) => count + (gateway.drivers ?? []).filter((driver) => !driver.ok).length, 0)
    };
  }

  /** The morning message for Greecon's own account: the sites that are live, and a line about those still being set up. */
  private fleetDigest(nowMs: number): DigestFacts {
    const rows = this.fleetRows(nowMs);
    const live = rows.filter((row) => row.commissionedAtUtc);
    const settingUp = rows.filter((row) => !row.commissionedAtUtc);
    const sinceDays = (row: FleetRow) => Math.max(0, Math.floor((nowMs - Date.parse(row.commissionedAtUtc as string)) / 86_400_000));
    return {
      customer: "Greecon",
      sites: live.map((row) => ({
        name: `${row.client}: ${row.site} (day ${sinceDays(row) + 1})`,
        state: row.state,
        reasons: row.reasons,
        ...(row.lastReadingAtUtc ? { lastReadingAtUtc: row.lastReadingAtUtc } : {})
      })),
      ...(settingUp.length > 0 ? { notes: [`Being set up: ${settingUp.map((row) => `${row.client}: ${row.site}`).join("; ")}.`] } : {})
    };
  }

  /** A person from Greecon in a customer's account to set it up may configure what is measured, not who
   * can sign in: that is the customer's. */
  private assertNotSupport(principal: Principal): void {
    if (principal.support) {
      throw new ForbiddenException("Greecon staff setting up an account cannot add people to it, change their roles or reset their passwords. The account's owner does that.");
    }
  }

  /** Who may add, change or reset a person through the ordinary people routes. These serve a customer's
   * account. On Greecon's own they would let any team member (an admin there, with user:manage) reset the
   * owner's password and sign in as the owner, so the team is managed only through the team routes above,
   * which are the owner's alone. */
  private assertMayManagePeople(principal: Principal): void {
    this.assertNotSupport(principal);
    if (!hasPermission(principal.role, "user:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    if (this.isOperatorTenant(principal.tenantId)) {
      throw new ForbiddenException("The people on Greecon's own account are the Greecon team. The owner adds them, turns them off and resets their passwords under Greecon team on the Clients page.");
    }
  }

  /** In any account only an owner changes an owner or makes one: an admin who could reset the owner's
   * password could sign in as the owner. */
  private assertOwnerRule(principal: Principal, ...roles: Array<UserRole | undefined>): void {
    if (roles.includes("owner") && principal.role !== "owner") {
      throw new ForbiddenException("Only an owner can add an owner, change one, or reset an owner's password.");
    }
  }

  async createUser(input: CreateUserInput, principal: Principal): Promise<{ user: User; temporaryPassword: string }> {
    this.assertMayManagePeople(principal);
    this.assertOwnerRule(principal, input.role);

    const email = input.email.trim().toLowerCase();
    this.assertEmailIsFree(email);

    // The temporary password is returned once, here, and never stored or logged anywhere else.
    // Whoever creates the account passes it to the new user out of band, and the new user must
    // choose their own before doing anything else (users.must_change_password).
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
        `INSERT INTO users (id, tenant_id, email, name, status, password_hash, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,true)`,
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
    this.assertMayManagePeople(principal);
    const user = this.requireUser(userId, principal.tenantId);
    this.assertOwnerRule(principal, user.role);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE users SET password_hash = $1, must_change_password = true, sessions_valid_after = $3, updated_at = now() WHERE id = $2`, [passwordHash, user.id, new Date()]);
    }
    // Whoever had the old password must not stay signed in on the strength of it.
    forgetUser(user.id);

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
    this.assertMayManagePeople(principal);
    const user = this.requireUser(userId, principal.tenantId);
    this.assertOwnerRule(principal, user.role, input.role);
    if (user.id === principal.userId && input.status === "disabled") {
      throw new ForbiddenException("You cannot disable your own account.");
    }
    if (user.id === principal.userId && input.role && input.role !== user.role) {
      throw new ForbiddenException("You cannot change your own role.");
    }

    const nextRole = input.role ?? user.role;
    const nextStatus = input.status ?? user.status;

    if (this.db.isConfigured()) {
      if (nextRole !== user.role) {
        await this.db.query(`UPDATE memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3`, [nextRole, principal.tenantId, user.id]);
      }
      if (nextRole !== user.role || nextStatus !== user.status) {
        // A session carries the role it was opened with, so a changed role or a person turned off and back
        // on must not leave an earlier session standing: it ends on its next request and they sign in again.
        await this.db.query(`UPDATE users SET status = $1, sessions_valid_after = $4, updated_at = now() WHERE id = $2 AND tenant_id = $3`, [nextStatus, user.id, principal.tenantId, new Date()]);
      }
    }

    user.role = nextRole;
    user.status = nextStatus;
    forgetUser(user.id);

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
      gateways: this.gateways.filter((gateway) => gateway.tenantId === principal.tenantId && gateway.siteId === siteId).map((gateway) => this.assessGateway(gateway, nowMs)),
      latestTelemetry: this.latestTelemetry(principal, siteId, nowMs),
      energyFlow: this.energyFlowOf(principal.tenantId, siteId, nowMs),
      derivedStates: this.listDerivedStates(principal, siteId),
      alerts: this.listAlerts(principal, siteId),
      rules: this.listRules(principal, siteId),
      // The audit trail is for those who may read it, not for everyone who may look at a site.
      audit: hasPermission(principal.role, "audit:read") ? this.listAudit(principal, siteId) : []
    };
  }

  /** What this site pays and what it used before. A site that has never been given any is reported
   * with its defaults (its own clock, euros, no prices), which is exactly the truth: nothing is set. */
  siteProfile(siteId: string, principal: Principal): SiteProfile {
    const site = this.requireSite(siteId, principal.tenantId);
    return (
      this.siteProfiles.find((profile) => profile.siteId === site.id) ?? {
        siteId: site.id,
        tenantId: site.tenantId,
        timezone: DEFAULT_TIME_ZONE,
        currency: "EUR",
        zeroExport: false
      }
    );
  }

  async updateSiteProfile(siteId: string, input: UpdateSiteProfileInput, principal: Principal): Promise<SiteProfile> {
    if (!hasPermission(principal.role, "site:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    const site = this.requireSite(siteId, principal.tenantId);
    this.assertValidProfile(input);

    const before = this.siteProfile(site.id, principal);
    const next: SiteProfile = { ...before };
    const assign = <K extends keyof SiteProfile>(key: K, value: SiteProfile[K] | null | undefined): void => {
      if (value === undefined) return;
      if (value === null) delete next[key];
      else next[key] = value;
    };
    assign("timezone", input.timezone);
    assign("currency", input.currency);
    assign("importPricePerKwh", input.importPricePerKwh);
    assign("exportPricePerKwh", input.exportPricePerKwh);
    assign("waterPricePerM3", input.waterPricePerM3);
    assign("baselineMonthlyImportKwh", input.baselineMonthlyImportKwh);
    assign("baselineMonthlyWaterM3", input.baselineMonthlyWaterM3);
    assign("baselineNote", input.baselineNote === null ? null : input.baselineNote?.trim() || undefined);
    if (input.zeroExport !== undefined) next.zeroExport = input.zeroExport;
    next.updatedByUserId = principal.userId;
    next.updatedAtUtc = nowIso();

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO site_profiles (site_id, tenant_id, timezone, currency, import_price_per_kwh, export_price_per_kwh, water_price_per_m3, baseline_monthly_import_kwh, baseline_monthly_water_m3, baseline_note, zero_export, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (site_id) DO UPDATE SET
           timezone=EXCLUDED.timezone, currency=EXCLUDED.currency, import_price_per_kwh=EXCLUDED.import_price_per_kwh,
           export_price_per_kwh=EXCLUDED.export_price_per_kwh, water_price_per_m3=EXCLUDED.water_price_per_m3,
           baseline_monthly_import_kwh=EXCLUDED.baseline_monthly_import_kwh, baseline_monthly_water_m3=EXCLUDED.baseline_monthly_water_m3,
           baseline_note=EXCLUDED.baseline_note, zero_export=EXCLUDED.zero_export, updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at`,
        [
          next.siteId,
          next.tenantId,
          next.timezone,
          next.currency,
          next.importPricePerKwh ?? null,
          next.exportPricePerKwh ?? null,
          next.waterPricePerM3 ?? null,
          next.baselineMonthlyImportKwh ?? null,
          next.baselineMonthlyWaterM3 ?? null,
          next.baselineNote ?? null,
          next.zeroExport,
          principal.userId,
          next.updatedAtUtc
        ]
      );
    }

    this.siteProfiles = [...this.siteProfiles.filter((profile) => profile.siteId !== next.siteId), next];
    const summary = (profile: SiteProfile) => ({
      currency: profile.currency,
      timezone: profile.timezone,
      importPricePerKwh: profile.importPricePerKwh ?? null,
      exportPricePerKwh: profile.exportPricePerKwh ?? null,
      waterPricePerM3: profile.waterPricePerM3 ?? null,
      baselineMonthlyImportKwh: profile.baselineMonthlyImportKwh ?? null,
      baselineMonthlyWaterM3: profile.baselineMonthlyWaterM3 ?? null,
      zeroExport: profile.zeroExport
    });
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "site.profile_updated",
      siteId: site.id,
      entityType: "site_profile",
      entityId: site.id,
      beforeMetadata: summary(before),
      afterMetadata: summary(next),
      reason: `Prices and baseline for "${site.name}" updated.`
    });
    return next;
  }

  private assertValidProfile(input: UpdateSiteProfileInput): void {
    const problems: string[] = [];
    if (input.timezone !== undefined && !isValidTimeZone(input.timezone)) problems.push(`"${input.timezone}" is not a time zone this platform knows, for example Europe/Tirane.`);
    if (input.currency !== undefined && !currencyCodes.includes(input.currency)) problems.push(`Currency must be one of ${currencyCodes.join(", ")}.`);
    const within = (label: string, value: number | null | undefined, max: number): void => {
      if (value === undefined || value === null) return;
      if (!Number.isFinite(value) || value < 0 || value > max) problems.push(`${label} must be a number from 0 to ${max}.`);
    };
    within("The electricity price", input.importPricePerKwh, 1000);
    within("The export price", input.exportPricePerKwh, 1000);
    within("The water price", input.waterPricePerM3, 1000);
    within("The baseline for electricity", input.baselineMonthlyImportKwh, 100_000_000);
    within("The baseline for water", input.baselineMonthlyWaterM3, 100_000_000);
    if (typeof input.baselineNote === "string" && input.baselineNote.length > 500) problems.push("The note must be 500 characters or fewer.");
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
  }

  /** What the site's own readings are worth over a period, at the prices the site entered. */
  async siteValue(siteId: string, periodKey: PeriodKey, principal: Principal, nowMs: number = Date.now()): Promise<SiteValue> {
    const site = this.requireSite(siteId, principal.tenantId);
    if (!periodKeys.includes(periodKey)) throw new BadRequestException(`Period must be one of ${periodKeys.join(", ")}.`);
    const profile = this.siteProfiles.find((candidate) => candidate.siteId === site.id);
    const period = resolvePeriod(periodKey, nowMs, profile?.timezone);
    const totals = await this.ledger.totals(site.id, period.fromMs, period.toMs);
    const readings = this.latestReadings(this.telemetry.filter((item) => item.tenantId === site.tenantId && item.siteId === site.id));
    return computeSiteValue({ siteId: site.id, period, profile, totals, simulated: this.edgeStatusOf(readings, nowMs) === "Simulated" });
  }

  /** This month's value at each of the account's sites that measures any energy or water. */
  async valueSummary(principal: Principal, nowMs: number = Date.now()): Promise<Array<{ siteId: string; siteName: string; value: SiteValue }>> {
    const measuring = this.scope(this.sites, principal.tenantId).filter((site) =>
      this.points.some((point) => point.tenantId === principal.tenantId && point.siteId === site.id && INTEGRATED_POINTS[point.canonicalName] !== undefined)
    );
    const summary: Array<{ siteId: string; siteName: string; value: SiteValue }> = [];
    for (const site of measuring) summary.push({ siteId: site.id, siteName: site.name, value: await this.siteValue(site.id, "month", principal, nowMs) });
    return summary;
  }

  /** What was confirmed by hand while this site was being set up, and the template it was made from.
   * A site nobody has touched has an empty record, which is the truth. */
  siteSetupRecord(siteId: string, principal: Principal): SiteSetupRecord {
    const site = this.requireSite(siteId, principal.tenantId);
    const record = this.siteSetup.find((candidate) => candidate.siteId === site.id);
    return record ? { ...record, confirmations: { ...record.confirmations } } : { siteId: site.id, tenantId: site.tenantId, confirmations: {} };
  }

  /** Remembers which template a site was made from. Called by the setup service, which has checked
   * the caller may manage sites. */
  async recordSiteTemplate(siteId: string, templateKey: string, principal: Principal): Promise<void> {
    const record = this.siteSetupRecord(siteId, principal);
    await this.saveSiteSetup({ ...record, templateKey });
  }

  /** A person says they checked something the platform cannot see, or takes it back. Both are recorded
   * in the audit trail with who and when, because "someone checked the clamps" is only worth
   * something if it can be said who. */
  async setSetupConfirmation(siteId: string, key: string, confirmation: Confirmation | null, principal: Principal): Promise<SiteSetupRecord> {
    if (!hasPermission(principal.role, "site:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    const site = this.requireSite(siteId, principal.tenantId);
    const record = this.siteSetupRecord(siteId, principal);
    const confirmations = { ...record.confirmations };
    if (confirmation) confirmations[key] = confirmation;
    else delete confirmations[key];

    const saved = { ...record, confirmations };
    await this.saveSiteSetup(saved);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: confirmation ? "setup.step_confirmed" : "setup.step_reopened",
      siteId: site.id,
      entityType: "site_setup",
      entityId: site.id,
      afterMetadata: { step: key, ...(confirmation?.note ? { note: confirmation.note } : {}) },
      reason: confirmation ? `Setup step "${key}" confirmed for "${site.name}".` : `Setup step "${key}" reopened for "${site.name}".`
    });
    return saved;
  }

  private async saveSiteSetup(record: SiteSetupRecord): Promise<void> {
    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO site_setup (site_id, tenant_id, template_key, confirmations, updated_at) VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (site_id) DO UPDATE SET template_key=EXCLUDED.template_key, confirmations=EXCLUDED.confirmations, updated_at=now()`,
        [record.siteId, record.tenantId, record.templateKey ?? null, JSON.stringify(record.confirmations)]
      );
    }
    this.siteSetup = [...this.siteSetup.filter((candidate) => candidate.siteId !== record.siteId), record];
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

  /** Boxes with how recently each was heard from, worked out now from its last heartbeat. */
  listGateways(principal: Principal, siteId?: string, nowMs: number = Date.now()): EdgeGateway[] {
    return this.scope(this.gateways, principal.tenantId)
      .filter((gateway) => !siteId || gateway.siteId === siteId)
      .map((gateway) => this.assessGateway(gateway, nowMs));
  }

  /** The stored status of a box is not trusted: it says what the box was when it was set up. What is
   * shown follows from when it last reported. */
  private assessGateway(stored: EdgeGateway, nowMs: number): EdgeGateway {
    const contact = gatewayContact(stored.lastSeenUtc, nowMs);
    const status: EdgeGateway["status"] = contact === "online" ? "OK" : contact === "late" ? "Watch" : contact === "offline" ? "Offline" : "Unknown";
    return { ...stored, contact, status };
  }

  /** One box of this account, or undefined. For the setup and edge services, which are told the
   * gateway by its credential and must not be able to name another account's. */
  findGateway(gatewayId: string, tenantId: string, nowMs: number = Date.now()): EdgeGateway | undefined {
    const gateway = this.gateways.find((candidate) => candidate.id === gatewayId && candidate.tenantId === tenantId);
    return gateway ? this.assessGateway(gateway, nowMs) : undefined;
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
    const adopted = await this.adoptSiteDevices(gateway);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "gateway.created",
      siteId: gateway.siteId,
      entityType: "gateway",
      entityId: gateway.id,
      afterMetadata: { name: gateway.name, devicesAssigned: adopted },
      reason: `Gateway "${gateway.name}" created.`
    });

    return { gateway, secret };
  }

  /** A gateway with no credential yet. The box it is for gets one by presenting an enrolment code
   * (SetupService.enrol), so the credential is never typed, shown or copied by anyone. */
  async provisionGateway(input: CreateGatewayInput, principal: Principal): Promise<EdgeGateway> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }
    this.requireSite(input.siteId, principal.tenantId);

    const gateway: EdgeGateway = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      name: input.name,
      status: "Unknown",
      secureIdentityStatus: "placeholder"
    };

    if (this.db.isConfigured()) {
      await this.db.query(`INSERT INTO edge_gateways (id, tenant_id, site_id, name, status, secure_identity_status) VALUES ($1,$2,$3,$4,$5,$6)`, [
        gateway.id,
        gateway.tenantId,
        gateway.siteId,
        gateway.name,
        gateway.status,
        gateway.secureIdentityStatus
      ]);
    }

    this.gateways.push(gateway);
    const adopted = await this.adoptSiteDevices(gateway);
    await this.recordAudit({
      tenantId: principal.tenantId,
      userId: principal.userId,
      eventType: "gateway.created",
      siteId: gateway.siteId,
      entityType: "gateway",
      entityId: gateway.id,
      afterMetadata: { name: gateway.name, devicesAssigned: adopted },
      reason: `Gateway "${gateway.name}" added, waiting for its box.`
    });
    return gateway;
  }

  /** The devices of a site that nobody has assigned to a box go to its box, when the site has exactly
   * one: the usual case, and the one where asking would be asking the obvious. With two boxes it is
   * ambiguous and left to the person. Returns how many were assigned. */
  private async adoptSiteDevices(gateway: EdgeGateway): Promise<number> {
    const boxes = this.gateways.filter((candidate) => candidate.tenantId === gateway.tenantId && candidate.siteId === gateway.siteId);
    if (boxes.length !== 1) return 0;

    const unassigned = this.devices.filter((device) => device.tenantId === gateway.tenantId && device.siteId === gateway.siteId && !device.gatewayId && device.protocol === "modbus");
    for (const device of unassigned) {
      if (this.db.isConfigured()) {
        await this.db.query(`UPDATE devices SET gateway_id=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3`, [gateway.id, device.id, device.tenantId]);
      }
      device.gatewayId = gateway.id;
    }
    return unassigned.length;
  }

  /** Gives the box that presented a valid enrolment code its credential, once. A box installed again
   * (a replacement, a fresh disk) enrols the same way and the old credential stops working at that
   * moment; what the old box last said about itself is cleared, so the new one is judged on its own. */
  async completeGatewayEnrolment(gatewayId: string, tenantId: string, issuedBy: string | undefined, nowMs: number = Date.now()): Promise<{ gateway: EdgeGateway; secret: string }> {
    const gateway = this.requireGateway(gatewayId, tenantId);
    const secret = generateGatewaySecret();
    const enrolledAtUtc = new Date(nowMs).toISOString();

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE edge_gateways SET secret_hash=$1, secure_identity_status='provisioned', enrolled_at=$2, last_seen_utc=NULL, software_version=NULL,
           config_version=NULL, buffer_depth=NULL, oldest_buffered_age_seconds=NULL, clock_skew_seconds=NULL, driver_status=NULL, updated_at=now()
         WHERE id=$3 AND tenant_id=$4`,
        [hashGatewaySecret(secret), enrolledAtUtc, gateway.id, tenantId]
      );
    }

    gateway.secureIdentityStatus = "provisioned";
    gateway.enrolledAtUtc = enrolledAtUtc;
    for (const key of ["lastSeenUtc", "softwareVersion", "configVersion", "bufferDepth", "oldestBufferedAgeSeconds", "clockSkewSeconds", "drivers"] as const) delete gateway[key];

    await this.recordAudit({
      tenantId,
      // The box has no account. The person who made the code is the one answerable for it.
      userId: issuedBy ?? "system",
      eventType: "gateway.enrolled",
      siteId: gateway.siteId,
      entityType: "gateway",
      entityId: gateway.id,
      afterMetadata: { name: gateway.name },
      reason: `A box enrolled as gateway "${gateway.name}".`
    });
    return { gateway: this.assessGateway(gateway, nowMs), secret };
  }

  /** What a box says about itself, kept so that the people setting a site up and the people running
   * it can see whether it is alive, what it is running, how far behind it is and what its devices say. */
  async recordGatewayHeartbeat(gatewayId: string, tenantId: string, heartbeat: GatewayHeartbeat, nowMs: number = Date.now()): Promise<EdgeGateway> {
    const gateway = this.requireGateway(gatewayId, tenantId);
    // Only devices that belong to this box are kept: a box cannot write about anything else.
    const known = new Set(this.devices.filter((device) => device.tenantId === tenantId && device.gatewayId === gateway.id).map((device) => device.id));
    const drivers: DriverDeviceStatus[] = heartbeat.devices.filter((device) => known.has(device.deviceId));
    const skew = Math.round((Date.parse(heartbeat.sentAtUtc) - nowMs) / 1000);

    gateway.lastSeenUtc = new Date(nowMs).toISOString();
    gateway.softwareVersion = heartbeat.agentVersion;
    gateway.configVersion = heartbeat.configVersion;
    gateway.bufferDepth = Math.round(heartbeat.bufferDepth);
    gateway.oldestBufferedAgeSeconds = heartbeat.oldestBufferedAgeSeconds === undefined ? undefined : Math.round(heartbeat.oldestBufferedAgeSeconds);
    gateway.clockSkewSeconds = skew;
    gateway.drivers = drivers;

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE edge_gateways SET last_seen_utc=$1, software_version=$2, config_version=$3, buffer_depth=$4, oldest_buffered_age_seconds=$5,
           clock_skew_seconds=$6, driver_status=$7, updated_at=now()
         WHERE id=$8 AND tenant_id=$9`,
        [
          gateway.lastSeenUtc,
          gateway.softwareVersion,
          gateway.configVersion ?? null,
          gateway.bufferDepth,
          gateway.oldestBufferedAgeSeconds ?? null,
          gateway.clockSkewSeconds,
          JSON.stringify(drivers),
          gateway.id,
          tenantId
        ]
      );
    }
    return this.assessGateway(gateway, nowMs);
  }

  /** What one box is told to read. The version changes exactly when what it reads changes. */
  edgeConfigFor(gatewayId: string, tenantId: string, pollIntervalMs?: number) {
    const gateway = this.requireGateway(gatewayId, tenantId);
    return buildEdgeConfig(gateway, this.devices, this.points, pollIntervalMs);
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
    this.siteProfiles = this.siteProfiles.filter((profile) => profile.siteId !== site.id);
    // The database removes these with the site; the working copy has to as well, or they would linger
    // in the lists until the next restart.
    this.siteSetup = this.siteSetup.filter((record) => record.siteId !== site.id);
    this.assets = this.assets.filter((asset) => asset.siteId !== site.id);
    this.gateways = this.gateways.filter((gateway) => gateway.siteId !== site.id);

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
    if (input.connection !== undefined) this.assertValidConnection(input.connection, input.protocol);
    // A named box must be this account's, at this site. Left unnamed, a Modbus device goes to the
    // site's box when it has exactly one: that is the only box it could mean.
    if (input.gatewayId) this.assertGatewayAtSite(input.gatewayId, input.siteId, principal.tenantId);
    const siteBoxes = this.gateways.filter((gateway) => gateway.tenantId === principal.tenantId && gateway.siteId === input.siteId);
    const gatewayId = input.gatewayId ?? (input.protocol === "modbus" && siteBoxes.length === 1 ? siteBoxes[0]?.id : undefined);

    const device: Device = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      siteId: input.siteId,
      assetId: input.assetId,
      gatewayId,
      name: input.name,
      deviceType: input.deviceType,
      protocol: input.protocol,
      driverType: input.driverType,
      health: "OK",
      lastSeenUtc: nowIso(),
      secureIdentityStatus: "placeholder",
      positionX: input.positionX,
      positionY: input.positionY,
      placementNote: input.placementNote,
      ...(input.connection ? { connection: tidyConnection(input.connection) } : {})
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO devices (id, tenant_id, site_id, asset_id, gateway_id, name, device_type, protocol, driver_type, health, last_seen_utc, secure_identity_status, metadata, connection)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
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
          JSON.stringify(devicePlacementMetadata(device)),
          device.connection ? JSON.stringify(device.connection) : null
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
      afterMetadata: { name: device.name, deviceType: device.deviceType, protocol: device.protocol, ...(device.connection ? { address: describeConnection(device.connection) } : {}) },
      reason: `Device "${device.name}" created.`
    });

    return device;
  }

  /** What is wrong with a device's address is said in words: it is typed by a person at a site. */
  private assertValidConnection(connection: unknown, protocol: Device["protocol"]): void {
    if (protocol !== "modbus") throw new BadRequestException("Only a Modbus device has a network address.");
    // An address pasted from a message or a datasheet often has a space at one end; that is not a mistake worth refusing.
    const problems = validateConnection(trimmedHost(connection));
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
  }

  private assertGatewayAtSite(gatewayId: string, siteId: string, tenantId: string): void {
    const gateway = this.requireGateway(gatewayId, tenantId);
    if (gateway.siteId !== siteId) throw new BadRequestException("That box belongs to a different site.");
  }

  async updateDevice(deviceId: string, input: UpdateDeviceInput, principal: Principal): Promise<Device> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const device = this.requireDevice(deviceId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);
    if (input.gatewayId) this.assertGatewayAtSite(input.gatewayId, device.siteId, principal.tenantId);
    const { connection, ...rest } = input;
    const nextProtocol = rest.protocol ?? device.protocol;
    const nextConnection = connection === null ? undefined : connection ?? device.connection;
    if (connection) this.assertValidConnection(connection, nextProtocol);
    if (nextProtocol !== "modbus" && nextConnection) throw new BadRequestException("Only a Modbus device has a network address. Remove the address first.");

    const before = { ...device };
    const patch = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    Object.assign(device, patch);
    if (connection === null) delete device.connection;
    else if (connection) device.connection = tidyConnection(connection);
    const addressChanged = JSON.stringify(before.connection ?? null) !== JSON.stringify(device.connection ?? null);

    if (this.db.isConfigured()) {
      await this.db.query(
        `UPDATE devices SET asset_id=$1, gateway_id=$2, name=$3, device_type=$4, protocol=$5, driver_type=$6, health=$7, metadata=$8, connection=$9, updated_at=now()
         WHERE id=$10 AND tenant_id=$11`,
        [
          device.assetId ?? null,
          device.gatewayId ?? null,
          device.name,
          device.deviceType,
          device.protocol,
          device.driverType,
          device.health,
          JSON.stringify(devicePlacementMetadata(device)),
          device.connection ? JSON.stringify(device.connection) : null,
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
      // The address decides what the box reads, so a change of it is recorded as old and new.
      beforeMetadata: { name: before.name, health: before.health, ...(addressChanged ? { address: before.connection ? describeConnection(before.connection) : null } : {}) },
      afterMetadata: { name: device.name, health: device.health, ...(addressChanged ? { address: device.connection ? describeConnection(device.connection) : null } : {}) },
      reason: addressChanged ? `Address of device "${device.name}" changed.` : `Device "${device.name}" updated.`
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
    if (input.source !== undefined) this.assertValidSource(input.source, device, input.capability);

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
      thresholdConfig: input.thresholdConfig,
      ...(input.source ? { source: tidySource(input.source) } : {})
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO points (id, tenant_id, site_id, asset_id, device_id, canonical_name, label, unit, quality, capability, threshold_config, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
          JSON.stringify(point.thresholdConfig ?? {}),
          point.source ? JSON.stringify(point.source) : null
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
      afterMetadata: { canonicalName: point.canonicalName, capability: point.capability, ...(point.source ? { register: describeSource(point.source) } : {}) },
      reason: `Point "${point.label}" created on device ${device.name}.`
    });

    return point;
  }

  /** A register description is typed by a person from a datasheet, so what is wrong with it is said in words. */
  private assertValidSource(source: unknown, device: Device, capability: Point["capability"]): void {
    if (device.protocol !== "modbus") throw new BadRequestException("Only a reading of a Modbus device has a register.");
    if (capability === "write") throw new BadRequestException("A command is written to equipment, not read from a register.");
    const problems = validatePointSource(source);
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
  }

  async updatePoint(pointId: string, input: UpdatePointInput, principal: Principal): Promise<Point> {
    if (!hasPermission(principal.role, "device:manage")) {
      throw new ForbiddenException("Action blocked by access policy.");
    }

    const point = this.requirePoint(pointId, principal.tenantId);
    if (input.assetId) this.requireAsset(input.assetId, principal.tenantId);
    if (input.thresholdConfig !== undefined) this.assertValidLimits(point.canonicalName, input.thresholdConfig);
    const { source, ...rest } = input;
    const nextCapability = rest.capability ?? point.capability;
    const nextSource = source === null ? undefined : source ?? point.source;
    if (source) this.assertValidSource(source, this.requireDevice(point.deviceId, principal.tenantId), nextCapability);
    if (nextCapability === "write" && nextSource) throw new BadRequestException("A command is written to equipment, not read from a register. Remove the register first.");

    const before = { ...point };
    const patch = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    Object.assign(point, patch);
    if (source === null) delete point.source;
    else if (source) point.source = tidySource(source);
    const limitsChanged = JSON.stringify(before.thresholdConfig ?? {}) !== JSON.stringify(point.thresholdConfig ?? {});
    const registerChanged = JSON.stringify(before.source ?? null) !== JSON.stringify(point.source ?? null);

    if (this.db.isConfigured()) {
      await this.db.query(`UPDATE points SET label=$1, unit=$2, capability=$3, quality=$4, threshold_config=$5, source=$6, updated_at=now() WHERE id=$7 AND tenant_id=$8`, [
        point.label,
        point.unit,
        point.capability,
        point.quality,
        JSON.stringify(point.thresholdConfig ?? {}),
        point.source ? JSON.stringify(point.source) : null,
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
      beforeMetadata: {
        label: before.label,
        capability: before.capability,
        ...(limitsChanged ? { thresholdConfig: before.thresholdConfig ?? {} } : {}),
        ...(registerChanged ? { register: before.source ? describeSource(before.source) : null } : {})
      },
      afterMetadata: {
        label: point.label,
        capability: point.capability,
        ...(limitsChanged ? { thresholdConfig: point.thresholdConfig ?? {} } : {}),
        ...(registerChanged ? { register: point.source ? describeSource(point.source) : null } : {})
      },
      reason: limitsChanged ? `Limits for point "${point.label}" changed.` : registerChanged ? `Register for point "${point.label}" changed.` : `Point "${point.label}" updated.`
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

    const bucketMinutes = historyBucketMinutes(hours);
    if (bucketMinutes === 0) {
      const result = await this.db.query<TelemetryRow>(
        `SELECT * FROM telemetry_readings
         WHERE tenant_id = $1 AND timestamp_utc >= now() - ($2 || ' hours')::interval ${siteFilter}
         ORDER BY timestamp_utc ASC
         LIMIT 20000`,
        params
      );
      return result.rows.map((row) => mapTelemetryRow(row));
    }

    // A long window is averaged into buckets across all of it, newest included. A switch reads as on if it was on at
    // any time in the bucket, a text as its last value, and the quality as the worst in the bucket.
    const result = await this.db.query<TelemetryRow>(
      `SELECT date_bin(($${params.length + 1} || ' minutes')::interval, timestamp_utc, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS timestamp_utc,
              tenant_id, site_id, NULL::uuid AS asset_id, device_id, point_id, canonical_name,
              avg(value_numeric) AS value_numeric,
              (array_agg(value_text ORDER BY timestamp_utc DESC) FILTER (WHERE value_text IS NOT NULL))[1] AS value_text,
              bool_or(value_bool) AS value_bool,
              max(unit) AS unit,
              CASE max(CASE quality WHEN 'BAD' THEN 3 WHEN 'WARN' THEN 2 ELSE 1 END) WHEN 3 THEN 'BAD' WHEN 2 THEN 'WARN' ELSE 'OK' END AS quality,
              'aggregate' AS source,
              max(timestamp_utc) AS ingestion_timestamp_utc
       FROM telemetry_readings
       WHERE tenant_id = $1 AND timestamp_utc >= now() - ($2 || ' hours')::interval ${siteFilter}
       GROUP BY 1, tenant_id, site_id, device_id, point_id, canonical_name
       ORDER BY 1 ASC, point_id
       LIMIT 50000`,
      [...params, bucketMinutes]
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

  /** `persistRaw: false` keeps the readings out of the raw history table while still using them for
   * everything live: the latest values, the states, the alerts and the energy totals. Only the
   * simulated demo uses it, so a demo that updates every few seconds does not fill a database. */
  async ingestTelemetry(message: TelemetryMessage, principal: Principal, options: IngestOptions = {}) {
    const outcome = await this.applyTelemetry(message, principal, options);
    if (outcome.accepted) await this.afterTelemetry(principal.tenantId, [message.siteId]);
    return outcome;
  }

  /** Readings from a box, many messages at once. Each message is judged on its own: one that is wrong
   * is reported as refused and the rest are taken, so a single bad reading can never hold up a site's
   * data. States and alerts are brought up to date once per site afterwards, not once per message. */
  async ingestTelemetryBatch(messages: TelemetryMessage[], principal: Principal): Promise<IngestBatchResult[]> {
    const results: IngestBatchResult[] = [];
    const sites = new Set<string>();
    for (const message of messages) {
      try {
        const outcome = await this.applyTelemetry(message, principal, { rawHistoryEveryMs: RAW_HISTORY_EVERY_MS });
        if (outcome.accepted) {
          sites.add(message.siteId);
          results.push({ accepted: true, ingested: outcome.ingested, errors: [] });
        } else {
          results.push({ accepted: false, ingested: 0, errors: outcome.errors });
        }
      } catch (error) {
        // A refusal (unknown device, wrong account) is this message's own; anything else is the
        // platform's trouble and fails the request, so the box keeps what it sent and tries again.
        if (error instanceof HttpException && error.getStatus() < 500) {
          results.push({ accepted: false, ingested: 0, errors: [error.message] });
        } else {
          throw error;
        }
      }
    }
    await this.afterTelemetry(principal.tenantId, [...sites]);
    return results;
  }

  private async afterTelemetry(tenantId: string, siteIds: string[]): Promise<void> {
    for (const siteId of siteIds) {
      this.refreshDerivedStates(tenantId, siteId);
      await this.reconcileSiteAlerts(tenantId, siteId, Date.now());
    }
  }

  private async applyTelemetry(message: TelemetryMessage, principal: Principal, options: IngestOptions): Promise<{ accepted: true; ingested: number; errors: [] } | { accepted: false; errors: string[] }> {
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
      // Energy and water are counted from each power and flow reading as it arrives, whatever order
      // it comes in: the ledger decides what can be joined and what cannot.
      if (typeof item.value === "number" && INTEGRATED_POINTS[item.canonicalName]) {
        this.ledger.record({
          tenantId: item.tenantId,
          siteId: item.siteId,
          pointId: item.pointId,
          canonicalName: item.canonicalName,
          timestampMs: Date.parse(item.timestampUtc),
          value: item.value,
          quality: item.quality
        });
      }
    }

    if (this.db.isConfigured() && options.persistRaw !== false) {
      for (const item of normalized) {
        if (options.rawHistoryEveryMs !== undefined && !this.worthKeepingInHistory(item, options.rawHistoryEveryMs)) continue;
        await this.persistTelemetryReading(item);
      }
    }

    return {
      accepted: true,
      ingested: normalized.length,
      errors: []
    };
  }

  /** The last reading kept in history for each point, so a box that reads every ten seconds does not
   * write a row every ten seconds. The latest value and the energy totals use every reading; history is
   * for looking back, and one a minute is plenty for that. What is always kept: the first reading, a
   * reading that is not simply fine, a switch that changed, and anything a minute or more from the last. */
  private readonly lastInHistory = new Map<string, { ms: number; value: number | boolean | string }>();

  private worthKeepingInHistory(item: TelemetryReading, everyMs: number): boolean {
    const ms = Date.parse(item.timestampUtc);
    const previous = this.lastInHistory.get(item.pointId);
    const remember = () => {
      if (!previous || ms > previous.ms) this.lastInHistory.set(item.pointId, { ms, value: item.value });
    };

    if (!previous || !Number.isFinite(ms) || item.quality !== "OK" || (typeof item.value !== "number" && item.value !== previous.value) || Math.abs(ms - previous.ms) >= everyMs) {
      remember();
      return true;
    }
    return false;
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
    this.commands = keepNewestOf(this.commands, record.tenantId, MAX_COMMANDS_IN_MEMORY_PER_ACCOUNT);
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

  // ---- What the notifications service reads (system use: nothing here is reachable from a route) ----

  private alertListener: ((events: AlertEvent[]) => void) | undefined;

  /** Told when an alert opens, gets worse, comes back, is acknowledged or clears, so that people can be told. One
   * listener at a time; it must not wait or throw, and if it does the platform carries on regardless. */
  setAlertListener(listener: ((events: AlertEvent[]) => void) | undefined): void {
    this.alertListener = listener;
  }

  private announce(events: AlertEvent[]): void {
    if (events.length === 0 || !this.alertListener) return;
    try {
      this.alertListener(events);
    } catch (error) {
      this.logger.warn(`Could not pass on an alert change: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private siteNameOf(tenantId: string, siteId: string): string {
    return this.sites.find((site) => site.id === siteId && site.tenantId === tenantId)?.name ?? "a site";
  }

  alertById(tenantId: string, alertId: string): AlertView | undefined {
    const alert = this.alerts.find((candidate) => candidate.id === alertId && candidate.tenantId === tenantId);
    return alert ? { ...alert } : undefined;
  }

  openAlertsAcrossTenants(): Array<{ alert: AlertView; siteName: string }> {
    return this.alerts.filter((alert) => alert.status === "open").map((alert) => ({ alert: { ...alert }, siteName: this.siteNameOf(alert.tenantId, alert.siteId) }));
  }

  /** Someone took data out of the account as a file: the account's own audit trail says who and what. */
  async recordDataExport(principal: Principal, kind: "readings" | "alerts" | "audit" | "account", siteId: string | undefined, reason: string): Promise<void> {
    await this.recordAudit({ tenantId: principal.tenantId, userId: principal.userId, eventType: "export.downloaded", siteId, entityType: "data_export", afterMetadata: { kind }, reason });
  }

  /** Who is told, or when, was changed: the account's own audit trail says so, and by whom. */
  async recordNotificationSettingsChange(principal: Principal, eventType: string, reason: string): Promise<void> {
    await this.recordAudit({ tenantId: principal.tenantId, userId: principal.userId, eventType, entityType: "notification_settings", reason });
  }

  tenantNameOf(tenantId: string): string {
    return this.tenants.find((tenant) => tenant.id === tenantId)?.name ?? "";
  }

  /** The morning message's facts: each of the account's sites, how it is, and what is wrong. For Greecon's own
   * account that is every customer's sites: the morning check that tells the team of a silent box before
   * the customer has to (docs/launch/05-runbooks.md). */
  digestOf(tenantId: string, nowMs: number): DigestFacts {
    if (this.tenants.find((tenant) => tenant.id === tenantId)?.domain === GREECON_DOMAIN) return this.fleetDigest(nowMs);
    const sites = this.sites.filter((site) => site.tenantId === tenantId).map((site) => this.assessSite(site, nowMs));
    return {
      customer: this.tenantNameOf(tenantId),
      sites: sites.map((site) => ({ name: site.name, state: site.health.state, reasons: site.health.reasons.map((reason) => reason.message), lastReadingAtUtc: site.lastReadingAtUtc }))
    };
  }

  async acknowledgeAlert(alertId: string, principal: Principal): Promise<AlertRecord> {
    const alert = this.alerts.find((candidate) => candidate.id === alertId && candidate.tenantId === principal.tenantId);
    if (!alert) throw new NotFoundException("Alert not found.");
    const before = { status: alert.status };
    alert.status = "acknowledged";
    const acknowledgedAt = new Date();
    alert.acknowledgedAtUtc = acknowledgedAt.toISOString();

    if (this.db.isConfigured()) {
      // The time is the platform's own, not the database's now(): after a restart it is read back, and the messages that depend on
      // it (an alert that returns after an acknowledgement is told again) keep their time on the platform's clock.
      await this.db.query(`UPDATE alerts SET status=$1, acknowledged_at=$4 WHERE id=$2 AND tenant_id=$3`, [alert.status, alert.id, principal.tenantId, acknowledgedAt]);
    }

    const acknowledger = this.users.find((user) => user.id === principal.userId);
    this.announce([
      {
        type: "acknowledged",
        atMs: Date.parse(alert.acknowledgedAtUtc as string),
        alert: { ...alert },
        siteName: this.siteNameOf(alert.tenantId, alert.siteId),
        by: acknowledger?.name ?? principal.email,
        byEmail: (acknowledger?.email ?? principal.email).toLowerCase()
      }
    ]);

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
    if (this.maintenanceTasks.filter((existing) => existing.tenantId === principal.tenantId).length >= MAX_MAINTENANCE_TASKS_PER_ACCOUNT) {
      throw new ConflictException(`This account already has ${MAX_MAINTENANCE_TASKS_PER_ACCOUNT} maintenance tasks. Close or delete some before adding more.`);
    }

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

  /** The audit trail with who did each thing, in words: a person of this account by name, Greecon staff as
   * such with their address (they act in an account they are not a user of), anything else as the system. */
  listAudit(principal: Principal, siteId?: string): Array<AuditEvent & { actor: string }> {
    return this.scope(this.auditEvents, principal.tenantId)
      .filter((event) => !siteId || event.siteId === siteId)
      .map((event) => ({ ...event, actor: this.actorOf(event.userId, principal.tenantId) }));
  }

  /** The account's whole audit trail, oldest first, a page at a time, from the database: the list held in memory
   * is only the newest part of it, and a download must not stop where the memory does. Without a database the
   * memory is all there is. */
  async *auditTrail(principal: Principal, pageSize: number = 1_000): AsyncGenerator<Array<AuditEvent & { actor: string }>> {
    if (!this.db.isConfigured()) {
      yield [...this.listAudit(principal)].sort((a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc));
      return;
    }
    let after: { at: string; id: string } | undefined;
    for (;;) {
      const page = await this.db.query<AuditRow>(
        after
          ? `SELECT * FROM audit_events WHERE tenant_id = $1 AND (created_at, id) > ($2::timestamptz, $3::uuid) ORDER BY created_at ASC, id ASC LIMIT $4`
          : `SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY created_at ASC, id ASC LIMIT $2`,
        after ? [principal.tenantId, after.at, after.id, pageSize] : [principal.tenantId, pageSize]
      );
      if (page.rows.length === 0) return;
      yield page.rows.map((row) => {
        const event = mapAuditRow(row);
        return { ...event, createdAtUtc: new Date(row.created_at).toISOString(), actor: this.actorOf(event.userId, principal.tenantId) };
      });
      const last = page.rows[page.rows.length - 1] as AuditRow;
      after = { at: new Date(last.created_at).toISOString(), id: last.id };
      if (page.rows.length < pageSize) return;
    }
  }

  private actorOf(userId: string, tenantId: string): string {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return "System";
    return user.tenantId === tenantId ? user.name : `Greecon staff (${user.email})`;
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
    if (this.edgeSyncBatches.length > MAX_EDGE_SYNC_BATCHES_IN_MEMORY) this.edgeSyncBatches.length = MAX_EDGE_SYNC_BATCHES_IN_MEMORY;

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

  /** Whether this is Greecon's own account: the one whose people are told, each morning, how every customer's sites
   * stand (and which customers' alert messages are failing to arrive). */
  isOperatorTenant(tenantId: string): boolean {
    return this.tenants.find((candidate) => candidate.id === tenantId)?.domain === GREECON_DOMAIN;
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

  // A box delivers at least once: a reply lost on the way back makes it send the same reading again.
  // A reading for a point and an instant that is already in history is not added a second time.
  private async persistTelemetryReading(item: TelemetryReading): Promise<void> {
    await this.db.query(
      `INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, value_text, value_bool, unit, quality, source, ingestion_timestamp_utc)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
       WHERE NOT EXISTS (SELECT 1 FROM telemetry_readings WHERE point_id = $6 AND timestamp_utc = $1)`,
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

    const events: AlertEvent[] = [];
    const siteName = this.siteNameOf(tenantId, siteId);
    for (const change of changes) {
      const alert = this.applyAlertChange(change, tenantId, siteId, at);
      if (!alert) continue;
      writes.push(() => (change.type === "open" ? this.insertAlert(alert) : this.updateAlertRow(alert)));
      const type = change.type === "open" ? "opened" : change.type === "escalate" ? "escalated" : change.type === "reopen" ? "reopened" : change.type === "resolve" ? "resolved" : undefined;
      if (type) events.push({ type, atMs: nowMs, alert: { ...alert }, siteName });
    }
    this.announce(events);

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
    this.auditEvents = keepNewestOf(this.auditEvents, auditEvent.tenantId, MAX_AUDIT_EVENTS_IN_MEMORY_PER_ACCOUNT);

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO audit_events (id, tenant_id, user_id, event_type, site_id, asset_id, entity_type, entity_id, before_metadata, after_metadata, reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          auditEvent.id,
          auditEvent.tenantId,
          // A box, a background job or a user since removed is not a row in users; the event is still
          // worth keeping, so it is kept without one rather than refused by the foreign key.
          this.users.some((user) => user.id === auditEvent.userId) ? auditEvent.userId : null,
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
  connection: ModbusConnection | null;
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
    lastSeenUtc: row.last_seen_utc ? toIso(row.last_seen_utc) : undefined,
    firmwareVersion: row.firmware_version ?? undefined,
    secureIdentityStatus: row.secure_identity_status as Device["secureIdentityStatus"],
    positionX: row.metadata?.positionX,
    positionY: row.metadata?.positionY,
    placementNote: row.metadata?.placementNote,
    ...(row.connection ? { connection: row.connection } : {})
  };
}

interface EdgeGatewayRow {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  status: string;
  last_seen_utc: string | Date | null;
  software_version: string | null;
  secure_identity_status: string;
  enrolled_at: string | Date | null;
  config_version: string | null;
  buffer_depth: number | null;
  oldest_buffered_age_seconds: number | null;
  clock_skew_seconds: number | null;
  driver_status: DriverDeviceStatus[] | null;
}

function mapGatewayRow(row: EdgeGatewayRow): EdgeGateway {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    status: row.status as EdgeGateway["status"],
    lastSeenUtc: row.last_seen_utc ? toIso(row.last_seen_utc) : undefined,
    softwareVersion: row.software_version ?? undefined,
    secureIdentityStatus: row.secure_identity_status as EdgeGateway["secureIdentityStatus"],
    enrolledAtUtc: row.enrolled_at ? toIso(row.enrolled_at) : undefined,
    configVersion: row.config_version ?? undefined,
    bufferDepth: row.buffer_depth ?? undefined,
    oldestBufferedAgeSeconds: row.oldest_buffered_age_seconds ?? undefined,
    clockSkewSeconds: row.clock_skew_seconds ?? undefined,
    drivers: row.driver_status ?? undefined
  };
}

interface SiteSetupRow {
  site_id: string;
  tenant_id: string;
  template_key: string | null;
  confirmations: Record<string, Confirmation> | null;
}

function mapSiteSetupRow(row: SiteSetupRow): SiteSetupRecord {
  return { siteId: row.site_id, tenantId: row.tenant_id, templateKey: row.template_key ?? undefined, confirmations: row.confirmations ?? {} };
}

/** The same address with the spaces around its host taken off, when it has a host to take them from. */
function trimmedHost(connection: unknown): unknown {
  if (typeof connection === "object" && connection !== null && typeof (connection as { host?: unknown }).host === "string") {
    return { ...(connection as Record<string, unknown>), host: ((connection as { host: string }).host).trim() };
  }
  return connection;
}

/** An address as it is kept: only the fields that mean something, with the host trimmed. */
function tidyConnection(connection: ModbusConnection): ModbusConnection {
  return { kind: "modbus_tcp", host: connection.host.trim(), port: connection.port, unitId: connection.unitId };
}

/** A register description as it is kept: only the fields that mean something, so what a person typed
 * beyond them is not stored and cannot reach the box. */
function tidySource(source: PointSource): PointSource {
  const tidy: PointSource = { kind: "modbus", registerType: source.registerType, address: source.address, dataType: source.dataType };
  if (source.wordOrder !== undefined) tidy.wordOrder = source.wordOrder;
  if (source.scale !== undefined) tidy.scale = source.scale;
  if (source.offset !== undefined) tidy.offset = source.offset;
  if (source.linear !== undefined) tidy.linear = { rawLow: source.linear.rawLow, rawHigh: source.linear.rawHigh, engLow: source.linear.engLow, engHigh: source.linear.engHigh };
  if (source.part !== undefined) tidy.part = source.part;
  return tidy;
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
  source: PointSource | null;
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
    thresholdConfig: row.threshold_config ?? undefined,
    ...(row.source ? { source: row.source } : {})
  };
}

interface SiteProfileRow {
  site_id: string;
  tenant_id: string;
  timezone: string;
  currency: string;
  import_price_per_kwh: string | null;
  export_price_per_kwh: string | null;
  water_price_per_m3: string | null;
  baseline_monthly_import_kwh: string | null;
  baseline_monthly_water_m3: string | null;
  baseline_note: string | null;
  zero_export: boolean;
  updated_by: string | null;
  updated_at: Date;
}

function mapSiteProfileRow(row: SiteProfileRow): SiteProfile {
  // numeric columns arrive from the driver as strings
  const number = (value: string | null): number | undefined => (value === null ? undefined : Number(value));
  return {
    siteId: row.site_id,
    tenantId: row.tenant_id,
    timezone: row.timezone,
    currency: row.currency as CurrencyCode,
    importPricePerKwh: number(row.import_price_per_kwh),
    exportPricePerKwh: number(row.export_price_per_kwh),
    waterPricePerM3: number(row.water_price_per_m3),
    baselineMonthlyImportKwh: number(row.baseline_monthly_import_kwh),
    baselineMonthlyWaterM3: number(row.baseline_monthly_water_m3),
    baselineNote: row.baseline_note ?? undefined,
    zeroExport: row.zero_export,
    updatedByUserId: row.updated_by ?? undefined,
    updatedAtUtc: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
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
