import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { NotificationConfig } from "../notifications/config";
import { PlatformService } from "../platform/platform.service";
import { ProvisionedSite, onboardClient, provisionSite, sendReadings } from "../platform/test-support";
import { BYTE_ORDER_MARK } from "./csv";
import { CsvDownload, ExportsService } from "./exports.service";

async function read(download: CsvDownload): Promise<string> {
  let out = "";
  for await (const chunk of download.chunks) out += chunk;
  return out;
}

describe("taking the account's data away", () => {
  let platform: PlatformService;
  let client: Principal;
  let service: ExportsService;
  let notifications: NotificationConfig;
  let site: ProvisionedSite;

  beforeEach(async () => {
    const db = new DatabaseService();
    platform = new PlatformService(db);
    client = await onboardClient(platform);
    notifications = new NotificationConfig(db);
    service = new ExportsService(platform, db, notifications);
    site = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
  });

  const stranger = async (): Promise<Principal> => {
    const other = await platform.createTenant({ name: "Other Farm", domain: "other-farm.example", ownerName: "O", ownerEmail: "owner@other-farm.example" }, { ...client, isPlatformAdmin: true });
    return { tenantId: other.tenant.id, userId: other.owner.id, role: "owner", email: other.owner.email, isPlatformAdmin: false };
  };

  describe("readings", () => {
    it("is a spreadsheet that opens in the right alphabet, with a head row that says what each column is", async () => {
      const download = await service.readings(client, { siteId: site.site.id, days: 7, resolution: "hourly", style: "standard" }, Date.parse("2026-10-19T12:00:00Z"));
      const body = await read(download);
      expect(body.startsWith(BYTE_ORDER_MARK)).toBe(true);
      expect(body.slice(1)).toBe("hour_utc,hour_local,site,device,reading,canonical_name,average,minimum,maximum,unit,samples\r\n");
      expect(download.filename).toBe("greecon-readings-owner-client-farm-example-site-2026-10-19-hourly.csv");
    });

    it("has its own head row when every reading is asked for, and the semicolon style for European settings", async () => {
      const body = await read(await service.readings(client, { siteId: site.site.id, days: 7, resolution: "raw", style: "eu" }));
      expect(body.slice(1)).toBe("time_utc;time_local;site;device;reading;canonical_name;value;unit;quality\r\n");
    });

    it("refuses a period that is not a period, in words", async () => {
      for (const days of [0, -3, 367, Number.NaN]) {
        await expect(service.readings(client, { siteId: site.site.id, days, resolution: "hourly", style: "standard" }), String(days)).rejects.toThrow("Choose a period of 1 to 366 days.");
      }
    });

    it("gives every reading only for a month, and says to ask for hourly averages beyond that", async () => {
      await expect(service.readings(client, { siteId: site.site.id, days: 32, resolution: "raw", style: "standard" })).rejects.toThrow(
        "Every reading can be downloaded for up to 31 days. For a longer period, ask for hourly averages."
      );
      await expect(service.readings(client, { siteId: site.site.id, days: 31, resolution: "raw", style: "standard" })).resolves.toBeDefined();
    });

    it("is for the account's own sites only", async () => {
      const other = await stranger();
      await expect(service.readings(other, { siteId: site.site.id, days: 7, resolution: "hourly", style: "standard" })).rejects.toThrow(new NotFoundException("That site is not one of this account's sites."));
      expect((await platform.listAudit(other)).some((event) => event.eventType === "export.downloaded")).toBe(false);
    });

    it("is written in the account's audit trail, with who and what", async () => {
      await service.readings(client, { siteId: site.site.id, days: 7, resolution: "hourly", style: "standard" }, Date.parse("2026-10-19T12:00:00Z"));
      const event = platform.listAudit(client).find((candidate) => candidate.eventType === "export.downloaded");
      expect(event).toMatchObject({ actor: "Client Owner", siteId: site.site.id, entityType: "data_export" });
      expect(event?.reason).toBe(`Hourly averages of ${site.site.name}, 2026-10-12 to 2026-10-19.`);
    });
  });

  describe("alerts", () => {
    it("lists each alert with its priority, first step, status and times on the site's clock", async () => {
      await sendReadings(platform, client, site, [{ name: "water.tank.level.percent", value: 5 }]);
      const body = await read(await service.alerts(client, 30, "standard"));
      const [head, row] = body.slice(1).split("\r\n");
      expect(head).toBe("raised_utc,raised_local,site,priority,alert,first_step,status,acknowledged_utc,acknowledged_local,cleared_utc,cleared_local");
      expect(row).toContain("Act now");
      expect(row).toContain("Tank level is critical");
      expect(row).toContain("open");
      expect(row).toContain(site.site.name);
    });

    it("leaves out alerts older than the period, and other accounts' alerts", async () => {
      await sendReadings(platform, client, site, [{ name: "water.tank.level.percent", value: 5 }]);
      const other = await stranger();
      const theirs = await provisionSite(platform, other, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
      await sendReadings(platform, other, theirs, [{ name: "water.tank.level.percent", value: 5 }]);

      const mine = (await read(await service.alerts(client, 30, "standard"))).trim().split("\r\n");
      expect(mine).toHaveLength(2);
      expect(mine[1]).toContain(site.site.name);
      expect(mine[1]).not.toContain(theirs.site.name);

      const later = await read(await service.alerts(client, 30, "standard", Date.now() + 40 * 86_400_000));
      expect(later.trim().split("\r\n")).toHaveLength(1);
    });
  });

  describe("the audit trail", () => {
    it("says who did what, oldest first", async () => {
      await platform.acknowledgeAlert((await (async () => {
        await sendReadings(platform, client, site, [{ name: "water.tank.level.percent", value: 5 }]);
        return platform.listAlerts(client)[0];
      })())?.id as string, client);
      const lines = (await read(await service.audit(client, "standard"))).slice(1).trim().split("\r\n");
      expect(lines[0]).toBe("time_utc,who,event,entity,reason");
      expect(lines.some((line) => line.includes("alert.acknowledged") && line.includes("Client Owner"))).toBe(true);
      const times = lines.slice(1).map((line) => line.slice(0, 19));
      expect(times).toEqual([...times].sort());
    });
  });

  describe("the account as one file", () => {
    it("holds the account's setup and people, and nothing that would open the account", async () => {
      await notifications.setContacts(client.tenantId, [{ name: "Besa Krasniqi", email: "besa@client-farm.example", phone: "+355691234567" }]);
      const { filename, json } = await service.account(client, Date.parse("2026-10-19T12:00:00Z"));
      expect(filename).toBe("greecon-account-client-farm-ltd-2026-10-19.json");
      expect(json.format).toBe("greecon-account-export/1");
      expect(json.exportedAtUtc).toBe("2026-10-19T12:00:00.000Z");
      expect(json.account).toEqual({ name: "Client Farm Ltd", identifier: "client-farm.example" });
      expect(json.people).toEqual([{ name: "Client Owner", email: "owner@client-farm.example", role: "owner", status: "active" }]);
      expect((json.sites as Array<{ equipment: unknown[] }>)[0]?.equipment).toHaveLength(1);
      expect((json.whoIsTold as { people: unknown[] }).people).toEqual([{ name: "Besa Krasniqi", email: "besa@client-farm.example", phone: "+355691234567" }]);

      // The file's own explanation says passwords are left out; what is checked is the data.
      const { about, ...data } = json;
      expect(about).toContain("Passwords and the box credentials are not included.");
      const text = JSON.stringify(data).toLowerCase();
      for (const secret of ["password", "secret", "hash", "token", "enrol"]) expect(text, secret).not.toContain(secret);
    });

    it("is one account's and no other's", async () => {
      const other = await stranger();
      const { json } = await service.account(other);
      expect(json.sites).toEqual([]);
      expect(JSON.stringify(json)).not.toContain(site.site.name);
      expect(JSON.stringify(json)).not.toContain("client-farm.example");
    });

    it("is written in the audit trail", async () => {
      await service.account(client);
      expect(platform.listAudit(client).some((event) => event.eventType === "export.downloaded" && event.reason === "Everything about how the account is set up.")).toBe(true);
    });
  });

  it("cannot be turned into a formula in a spreadsheet by naming something cleverly", async () => {
    const tricky = await platform.createSite({ name: "=HYPERLINK(\"http://evil.example\",\"x\")", type: "integrated_site", locationName: "x" }, client);
    const point = await provisionSite(platform, client, [{ canonicalName: "water.tank.level.percent", unit: "%" }]);
    await sendReadings(platform, client, point, [{ name: "water.tank.level.percent", value: 5 }]);
    await platform.updateSite(point.site.id, { name: tricky.name }, client);
    const body = await read(await service.alerts(client, 30, "standard"));
    expect(body).toContain("\"'=HYPERLINK(");
    expect(body).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});
