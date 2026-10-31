import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from "@nestjs/common";
import {
  CurrencyCode,
  DeviceProposal,
  DiscoveryRequest,
  DiscoveryResult,
  DiscoveryView,
  EdgeConfig,
  EdgeGateway,
  EnrolResponse,
  EnrolmentIssued,
  ExpectedDevice,
  GREECON_PUBLIC_EMAILS,
  GatewayHeartbeat,
  HandoverDevice,
  HandoverReading,
  HandoverView,
  HeartbeatReply,
  ModbusConnection,
  NotificationContact,
  Point,
  SetupView,
  Site,
  SiteTemplate,
  TemplateDevice,
  describeConnection,
  describeIdentity,
  describeScan,
  describeSource,
  expectationOf,
  hasPermission,
  isManualSetupStep,
  isPrivateAddress,
  limitsFor,
  manualSetupSteps,
  profileByKey,
  profileForModel,
  proposeAssignments,
  rangeProblem,
  sourceFromRange,
  templateByKey,
  unitsFound,
  validateDiscoveryResult,
  validateHeartbeat
} from "@greecon/shared";
import { Principal } from "../common/principal";
import { PlatformService } from "../platform/platform.service";
import { EdgeBundleService } from "./edge-bundle";
import { ENROLMENT_VALID_FOR_MS, generateEnrolmentCode, hashEnrolmentCode, normaliseEnrolmentCode } from "./enrolment-code";
import { EnrolmentStore } from "./enrolment-store";
import { NotificationsService } from "../notifications/notifications.service";
import { LatestForSetup, SetupNotifications, computeSetup } from "./setup-checklist";

export const ENROLMENT_STORE = "ENROLMENT_STORE";

/** What setting a site up asks of the notifications: how things stand, and who is on the list. */
export interface SetupNotificationsSource {
  summary(tenantId: string): SetupNotifications;
  contacts(tenantId: string): NotificationContact[];
}

export interface CreateSiteFromTemplateInput {
  templateKey: string;
  name: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currency?: CurrencyCode;
}

export interface CreateDeviceFromProfileInput {
  siteId: string;
  profileKey: string;
  name?: string;
  assetId?: string;
  host?: string;
  port?: number;
  unitId?: number;
}

const ENROL_REFUSED = "That code has already been used, has expired, or is not one of ours. Make a new one on the site's setup page.";

/** A search the box has not answered in this long is shown as one it never picked up, and is no longer sent to it. */
const SEARCH_WAITS_FOR_MS = 10 * 60_000;
/** Asked for again within this long while the box is still looking, the person is shown the search that is under way, not a second one. */
const SEARCH_REPEAT_AFTER_MS = 2 * 60_000;
const SEARCH_KEPT_FOR_MS = 24 * 3_600_000;

/** A search for equipment on one box's network: what was asked, who asked, and what the box said. Kept in memory: a result is only
 * useful for the minutes it takes to act on it, and a platform that restarts in between just asks again. */
interface Search {
  request: DiscoveryRequest;
  requestedAtMs: number;
  /** The person who pressed the button: the addresses that are filled in are filled in as them, and the audit trail says so. */
  requestedBy: Principal;
  result?: DiscoveryResult;
}

/** The steps whose confirmation must say who and when, because the paper behind them is somewhere else and this is the only record. */
const NOTE_REQUIRED: Readonly<Record<string, string>> = {
  paperwork: "Write who signed for the customer and on what date, so it is written down here.",
  electrician: "Write the electrician's name and licence number, or that no electrical work was needed, so it is written down here."
};

export interface RangeEntry {
  canonicalName: string;
  /** The top of the range printed on the transmitter's label. */
  range?: number;
  /** For a level: how tall the tank is inside, in the same unit. */
  tankHeight?: number;
  /** There is no such transmitter at this site: take the reading away. */
  notFitted?: boolean;
}

/** Setting a site up: starting from a template, adding known equipment, getting a box on the network,
 * and the checklist that says how far it has got. Everything that changes the platform goes through
 * PlatformService, which keeps each account's data apart and writes the audit trail; this class
 * decides the order and, when a step fails, puts back what the earlier ones made. */
@Injectable()
export class SetupService {
  private readonly searches = new Map<string, Search>();

  constructor(
    private readonly platform: PlatformService,
    @Inject(ENROLMENT_STORE) private readonly enrolments: EnrolmentStore,
    private readonly bundle: EdgeBundleService,
    @Optional() @Inject(NotificationsService) private readonly notifications?: SetupNotificationsSource
  ) {}

  // ---- A site from a template ----------------------------------------------------------------

  async createSiteFromTemplate(input: CreateSiteFromTemplateInput, principal: Principal): Promise<{ site: Site; setup: SetupView }> {
    for (const permission of ["site:manage", "asset:manage", "device:manage"] as const) {
      if (!hasPermission(principal.role, permission)) throw new ForbiddenException("Action blocked by access policy.");
    }
    const template = templateByKey(input.templateKey);
    if (!template) throw new BadRequestException(`There is no site template called "${input.templateKey}".`);

    const site = await this.platform.createSite(
      { name: input.name, type: template.siteType, locationName: input.locationName, latitude: input.latitude, longitude: input.longitude },
      principal
    );
    try {
      await this.addTemplateContent(site.id, template, principal);
      await this.platform.recordSiteTemplate(site.id, template.key, principal);
      if (input.timezone || input.currency) {
        await this.platform.updateSiteProfile(site.id, { ...(input.timezone ? { timezone: input.timezone } : {}), ...(input.currency ? { currency: input.currency } : {}) }, principal);
      }
    } catch (error) {
      await this.removeSite(site.id, principal);
      throw error;
    }
    return { site, setup: this.setupView(site.id, principal) };
  }

  private async addTemplateContent(siteId: string, template: SiteTemplate, principal: Principal): Promise<void> {
    const assetIds = new Map<string, string>();
    for (const asset of template.assets) {
      assetIds.set(asset.ref, (await this.platform.createAsset({ siteId, name: asset.name, type: asset.type }, principal)).id);
    }
    for (const entry of template.devices) {
      await this.addDevice(siteId, entry, entry.assetRef ? assetIds.get(entry.assetRef) : undefined, principal);
    }
  }

  private async addDevice(siteId: string, entry: Pick<TemplateDevice, "name" | "deviceType" | "protocol" | "driverType" | "profile" | "points">, assetId: string | undefined, principal: Principal, connection?: ModbusConnection): Promise<string> {
    const profile = entry.profile ? profileByKey(entry.profile) : undefined;
    if (entry.profile && !profile) throw new BadRequestException(`There is no equipment profile called "${entry.profile}".`);

    const device = await this.platform.createDevice(
      { siteId, assetId, name: entry.name, deviceType: entry.deviceType, protocol: entry.protocol, driverType: entry.driverType, ...(connection ? { connection } : {}), ...(profile ? { profileKey: profile.key } : {}) },
      principal
    );
    const points = profile
      ? profile.points.map((point) => ({ canonicalName: point.canonicalName, label: point.label, unit: point.unit, capability: "read" as const, source: point.source }))
      : entry.points.map((point) => ({ canonicalName: point.canonicalName, label: point.label, unit: point.unit, capability: point.capability ?? ("read" as const), source: point.source }));
    try {
      for (const point of points) {
        await this.platform.createPoint({ siteId, assetId, deviceId: device.id, ...point }, principal);
      }
    } catch (error) {
      // A device with only some of its readings is worse than none: it would look set up and not be.
      await this.platform.deleteDevice(device.id, principal).catch(() => undefined);
      throw error;
    }
    return device.id;
  }

  /** Puts a half-made site back to nothing, best effort: the error that matters is the first one. */
  private async removeSite(siteId: string, principal: Principal): Promise<void> {
    const attempt = async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch {
        // Whatever could not be removed stays in the site's own list, where it can be deleted by hand.
      }
    };
    for (const device of this.platform.listDevices(principal, siteId)) await attempt(() => this.platform.deleteDevice(device.id, principal));
    for (const asset of this.platform.listAssets(principal, siteId)) await attempt(() => this.platform.deleteAsset(asset.id, principal));
    await attempt(() => this.platform.deleteSite(siteId, principal));
  }

  // ---- Known equipment, added later ---------------------------------------------------------------

  async createDeviceFromProfile(input: CreateDeviceFromProfileInput, principal: Principal): Promise<{ deviceId: string; setup: SetupView }> {
    if (!hasPermission(principal.role, "device:manage")) throw new ForbiddenException("Action blocked by access policy.");
    const profile = profileByKey(input.profileKey);
    if (!profile) throw new BadRequestException(`There is no equipment profile called "${input.profileKey}".`);

    const connection: ModbusConnection | undefined = input.host
      ? { kind: "modbus_tcp", host: input.host, port: input.port ?? profile.defaultPort, unitId: input.unitId ?? profile.defaultUnitId }
      : undefined;
    const deviceId = await this.addDevice(
      input.siteId,
      { name: input.name?.trim() || profile.name, deviceType: profile.deviceType, protocol: "modbus", driverType: "modbus-tcp", profile: profile.key, points: [] },
      input.assetId,
      principal,
      connection
    );
    return { deviceId, setup: this.setupView(input.siteId, principal) };
  }

  // ---- The box: enrolment, what to read, how it is ------------------------------------------------

  /** Adds the box for a site and gives the code to install it with. */
  async provisionBox(input: { siteId: string; name: string }, principal: Principal, apiUrl: string): Promise<{ gatewayId: string; enrolment: EnrolmentIssued }> {
    const gateway = await this.platform.provisionGateway(input, principal);
    return { gatewayId: gateway.id, enrolment: await this.issueCode(gateway.id, principal, apiUrl) };
  }

  /** A new code for a box that has been lost, replaced or reinstalled. The box that enrols with it
   * gets a new credential, and the old one stops working. */
  async issueEnrolment(gatewayId: string, principal: Principal, apiUrl: string): Promise<EnrolmentIssued> {
    if (!hasPermission(principal.role, "device:manage")) throw new ForbiddenException("Action blocked by access policy.");
    if (!this.platform.findGateway(gatewayId, principal.tenantId)) throw new NotFoundException("Gateway not found.");
    return this.issueCode(gatewayId, principal, apiUrl);
  }

  private async issueCode(gatewayId: string, principal: Principal, apiUrl: string, nowMs: number = Date.now()): Promise<EnrolmentIssued> {
    const code = generateEnrolmentCode();
    const body = normaliseEnrolmentCode(code) as string;
    const expiresAtMs = nowMs + ENROLMENT_VALID_FOR_MS;
    await this.enrolments.issue({ tenantId: principal.tenantId, gatewayId, codeHash: hashEnrolmentCode(body), createdBy: principal.userId, createdAtMs: nowMs, expiresAtMs });
    return { code, expiresAtUtc: new Date(expiresAtMs).toISOString(), installCommand: `curl -fsSL ${apiUrl}/edge/install.sh | sudo bash -s -- ${code}` };
  }

  /** What a box does with its code. Anyone can call this, so every refusal says the same thing and
   * nothing about which codes exist. */
  async enrol(code: unknown, apiUrl: string, nowMs: number = Date.now()): Promise<EnrolResponse> {
    const body = normaliseEnrolmentCode(code);
    if (!body) throw new BadRequestException("That does not look like an enrolment code. It looks like GRC-ABCD-EFGH-JKLM.");

    const claimed = await this.enrolments.claim(hashEnrolmentCode(body), nowMs);
    if (!claimed) throw new UnauthorizedException(ENROL_REFUSED);

    try {
      const { gateway, secret } = await this.platform.completeGatewayEnrolment(claimed.gatewayId, claimed.tenantId, claimed.createdBy, nowMs);
      return { apiUrl, tenantId: gateway.tenantId, siteId: gateway.siteId, gatewayId: gateway.id, gatewayName: gateway.name, secret };
    } catch (error) {
      // The box got nothing, so the code is still good: it can try again, or the box can be asked to.
      await this.enrolments.release(claimed.id);
      if (error instanceof NotFoundException) throw new UnauthorizedException(ENROL_REFUSED);
      throw error;
    }
  }

  /** What this box is to read. For the box only: a person's session has no gateway. */
  edgeConfig(principal: Principal): EdgeConfig {
    return this.platform.edgeConfigFor(this.gatewayOf(principal), principal.tenantId);
  }

  /** The box saying how it is. The reply tells it whether what it reads has changed, how far its clock
   * is out, and whether newer software is available. */
  async heartbeat(principal: Principal, body: unknown, nowMs: number = Date.now()): Promise<HeartbeatReply> {
    const gatewayId = this.gatewayOf(principal);
    const problems = validateHeartbeat(body);
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
    const heartbeat = body as GatewayHeartbeat;

    const gateway = await this.platform.recordGatewayHeartbeat(gatewayId, principal.tenantId, heartbeat, nowMs);
    const latest = this.bundle.manifest()?.version;
    const search = this.searches.get(gatewayId);
    const asked = search && !search.result && nowMs - search.requestedAtMs < SEARCH_WAITS_FOR_MS ? search.request : undefined;
    return {
      serverTimeUtc: new Date(nowMs).toISOString(),
      configVersion: this.platform.edgeConfigFor(gatewayId, principal.tenantId).version,
      clockSkewSeconds: gateway.clockSkewSeconds ?? 0,
      latestAgentVersion: latest ?? heartbeat.agentVersion,
      // EDGE_AUTO_UPDATE=false holds every box at the version it has, for when an update must wait.
      updateAvailable: latest !== undefined && latest !== heartbeat.agentVersion && process.env.EDGE_AUTO_UPDATE?.trim().toLowerCase() !== "false",
      ...(asked ? { discovery: asked } : {})
    };
  }

  /** The box's software goes to a box that has a credential (it is updating itself) or presents a code
   * that has not been used yet (it is being installed). It goes to nobody else. */
  async assertMayFetchSoftware(principal: Principal, code: string | undefined, nowMs: number = Date.now()): Promise<void> {
    if (principal.gatewayId) return;
    const body = normaliseEnrolmentCode(code);
    if (body && (await this.enrolments.peek(hashEnrolmentCode(body), nowMs))) return;
    throw new UnauthorizedException("The software is for a box with a credential, or with a code that has not been used.");
  }

  private gatewayOf(principal: Principal): string {
    if (!principal.gatewayId) throw new ForbiddenException("This is for a box with a credential of its own.");
    return principal.gatewayId;
  }

  // ---- The checklist ----------------------------------------------------------------------------

  setupView(siteId: string, principal: Principal, nowMs: number = Date.now()): SetupView {
    const detail = this.platform.siteDetail(siteId, principal, nowMs);
    const record = this.platform.siteSetupRecord(siteId, principal);
    const latest: LatestForSetup[] = detail.latestTelemetry.map((reading) => ({
      pointId: reading.pointId,
      value: reading.value,
      unit: reading.unit,
      timestampUtc: reading.timestampUtc,
      ageSeconds: reading.ageSeconds,
      freshness: reading.freshness
    }));
    return computeSetup({
      nowMs,
      site: { id: detail.site.id, name: detail.site.name },
      templateKey: record.templateKey,
      profile: this.platform.siteProfile(siteId, principal),
      gateways: detail.gateways,
      devices: detail.devices,
      points: detail.points,
      latest,
      confirmations: record.confirmations,
      ...(this.notifications ? { notifications: this.notifications.summary(principal.tenantId) } : {})
    });
  }

  /** A person says they checked a step the platform cannot see. */
  async confirmStep(siteId: string, key: string, note: string | undefined, principal: Principal, nowMs: number = Date.now()): Promise<SetupView> {
    if (!isManualSetupStep(key)) {
      throw new BadRequestException(`Only these steps are confirmed by hand: ${manualSetupSteps.join(", ")}. The others are worked out from what the platform sees.`);
    }
    const view = this.setupView(siteId, principal, nowMs);
    const step = view.steps.find((candidate) => candidate.key === key);
    if (!step) throw new BadRequestException("That step does not apply to this site.");
    if (key === "commissioned" && !view.readyToCommission) {
      throw new ConflictException("The steps above are not all done yet, so the site cannot be commissioned.");
    }
    if (step.canConfirm === false) throw new ConflictException(`This cannot be confirmed yet. ${step.nextAction ?? step.detail}`);
    const tidy = note?.replace(/\s+/g, " ").trim().slice(0, 300);
    if (NOTE_REQUIRED[key] && (tidy?.length ?? 0) < 3) throw new BadRequestException(NOTE_REQUIRED[key]);
    await this.platform.setSetupConfirmation(siteId, key, { atUtc: new Date(nowMs).toISOString(), by: principal.support ? `${principal.email} (Greecon staff)` : principal.email, ...(tidy ? { note: tidy } : {}) }, principal);
    return this.setupView(siteId, principal, nowMs);
  }

  /** Takes a confirmation back. A site cannot stay commissioned on a step that has been reopened. */
  async reopenStep(siteId: string, key: string, principal: Principal, nowMs: number = Date.now()): Promise<SetupView> {
    if (!isManualSetupStep(key)) throw new BadRequestException(`Only these steps are confirmed by hand: ${manualSetupSteps.join(", ")}.`);
    this.platform.siteSetupRecord(siteId, principal);
    await this.platform.setSetupConfirmation(siteId, key, null, principal);
    if (key !== "commissioned" && this.platform.siteSetupRecord(siteId, principal).confirmations.commissioned) {
      await this.platform.setSetupConfirmation(siteId, "commissioned", null, principal);
    }
    return this.setupView(siteId, principal, nowMs);
  }

  // ---- Finding the equipment on the site's network ----------------------------------------------------

  /** A person pressed "Find equipment": every box of the site that is reachable is asked to look at its network. The box picks the request up at its
   * next heartbeat, looks (a minute at most), and says what answered; the addresses of what is found are filled in when it does. */
  async requestDiscovery(siteId: string, input: { host?: string; port?: number }, principal: Principal, nowMs: number = Date.now()): Promise<DiscoveryView> {
    if (!hasPermission(principal.role, "device:manage")) throw new ForbiddenException("Action blocked by access policy.");
    const detail = this.platform.siteDetail(siteId, principal, nowMs);
    if (detail.gateways.length === 0) throw new ConflictException("This site has no box yet. Add the box first: Greecon looks at the network through it.");
    const reachable = detail.gateways.filter((gateway) => gateway.contact === "online" || gateway.contact === "late");
    if (reachable.length === 0) throw new ConflictException("The box is not online yet, so it cannot look at the network. Wait until the box shows as online, then try again.");
    const host = input.host?.trim() || undefined;
    if (host && !isPrivateAddress(host)) {
      throw new BadRequestException("That address is not on a private network. Give the address the converter has on the site's own network, for example 192.168.1.50.");
    }
    const port = input.port !== undefined && Number.isInteger(input.port) && input.port >= 1 && input.port <= 65535 ? input.port : undefined;
    // Asked about a particular address or port, a new search always replaces the one that is under way.
    const particular = host !== undefined || port !== undefined;

    for (const [key, search] of this.searches) if (nowMs - search.requestedAtMs > SEARCH_KEPT_FOR_MS) this.searches.delete(key);
    for (const box of reachable) {
      const existing = this.searches.get(box.id);
      if (!particular && existing && !existing.result && nowMs - existing.requestedAtMs < SEARCH_REPEAT_AFTER_MS) continue;
      this.searches.set(box.id, { request: { id: randomUUID(), ...(host ? { hosts: [host] } : {}), ...(port !== undefined ? { ports: [port] } : {}) }, requestedAtMs: nowMs, requestedBy: principal });
    }
    return this.discoveryView(siteId, principal, nowMs);
  }

  /** What the box found, and what that means for each device of the site. */
  discoveryView(siteId: string, principal: Principal, nowMs: number = Date.now()): DiscoveryView {
    const detail = this.platform.siteDetail(siteId, principal, nowMs);
    const record = this.platform.siteSetupRecord(siteId, principal);
    const searches = detail.gateways.flatMap((gateway) => {
      const search = this.searches.get(gateway.id);
      return search ? [{ gateway, search }] : [];
    });
    const done = searches.filter((entry) => entry.search.result);
    const waiting = searches.filter((entry) => !entry.search.result && nowMs - entry.search.requestedAtMs < SEARCH_WAITS_FOR_MS);
    const state = waiting.length > 0 ? "waiting" : done.length > 0 ? "done" : searches.length > 0 ? "expired" : "idle";

    const proposals: DeviceProposal[] = [];
    const unclaimed: DiscoveryView["unclaimed"] = [];
    const notes: string[] = [];
    for (const { gateway, search } of done) {
      const result = search.result as DiscoveryResult;
      const expected = detail.devices
        .filter((device) => device.protocol === "modbus" && device.gatewayId === gateway.id)
        .map((device): ExpectedDevice & ReturnType<typeof expectationOf> => ({
          id: device.id,
          name: device.name,
          deviceType: device.deviceType,
          ...(device.connection ? { connection: { host: device.connection.host, port: device.connection.port, unitId: device.connection.unitId } } : {}),
          ...expectationOf(device, record.templateKey)
        }));
      const proposed = proposeAssignments(result.hosts, expected);
      proposals.push(...proposed.proposals);
      unclaimed.push(...proposed.unclaimed.map((found) => ({ host: found.host, port: found.port, unit: found.unit, seen: describeIdentity(found.identity) })));
      notes.push(...result.notes, ...proposed.notes);
    }

    const requested = searches.map((entry) => entry.search.requestedAtMs);
    const finished = done.map((entry) => Date.parse((entry.search.result as DiscoveryResult).finishedAtUtc));
    return {
      state,
      ...(requested.length > 0 ? { requestedAtUtc: new Date(Math.max(...requested)).toISOString() } : {}),
      ...(finished.length > 0 ? { finishedAtUtc: new Date(Math.max(...finished)).toISOString() } : {}),
      boxes: done.map((entry) => ({ name: entry.gateway.name, finishedAtUtc: (entry.search.result as DiscoveryResult).finishedAtUtc, looked: describeScan((entry.search.result as DiscoveryResult).scanned) })),
      proposals,
      unclaimed,
      notes: [...new Set(notes)],
      toApply: proposals.filter((proposal) => proposal.status === "found").length,
      allSet: proposals.length > 0 && proposals.every((proposal) => proposal.status === "already")
    };
  }

  /** What the box found, arriving. Filled in at once for the devices that have no address yet, as the person who asked: that is what they
   * pressed the button for. A device that already has an address is left alone until the person says to use the new one. */
  async recordDiscovery(principal: Principal, body: unknown, nowMs: number = Date.now()): Promise<{ recorded: boolean }> {
    const gatewayId = this.gatewayOf(principal);
    const problems = validateDiscoveryResult(body);
    if (problems.length > 0) throw new BadRequestException(problems.join(" "));
    const result = body as DiscoveryResult;
    const search = this.searches.get(gatewayId);
    // A result for a search that has been replaced, or one already recorded, is thanked and put aside: the box need not send it again.
    if (!search || search.request.id !== result.requestId || search.result) return { recorded: false };
    search.result = result;
    const gateway = this.platform.findGateway(gatewayId, principal.tenantId, nowMs);
    if (gateway) await this.applyFound(gateway.siteId, search.requestedBy, "new", nowMs).catch(() => undefined);
    return { recorded: true };
  }

  /** "Use these addresses": every device that was found at an address other than the one it has is set to the one it was found at. */
  async applyDiscovery(siteId: string, principal: Principal, nowMs: number = Date.now()): Promise<{ applied: string[]; discovery: DiscoveryView; setup: SetupView }> {
    if (!hasPermission(principal.role, "device:manage")) throw new ForbiddenException("Action blocked by access policy.");
    const { applied } = await this.applyFound(siteId, principal, "all", nowMs);
    return { applied, discovery: this.discoveryView(siteId, principal, nowMs), setup: this.setupView(siteId, principal, nowMs) };
  }

  /** Sets each device the box found to where it found it. `new` leaves a device that already has an address alone. */
  private async applyFound(siteId: string, principal: Principal, mode: "new" | "all", nowMs: number): Promise<{ applied: string[] }> {
    const view = this.discoveryView(siteId, principal, nowMs);
    const record = this.platform.siteSetupRecord(siteId, principal);
    const devices = new Map(this.platform.listDevices(principal, siteId).map((device) => [device.id, device]));
    const applied: string[] = [];
    for (const proposal of view.proposals) {
      const device = devices.get(proposal.deviceId);
      if (proposal.status !== "found" || !proposal.match || !device) continue;
      if (mode === "new" && device.connection) continue;
      await this.platform.updateDevice(device.id, { connection: { kind: "modbus_tcp", host: proposal.match.host, port: proposal.match.port, unitId: proposal.match.unit } }, principal);
      if (proposal.useModel) await this.readAsModel(device.id, proposal.useModel, record.templateKey, principal);
      applied.push(device.name);
    }
    return { applied };
  }

  /** A meter of the other model is there than the one planned: the device is read as the one that is there, by the other model's registers. */
  private async readAsModel(deviceId: string, model: "SDM230" | "SDM630", templateKey: string | undefined, principal: Principal): Promise<void> {
    const device = this.platform.listDevices(principal).find((candidate) => candidate.id === deviceId);
    if (!device) return;
    const current = device.profileKey ?? expectationOf(device, templateKey).profileKey;
    const profile = current ? profileByKey(profileForModel(current, model) ?? "") : undefined;
    if (!profile) return;
    await this.platform.updateDevice(device.id, { profileKey: profile.key }, principal);
    for (const point of this.platform.listPoints(principal, device.id)) {
      const known = profile.points.find((candidate) => candidate.canonicalName === point.canonicalName);
      if (known?.source) await this.platform.updatePoint(point.id, { source: known.source }, principal);
    }
  }

  // ---- The ranges on the transmitters' labels --------------------------------------------------------

  /** For a 4 to 20 mA module: the range printed on each transmitter's label. Greecon works out the register and the scale from it, so that
   * nobody types either. All of the answers are checked before any is used. */
  async setRanges(deviceId: string, body: unknown, principal: Principal, nowMs: number = Date.now()): Promise<{ setup: SetupView }> {
    if (!hasPermission(principal.role, "device:manage")) throw new ForbiddenException("Action blocked by access policy.");
    const device = this.platform.listDevices(principal).find((candidate) => candidate.id === deviceId);
    if (!device) throw new NotFoundException("Device not found.");
    const profile = device.profileKey ? profileByKey(device.profileKey) : undefined;
    if (!profile) throw new BadRequestException("Greecon does not know this equipment's transmitters, so it cannot work from a range. Enter each reading's register from the datasheet instead.");

    const entries = (body as { ranges?: unknown } | null)?.ranges;
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 8) throw new BadRequestException("Give the range of at least one transmitter.");
    const points = this.platform.listPoints(principal, device.id);
    const plan = entries.map((entry: unknown) => {
      const asked = (typeof entry === "object" && entry !== null ? entry : {}) as Partial<RangeEntry>;
      const known = profile.points.find((candidate) => candidate.canonicalName === asked.canonicalName && candidate.range !== undefined);
      if (!known?.range) throw new BadRequestException(`This equipment has no reading called "${String(asked.canonicalName)}" that is set from a range.`);
      const point = points.find((candidate) => candidate.canonicalName === asked.canonicalName);
      if (!point) throw new BadRequestException(`${known.label} has been taken off this device.`);
      if (asked.notFitted === true) return { point, remove: true as const };
      const problem = rangeProblem(known.range, asked);
      if (problem) throw new BadRequestException(`${known.label}: ${problem}`);
      return { point, remove: false as const, source: sourceFromRange(known.range, { range: asked.range as number, ...(asked.tankHeight !== undefined ? { tankHeight: asked.tankHeight } : {}) }) };
    });
    for (const step of plan) {
      if (step.remove) await this.platform.deletePoint(step.point.id, principal);
      else await this.platform.updatePoint(step.point.id, { source: step.source }, principal);
    }
    return { setup: this.setupView(device.siteId, principal, nowMs) };
  }

  // ---- The handover sheet -------------------------------------------------------------------------

  /** What is left with the customer: what was installed where, what it reads, the limits in force, who
   * was told, and who checked what. */
  handover(siteId: string, principal: Principal, nowMs: number = Date.now()): HandoverView {
    const detail = this.platform.siteDetail(siteId, principal, nowMs);
    const setup = this.setupView(siteId, principal, nowMs);
    const profile = this.platform.siteProfile(siteId, principal);
    const latest = new Map(detail.latestTelemetry.map((reading) => [reading.pointId, reading]));
    const tenant = this.platform.listTenants(principal).find((candidate) => candidate.id === principal.tenantId);

    const devices: HandoverDevice[] = detail.devices.map((device) => ({
      name: device.name,
      deviceType: device.deviceType,
      address: device.connection ? describeConnection(device.connection) : undefined,
      placementNote: device.placementNote,
      readings: detail.points
        .filter((point) => point.deviceId === device.id)
        .map((point): HandoverReading => {
          const reading = latest.get(point.id);
          return {
            label: point.label,
            canonicalName: point.canonicalName,
            unit: point.unit,
            register: point.source ? describeSource(point.source) : undefined,
            latestValue: reading?.value,
            latestAtUtc: reading?.timestampUtc,
            ageSeconds: reading?.ageSeconds,
            quality: reading?.quality,
            current: reading ? reading.freshness === "current" : undefined,
            limits: limitsInForce(point)
          };
        })
    }));

    return {
      generatedAtUtc: new Date(nowMs).toISOString(),
      customer: tenant?.name ?? "",
      site: { id: detail.site.id, name: detail.site.name, type: detail.site.type, locationName: detail.site.locationName },
      profile: {
        timezone: profile.timezone,
        currency: profile.currency,
        importPricePerKwh: profile.importPricePerKwh,
        exportPricePerKwh: profile.exportPricePerKwh,
        waterPricePerM3: profile.waterPricePerM3,
        zeroExport: profile.zeroExport
      },
      gateways: detail.gateways.map((gateway) => ({
        name: gateway.name,
        contact: gateway.contact ?? "never",
        lastSeenUtc: gateway.lastSeenUtc,
        softwareVersion: gateway.softwareVersion,
        enrolledAtUtc: gateway.enrolledAtUtc
      })),
      devices,
      steps: setup.steps,
      commissioned: setup.commissioned,
      commissionedAtUtc: setup.commissionedAtUtc,
      commissionedBy: setup.commissionedBy,
      told: (this.notifications?.contacts(principal.tenantId) ?? []).map((contact) => ({ name: contact.name, email: contact.email, phone: contact.phone })),
      people: this.platform
        .listUsers(principal)
        .filter((user) => user.status === "active")
        .map((user) => ({ name: user.name, email: user.email, role: user.role })),
      support: { email: GREECON_PUBLIC_EMAILS[0] }
    };
  }
}

/** The limits that decide when people are alerted, as they are for this reading: its own where it has
 * been set, otherwise the standard ones. A limit with neither is left out, because the platform then
 * says nothing about it. */
function limitsInForce(point: Point): HandoverReading["limits"] {
  return limitsFor(point.canonicalName)
    .filter((definition) => definition.key !== "max_age_seconds")
    .flatMap((definition) => {
      const set = point.thresholdConfig?.[definition.key];
      const value = set ?? definition.fallback;
      return value === null || value === undefined ? [] : [{ key: definition.key, label: definition.label, value, standard: set === undefined }];
    });
}
