import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_TENANT_ID, TelemetryMessage } from "@greecon/shared";
import { Principal } from "../common/principal";
import { DatabaseService } from "../database/database.service";
import { PlatformService } from "./platform.service";
import { DEMO_OWNER, PLATFORM_ADMIN } from "./test-support";

// One customer must never see, change or learn of another's data. This leaked once (the Overview
// summed every tenant), so it is pinned for the whole service surface, not just the one route that
// failed. Tenant A is the demo tenant, which holds a rich set of seeded records; tenant B is a freshly
// onboarded client. Every read B can make must contain none of A's identifiers, every attempt by B
// to touch A's records must be refused and leave A unchanged, and any new method that takes a
// principal must be listed here on purpose (the guard at the bottom fails otherwise).

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const identifiersIn = (value: unknown): Set<string> => new Set(JSON.stringify(value).match(UUID) ?? []);

describe("tenant isolation across the service", () => {
  let platform: PlatformService;
  let b: Principal;
  let aIds: Set<string>;
  let mine: { site: string; device: string; point: string };

  // The identifiers of tenant A's records that B will try to reach.
  const a = {
    site: "22222222-2222-4222-8222-222222222202",
    asset: "33333333-3333-4333-8333-333333333304",
    device: "44444444-4444-4444-8444-444444444404",
    rule: "88888888-8888-4888-8888-888888888801",
    alert: "99999999-9999-4999-8999-999999999901",
    incident: "abababab-abab-4aba-8aba-ababababab01",
    task: "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcd01"
  };
  let aPoint = "";
  let aCommand = "";
  let aGateway = "";
  let aUser = "";

  beforeEach(async () => {
    platform = new PlatformService(new DatabaseService());

    // Give tenant A a gateway and a command too, so there is something to reach for.
    aGateway = (await platform.createGateway({ siteId: a.site, name: "Canary gateway" }, DEMO_OWNER)).gateway.id;
    aPoint = platform.listPoints(DEMO_OWNER).find((point) => point.canonicalName === "water.pump.command")?.id as string;
    const pumpPoint = platform.listPoints(DEMO_OWNER).find((point) => point.id === aPoint);
    aCommand = (
      await platform.createCommand(
        { siteId: pumpPoint?.siteId as string, targetDeviceId: pumpPoint?.deviceId as string, targetPointId: aPoint, requestedValue: "OFF", reason: "Canary command" },
        DEMO_OWNER
      )
    ).id;
    aUser = platform.listUsers(DEMO_OWNER)[0]?.id as string;

    const created = await platform.createTenant(
      { name: "Isolation Farm Ltd", domain: "isolation-farm.example", ownerName: "B Owner", ownerEmail: "owner@isolation-farm.example" },
      PLATFORM_ADMIN
    );
    b = { tenantId: created.tenant.id, userId: created.owner.id, role: "owner", email: created.owner.email, isPlatformAdmin: false };

    const site = await platform.createSite({ name: "B's own site", type: "integrated_site", locationName: "B" }, b);
    const device = await platform.createDevice({ siteId: site.id, name: "B controller", deviceType: "plc", protocol: "simulated", driverType: "simulator" }, b);
    const point = await platform.createPoint(
      { siteId: site.id, deviceId: device.id, canonicalName: "water.tank.level.percent", label: "Tank", unit: "%", capability: "read" },
      b
    );
    mine = { site: site.id, device: device.id, point: point.id };

    // Everything tenant A holds, as A sees it: the identifiers that must never reach B.
    aIds = new Set<string>([DEMO_TENANT_ID]);
    const asA = [
      platform.overview(DEMO_OWNER),
      platform.listSites(DEMO_OWNER),
      platform.siteDetail(a.site, DEMO_OWNER),
      platform.listAssets(DEMO_OWNER),
      platform.listDevices(DEMO_OWNER),
      platform.listPoints(DEMO_OWNER),
      platform.listGateways(DEMO_OWNER),
      platform.latestTelemetry(DEMO_OWNER),
      platform.listDerivedStates(DEMO_OWNER),
      platform.listRules(DEMO_OWNER),
      platform.listCommands(DEMO_OWNER),
      platform.listAlerts(DEMO_OWNER),
      platform.listIncidents(DEMO_OWNER),
      platform.listMaintenance(DEMO_OWNER),
      platform.listAudit(DEMO_OWNER),
      platform.listUsers(DEMO_OWNER),
      await platform.valueSummary(DEMO_OWNER),
      platform.siteProfile(a.site, DEMO_OWNER)
    ];
    for (const value of asA) for (const id of identifiersIn(value)) aIds.add(id);
    // The Greecon staff member who onboarded tenant B acts inside it by design: their user id is in
    // B's audit trail (it is who created B's account), so it is not a leak.
    aIds.delete(PLATFORM_ADMIN.userId);
  });

  const leaked = (value: unknown) => [...identifiersIn(value)].filter((id) => aIds.has(id));

  it("shows tenant B none of tenant A's identifiers in any read", async () => {
    const reads: Array<[string, unknown]> = [
      ["session", platform.session(b)],
      ["getDashboardPreferences", await platform.getDashboardPreferences(b)],
      ["listTenants", platform.listTenants(b)],
      ["listUsers", platform.listUsers(b)],
      ["overview", platform.overview(b)],
      ["listSites", platform.listSites(b)],
      ["listAssets", platform.listAssets(b)],
      ["listAssets(A's site)", platform.listAssets(b, a.site)],
      ["listDevices", platform.listDevices(b)],
      ["listDevices(A's site)", platform.listDevices(b, a.site)],
      ["listPoints", platform.listPoints(b)],
      ["listPoints(A's device)", platform.listPoints(b, a.device)],
      ["listGateways", platform.listGateways(b)],
      ["listGateways(A's site)", platform.listGateways(b, a.site)],
      ["telemetryHistory", await platform.telemetryHistory(b, undefined, 24)],
      ["latestTelemetry", platform.latestTelemetry(b)],
      ["latestTelemetry(A's site)", platform.latestTelemetry(b, a.site)],
      ["listDerivedStates", platform.listDerivedStates(b)],
      ["listDerivedStates(A's site)", platform.listDerivedStates(b, a.site)],
      ["listRules", platform.listRules(b)],
      ["listRules(A's site)", platform.listRules(b, a.site)],
      ["simulateRules", platform.simulateRules(b)],
      ["simulateRules(A's site)", platform.simulateRules(b, a.site)],
      ["listCommands", platform.listCommands(b)],
      ["listAlerts", platform.listAlerts(b)],
      ["listAlerts(A's site)", platform.listAlerts(b, a.site)],
      ["listIncidents", platform.listIncidents(b)],
      ["listMaintenance", platform.listMaintenance(b)],
      ["listAudit", platform.listAudit(b)],
      ["listAudit(A's site)", platform.listAudit(b, a.site)],
      ["valueSummary", await platform.valueSummary(b)],
      ["siteProfile(B's site)", platform.siteProfile(mine.site, b)],
      ["siteValue(B's site)", await platform.siteValue(mine.site, "month", b)],
      ["siteSetupRecord(B's site)", platform.siteSetupRecord(mine.site, b)]
    ];

    for (const [name, result] of reads) {
      expect(leaked(result), `${name} leaked another tenant's identifiers`).toEqual([]);
    }
    // B does see its own records, so the checks above are not passing on empty answers.
    expect(platform.listSites(b).map((site) => site.id)).toEqual([mine.site]);
  });

  it("refuses tenant B any attempt to open, change or delete tenant A's records, and leaves them unchanged", async () => {
    const before = JSON.stringify([
      platform.listSites(DEMO_OWNER),
      platform.listAssets(DEMO_OWNER),
      platform.listDevices(DEMO_OWNER),
      platform.listPoints(DEMO_OWNER),
      platform.listGateways(DEMO_OWNER),
      platform.listRules(DEMO_OWNER),
      platform.listAlerts(DEMO_OWNER),
      platform.listCommands(DEMO_OWNER),
      platform.listIncidents(DEMO_OWNER),
      platform.listMaintenance(DEMO_OWNER),
      platform.listUsers(DEMO_OWNER)
    ]);

    const attempts: Array<[string, () => unknown]> = [
      ["siteDetail", () => platform.siteDetail(a.site, b)],
      ["telemetryHistory(A's site)", () => platform.telemetryHistory(b, a.site, 24)],
      ["updateSite", () => platform.updateSite(a.site, { name: "Taken" }, b)],
      ["deleteSite", () => platform.deleteSite(a.site, b)],
      ["createAsset", () => platform.createAsset({ siteId: a.site, name: "Intruder", type: "WaterSystem" }, b)],
      ["updateAsset", () => platform.updateAsset(a.asset, { name: "Taken" }, b)],
      ["deleteAsset", () => platform.deleteAsset(a.asset, b)],
      ["createDevice", () => platform.createDevice({ siteId: a.site, name: "Intruder", deviceType: "plc", protocol: "simulated", driverType: "simulator" }, b)],
      ["updateDevice", () => platform.updateDevice(a.device, { name: "Taken" }, b)],
      ["deleteDevice", () => platform.deleteDevice(a.device, b)],
      ["createPoint", () => platform.createPoint({ siteId: a.site, deviceId: a.device, canonicalName: "water.tank.level.percent", label: "x", unit: "%", capability: "read" }, b)],
      ["updatePoint", () => platform.updatePoint(aPoint, { label: "Taken" }, b)],
      ["deletePoint", () => platform.deletePoint(aPoint, b)],
      ["createGateway", () => platform.createGateway({ siteId: a.site, name: "Intruder" }, b)],
      ["deleteGateway", () => platform.deleteGateway(aGateway, b)],
      [
        "createRule",
        () =>
          platform.createRule(
            {
              siteId: a.site,
              name: "Intruder",
              priority: "optimization",
              triggerType: "threshold",
              conditions: [],
              constraints: [],
              actions: [],
              executionMode: "simulation",
              explanationTemplate: "x",
              rollbackBehavior: "x"
            },
            b
          )
      ],
      ["updateRule", () => platform.updateRule(a.rule, { name: "Taken" }, b)],
      ["setRuleApprovalState", () => platform.setRuleApprovalState(a.rule, "approved", "x", b)],
      ["deleteRule", () => platform.deleteRule(a.rule, b)],
      ["createCommand", () => platform.createCommand({ siteId: a.site, targetDeviceId: a.device, targetPointId: aPoint, requestedValue: "OFF", reason: "x" }, b)],
      [
        "acknowledgeCommand",
        () => platform.acknowledgeCommand(aCommand, { messageType: "command_ack", commandId: aCommand, tenantId: DEMO_TENANT_ID, siteId: a.site, status: "executed", correlationId: "x", acknowledgedAtUtc: new Date().toISOString() } as never, b)
      ],
      ["acknowledgeAlert", () => platform.acknowledgeAlert(a.alert, b)],
      ["updateIncidentStatus", () => platform.updateIncidentStatus(a.incident, "closed", b)],
      ["createMaintenanceTask", () => platform.createMaintenanceTask({ siteId: a.site, title: "Intruder" }, b)],
      ["updateMaintenanceTask", () => platform.updateMaintenanceTask(a.task, { title: "Taken" }, b)],
      ["createReportExport", () => platform.createReportExport({ siteId: a.site, reportType: "operational" }, b)],
      ["updateUser", () => platform.updateUser(aUser, { status: "disabled" }, b)],
      ["resetUserPassword", () => platform.resetUserPassword(aUser, b)],
      ["recordEdgeSync", () => platform.recordEdgeSync({ siteId: a.site, gatewayId: aGateway, status: "completed", bufferedReadings: 0, startedAtUtc: new Date().toISOString() }, b)],
      [
        "ingestTelemetry",
        () => {
          const now = new Date().toISOString();
          const message: TelemetryMessage = {
            messageType: "telemetry",
            tenantId: DEMO_TENANT_ID,
            siteId: a.site,
            deviceId: a.device,
            publishedAtUtc: now,
            correlationId: "x",
            readings: [
              { timestampUtc: now, tenantId: DEMO_TENANT_ID, siteId: a.site, deviceId: a.device, pointId: aPoint, canonicalName: "water.tank.level.percent", value: 1, unit: "%", quality: "OK", source: "edge", ingestionTimestampUtc: now }
            ]
          };
          return platform.ingestTelemetry(message, b);
        }
      ],
      ["siteProfile", () => platform.siteProfile(a.site, b)],
      ["updateSiteProfile", () => platform.updateSiteProfile(a.site, { importPricePerKwh: 99 }, b)],
      ["siteValue", () => platform.siteValue(a.site, "month", b)],
      ["siteSetupRecord", () => platform.siteSetupRecord(a.site, b)],
      ["recordSiteTemplate", () => platform.recordSiteTemplate(a.site, "hotel", b)],
      ["setSetupConfirmation", () => platform.setSetupConfirmation(a.site, "direction", { atUtc: new Date().toISOString(), by: "b@x.example" }, b)],
      ["provisionGateway", () => platform.provisionGateway({ siteId: a.site, name: "Intruder" }, b)],
      // These are told which box by its credential, not by a person, so they take the account's id.
      ["completeGatewayEnrolment", () => platform.completeGatewayEnrolment(aGateway, b.tenantId, undefined)],
      [
        "recordGatewayHeartbeat",
        () => platform.recordGatewayHeartbeat(aGateway, b.tenantId, { agentVersion: "x", uptimeSeconds: 1, sentAtUtc: new Date().toISOString(), bufferDepth: 0, devices: [] })
      ],
      ["edgeConfigFor", () => platform.edgeConfigFor(aGateway, b.tenantId)],
      ["updateTenantStatus", () => platform.updateTenantStatus(DEMO_TENANT_ID, "suspended", b)],
      ["listAllTenants", () => platform.listAllTenants(b, {})],
      ["createTenant", () => platform.createTenant({ name: "x", domain: "x.example", ownerName: "x", ownerEmail: "x@x.example" }, b)]
    ];

    for (const [name, attempt] of attempts) {
      await expect(Promise.resolve().then(attempt), `${name} was not refused`).rejects.toThrow();
    }

    expect(
      JSON.stringify([
        platform.listSites(DEMO_OWNER),
        platform.listAssets(DEMO_OWNER),
        platform.listDevices(DEMO_OWNER),
        platform.listPoints(DEMO_OWNER),
        platform.listGateways(DEMO_OWNER),
        platform.listRules(DEMO_OWNER),
        platform.listAlerts(DEMO_OWNER),
        platform.listCommands(DEMO_OWNER),
        platform.listIncidents(DEMO_OWNER),
        platform.listMaintenance(DEMO_OWNER),
        platform.listUsers(DEMO_OWNER)
      ])
    ).toBe(before);
  });

  it("refuses every message of a batch that is addressed to another account's site, and changes nothing", async () => {
    const now = new Date().toISOString();
    const aMessage = (value: number): TelemetryMessage => ({
      messageType: "telemetry",
      tenantId: DEMO_TENANT_ID,
      siteId: a.site,
      deviceId: a.device,
      publishedAtUtc: now,
      correlationId: "x",
      readings: [{ timestampUtc: now, tenantId: DEMO_TENANT_ID, siteId: a.site, deviceId: a.device, pointId: aPoint, canonicalName: "water.tank.level.percent", value, unit: "%", quality: "OK", source: "edge", ingestionTimestampUtc: now }]
    });
    const before = JSON.stringify(platform.latestTelemetry(DEMO_OWNER, a.site));
    // Addressed to A with B's credentials: refused as a mismatch. Addressed to B's account but naming A's
    // records: refused as not B's.
    const results = await platform.ingestTelemetryBatch([aMessage(1), { ...aMessage(2), tenantId: b.tenantId, readings: aMessage(2).readings.map((reading) => ({ ...reading, tenantId: b.tenantId })) }], b);
    expect(results.map((result) => result.accepted)).toEqual([false, false]);
    expect(JSON.stringify(platform.latestTelemetry(DEMO_OWNER, a.site))).toBe(before);
  });

  it("does not name another account's box to anyone but its own account", () => {
    expect(platform.findGateway(aGateway, b.tenantId)).toBeUndefined();
    expect(platform.findGateway(aGateway, DEMO_TENANT_ID)?.id).toBe(aGateway);
  });

  it("does not let tenant B's readings or alerts appear for tenant A either", async () => {
    // The mirror image: B has data too, and A must not see any of it.
    await platform.ingestTelemetry(
      {
        messageType: "telemetry",
        tenantId: b.tenantId,
        siteId: mine.site,
        deviceId: mine.device,
        publishedAtUtc: new Date().toISOString(),
        correlationId: "x",
        readings: [
          {
            timestampUtc: new Date().toISOString(),
            tenantId: b.tenantId,
            siteId: mine.site,
            deviceId: mine.device,
            pointId: mine.point,
            canonicalName: "water.tank.level.percent",
            value: 4,
            unit: "%",
            quality: "OK",
            source: "edge",
            ingestionTimestampUtc: new Date().toISOString()
          }
        ]
      },
      b
    );
    const bIds = new Set<string>([b.tenantId, mine.site, mine.device, mine.point]);
    const seenByA = [platform.overview(DEMO_OWNER), platform.listAlerts(DEMO_OWNER), platform.latestTelemetry(DEMO_OWNER), platform.listAudit(DEMO_OWNER), platform.listDerivedStates(DEMO_OWNER)];
    for (const value of seenByA) expect([...identifiersIn(value)].filter((id) => bIds.has(id))).toEqual([]);
  });

  // The guard that keeps this list honest: a new public method that takes a principal has to be
  // added to the checks above, or named here with the reason it needs none.
  it("covers every service method that takes a principal", () => {
    const exercised = new Set([
      "session", "getDashboardPreferences", "listTenants", "listUsers", "overview", "listSites", "siteDetail", "listAssets", "listDevices", "listPoints",
      "listGateways", "telemetryHistory", "latestTelemetry", "listDerivedStates", "listRules", "simulateRules", "listCommands", "listAlerts", "listIncidents",
      "listMaintenance", "listAudit", "updateSite", "deleteSite", "createAsset", "updateAsset", "deleteAsset", "createDevice", "updateDevice", "deleteDevice",
      "createPoint", "updatePoint", "deletePoint", "createGateway", "deleteGateway", "createRule", "updateRule", "setRuleApprovalState", "deleteRule",
      "createCommand", "acknowledgeCommand", "acknowledgeAlert", "updateIncidentStatus", "createMaintenanceTask", "updateMaintenanceTask", "createReportExport",
      "updateUser", "resetUserPassword", "recordEdgeSync", "ingestTelemetry", "updateTenantStatus", "listAllTenants", "createTenant",
      "siteProfile", "updateSiteProfile", "siteValue", "valueSummary",
      "siteSetupRecord", "recordSiteTemplate", "setSetupConfirmation", "provisionGateway",
      // The batch route and the shared implementation behind both ingest routes.
      "ingestTelemetryBatch", "applyTelemetry"
    ]);
    // Acting only on the caller's own tenant, with nothing in the request that names another's data.
    const ownScopeOnly = new Set(["saveDashboardPreferences", "createSite", "createUser"]);

    const takingAPrincipal = Object.getOwnPropertyNames(PlatformService.prototype).filter((name) => {
      const method = (PlatformService.prototype as unknown as Record<string, unknown>)[name];
      if (typeof method !== "function" || name === "constructor") return false;
      const parameters = /^[^(]*\(([^)]*)\)/.exec(method.toString())?.[1] ?? "";
      return /\bprincipal\b/.test(parameters);
    });

    const unaccounted = takingAPrincipal.filter((name) => !exercised.has(name) && !ownScopeOnly.has(name));
    expect(unaccounted, "add these methods to the isolation checks, or to ownScopeOnly with a reason").toEqual([]);
  });
});
