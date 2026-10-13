import { beforeEach, describe, expect, it } from "vitest";
import { CanonicalPointName, DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";

const DEMO_OWNER: Principal = {
  tenantId: DEMO_TENANT_ID,
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  role: "owner",
  email: "eridon.manuka@greecon.earth"
};

const PLATFORM_ADMIN: Principal = { ...DEMO_OWNER, isPlatformAdmin: true };

// Onboards a real second tenant the way Greecon staff do, and returns its owner as a principal.
async function onboardClient(platform: PlatformService): Promise<Principal> {
  const { tenant, owner } = await platform.createTenant(
    { name: "Client Farm Ltd", domain: "client-farm.example", ownerName: "Client Owner", ownerEmail: "owner@client-farm.example" },
    PLATFORM_ADMIN
  );
  return { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email };
}

// Provisions one site/device/point for a tenant and pushes a single reading through the real
// ingestion path, the same way a gateway would.
async function provisionReading(
  platform: PlatformService,
  principal: Principal,
  canonicalName: CanonicalPointName,
  unit: string,
  value: number
) {
  const site = await platform.createSite({ name: `${principal.email} site`, type: "integrated_site", locationName: "Test" }, principal);
  const device = await platform.createDevice(
    { siteId: site.id, name: "Meter", deviceType: "meter", protocol: "simulated", driverType: "simulator" },
    principal
  );
  const point = await platform.createPoint(
    { siteId: site.id, deviceId: device.id, canonicalName, label: canonicalName, unit, capability: "read" },
    principal
  );

  const now = new Date().toISOString();
  const message: TelemetryMessage = {
    messageType: "telemetry",
    tenantId: principal.tenantId,
    siteId: site.id,
    deviceId: device.id,
    publishedAtUtc: now,
    correlationId: "corr-overview-spec",
    readings: [
      {
        timestampUtc: now,
        tenantId: principal.tenantId,
        siteId: site.id,
        deviceId: device.id,
        pointId: point.id,
        canonicalName,
        value,
        unit,
        quality: "OK",
        source: "edge",
        ingestionTimestampUtc: now
      }
    ]
  };

  const result = await platform.ingestTelemetry(message, principal);
  expect(result.accepted).toBe(true);
  return { site, device, point };
}

describe("overview tenant isolation", () => {
  let platform: PlatformService;
  let CLIENT_OWNER: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    CLIENT_OWNER = await onboardClient(platform);
  });

  it("shows a tenant its own readings, not another tenant's", async () => {
    await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 777);

    // The client's Overview must reflect the client's own plant...
    expect(platform.overview(CLIENT_OWNER).summaries.energy.solarPowerKw).toBe(777);
    // ...and the demo tenant's Overview must not pick up the client's reading.
    expect(platform.overview(DEMO_OWNER).summaries.energy.solarPowerKw).not.toBe(777);
  });

  it("reports no value for a metric a tenant does not meter, rather than borrowing another tenant's", async () => {
    // The demo tenant meters water; this client only meters solar.
    await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 12);

    const water = platform.overview(CLIENT_OWNER).summaries.water;
    expect(water.tankLevelPercent).toBeUndefined();
    expect(water.flowLpm).toBeUndefined();
    expect(water.pressureBar).toBeUndefined();

    const agriculture = platform.overview(CLIENT_OWNER).summaries.agriculture;
    expect(agriculture.soilMoisturePercent).toBeUndefined();
  });

  it("derives a tenant's surplus state from its own readings only", async () => {
    // Demo tenant: lots of solar and little consumption (a surplus). Client: no energy data of its own
    // beyond a tiny solar reading, so it must not inherit the demo tenant's 'Available' surplus.
    const demoBefore = platform.overview(DEMO_OWNER).summaries.energy.surplusState;
    await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 0.2);

    // Surplus is solar minus consumption, so solar alone cannot judge it: the client says nothing
    // (it used to say "Constrained", a claim with no basis) and, above all, does not inherit the
    // demo tenant's answer.
    expect(platform.overview(CLIENT_OWNER).summaries.energy.surplusState).toBeUndefined();
    expect(platform.overview(DEMO_OWNER).summaries.energy.surplusState).toBe(demoBefore);
  });

  it("does not show another tenant's last command as this tenant's last action", async () => {
    const demoSite = platform.listSites(DEMO_OWNER)[0]!;
    const pump = platform.listPoints(DEMO_OWNER).find((point) => point.canonicalName === "water.pump.command" && point.siteId === demoSite.id)
      ?? platform.listPoints(DEMO_OWNER).find((point) => point.canonicalName === "water.pump.command")!;
    await platform.createCommand(
      { siteId: pump.siteId, targetDeviceId: pump.deviceId, targetPointId: pump.id, requestedValue: "OFF", reason: "Demo tenant command" },
      DEMO_OWNER
    );
    expect(platform.overview(DEMO_OWNER).summaries.automation.lastAction).not.toBe("No command dispatched");

    // A brand-new client has never issued a command.
    expect(platform.overview(CLIENT_OWNER).summaries.automation.lastAction).toBe("No command dispatched");
  });
});

describe("telemetry ingestion integrity", () => {
  let platform: PlatformService;
  let CLIENT_OWNER: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    CLIENT_OWNER = await onboardClient(platform);
  });

  it("rejects a reading that claims a different tenant than the authenticated caller", async () => {
    const { site, device, point } = await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 5);
    const now = new Date().toISOString();

    const forged: TelemetryMessage = {
      messageType: "telemetry",
      tenantId: CLIENT_OWNER.tenantId,
      siteId: site.id,
      deviceId: device.id,
      publishedAtUtc: now,
      correlationId: "corr-forged-tenant",
      readings: [
        {
          timestampUtc: now,
          // The message is addressed to the caller's tenant, but this one reading claims to belong
          // to the demo tenant — it must not be stored under that tenant.
          tenantId: DEMO_TENANT_ID,
          siteId: site.id,
          deviceId: device.id,
          pointId: point.id,
          canonicalName: "energy.solar.power.kw",
          value: 99999,
          unit: "kW",
          quality: "OK",
          source: "edge",
          ingestionTimestampUtc: now
        }
      ]
    };

    const result = await platform.ingestTelemetry(forged, CLIENT_OWNER);
    expect(result.accepted).toBe(false);
    expect(result.errors.join(" ")).toContain("tenantId");
    expect(platform.latestTelemetry(DEMO_OWNER).some((reading) => reading.value === 99999)).toBe(false);
  });

  it("rejects a reading whose site differs from the message it arrived in", async () => {
    const { site, device, point } = await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 5);
    const now = new Date().toISOString();

    const mismatched: TelemetryMessage = {
      messageType: "telemetry",
      tenantId: CLIENT_OWNER.tenantId,
      siteId: site.id,
      deviceId: device.id,
      publishedAtUtc: now,
      correlationId: "corr-mismatch",
      readings: [
        {
          timestampUtc: now,
          tenantId: CLIENT_OWNER.tenantId,
          siteId: "22222222-2222-4222-8222-222222222201",
          deviceId: device.id,
          pointId: point.id,
          canonicalName: "energy.solar.power.kw",
          value: 1,
          unit: "kW",
          quality: "OK",
          source: "edge",
          ingestionTimestampUtc: now
        }
      ]
    };

    const result = await platform.ingestTelemetry(mismatched, CLIENT_OWNER);
    expect(result.accepted).toBe(false);
    expect(result.errors.join(" ")).toContain("siteId");
  });

  it("rejects a reading timestamped far in the future, which would otherwise freeze the 'latest' value", async () => {
    const { site, device, point } = await provisionReading(platform, CLIENT_OWNER, "energy.solar.power.kw", "kW", 5);
    const now = new Date();
    const farFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const message: TelemetryMessage = {
      messageType: "telemetry",
      tenantId: CLIENT_OWNER.tenantId,
      siteId: site.id,
      deviceId: device.id,
      publishedAtUtc: now.toISOString(),
      correlationId: "corr-future",
      readings: [
        {
          timestampUtc: farFuture,
          tenantId: CLIENT_OWNER.tenantId,
          siteId: site.id,
          deviceId: device.id,
          pointId: point.id,
          canonicalName: "energy.solar.power.kw",
          value: 424242,
          unit: "kW",
          quality: "OK",
          source: "edge",
          ingestionTimestampUtc: now.toISOString()
        }
      ]
    };

    const result = await platform.ingestTelemetry(message, CLIENT_OWNER);
    expect(result.accepted).toBe(false);
    expect(result.errors.join(" ")).toContain("future");
    expect(platform.overview(CLIENT_OWNER).summaries.energy.solarPowerKw).toBe(5);
  });
});

describe("latest value ordering", () => {
  let platform: PlatformService;
  let client: Principal;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
  });

  async function send(siteId: string, deviceId: string, pointId: string, timestampUtc: string, value: number, quality: "OK" | "BAD" = "OK") {
    const now = new Date().toISOString();
    return platform.ingestTelemetry(
      {
        messageType: "telemetry",
        tenantId: client.tenantId,
        siteId,
        deviceId,
        publishedAtUtc: now,
        correlationId: "corr-order",
        readings: [
          {
            timestampUtc,
            tenantId: client.tenantId,
            siteId,
            deviceId,
            pointId,
            canonicalName: "energy.solar.power.kw",
            value,
            unit: "kW",
            quality,
            source: "edge",
            ingestionTimestampUtc: now
          }
        ]
      },
      client
    );
  }

  it("keeps the newest reading when an older, delayed one arrives afterwards", async () => {
    const { site, device, point } = await provisionReading(platform, client, "energy.solar.power.kw", "kW", 1);

    // The fixture's own first reading is stamped "now", so 'newer' must be later than that (a couple
    // of seconds ahead is well inside the allowed clock skew).
    const newer = new Date(Date.now() + 2_000).toISOString();
    const older = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    expect((await send(site.id, device.id, point.id, newer, 50)).accepted).toBe(true);
    // A reading buffered during an outage is replayed after live data has already resumed.
    expect((await send(site.id, device.id, point.id, older, 7, "BAD")).accepted).toBe(true);

    expect(platform.overview(client).summaries.energy.solarPowerKw).toBe(50);
    // The late BAD reading must not mark the point as bad either: it describes an hour ago.
    expect(platform.listPoints(client).find((candidate) => candidate.id === point.id)?.quality).toBe("OK");
  });
});
