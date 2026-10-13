// Fixtures shared by the PlatformService specs: onboarding a real second tenant, provisioning a
// site with points, and sending readings through the same ingestion path a gateway uses.
import { CanonicalPointName, DEMO_TENANT_ID, Device, Site, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { PlatformService } from "./platform.service";

export const DEMO_OWNER: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  role: "owner",
  email: "eridon.manuka@greecon.earth",
  isPlatformAdmin: false
};

export const PLATFORM_ADMIN: Principal = { ...DEMO_OWNER, isPlatformAdmin: true };

/** Onboards a real second tenant the way Greecon staff do, and returns its owner as a principal. */
export async function onboardClient(platform: PlatformService): Promise<Principal> {
  const { tenant, owner } = await platform.createTenant(
    { name: "Client Farm Ltd", domain: "client-farm.example", ownerName: "Client Owner", ownerEmail: "owner@client-farm.example" },
    PLATFORM_ADMIN
  );
  return { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false };
}

export interface PointSpec {
  canonicalName: CanonicalPointName;
  unit: string;
  capability?: "read" | "write" | "read_write";
  thresholds?: Record<string, number>;
}

export interface ProvisionedSite {
  site: Site;
  device: Device;
  pointIds: Partial<Record<CanonicalPointName, string>>;
}

export async function provisionSite(platform: PlatformService, principal: Principal, points: PointSpec[]): Promise<ProvisionedSite> {
  const site = await platform.createSite({ name: `${principal.email} site`, type: "integrated_site", locationName: "Test" }, principal);
  const device = await platform.createDevice(
    { siteId: site.id, name: "Controller", deviceType: "plc", protocol: "simulated", driverType: "simulator" },
    principal
  );

  const pointIds: ProvisionedSite["pointIds"] = {};
  for (const spec of points) {
    const point = await platform.createPoint(
      {
        siteId: site.id,
        deviceId: device.id,
        canonicalName: spec.canonicalName,
        label: spec.canonicalName,
        unit: spec.unit,
        capability: spec.capability ?? "read",
        thresholdConfig: spec.thresholds
      },
      principal
    );
    pointIds[spec.canonicalName] = point.id;
  }
  return { site, device, pointIds };
}

export interface ReadingSpec {
  name: CanonicalPointName;
  value: number;
  unit?: string;
  /** How long before now the measurement was taken. Default 0 (just now). */
  minutesAgo?: number;
  quality?: "OK" | "WARN" | "BAD";
  source?: "edge" | "simulator" | "manual" | "cloud";
}

export async function sendReadings(platform: PlatformService, principal: Principal, provisioned: ProvisionedSite, readings: ReadingSpec[]) {
  const now = new Date();
  const message: TelemetryMessage = {
    messageType: "telemetry",
    tenantId: principal.tenantId,
    siteId: provisioned.site.id,
    deviceId: provisioned.device.id,
    publishedAtUtc: now.toISOString(),
    correlationId: "corr-test-support",
    readings: readings.map((reading) => ({
      timestampUtc: new Date(now.getTime() - (reading.minutesAgo ?? 0) * 60_000).toISOString(),
      tenantId: principal.tenantId,
      siteId: provisioned.site.id,
      deviceId: provisioned.device.id,
      pointId: provisioned.pointIds[reading.name] as string,
      canonicalName: reading.name,
      value: reading.value,
      unit: reading.unit ?? "",
      quality: reading.quality ?? "OK",
      source: reading.source ?? "edge",
      ingestionTimestampUtc: now.toISOString()
    }))
  };
  return platform.ingestTelemetry(message, principal);
}

export const minutes = (count: number) => count * 60_000;
