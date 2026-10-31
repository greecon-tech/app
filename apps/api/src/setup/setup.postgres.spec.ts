import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { Principal, edgeDeviceIngestPrincipal } from "../common/principal";
import { hashGatewaySecret } from "../common/gateway-secret";
import { DatabaseService } from "../database/database.service";
import { runMigrations } from "../database/migrator";
import { testDatabaseUrl, withEmptyDatabase } from "../database/test-database";
import { PlatformService } from "../platform/platform.service";
import { PLATFORM_ADMIN } from "../platform/test-support";
import { EdgeBundleService } from "./edge-bundle";
import { PostgresEnrolmentStore } from "./enrolment-store";
import { SetupService } from "./setup.service";

const API = "https://api.greecon.example";
const bundle = { manifest: () => undefined } as unknown as EdgeBundleService;

interface World {
  pool: Pool;
  connectionString: string;
  start(): Promise<{ platform: PlatformService; setup: SetupService; db: DatabaseService; stop: () => Promise<void> }>;
  owner: Principal;
}

/** A migrated empty database with one client, and a way to start the platform on it, again and again
 * as a restart would. */
async function inWorld<T>(use: (world: World) => Promise<T>): Promise<T> {
  return withEmptyDatabase(async (pool, connectionString) => {
    await runMigrations(pool, join(__dirname, "..", "database", "migrations"));
    const start = async () => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = new DatabaseService();
      process.env.DATABASE_URL = previous;
      const platform = new PlatformService(db);
      await platform.onModuleInit();
      return {
        platform,
        db,
        setup: new SetupService(platform, new PostgresEnrolmentStore(db), bundle),
        stop: async () => {
          await platform.onApplicationShutdown();
          await db.onModuleDestroy();
        }
      };
    };

    const first = await start();
    // The platform administrator is a real row (the audit trail points at users); the demo owner is one of the seeded ones.
    const { tenant, owner } = await first.platform.createTenant(
      { name: "Hotel Group Ltd", domain: "hotel-group.example", ownerName: "Hotel Owner", ownerEmail: "owner@hotel-group.example" },
      PLATFORM_ADMIN
    );
    await first.stop();
    return use({ pool, connectionString, start, owner: { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false } });
  });
}

describe.skipIf(!testDatabaseUrl)("setting a site up, on a real PostgreSQL", () => {
  it("keeps the whole setup across a restart, and the box's configuration comes back identical", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      const { site } = await running.setup.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës", timezone: "Europe/Tirane" }, owner);
      const devices = running.platform.listDevices(owner, site.id);
      for (const [index, device] of devices.entries()) {
        await running.platform.updateDevice(device.id, { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: index + 1 } }, owner);
      }
      const tank = running.platform.listPoints(owner).find((point) => point.canonicalName === "water.tank.level.percent");
      await running.platform.updatePoint(tank?.id as string, { source: { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 100 } } }, owner);

      const { gatewayId, enrolment } = await running.setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
      const { secret } = await running.setup.enrol(enrolment.code, API);
      const box = edgeDeviceIngestPrincipal(owner.tenantId, gatewayId);
      await running.setup.heartbeat(box, {
        agentVersion: "0.2.0",
        uptimeSeconds: 10,
        sentAtUtc: new Date().toISOString(),
        bufferDepth: 3,
        configVersion: "x",
        devices: devices.map((device) => ({ deviceId: device.id, ok: true, readingsOk: 1, readingsFailed: 0 }))
      });
      await running.setup.confirmStep(site.id, "direction", "Checked", owner);
      const configBefore = running.setup.edgeConfig(box);
      await running.stop();

      const again = await start();
      try {
        const restored = again.platform.listDevices(owner, site.id);
        expect(restored.map((device) => device.connection?.unitId).sort()).toEqual([1, 2, 3, 4]);
        // Each device remembers which approved model it is, through the database, so that the platform still knows what to ask for and what to look for.
        expect(restored.map((device) => device.profileKey).sort()).toEqual(["eastron-sdm630-grid", "eastron-sdm630-solar", "waveshare-ai8-water", "waveshare-io8-pump"]);
        expect(again.platform.listPoints(owner).find((point) => point.canonicalName === "water.pump.status")?.source).toEqual({ kind: "modbus", registerType: "discrete", address: 0, dataType: "uint16" });
        expect(restored.every((device) => device.gatewayId === gatewayId)).toBe(true);
        expect(again.platform.listPoints(owner).find((point) => point.canonicalName === "water.tank.level.percent")?.source?.linear).toEqual({ rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 100 });

        const gateway = again.platform.findGateway(gatewayId, owner.tenantId);
        expect(gateway).toMatchObject({ secureIdentityStatus: "provisioned", softwareVersion: "0.2.0", bufferDepth: 3 });
        expect(gateway?.enrolledAtUtc).toBeDefined();
        expect(gateway?.drivers).toHaveLength(4);
        expect(gateway?.contact).toBe("online");

        const record = again.platform.siteSetupRecord(site.id, owner);
        expect(record.templateKey).toBe("hotel");
        expect(record.confirmations.direction).toMatchObject({ by: owner.email, note: "Checked" });

        // The version is a digest of what the box reads: it must not change just because the data went through the database.
        expect(again.setup.edgeConfig(box)).toEqual(configBefore);
        expect(again.platform.siteProfile(site.id, owner).timezone).toBe("Europe/Tirane");
      } finally {
        await again.stop();
      }

      // The credential the box was given opens the door, by its hash, and only its hash is kept.
      const found = await pool.query("SELECT id, tenant_id FROM edge_gateways WHERE secret_hash = $1", [hashGatewaySecret(secret)]);
      expect(found.rows).toEqual([{ id: gatewayId, tenant_id: owner.tenantId }]);
      const stored = await pool.query("SELECT secret_hash FROM edge_gateways WHERE id = $1", [gatewayId]);
      expect(stored.rows[0].secret_hash).not.toBe(secret);
    });
  }, 120_000);

  it("lets only one of several simultaneous boxes use a code", async () => {
    await inWorld(async ({ start, owner }) => {
      const running = await start();
      try {
        const { site } = await running.setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
        const { enrolment } = await running.setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
        const results = await Promise.allSettled(Array.from({ length: 6 }, () => running.setup.enrol(enrolment.code, API)));
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(5);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);

  it("ends the old credential when a replacement box enrols", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      try {
        const { site } = await running.setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
        const { gatewayId, enrolment } = await running.setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
        const first = await running.setup.enrol(enrolment.code, API);
        const second = await running.setup.enrol((await running.setup.issueEnrolment(gatewayId, owner, API)).code, API);

        const oldOne = await pool.query("SELECT id FROM edge_gateways WHERE secret_hash = $1", [hashGatewaySecret(first.secret)]);
        const newOne = await pool.query("SELECT id FROM edge_gateways WHERE secret_hash = $1", [hashGatewaySecret(second.secret)]);
        expect(oldOne.rows).toEqual([]);
        expect(newOne.rows).toEqual([{ id: gatewayId }]);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);

  it("records an enrolment in the audit trail even when the person who made the code is gone", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      try {
        const { site } = await running.setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
        const gateway = await running.platform.provisionGateway({ siteId: site.id, name: "Plant room" }, owner);
        await running.platform.completeGatewayEnrolment(gateway.id, owner.tenantId, "no-such-user");
        const events = await pool.query("SELECT user_id FROM audit_events WHERE event_type = 'gateway.enrolled' AND tenant_id = $1", [owner.tenantId]);
        expect(events.rows).toEqual([{ user_id: null }]);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);

  it("removes a gateway's unused codes with the gateway", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      try {
        const { site } = await running.setup.createSiteFromTemplate({ templateKey: "blank", name: "Blank", locationName: "x" }, owner);
        const { gatewayId } = await running.setup.provisionBox({ siteId: site.id, name: "Plant room" }, owner, API);
        expect((await pool.query("SELECT 1 FROM gateway_enrolments WHERE gateway_id = $1", [gatewayId])).rowCount).toBe(1);
        await running.platform.deleteGateway(gatewayId, owner);
        expect((await pool.query("SELECT 1 FROM gateway_enrolments WHERE gateway_id = $1", [gatewayId])).rowCount).toBe(0);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);

  it("leaves nothing in the database when a site cannot be made from its template", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      try {
        const original = running.platform.createPoint.bind(running.platform);
        let calls = 0;
        vi.spyOn(running.platform, "createPoint").mockImplementation(async (input, principal) => {
          calls += 1;
          if (calls === 5) throw new Error("the connection dropped");
          return original(input, principal);
        });
        await expect(running.setup.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel", locationName: "x" }, owner)).rejects.toThrow("the connection dropped");
        for (const table of ["sites", "assets", "devices", "points"]) {
          const count = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`, [owner.tenantId]);
          expect(count.rows[0].n, table).toBe(0);
        }
        expect((await pool.query("SELECT count(*)::int AS n FROM site_setup WHERE tenant_id = $1", [owner.tenantId])).rows[0].n).toBe(0);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);

  it("keeps one account's equipment out of another's, in the database too", async () => {
    await inWorld(async ({ start, owner, pool }) => {
      const running = await start();
      try {
        const { site } = await running.setup.createSiteFromTemplate({ templateKey: "hotel", name: "Hotel", locationName: "x" }, owner);
        const other = await running.platform.createTenant(
          { name: "Other Ltd", domain: "other.example", ownerName: "Other", ownerEmail: "owner@other.example" },
          PLATFORM_ADMIN
        );
        const intruder: Principal = { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
        expect(() => running.setup.setupView(site.id, intruder)).toThrow();
        const rows = await pool.query("SELECT count(*)::int AS n FROM devices WHERE tenant_id = $1", [intruder.tenantId]);
        expect(rows.rows[0].n).toBe(0);
      } finally {
        await running.stop();
      }
    });
  }, 120_000);
});
