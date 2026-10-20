import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "../platform/platform.service";
import { ProvisionedSite, minutes, onboardClient, provisionSite, sendReadings } from "../platform/test-support";
import { OutgoingEmail } from "./channels";
import { NotificationConfig } from "./config";
import { NotificationsService } from "./notifications.service";
import { MemoryOutboxStore } from "./outbox";

// The real platform deciding that a tank is critical, and the real notifier telling the right person, with
// nothing in between faked except the post office.

describe("telling people, with the real platform", () => {
  let platform: PlatformService;
  let client: Principal;
  let service: NotificationsService;
  let outbox: MemoryOutboxStore;
  let provisioned: ProvisionedSite;
  const emails: OutgoingEmail[] = [];
  const texts: Array<{ to: string; body: string }> = [];

  beforeEach(async () => {
    emails.length = 0;
    texts.length = 0;
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    const config = new NotificationConfig(new DatabaseService());
    await config.setContacts(client.tenantId, [
      { name: "Besa Krasniqi", email: "besa@client-farm.example", phone: "+355691111111" },
      { name: "Arben Hoxha", email: "arben@client-farm.example", phone: "+355692222222" }
    ]);
    // No quiet hours and no morning message, so what the test sees does not depend on the time it runs at.
    await config.setSettings(client.tenantId, { ...DEFAULT_NOTIFICATION_SETTINGS, quietFrom: "00:00", quietTo: "00:00", digestEnabled: false });
    outbox = new MemoryOutboxStore();
    service = new NotificationsService(
      platform,
      config,
      outbox,
      {
        email: { send: async (message) => (emails.push(message), { ok: true as const, providerId: "em" }) },
        sms: { send: async (message) => (texts.push(message), { ok: true as const, providerId: "sm" }) },
        problems: []
      },
      { webUrl: "https://app.greecon.example", autoSend: false }
    );
    service.onModuleInit();
    provisioned = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
  });

  afterEach(() => service.onModuleDestroy());

  /** The platform tells the notifier without waiting; give it a moment to plan. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
  const tank = (value: number) => sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value }]);

  it("emails the first person the moment a tank goes critical, with the first step and a link", async () => {
    await tank(60);
    await settle();
    expect((await service.tick(Date.now())).sent).toBe(0);

    await tank(5);
    await settle();
    expect(await service.tick(Date.now())).toMatchObject({ sent: 1 });
    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe("besa@client-farm.example");
    expect(emails[0]?.subject).toBe(`Act now: Tank level is critical, ${provisioned.site.name}`);
    expect(emails[0]?.body).toContain("First step: Check the water supply and refill the tank");
    expect(emails[0]?.body).toContain("https://app.greecon.example/alerts");
  });

  it("texts them ten minutes later, and tells the next person after thirty, if nobody acknowledges", async () => {
    await tank(5);
    await settle();
    const start = Date.now();
    await service.tick(start);
    await service.tick(start + minutes(10) + 1_000);
    expect(texts.map((text) => text.to)).toEqual(["+355691111111"]);
    await service.tick(start + minutes(30) + 1_000);
    expect(emails.map((email) => email.to)).toEqual(["besa@client-farm.example", "arben@client-farm.example"]);
    expect(texts.map((text) => text.to)).toEqual(["+355691111111", "+355692222222"]);
  });

  it("stops the chain when a person acknowledges the alert in the app, and tells the two who were told who did", async () => {
    await tank(5);
    await settle();
    const start = Date.now();
    await service.tick(start);
    await service.tick(start + minutes(10) + 1_000);
    await service.tick(start + minutes(30) + 1_000);
    emails.length = 0;
    texts.length = 0;

    // The account's owner takes it. They are not on the list, so both people who were told hear who did.
    const [alert] = platform.listAlerts(client, provisioned.site.id);
    await platform.acknowledgeAlert(alert?.id as string, client);
    await settle();
    await service.tick(start + minutes(31));
    expect(emails.map((email) => email.to).sort()).toEqual(["arben@client-farm.example", "besa@client-farm.example"]);
    expect(emails[0]?.body.split("\n")[0]).toBe("Acknowledged by Client Owner at " + emails[0]?.body.match(/at (\d\d:\d\d)\./)?.[1] + ". The message will not go on to anyone else.");
    expect(texts).toEqual([]);
  });

  it("sends no further step of the chain once the alert is acknowledged before the second step", async () => {
    await tank(5);
    await settle();
    const start = Date.now();
    await service.tick(start);
    const [alert] = platform.listAlerts(client, provisioned.site.id);
    await platform.acknowledgeAlert(alert?.id as string, client);
    await settle();
    await service.tick(start + minutes(120));
    expect(texts).toEqual([]);
    // The one who was told hears that it was taken, and nothing else goes to anyone.
    expect(emails.map((email) => `${email.subject?.split(":")[0]} ${email.to}`)).toEqual(["Act now besa@client-farm.example", "Acknowledged besa@client-farm.example"]);
  });

  it("sends one 'Check today' email, and no text, for a tank that is low but not critical", async () => {
    await tank(30);
    await settle();
    const start = Date.now();
    await service.tick(start);
    await service.tick(start + minutes(120));
    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe(`Check today: Tank level is low, ${provisioned.site.name}`);
    expect(texts).toEqual([]);
  });

  it("does not page again when the level wobbles around its limit", async () => {
    for (const value of [5, 40, 5, 40, 5]) {
      await tank(value);
      await settle();
    }
    const start = Date.now();
    await service.tick(start);
    expect(emails.filter((email) => email.subject?.startsWith("Act now"))).toHaveLength(1);
    expect(outbox.rows.filter((row) => row.kind === "alert" && row.channel === "email")).toHaveLength(1);
  });

  it("says resolved only once the readings have stayed clear for fifteen minutes", async () => {
    await tank(5);
    await settle();
    const start = Date.now();
    await service.tick(start);
    emails.length = 0;

    await tank(80);
    await settle();
    await service.tick(start + minutes(14));
    expect(emails).toEqual([]);
    await service.tick(start + minutes(16));
    expect(emails.map((email) => email.subject)).toEqual([`Resolved: Tank level is critical, ${provisioned.site.name}`]);
  });

  it("tells nobody on an account that has nobody on the list", async () => {
    const other = await platform.createTenant({ name: "Other Farm", domain: "other-farm.example", ownerName: "O", ownerEmail: "owner@other-farm.example" }, { ...client, isPlatformAdmin: true });
    const otherClient: Principal = { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
    const site = await provisionSite(platform, otherClient, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    await sendReadings(platform, otherClient, site, [{ name: "water.tank.level.percent", value: 5 }]);
    await settle();
    await service.tick(Date.now());
    expect(emails).toEqual([]);
    expect(texts).toEqual([]);
  });
});
