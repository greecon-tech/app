import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS, GREECON_DOMAIN, GatewayHeartbeat } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { OutgoingEmail } from "../notifications/channels";
import { NotificationConfig } from "../notifications/config";
import { digestEmail } from "../notifications/messages";
import { NotificationsService } from "../notifications/notifications.service";
import { MemoryOutboxStore } from "../notifications/outbox";
import { PlatformService } from "./platform.service";
import { RECONNECTING, RESTART_GRACE_MS } from "./restart-grace";
import { PLATFORM_ADMIN, ProvisionedSite, minutes, onboardClient, provisionSite, sendReadings } from "./test-support";

// A calm restart. After a deploy, a crash or a database outage every box's last word is old because the platform was not
// listening. Nothing that comes from missing data may be raised, said or messaged until the boxes have had their chance
// to reconnect; nothing that comes from a measured value may wait a second.

const heartbeat = (atMs: number): GatewayHeartbeat => ({ agentVersion: "1.2.3", uptimeSeconds: 600, sentAtUtc: new Date(atMs).toISOString(), bufferDepth: 0, configVersion: "c1", devices: [] });

describe("starting to listen", () => {
  it("begins the grace when the application starts, before its first look at every site", async () => {
    const platform = new PlatformService(new DatabaseService());
    expect(platform.restartGraceUntil(Date.now())).toBeUndefined();
    let graceAtFirstLook: number | undefined;
    vi.spyOn(platform, "refreshAllDerivedStates").mockImplementation(async () => {
      graceAtFirstLook = platform.restartGraceUntil(Date.now());
    });
    await platform.onApplicationBootstrap();
    expect(graceAtFirstLook).toBeGreaterThan(Date.now());
    await platform.onApplicationShutdown();
  });
});

describe("the grace after the platform starts listening", () => {
  let platform: PlatformService;
  let client: Principal;
  let provisioned: ProvisionedSite;
  let start: number;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.tank.level.percent", unit: "%" },
      { canonicalName: "water.flow.lpm", unit: "lpm" }
    ]);
    // The platform has just started; the box last spoke half an hour ago, before it went down.
    start = Date.now();
    platform.markStartedListening(start);
  });

  const openAlerts = () => platform.listAlerts(client, provisioned.site.id).filter((alert) => alert.status === "open").map((alert) => alert.category);
  const stateOf = (key: string) => platform.listDerivedStates(client, provisioned.site.id).find((state) => state.stateKey === key);
  const health = (atMs: number) => platform.siteDetail(provisioned.site.id, client, atMs).health;

  it("does not call readings out of date, or open an alert about them, until the boxes have had their chance to reconnect", async () => {
    await sendReadings(platform, client, provisioned, [
      { name: "water.tank.level.percent", value: 60, minutesAgo: 30 },
      { name: "water.flow.lpm", value: 12, minutesAgo: 30 }
    ]);
    for (const after of [minutes(1), minutes(5), RESTART_GRACE_MS - 1_000]) {
      await platform.refreshAllDerivedStates(start + after);
      expect(openAlerts()).toEqual([]);
      expect(stateOf("system.communication_degraded")).toBeUndefined();
    }

    // The screens say what is true: the site's state is not known yet, and why, never "Action required" for a silence.
    expect(health(start + minutes(2))).toMatchObject({ state: "unknown", reasons: [expect.objectContaining({ message: RECONNECTING })] });

    // After the grace a site that is still silent is treated as it always was.
    await platform.refreshAllDerivedStates(start + RESTART_GRACE_MS + 1_000);
    expect(openAlerts()).toEqual(["communication_degraded"]);
    expect(health(start + RESTART_GRACE_MS + 1_000).reasons[0]?.message).toMatch(/2 readings are out of date; the oldest was taken 4\d minutes ago\./);
  });

  it("raises a measured danger in the first second after a start, while the other readings are still old", async () => {
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12, minutesAgo: 30 }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    expect(Date.now() - start).toBeLessThan(1_000);
    expect(openAlerts()).toEqual(["water_tank_critical"]);
    expect(stateOf("water.tank.critical")?.stateValue).toBe(true);
    // A critical alert is Action required at once; the old flow reading is the only thing that is not known.
    expect(health(Date.now())).toMatchObject({ state: "action" });
  });

  it("never judges the tank on a reading taken before the start: an alert that stands stays, and none is raised from an old value", async () => {
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    expect(openAlerts()).toEqual(["water_tank_critical"]);

    // The platform restarts half an hour later. The level it last saw is no longer the level now.
    platform.markStartedListening(Date.now() + minutes(30));
    await platform.refreshAllDerivedStates(Date.now() + minutes(31));
    expect(openAlerts()).toEqual(["water_tank_critical"]);
    expect(stateOf("water.tank.critical")).toBeUndefined();
  });

  it("is switched off by a grace of 0: a silence is then raised at the first look, as before", async () => {
    platform.markStartedListening(start, 0);
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12, minutesAgo: 30 }]);
    expect(openAlerts()).toEqual(["communication_degraded"]);
    expect(platform.restartGraceUntil(start + minutes(1))).toBeUndefined();
  });

  it("counts a slow reading's silence from the start, not from before it", async () => {
    const field = await provisionSite(platform, client, [{ canonicalName: "agri.soil.moisture.percent", unit: "%" }]);
    // A soil probe may report every hour or so: three hours is its limit. It last reported before the platform went down.
    await sendReadings(platform, client, field, [{ name: "agri.soil.moisture.percent", value: 31, minutesAgo: 175 }]);
    const alerts = () => platform.listAlerts(client, field.site.id).filter((alert) => alert.status === "open").map((alert) => alert.category);

    await platform.refreshAllDerivedStates(start + RESTART_GRACE_MS + minutes(1));
    expect(alerts()).toEqual([]);
    // Not called fine either: the reading is old, and the screen says so.
    expect(platform.siteDetail(field.site.id, client, start + RESTART_GRACE_MS + minutes(1)).health.state).toBe("unknown");

    await platform.refreshAllDerivedStates(start + minutes(181));
    expect(alerts()).toEqual(["communication_degraded"]);
  });
});

describe("a box after the platform starts listening", () => {
  let platform: PlatformService;
  let client: Principal;
  let provisioned: ProvisionedSite;
  let gatewayId: string;
  let start: number;

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    provisioned = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    start = Date.now();
    const box = await platform.provisionGateway({ siteId: provisioned.site.id, name: "Plant room" }, client);
    gatewayId = box.id;
    await platform.completeGatewayEnrolment(box.id, client.tenantId, client.userId, start - minutes(60));
    // Its last word was thirty minutes before the platform came back.
    await platform.recordGatewayHeartbeat(box.id, client.tenantId, heartbeat(start - minutes(30)), start - minutes(30));
    await platform.setSetupConfirmation(provisioned.site.id, "commissioned", { atUtc: new Date(start - 86_400_000).toISOString(), by: "pm@greecon.earth" }, client);
    platform.markStartedListening(start);
  });

  const contactAt = (atMs: number) => platform.listGateways(client, provisioned.site.id, atMs)[0]?.contact;
  const fleetAt = (atMs: number) => platform.fleet(PLATFORM_ADMIN, atMs).find((row) => row.siteId === provisioned.site.id);

  it("is only late while the grace lasts, and the fleet says Greecon was restarted, not that the box is silent", () => {
    expect(contactAt(start + minutes(1))).toBe("late");
    const row = fleetAt(start + minutes(1));
    expect(row).toMatchObject({ state: "unknown", box: { status: "late" } });
    expect(row?.reasons).toContain(RECONNECTING);
    expect(row?.reasons.join(" ")).not.toMatch(/offline|silent|has not reported/);
  });

  it("is never called offline inside the grace, however long the grace is set", () => {
    platform.markStartedListening(start, minutes(30));
    expect(contactAt(start + minutes(20))).toBe("late");
    expect(fleetAt(start + minutes(20))?.reasons.join(" ")).not.toMatch(/offline/);
    expect(contactAt(start + minutes(30) + 1_000)).toBe("offline");
  });

  it("counts its silence from the start once the grace is over: late first, then offline after the usual fifteen minutes", () => {
    expect(contactAt(start + RESTART_GRACE_MS + 1_000)).toBe("late");
    expect(fleetAt(start + RESTART_GRACE_MS + 1_000)?.state).toBe("attention");
    expect(contactAt(start + minutes(15) + 1_000)).toBe("offline");
    // And says how long it has really been silent.
    expect(fleetAt(start + minutes(16))?.reasons[0]).toBe("The box has not reported for 46 minutes: it is offline. Check its power and its network.");
  });

  it("is judged as always once it has been heard from since the start", async () => {
    await platform.recordGatewayHeartbeat(gatewayId, client.tenantId, heartbeat(start + minutes(1)), start + minutes(1));
    expect(contactAt(start + minutes(2))).toBe("online");
    expect(contactAt(start + minutes(4))).toBe("late");
    expect(contactAt(start + minutes(17))).toBe("offline");
  });

  it("stays online through a quick restart when it was heard from a moment before", async () => {
    await platform.recordGatewayHeartbeat(gatewayId, client.tenantId, heartbeat(start - 30_000), start - 30_000);
    expect(contactAt(start + 30_000)).toBe("online");
  });

  it("does not let the site's own card say Offline while the box may be reconnecting", async () => {
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 60, minutesAgo: 30 }]);
    expect(platform.listSites(client, start + minutes(1)).find((site) => site.id === provisioned.site.id)?.edgeStatus).toBe("Unknown");
    expect(platform.listSites(client, start + RESTART_GRACE_MS + 1_000).find((site) => site.id === provisioned.site.id)?.edgeStatus).toBe("Offline");
  });

  it("is not called silent in Greecon's own morning message inside the grace", async () => {
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 60, minutesAgo: 30 }]);
    const { tenant } = await platform.createTenant({ name: "Greecon", domain: GREECON_DOMAIN, ownerName: "Founder", ownerEmail: "founder@greecon.earth" }, PLATFORM_ADMIN);
    const at = start + minutes(2);
    const message = digestEmail(platform.digestOf(tenant.id, at), at, "Europe/Tirane", "07:30");
    expect(message.body).toContain(RECONNECTING);
    expect(message.body).not.toMatch(/offline|silent|has not reported|out of date/i);
  });
});

describe("telling people, right after a start", () => {
  let platform: PlatformService;
  let client: Principal;
  let provisioned: ProvisionedSite;
  let service: NotificationsService;
  let config: NotificationConfig;
  const emails: OutgoingEmail[] = [];

  beforeEach(async () => {
    emails.length = 0;
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    config = new NotificationConfig(new DatabaseService());
    await config.setContacts(client.tenantId, [{ name: "Besa Krasniqi", email: "besa@client-farm.example" }]);
    await config.setSettings(client.tenantId, { ...DEFAULT_NOTIFICATION_SETTINGS, quietFrom: "00:00", quietTo: "00:00" });
    service = new NotificationsService(platform, config, new MemoryOutboxStore(), { email: { send: async (message) => (emails.push(message), { ok: true as const }) }, problems: [] }, { webUrl: "https://app.greecon.example", autoSend: false });
    service.onModuleInit();
    provisioned = await provisionSite(platform, client, [
      { canonicalName: "water.tank.level.percent", unit: "%" },
      { canonicalName: "water.flow.lpm", unit: "lpm" }
    ]);
    platform.markStartedListening(Date.now());
  });

  afterEach(() => service.onModuleDestroy());

  const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

  it("emails the first person about a critical tank read in the first second, and nobody about the old readings", async () => {
    await sendReadings(platform, client, provisioned, [{ name: "water.flow.lpm", value: 12, minutesAgo: 30 }]);
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value: 5 }]);
    await settle();
    await service.tick(Date.now());
    expect(emails.map((email) => email.subject)).toEqual([`Act now: Tank level is critical, ${provisioned.site.name}`]);
  });

  it("holds the morning message until the grace is over", async () => {
    const noon = Date.parse("2026-10-19T12:00:00Z");
    platform.markStartedListening(noon);
    await config.setSettings(client.tenantId, { ...DEFAULT_NOTIFICATION_SETTINGS, quietFrom: "00:00", quietTo: "00:00", timezone: "UTC", digestAt: "12:00" });
    await service.tick(noon + minutes(1));
    expect(emails.filter((email) => email.subject?.startsWith("Greecon,"))).toEqual([]);
    await service.tick(noon + RESTART_GRACE_MS + minutes(1));
    expect(emails.filter((email) => email.subject?.startsWith("Greecon,")).map((email) => email.to)).toEqual(["besa@client-farm.example"]);
  });
});
