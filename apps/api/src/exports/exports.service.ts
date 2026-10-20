import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { alertPriority, alertPriorityWords } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { NotificationConfig } from "../notifications/config";
import { PlatformService } from "../platform/platform.service";
import { CsvCell, CsvStyle, csvHeader, csvLine, localStamp, number, slug, text, utcStamp } from "./csv";

// Taking your data with you. The customer's readings, alerts and audit trail as spreadsheets, and everything
// Greecon holds about the account's setup as one file. All of it is the account's own: every query is
// limited to the account asking, and a site is looked up among that account's sites before anything is read.
// Each download is written to the account's audit trail with who took what.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const MAX_HOURLY_DAYS = 366;
export const MAX_RAW_DAYS = 31;

export interface ReadingsRequest {
  siteId: string;
  days: number;
  resolution: "hourly" | "raw";
  style: CsvStyle;
}

export interface CsvDownload {
  filename: string;
  chunks: AsyncIterable<string>;
}

interface RawRow {
  timestamp_utc: Date;
  point_id: string;
  device_id: string;
  canonical_name: string;
  value_numeric: number | null;
  value_bool: boolean | null;
  value_text: string | null;
  unit: string;
  quality: string;
}

interface HourlyRow {
  bucket: Date;
  point_id: string;
  device_id: string;
  canonical_name: string;
  unit: string;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  samples: string;
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

@Injectable()
export class ExportsService {
  constructor(
    private readonly platform: PlatformService,
    private readonly db: DatabaseService,
    private readonly notifications: NotificationConfig
  ) {}

  /** Every reading of one site for a period, or hourly averages for up to a year. */
  async readings(principal: Principal, request: ReadingsRequest, nowMs: number = Date.now()): Promise<CsvDownload> {
    const days = Math.floor(request.days);
    const raw = request.resolution === "raw";
    if (!Number.isFinite(days) || days < 1 || days > MAX_HOURLY_DAYS) throw new BadRequestException(`Choose a period of 1 to ${MAX_HOURLY_DAYS} days.`);
    if (raw && days > MAX_RAW_DAYS) throw new BadRequestException(`Every reading can be downloaded for up to ${MAX_RAW_DAYS} days. For a longer period, ask for hourly averages.`);

    const site = this.platform.listSites(principal).find((candidate) => candidate.id === request.siteId);
    if (!site) throw new NotFoundException("That site is not one of this account's sites.");
    const timezone = this.platform.siteProfile(site.id, principal).timezone;
    const devices = new Map(this.platform.listDevices(principal, site.id).map((device) => [device.id, device.name]));
    const points = new Map(this.platform.listPoints(principal).filter((point) => point.siteId === site.id).map((point) => [point.id, point.label]));
    const style = request.style;
    const to = nowMs;
    const from = raw ? to - days * DAY_MS : Math.floor((to - days * DAY_MS) / HOUR_MS) * HOUR_MS;

    await this.platform.recordDataExport(principal, "readings", site.id, `${raw ? "Every reading" : "Hourly averages"} of ${site.name}, ${isoDay(from)} to ${isoDay(to)}.`);

    const common = (pointId: string, deviceId: string, canonicalName: string): CsvCell[] => [
      text(site.name),
      text(devices.get(deviceId) ?? deviceId),
      text(points.get(pointId) ?? canonicalName),
      text(canonicalName)
    ];
    const db = this.db;
    const tenantId = principal.tenantId;
    const siteId = site.id;
    const filename = `greecon-readings-${slug(site.name)}-${isoDay(to)}-${raw ? "every-reading" : "hourly"}.csv`;

    async function* chunks(): AsyncGenerator<string> {
      yield csvHeader(
        raw
          ? ["time_utc", "time_local", "site", "device", "reading", "canonical_name", "value", "unit", "quality"]
          : ["hour_utc", "hour_local", "site", "device", "reading", "canonical_name", "average", "minimum", "maximum", "unit", "samples"],
        style
      );

      if (!db.isConfigured()) return; // Without a database there is no history to give: the head row says what the file would hold.

      // A window at a time, oldest first, so a year of readings is never held in memory at once.
      const windowMs = raw ? 6 * HOUR_MS : DAY_MS;
      for (let start = from; start < to; start += windowMs) {
        const end = Math.min(start + windowMs, to);
        if (raw) {
          const result = await db.query<RawRow>(
            `SELECT timestamp_utc, point_id, device_id, canonical_name, value_numeric, value_bool, value_text, unit, quality
             FROM telemetry_readings WHERE tenant_id = $1 AND site_id = $2 AND timestamp_utc >= $3 AND timestamp_utc < $4
             ORDER BY timestamp_utc, canonical_name, point_id`,
            [tenantId, siteId, new Date(start), new Date(end)]
          );
          let out = "";
          for (const row of result.rows) {
            const at = row.timestamp_utc.getTime();
            const value: CsvCell = row.value_numeric !== null ? number(row.value_numeric) : row.value_bool !== null ? number(row.value_bool ? 1 : 0) : text(row.value_text ?? "");
            out += csvLine([text(utcStamp(at)), text(localStamp(at, timezone)), ...common(row.point_id, row.device_id, row.canonical_name), value, text(row.unit), text(row.quality)], style);
          }
          if (out) yield out;
        } else {
          const result = await db.query<HourlyRow>(
            `SELECT date_bin('1 hour', timestamp_utc, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS bucket, point_id, device_id, canonical_name, max(unit) AS unit,
                    avg(coalesce(value_numeric, CASE WHEN value_bool THEN 1 ELSE 0 END)) AS average,
                    min(coalesce(value_numeric, CASE WHEN value_bool THEN 1 ELSE 0 END)) AS minimum,
                    max(coalesce(value_numeric, CASE WHEN value_bool THEN 1 ELSE 0 END)) AS maximum,
                    count(*)::text AS samples
             FROM telemetry_readings
             WHERE tenant_id = $1 AND site_id = $2 AND timestamp_utc >= $3 AND timestamp_utc < $4 AND (value_numeric IS NOT NULL OR value_bool IS NOT NULL)
             GROUP BY 1, point_id, device_id, canonical_name
             ORDER BY 1, canonical_name, point_id`,
            [tenantId, siteId, new Date(start), new Date(end)]
          );
          let out = "";
          for (const row of result.rows) {
            const at = row.bucket.getTime();
            out += csvLine(
              [text(utcStamp(at)), text(localStamp(at, timezone)), ...common(row.point_id, row.device_id, row.canonical_name), number(row.average), number(row.minimum), number(row.maximum), text(row.unit), number(Number(row.samples))],
              style
            );
          }
          if (out) yield out;
        }
      }
    }

    return { filename, chunks: chunks() };
  }

  /** The account's alerts: when each was raised, how urgent, what to do, and what became of it. */
  async alerts(principal: Principal, days: number, style: CsvStyle, nowMs: number = Date.now()): Promise<CsvDownload> {
    const period = Math.floor(days);
    if (!Number.isFinite(period) || period < 1 || period > MAX_HOURLY_DAYS) throw new BadRequestException(`Choose a period of 1 to ${MAX_HOURLY_DAYS} days.`);
    const since = nowMs - period * DAY_MS;
    const sites = new Map(this.platform.listSites(principal).map((site) => [site.id, site]));
    const zones = new Map([...sites.keys()].map((id) => [id, this.platform.siteProfile(id, principal).timezone]));
    const alerts = this.platform
      .listAlerts(principal)
      .filter((alert) => Date.parse(alert.createdAtUtc) >= since)
      .sort((a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc));

    await this.platform.recordDataExport(principal, "alerts", undefined, `Alerts of the last ${period} days.`);

    const stamp = (iso: string | undefined, zone: string): CsvCell[] => (iso ? [text(utcStamp(Date.parse(iso))), text(localStamp(Date.parse(iso), zone))] : [text(""), text("")]);
    async function* chunks(): AsyncGenerator<string> {
      yield csvHeader(["raised_utc", "raised_local", "site", "priority", "alert", "first_step", "status", "acknowledged_utc", "acknowledged_local", "cleared_utc", "cleared_local"], style);
      for (const alert of alerts) {
        const zone = zones.get(alert.siteId) ?? "UTC";
        yield csvLine(
          [
            ...stamp(alert.createdAtUtc, zone),
            text(sites.get(alert.siteId)?.name ?? ""),
            text(alertPriorityWords[alertPriority(alert.severity)]),
            text(alert.title),
            text(alert.suggestedAction),
            text(alert.status),
            ...stamp(alert.acknowledgedAtUtc, zone),
            ...stamp(alert.resolvedAtUtc, zone)
          ],
          style
        );
      }
    }
    return { filename: `greecon-alerts-${isoDay(nowMs)}.csv`, chunks: chunks() };
  }

  /** The account's audit trail: who did what, and when. */
  async audit(principal: Principal, style: CsvStyle, nowMs: number = Date.now()): Promise<CsvDownload> {
    // Recorded first, so the download's own line is in the trail it takes. The trail is read from the
    // database a page at a time: what the platform holds in memory is only its newest part.
    await this.platform.recordDataExport(principal, "audit", undefined, "The audit trail.");
    const platform = this.platform;
    async function* chunks(): AsyncGenerator<string> {
      yield csvHeader(["time_utc", "who", "event", "entity", "reason"], style);
      for await (const page of platform.auditTrail(principal)) {
        for (const event of page) yield csvLine([text(utcStamp(Date.parse(event.createdAtUtc))), text(event.actor), text(event.eventType), text(event.entityType), text(event.reason ?? "")], style);
      }
    }
    return { filename: `greecon-audit-${isoDay(nowMs)}.csv`, chunks: chunks() };
  }

  /** Everything Greecon holds about how the account is set up, as one file. No password, no box credential and
   * no enrolment code is in it: those are not the account's to take, because they would open the account. */
  async account(principal: Principal, nowMs: number = Date.now()): Promise<{ filename: string; json: Record<string, unknown> }> {
    await this.platform.recordDataExport(principal, "account", undefined, "Everything about how the account is set up.");
    const tenant = this.platform.listTenants(principal)[0];
    const sites = this.platform.listSites(principal);
    const devices = this.platform.listDevices(principal);
    const points = this.platform.listPoints(principal);
    const json = {
      format: "greecon-account-export/1",
      exportedAtUtc: new Date(nowMs).toISOString(),
      about:
        "Everything Greecon holds about how this account is set up: its people, sites, equipment, readings' registers and limits, who is told when something needs attention, and its alerts and tasks. Readings themselves are downloaded as spreadsheets. Passwords and the box credentials are not included.",
      account: tenant ? { name: tenant.name, identifier: tenant.domain } : undefined,
      people: this.platform.listUsers(principal).map((user) => ({ name: user.name, email: user.email, role: user.role, status: user.status })),
      sites: sites.map((site) => {
        const profile = this.platform.siteProfile(site.id, principal);
        return {
          name: site.name,
          type: site.type,
          location: site.locationName,
          prices: {
            currency: profile.currency,
            timezone: profile.timezone,
            electricityBoughtPerKwh: profile.importPricePerKwh,
            electricitySoldPerKwh: profile.exportPricePerKwh,
            waterPerM3: profile.waterPricePerM3,
            baselineMonthlyElectricityKwh: profile.baselineMonthlyImportKwh,
            baselineMonthlyWaterM3: profile.baselineMonthlyWaterM3,
            cannotSendToGrid: profile.zeroExport
          },
          boxes: this.platform.listGateways(principal, site.id).map((gateway) => ({ name: gateway.name, softwareVersion: gateway.softwareVersion, lastHeardFromUtc: gateway.lastSeenUtc, installedUtc: gateway.enrolledAtUtc })),
          assets: this.platform.listAssets(principal, site.id).map((asset) => ({ name: asset.name, type: asset.type })),
          equipment: devices
            .filter((device) => device.siteId === site.id)
            .map((device) => ({
              name: device.name,
              type: device.deviceType,
              protocol: device.protocol,
              connection: device.connection,
              readings: points
                .filter((point) => point.deviceId === device.id)
                .map((point) => ({ name: point.label, canonicalName: point.canonicalName, unit: point.unit, capability: point.capability, limits: point.thresholdConfig, register: point.source }))
            })),
          rules: this.platform.listRules(principal, site.id).map((rule) => ({ name: rule.name, priority: rule.priority, mode: rule.executionMode, approvalState: rule.approvalState, enabled: rule.enabled, conditions: rule.conditions, actions: rule.actions }))
        };
      }),
      whoIsTold: { people: this.notifications.contacts(principal.tenantId).map((contact) => ({ name: contact.name, email: contact.email, phone: contact.phone })), settings: this.notifications.settings(principal.tenantId) },
      alerts: this.platform.listAlerts(principal).map((alert) => ({ raisedUtc: alert.createdAtUtc, site: sites.find((site) => site.id === alert.siteId)?.name, priority: alertPriorityWords[alertPriority(alert.severity)], title: alert.title, firstStep: alert.suggestedAction, status: alert.status, acknowledgedUtc: alert.acknowledgedAtUtc, clearedUtc: alert.resolvedAtUtc })),
      incidents: this.platform.listIncidents(principal).map((incident) => ({ title: incident.title, status: incident.status, severity: incident.severity, notes: incident.investigationNotes })),
      maintenance: this.platform.listMaintenance(principal)
    };
    return { filename: `greecon-account-${slug(tenant?.name ?? "account")}-${isoDay(nowMs)}.json`, json };
  }
}
