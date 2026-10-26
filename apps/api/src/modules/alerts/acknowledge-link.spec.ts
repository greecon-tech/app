import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@greecon/shared";
import { Principal } from "../../common/principal";
import { DatabaseService } from "../../database/database.service";
import { ACK_LINK_LIFETIME_MS, ackLinkKey, ackToken } from "../../notifications/ack-link";
import { OutgoingEmail } from "../../notifications/channels";
import { NotificationConfig } from "../../notifications/config";
import { NotificationOptions, NotificationsService } from "../../notifications/notifications.service";
import { MemoryOutboxStore } from "../../notifications/outbox";
import { PlatformService } from "../../platform/platform.service";
import { PLATFORM_ADMIN, ProvisionedSite, minutes, onboardClient, provisionSite, sendReadings } from "../../platform/test-support";
import { AcknowledgeLinkService } from "./acknowledge-link.service";

// The "I have seen this" link, with the real platform and the real notifier: it shows its one alert and changes nothing when
// opened, acknowledges it when its button is pressed exactly as Acknowledge in Greecon does, and reaches nothing else.

const WEB = "https://app.greecon.example";
const ACK_LINK = /https:\/\/app\.greecon\.example\/ack\/([A-Za-z0-9_-]{36})/;

describe("the link in an alert message", () => {
  let platform: PlatformService;
  let client: Principal;
  let provisioned: ProvisionedSite;
  let config: NotificationConfig;
  let outbox: MemoryOutboxStore;
  let service: NotificationsService;
  let links: AcknowledgeLinkService;
  let options: NotificationOptions;
  let emails: OutgoingEmail[];
  let texts: Array<{ to: string; body: string }>;

  beforeEach(async () => {
    emails = [];
    texts = [];
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    config = new NotificationConfig(new DatabaseService());
    await config.setContacts(client.tenantId, [
      { name: "Besa Krasniqi", email: "besa@client-farm.example", phone: "+355691111111" },
      { name: "Arben Hoxha", email: "arben@client-farm.example", phone: "+355692222222" }
    ]);
    await config.setSettings(client.tenantId, { ...DEFAULT_NOTIFICATION_SETTINGS, quietFrom: "00:00", quietTo: "00:00", digestEnabled: false });
    outbox = new MemoryOutboxStore();
    options = { webUrl: WEB, autoSend: false, ackLinkKey: ackLinkKey("s".repeat(48)) };
    service = new NotificationsService(
      platform,
      config,
      outbox,
      {
        email: { send: async (message) => (emails.push(message), { ok: true as const }) },
        sms: { send: async (message) => (texts.push(message), { ok: true as const }) },
        problems: []
      },
      options
    );
    service.onModuleInit();
    links = new AcknowledgeLinkService(platform, config, options);
    provisioned = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
  });

  afterEach(() => service.onModuleDestroy());

  const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
  const tank = async (value: number) => {
    await sendReadings(platform, client, provisioned, [{ name: "water.tank.level.percent", value }]);
    await settle();
  };
  const theAlert = () => platform.listAlerts(client, provisioned.site.id)[0];
  const linkIn = (text: string | undefined) => ACK_LINK.exec(text ?? "")?.[1] as string;
  const acknowledgements = () => platform.listAudit(client).filter((event) => event.eventType === "alert.acknowledged");

  /** A critical tank, the first person emailed at once and texted ten minutes later, each with a link of their own. */
  async function criticalTank(): Promise<number> {
    await tank(5);
    const start = Date.now();
    await service.tick(start);
    await service.tick(start + minutes(10) + 1_000);
    return start;
  }

  it("is in the email and the text, and opens to its alert", async () => {
    await criticalTank();
    const email = emails[0]?.body ?? "";
    expect(email).toContain(`Open the alert in Greecon: ${WEB}/alerts`);
    expect(email).toMatch(/When you have seen it and are acting, press Acknowledge there, or say so with this link, without signing in:\nhttps:\/\/app\.greecon\.example\/ack\/[A-Za-z0-9_-]{36}\nThat stops the message going on to the next person\./);
    expect(texts[0]?.body).toMatch(/ Acknowledge: https:\/\/app\.greecon\.example\/ack\/[A-Za-z0-9_-]{36}$/);
    expect(texts[0]?.body).not.toContain("/alerts");

    for (const token of [linkIn(email), linkIn(texts[0]?.body)]) {
      expect(links.view(token)).toEqual({
        valid: true,
        alert: { title: "Tank level is critical", siteName: provisioned.site.name, priority: "Act now", raisedAtUtc: theAlert()?.createdAtUtc, state: "open" }
      });
    }
  });

  it("changes nothing when it is only opened, however often", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    const before = { ...theAlert() };
    const planned = outbox.rows.length;
    for (let times = 0; times < 5; times += 1) links.view(token);
    await settle();
    expect(theAlert()).toEqual(before);
    expect(theAlert()?.acknowledgedAtUtc).toBeUndefined();
    expect(acknowledgements()).toEqual([]);
    expect(outbox.rows).toHaveLength(planned);
  });

  it("acknowledges when its button is pressed, on the platform's clock, and stops the messages exactly as Acknowledge in Greecon does", async () => {
    const start = await criticalTank();
    const pressedAt = Date.now();
    expect(await links.acknowledge(linkIn(texts[0]?.body))).toMatchObject({ valid: true, alert: { state: "acknowledged" } });
    expect(theAlert()?.status).toBe("acknowledged");
    expect(Date.parse(theAlert()?.acknowledgedAtUtc as string)).toBeGreaterThanOrEqual(pressedAt);
    expect(Date.parse(theAlert()?.acknowledgedAtUtc as string)).toBeLessThanOrEqual(Date.now());

    await settle();
    emails.length = 0;
    texts.length = 0;
    await service.tick(start + minutes(31));
    // Arben is not told, and Besa, who pressed it, is not told that she did.
    expect(emails).toEqual([]);
    expect(texts).toEqual([]);
    expect(outbox.rows.filter((row) => row.contactName === "Arben Hoxha").map((row) => row.error)).toEqual(Array(2).fill("Someone acknowledged the alert before this was sent."));
  });

  it("writes it in the account's audit trail as done with the link, naming the person it was sent to", async () => {
    await criticalTank();
    await links.acknowledge(linkIn(emails[0]?.body));
    expect(acknowledgements()).toHaveLength(1);
    expect(acknowledgements()[0]).toMatchObject({
      actor: "Link in an alert message (Besa Krasniqi, besa@client-farm.example)",
      reason: "Alert acknowledged with the link in an alert message sent to Besa Krasniqi, besa@client-farm.example.",
      entityId: theAlert()?.id
    });
  });

  it("writes a contact's address in the audit trail on one line, without the invisible characters it may have been typed with", async () => {
    await config.setContacts(client.tenantId, [{ name: "Besa Krasniqi", email: "besa\u202e\u200b@client-farm.example", phone: "+355691111111" }]);
    await criticalTank();
    await links.acknowledge(linkIn(emails[0]?.body));
    expect(acknowledgements()[0]).toMatchObject({
      actor: "Link in an alert message (Besa Krasniqi, besa@client-farm.example)",
      reason: "Alert acknowledged with the link in an alert message sent to Besa Krasniqi, besa@client-farm.example."
    });
  });

  it("gives the next person a link of their own, and tells the others who took it", async () => {
    const start = await criticalTank();
    await service.tick(start + minutes(30) + 1_000);
    const arbens = emails.find((email) => email.to === "arben@client-farm.example");
    expect(arbens?.subject).toBe(`Act now, not acknowledged: Tank level is critical, ${provisioned.site.name}`);
    expect(linkIn(arbens?.body)).not.toBe(linkIn(emails[0]?.body));
    emails.length = 0;

    await links.acknowledge(linkIn(arbens?.body));
    await settle();
    await service.tick(start + minutes(31));
    expect(emails.map((email) => `${email.to}: ${email.body.split("\n")[0]?.replace(/at \d\d:\d\d/, "at hh:mm")}`)).toEqual([
      "besa@client-farm.example: Acknowledged by Arben Hoxha at hh:mm. The message will not go on to anyone else."
    ]);
    expect(acknowledgements()[0]?.actor).toBe("Link in an alert message (Arben Hoxha, arben@client-farm.example)");
  });

  it("answers the same when it is pressed twice, and changes nothing the second time", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    const first = await links.acknowledge(token);
    const acknowledgedAt = theAlert()?.acknowledgedAtUtc;
    expect(await links.acknowledge(token)).toEqual(first);
    expect(theAlert()?.acknowledgedAtUtc).toBe(acknowledgedAt);
    expect(acknowledgements()).toHaveLength(1);
  });

  it("says an alert has cleared, and leaves it cleared, rather than calling the press an error", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    await tank(80);
    expect(theAlert()?.status).toBe("resolved");
    expect(await links.acknowledge(token)).toMatchObject({ valid: true, alert: { state: "cleared" } });
    expect(theAlert()?.status).toBe("resolved");
    expect(acknowledgements()).toEqual([]);
  });

  it("starts the messages again from the first person when the alert comes back after it was acknowledged with the link", async () => {
    await criticalTank();
    await links.acknowledge(linkIn(emails[0]?.body));
    await tank(80);
    await tank(4);
    expect(theAlert()?.status).toBe("open");
    emails.length = 0;
    await service.tick(Date.now() + 1_000);
    expect(emails.map((email) => `${email.to} ${email.subject?.split(":")[0]}`)).toEqual(["besa@client-farm.example Act now"]);
  });

  it("gives one answer, and the same, for a link that is altered, expired or for an alert that is not there", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    const altered = `${token.slice(0, 20)}${token[20] === "A" ? "B" : "A"}${token.slice(21)}`;
    const nowhere = ackToken(options.ackLinkKey as Buffer, { alertId: "0b7c3f1e-4b7a-4c3e-9f10-2a6b8c4d5e01", tenantId: client.tenantId }, Date.now() + ACK_LINK_LIFETIME_MS) as string;
    const answers = [links.view(altered), links.view(token, Date.now() + ACK_LINK_LIFETIME_MS + minutes(1)), links.view(nowhere), await links.acknowledge(altered), await links.acknowledge(nowhere)];
    expect(answers).toEqual(Array(5).fill({ valid: false }));
    expect(theAlert()?.status).toBe("open");
  });

  it("reaches nothing of another account: not its alerts, and not with this account's link", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    const { tenant, owner } = await platform.createTenant({ name: "Other Farm", domain: "other-farm.example", ownerName: "O", ownerEmail: "owner@other-farm.example" }, PLATFORM_ADMIN);
    const other: Principal = { tenantId: tenant.id, userId: owner.id, role: "owner", email: owner.email, isPlatformAdmin: false };
    const theirs = await provisionSite(platform, other, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    await sendReadings(platform, other, theirs, [{ name: "water.tank.level.percent", value: 3 }]);
    const theirAlert = platform.listAlerts(other, theirs.site.id)[0];

    // A link made for their alert in this account, or for this alert in theirs, is no link.
    const key = options.ackLinkKey as Buffer;
    expect(links.view(ackToken(key, { alertId: theirAlert?.id as string, tenantId: client.tenantId }, Date.now() + minutes(60)) as string)).toEqual({ valid: false });
    expect(links.view(ackToken(key, { alertId: theAlert()?.id as string, tenantId: tenant.id }, Date.now() + minutes(60)) as string)).toEqual({ valid: false });
    expect(platform.alertLinkView(tenant.id, theAlert()?.id as string)).toBeUndefined();
    expect(await platform.acknowledgeAlertByLink(client.tenantId, theirAlert?.id as string, undefined)).toBeUndefined();

    await links.acknowledge(token);
    expect(platform.listAlerts(other, theirs.site.id)[0]?.status).toBe("open");
    expect(platform.listAudit(other).some((event) => event.eventType === "alert.acknowledged")).toBe(false);
  });

  it("does nothing for an account that has been suspended", async () => {
    await criticalTank();
    const token = linkIn(emails[0]?.body);
    await platform.updateTenantStatus(client.tenantId, "suspended", PLATFORM_ADMIN);
    expect(links.view(token)).toEqual({ valid: false });
    expect(await links.acknowledge(token)).toEqual({ valid: false });
    expect(theAlert()?.status).toBe("open");
  });

  it("is left out of messages when there is no web address for it, or no key to sign it, and nothing else is lost", async () => {
    const withoutAddress = new NotificationsService(platform, config, new MemoryOutboxStore(), { email: { send: async (message) => (emails.push(message), { ok: true as const }) }, problems: [] }, { autoSend: false, ackLinkKey: options.ackLinkKey });
    const withoutKey = new NotificationsService(platform, config, new MemoryOutboxStore(), { email: { send: async (message) => (emails.push(message), { ok: true as const }) }, problems: [] }, { webUrl: WEB, autoSend: false });
    await tank(5);
    const alert = theAlert();
    for (const notifier of [withoutAddress, withoutKey]) {
      await notifier.onAlertEvents([{ type: "opened", atMs: Date.now(), alert: { ...(alert as NonNullable<typeof alert>) }, siteName: provisioned.site.name }], Date.now());
      await notifier.tick(Date.now());
    }
    const [noAddress, noKey] = emails.filter((email) => email.subject?.startsWith("Act now")).slice(-2);
    expect(noAddress?.body).not.toContain("http");
    expect(noAddress?.body).toContain("When you have seen it and are acting, press Acknowledge there. That stops the message going on to the next person.");
    expect(noKey?.body).toContain(`Open the alert in Greecon: ${WEB}/alerts`);
    expect(noKey?.body).not.toContain("/ack/");
  });
});
