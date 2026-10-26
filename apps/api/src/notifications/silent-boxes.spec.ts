import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS, GREECON_DOMAIN, GatewayHeartbeat } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "../platform/platform.service";
import { PLATFORM_ADMIN, minutes, onboardClient, provisionSite } from "../platform/test-support";
import { OutgoingEmail } from "./channels";
import { NotificationConfig } from "./config";
import { AlertSource, NotificationsService } from "./notifications.service";
import { MemoryOutboxStore } from "./outbox";
import { QuietBox, STORM_SETTLE_MS, silenceKey, silenceOfKey, silencesToTell, togetherKey } from "./silent-boxes";

// Greecon's own team hears at once when a customer's box goes silent: once for each silence, as one message when many go
// silent together, never at night, never once the box is back, and never to the customer.

const TEAM = "team-greecon";
const CUSTOMER = "customer-1";
const NOON = Date.parse("2026-10-19T10:00:00Z"); // 12:00 in Tirane
const OFFLINE_AFTER = minutes(15);

const gatewayId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function quietBox(n: number, lastSeenMs: number, nowMs: number, overrides: Partial<QuietBox> = {}): QuietBox {
  return {
    tenantId: CUSTOMER,
    client: n % 2 === 0 ? "Vlora Farm" : "Hotel Adriatik Ltd",
    siteId: `site-${n}`,
    site: `Site ${n}`,
    gatewayId: gatewayId(n),
    box: `Box ${n}`,
    status: nowMs - lastSeenMs > OFFLINE_AFTER ? "offline" : "late",
    lastSeenUtc: new Date(lastSeenMs).toISOString(),
    silentSinceMs: lastSeenMs,
    lastReadingAtUtc: new Date(lastSeenMs - 20_000).toISOString(),
    outOfDateAlertIds: [],
    ...overrides
  };
}

describe("what to tell, of boxes that have gone silent", () => {
  const at = NOON + OFFLINE_AFTER + 1_000;

  it("names a silence by its box and its last word, and reads it back from every message keyed after it", () => {
    const box = quietBox(7, NOON, NOON);
    const named = { gatewayId: gatewayId(7), lastSeenMs: NOON };
    expect(silenceOfKey(silenceKey(box))).toEqual(named);
    expect(silenceOfKey(`${silenceKey(box)}:contact-1`)).toEqual(named);
    expect(silenceOfKey(togetherKey(box, "contact-1"))).toEqual(named);
    expect(silenceOfKey("chain:a-1:g0:c-1:email")).toBeUndefined();
  });

  it("tells one box on its own, at once, when nothing else has stopped", () => {
    const box = quietBox(1, NOON, at);
    expect(silencesToTell([box], [box], at)).toEqual([{ together: false, boxes: [box] }]);
  });

  it("tells three that stopped within ten minutes of each other as one", () => {
    const boxes = [quietBox(1, NOON, at), quietBox(2, NOON - minutes(4), at), quietBox(3, NOON - minutes(9), at)];
    const told = silencesToTell(boxes, boxes, at);
    expect(told).toHaveLength(1);
    expect(told[0]?.together).toBe(true);
    expect(told[0]?.boxes.map((box) => box.gatewayId)).toEqual([gatewayId(3), gatewayId(2), gatewayId(1)]);
  });

  it("tells silences that began more than ten minutes apart each on its own", () => {
    const boxes = [quietBox(1, NOON, at), quietBox(2, NOON - minutes(11), at), quietBox(3, NOON - minutes(30), at)];
    expect(silencesToTell(boxes, boxes, at).map((telling) => telling.together)).toEqual([false, false, false]);
  });

  it("waits a moment when another box stopped at the same time and is about to be silent too, and no longer than that", () => {
    const silent = [quietBox(1, NOON, at), quietBox(2, NOON + 10_000, at)];
    const late = quietBox(3, NOON + 20_000, at);
    expect(late.status).toBe("late");
    expect(silencesToTell(silent, [...silent, late], at)).toEqual([]);
    expect(silencesToTell(silent, [...silent, late], NOON + OFFLINE_AFTER + STORM_SETTLE_MS).map((telling) => telling.together)).toEqual([false, false]);
  });

  it("does not wait for a box that went quiet long after", () => {
    const box = quietBox(1, NOON, at);
    const later = quietBox(2, NOON + minutes(6), at);
    expect(silencesToTell([box], [box, later], at)).toEqual([{ together: false, boxes: [box] }]);
  });
});

class Source implements AlertSource {
  boxes: QuietBox[] = [];
  graceUntil: number | undefined;
  alertById() {
    return undefined;
  }
  openAlertsAcrossTenants() {
    return [];
  }
  tenantNameOf(tenantId: string) {
    return tenantId === TEAM ? "Greecon" : "Hotel Adriatik Ltd";
  }
  digestOf() {
    return { customer: "x", sites: [] };
  }
  setAlertListener() {}
  isTenantActive() {
    return true;
  }
  isOperatorTenant(tenantId: string) {
    return tenantId === TEAM;
  }
  restartGraceUntil(nowMs: number) {
    return this.graceUntil !== undefined && nowMs < this.graceUntil ? this.graceUntil : undefined;
  }
  /** A box is quiet once it has not reported for two minutes, and silent after fifteen; one that has reported is not here. */
  quietBoxes(nowMs: number): QuietBox[] {
    return this.boxes.filter((box) => nowMs - box.silentSinceMs > 120_000).map((box) => ({ ...box, status: nowMs - box.silentSinceMs > OFFLINE_AFTER ? "offline" : "late" }));
  }
  silent(n: number, lastSeenMs: number, overrides: Partial<QuietBox> = {}): void {
    this.boxes = [...this.boxes.filter((box) => box.gatewayId !== gatewayId(n)), quietBox(n, lastSeenMs, lastSeenMs, overrides)];
  }
  reported(n: number): void {
    this.boxes = this.boxes.filter((box) => box.gatewayId !== gatewayId(n));
  }
}

describe("telling Greecon's own team", () => {
  let source: Source;
  let config: NotificationConfig;
  let outbox: MemoryOutboxStore;
  let sent: OutgoingEmail[];
  let service: NotificationsService;

  const build = () =>
    new NotificationsService(source, config, outbox, { email: { send: async (message) => (sent.push(message), { ok: true as const }) }, problems: [] }, { webUrl: "https://app.greecon.example", autoSend: false });

  beforeEach(async () => {
    source = new Source();
    config = new NotificationConfig(new DatabaseService());
    outbox = new MemoryOutboxStore();
    sent = [];
    // The customer's list comes first, so that nothing finds the team's list by luck.
    await config.setContacts(CUSTOMER, [{ name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355692222222" }]);
    await config.setContacts(TEAM, [
      { name: "Eridon Manuka", email: "eridon@greecon.example" },
      { name: "Project Manager", email: "pm@greecon.example", phone: "+355691111111" }
    ]);
    service = build();
  });

  const teamMail = () => sent.filter((message) => message.to.endsWith("@greecon.example"));

  it("tells each person on Greecon's own list, by email, the moment a box goes silent: which client, which site, since when, the last reading", async () => {
    source.silent(1, NOON);
    await service.tick(NOON + minutes(14));
    expect(sent).toEqual([]);

    await service.tick(NOON + OFFLINE_AFTER + 1_000);
    expect(sent.map((message) => message.to).sort()).toEqual(["eridon@greecon.example", "pm@greecon.example"]);
    const [message] = sent;
    expect(message?.subject).toBe("Box silent: Hotel Adriatik Ltd, Site 1");
    expect(message?.body).toContain("The box at Hotel Adriatik Ltd, Site 1 has gone silent: it has not reported since 12:00 on Mon 19 Oct (Europe/Tirane), 15 minutes ago.");
    expect(message?.body).toContain("Box: Box 1");
    expect(message?.body).toContain("Last reading: 11:59 on Mon 19 Oct");
    expect(message?.body).toContain("No customer message has been sent for this.");
    expect(message?.body).toContain("Open Greecon: https://app.greecon.example/today");
    expect(message?.body).toContain("It is not sent to any customer.");
    expect(outbox.rows.filter((row) => row.tenantId === TEAM).every((row) => row.kind === "box_silent" && row.channel === "email")).toBe(true);
  });

  it("never tells the customer's own people", async () => {
    source.silent(1, NOON);
    await service.tick(NOON + minutes(16));
    expect(sent.some((message) => message.to === "besa@hotel.example")).toBe(false);
    expect(outbox.rows.filter((row) => row.tenantId === CUSTOMER)).toEqual([]);
  });

  it("says when the customer's own people have been told that the site's readings are out of date", async () => {
    const [row] = await outbox.plan(
      CUSTOMER,
      [{ alertId: "al-1", contactId: "c-besa", contactName: "Besa Krasniqi", channel: "email", kind: "alert", priority: "check_today", body: "Check today", dueAtMs: NOON + minutes(5), dedupeKey: "chain:al-1:g0:c-besa:email" }],
      NOON + minutes(5)
    );
    await outbox.markSent(row?.id as string, NOON + minutes(6), "besa@hotel.example");
    source.silent(1, NOON, { outOfDateAlertIds: ["al-1"] });
    await service.tick(NOON + minutes(16));
    expect(teamMail()[0]?.body).toContain("The customer's people were told at 12:06 that the site's readings are out of date.");
    expect(teamMail()[0]?.body).not.toContain("No customer message");
  });

  it("does not tell the same silence twice, in a later round or after a restart", async () => {
    source.silent(1, NOON);
    await service.tick(NOON + minutes(16));
    await service.tick(NOON + minutes(30));
    await build().tick(NOON + minutes(90));
    expect(teamMail()).toHaveLength(2);
  });

  it("tells a box that reported and later went silent again, because that is a new silence", async () => {
    source.silent(1, NOON);
    await service.tick(NOON + minutes(16));
    source.reported(1);
    await service.tick(NOON + minutes(20));
    source.silent(1, NOON + minutes(40));
    await service.tick(NOON + minutes(56));
    expect(teamMail().map((message) => message.subject)).toEqual(Array(4).fill("Box silent: Hotel Adriatik Ltd, Site 1"));
  });

  it("does not tell a box again among others that go silent soon after it", async () => {
    source.silent(1, NOON);
    source.silent(2, NOON + minutes(4));
    source.silent(3, NOON + minutes(5));
    await service.tick(NOON + OFFLINE_AFTER + 1_000);
    await service.tick(NOON + minutes(20) + 1_000);
    await service.tick(NOON + minutes(40));
    expect(teamMail().map((message) => message.subject?.replace("Box silent: ", "")).sort()).toEqual(
      ["Hotel Adriatik Ltd, Site 1", "Hotel Adriatik Ltd, Site 1", "Hotel Adriatik Ltd, Site 3", "Hotel Adriatik Ltd, Site 3", "Vlora Farm, Site 2", "Vlora Farm, Site 2"]
    );
  });

  it("sends one message when many boxes go silent together, and says what that means", async () => {
    for (const n of [1, 2, 3, 4]) source.silent(n, NOON + n * 5_000);
    // The first round sees two of them silent and two only late: it waits a moment for the others.
    await service.tick(NOON + OFFLINE_AFTER + 12_000);
    expect(sent).toEqual([]);
    await service.tick(NOON + OFFLINE_AFTER + 30_000);
    await service.tick(NOON + minutes(40));
    expect(teamMail()).toHaveLength(2);
    const [message] = teamMail();
    expect(message?.subject).toBe("4 boxes have gone silent at the same time");
    expect(message?.body).toContain("4 boxes have gone silent at the same time, the first at 12:00 on Mon 19 Oct (Europe/Tirane). This looks like Greecon's platform or a provider outage, not 4 customers.");
    expect(message?.body).toContain("Vlora Farm, Site 2, box Box 2: silent since 12:00. No customer message has been sent for this.");
    // Each box has a line of its own in the log, saying it was told together with the others.
    const lines = outbox.rows.filter((row) => row.tenantId === TEAM && row.status === "skipped");
    expect(lines.map((row) => row.dedupeKey).sort()).toEqual([1, 2, 3, 4].map((n) => silenceKey({ gatewayId: gatewayId(n), lastSeenUtc: new Date(NOON + n * 5_000).toISOString() })).sort());
    expect(lines.every((row) => row.error === "Told in one message about the 4 boxes that went silent at the same time.")).toBe(true);
  });

  it("holds a message through the team's quiet hours, and sends it in the morning if the box is still silent", async () => {
    const evening = Date.parse("2026-10-19T21:00:00Z"); // 23:00 in Tirane
    source.silent(1, evening);
    await service.tick(evening + minutes(16));
    expect(sent).toEqual([]);
    const morning = Date.parse("2026-10-20T05:00:00Z"); // 07:00 in Tirane
    // Planned for the morning, not planned for now and turned back: the quiet hours are kept where it is planned too.
    expect(outbox.rows.map((row) => `${row.status} ${row.dueAtMs === morning} ${row.error ?? "-"}`)).toEqual(["planned true -", "planned true -"]);
    await service.tick(morning - 60_000);
    expect(sent).toEqual([]);
    await service.tick(morning);
    expect(teamMail()).toHaveLength(2);
    expect(teamMail()[0]?.body).toContain("since 23:00 on Mon 19 Oct (Europe/Tirane), 8 hours ago.");
  });

  it("holds a message that was due before the quiet hours and could only be sent after they began", async () => {
    const lateEvening = Date.parse("2026-10-19T19:55:00Z"); // 21:55 in Tirane
    source.silent(1, lateEvening - minutes(16));
    // The email service is down for a few minutes, so both tries wait until the quiet hours have begun.
    let refusals = 2;
    const refusing = { send: async (message: OutgoingEmail) => (refusals-- > 0 ? { ok: false as const, transient: true, error: "The email service answered 503: unavailable" } : (sent.push(message), { ok: true as const })) };
    service = new NotificationsService(source, config, outbox, { email: refusing, problems: [] }, { webUrl: "https://app.greecon.example", autoSend: false });
    await service.tick(lateEvening);
    expect(sent).toEqual([]);
    await service.tick(lateEvening + minutes(10)); // 22:05: due again, and quiet
    expect(sent).toEqual([]);
    expect(outbox.rows.map((row) => row.error)).toEqual(["Held until the quiet hours end.", "Held until the quiet hours end."]);
    await service.tick(Date.parse("2026-10-20T05:00:00Z"));
    expect(teamMail()).toHaveLength(2);
  });

  it("does not send it in the morning if the box came back in the night", async () => {
    const evening = Date.parse("2026-10-19T21:00:00Z");
    source.silent(1, evening);
    await service.tick(evening + minutes(16));
    source.reported(1);
    await service.tick(Date.parse("2026-10-20T05:00:00Z"));
    expect(sent).toEqual([]);
    expect(outbox.rows.filter((row) => row.tenantId === TEAM).map((row) => row.error)).toEqual(["The box reported again before this was sent.", "The box reported again before this was sent."]);
  });

  it("holds what was planned while the platform is in its grace after a start, and sends it after if the box is still silent", async () => {
    source.silent(1, NOON);
    source.graceUntil = NOON + minutes(25);
    await service.tick(NOON + minutes(16));
    expect(sent).toEqual([]);
    await service.tick(NOON + minutes(25));
    expect(teamMail()).toHaveLength(2);
  });

  it("says nothing when Greecon's own list has nobody on it", async () => {
    await config.setContacts(TEAM, []);
    source.silent(1, NOON);
    await service.tick(NOON + minutes(16));
    expect(sent).toEqual([]);
    expect(outbox.rows).toEqual([]);
  });

  it("leaves a silence that began more than a day ago to the morning message and the fleet", async () => {
    source.silent(1, NOON - 25 * 3_600_000);
    await service.tick(NOON);
    expect(sent).toEqual([]);
  });
});

describe("telling Greecon's own team, with the real platform", () => {
  let platform: PlatformService;
  let client: Principal;
  let config: NotificationConfig;
  let service: NotificationsService;
  let sent: OutgoingEmail[];
  let siteName: string;

  const heartbeat = (atMs: number): GatewayHeartbeat => ({ agentVersion: "1.2.3", uptimeSeconds: 60, sentAtUtc: new Date(atMs).toISOString(), bufferDepth: 0, configVersion: "c1", devices: [] });

  async function boxAt(principal: Principal, commissioned: boolean, lastSeenMs: number): Promise<{ siteId: string; gatewayId: string; siteName: string }> {
    const provisioned = await provisionSite(platform, principal, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    const box = await platform.provisionGateway({ siteId: provisioned.site.id, name: "Plant room" }, principal);
    await platform.completeGatewayEnrolment(box.id, principal.tenantId, principal.userId, lastSeenMs - minutes(60));
    await platform.recordGatewayHeartbeat(box.id, principal.tenantId, heartbeat(lastSeenMs), lastSeenMs);
    if (commissioned) await platform.setSetupConfirmation(provisioned.site.id, "commissioned", { atUtc: new Date(lastSeenMs - 86_400_000).toISOString(), by: "pm@greecon.earth" }, principal);
    return { siteId: provisioned.site.id, gatewayId: box.id, siteName: provisioned.site.name };
  }

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());
    client = await onboardClient(platform);
    const { tenant } = await platform.createTenant({ name: "Greecon", domain: GREECON_DOMAIN, ownerName: "Founder", ownerEmail: "founder@greecon.earth" }, PLATFORM_ADMIN);
    config = new NotificationConfig(new DatabaseService());
    await config.setContacts(tenant.id, [{ name: "Founder", email: "founder@greecon.earth" }]);
    await config.setSettings(tenant.id, { ...DEFAULT_NOTIFICATION_SETTINGS, digestEnabled: false });
    sent = [];
    service = new NotificationsService(platform, config, new MemoryOutboxStore(), { email: { send: async (message) => (sent.push(message), { ok: true as const }) }, problems: [] }, { webUrl: "https://app.greecon.example", autoSend: false });
    siteName = (await boxAt(client, true, NOON)).siteName;
  });

  it("tells the team when a live site's box has been silent for fifteen minutes, by the fleet's own measure", async () => {
    await service.tick(NOON + minutes(14));
    expect(sent).toEqual([]);
    await service.tick(NOON + minutes(16));
    expect(sent.map((message) => `${message.to} ${message.subject}`)).toEqual([`founder@greecon.earth Box silent: Client Farm Ltd, ${siteName}`]);
    expect(sent[0]?.body).toContain("Last reading: none has arrived yet");
    expect(platform.fleet(PLATFORM_ADMIN, NOON + minutes(16)).find((row) => row.site === siteName)?.box.status).toBe("offline");
  });

  it("leaves out a site still being set up, a suspended customer and the demo", async () => {
    await boxAt(client, false, NOON - minutes(30));
    const other = await platform.createTenant({ name: "Left Farm", domain: "left-farm.example", ownerName: "O", ownerEmail: "owner@left-farm.example" }, PLATFORM_ADMIN);
    const leftClient: Principal = { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
    await boxAt(leftClient, true, NOON - minutes(30));
    await platform.updateTenantStatus(other.tenant.id, "suspended", PLATFORM_ADMIN);

    expect(platform.quietBoxes(NOON + minutes(16)).map((box) => `${box.client}: ${box.site}`)).toEqual([`Client Farm Ltd: ${siteName}`]);
    await service.tick(NOON + minutes(16));
    expect(sent.map((message) => message.subject)).toEqual([`Box silent: Client Farm Ltd, ${siteName}`]);
  });

  it("says nothing inside the grace after the platform's own start, and tells the team once it is over if the box is still silent", async () => {
    platform.markStartedListening(NOON + minutes(5));
    await service.tick(NOON + minutes(16));
    expect(sent).toEqual([]);
    // Silence is counted from the moment the platform started listening: fifteen minutes from then.
    await service.tick(NOON + minutes(19));
    expect(sent).toEqual([]);
    await service.tick(NOON + minutes(21));
    expect(sent.map((message) => message.subject)).toEqual([`Box silent: Client Farm Ltd, ${siteName}`]);
  });
});
