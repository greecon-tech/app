import { describe, expect, it } from "vitest";
import { Device, EdgeGateway, Point, SiteProfile, profileByKey, templateByKey } from "@greecon/shared";
import { Confirmation, LatestForSetup, SetupInput, SetupNotifications, computeSetup } from "./setup-checklist";

const NOW = Date.parse("2026-10-19T10:00:00Z");
const TENANT = "t-1";
const SITE = "s-1";
const secondsAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

const profile: SiteProfile = { siteId: SITE, tenantId: TENANT, timezone: "Europe/Tirane", currency: "EUR", zeroExport: false };
const gateway = (overrides: Partial<EdgeGateway> = {}): EdgeGateway => ({
  id: "g-1",
  tenantId: TENANT,
  siteId: SITE,
  name: "Plant room box",
  status: "OK",
  secureIdentityStatus: "provisioned",
  enrolledAtUtc: secondsAgo(3600),
  lastSeenUtc: secondsAgo(10),
  softwareVersion: "0.2.0",
  clockSkewSeconds: 1,
  ...overrides
});

/** A hotel built the way the template builds it, so the test follows the real catalogue. */
function hotel(options: { addressed?: boolean; mapped?: boolean } = {}): { devices: Device[]; points: Point[] } {
  const template = templateByKey("hotel");
  if (!template) throw new Error("hotel template missing");
  const devices: Device[] = [];
  const points: Point[] = [];
  let unit = 1;
  for (const entry of template.devices) {
    const id = `d-${entry.ref}`;
    devices.push({
      id,
      tenantId: TENANT,
      siteId: SITE,
      gatewayId: "g-1",
      name: entry.name,
      deviceType: entry.deviceType,
      protocol: entry.protocol,
      driverType: entry.driverType,
      health: "OK",
      secureIdentityStatus: "placeholder",
      ...(options.addressed ? { connection: { kind: "modbus_tcp" as const, host: "192.168.1.50", port: 502, unitId: unit++ } } : {})
    });
    const profileDef = entry.profile ? profileByKey(entry.profile) : undefined;
    for (const [index, definition] of (profileDef ? profileDef.points : entry.points).entries()) {
      const mapped = profileDef !== undefined || options.mapped === true;
      points.push({
        id: `p-${entry.ref}-${index}`,
        tenantId: TENANT,
        siteId: SITE,
        deviceId: id,
        canonicalName: definition.canonicalName,
        label: definition.label,
        unit: definition.unit,
        quality: "OK",
        capability: "read",
        ...(mapped
          ? { source: ("source" in definition && definition.source) || { kind: "modbus" as const, registerType: "holding" as const, address: index, dataType: "uint16" as const } }
          : {})
      });
    }
  }
  return { devices, points };
}

function input(overrides: Partial<SetupInput> = {}): SetupInput {
  const { devices, points } = hotel();
  return { nowMs: NOW, site: { id: SITE, name: "Hotel Adriatik" }, profile, gateways: [], devices, points, latest: [], confirmations: {}, ...overrides };
}

const step = (view: ReturnType<typeof computeSetup>, key: string) => view.steps.find((candidate) => candidate.key === key);

/** Every reading current and plausible. */
function allReadings(points: Point[]): LatestForSetup[] {
  const values: Record<string, number> = { "water.tank.level.percent": 62, "water.pressure.bar": 3.1, "water.flow.lpm": 14, "water.pump.status": 1, "energy.grid.import.kw": 4.2, "energy.grid.export.kw": 0, "energy.solar.power.kw": 0 };
  return points.map((point) => ({ pointId: point.id, value: values[point.canonicalName] ?? 1, unit: point.unit, timestampUtc: secondsAgo(8), ageSeconds: 8, freshness: "current" as const }));
}

function working(extra: Partial<SetupInput> = {}): SetupInput {
  const { devices, points } = hotel({ addressed: true, mapped: true });
  return {
    nowMs: NOW,
    site: { id: SITE, name: "Hotel Adriatik" },
    profile: { ...profile, importPricePerKwh: 0.14, waterPricePerM3: 1.2 },
    gateways: [gateway({ drivers: devices.map((device) => ({ deviceId: device.id, ok: true, readingsOk: 2, readingsFailed: 0 })) })],
    devices,
    points,
    latest: allReadings(points),
    confirmations: {},
    ...extra
  };
}

const done = (by = "pm@greecon.earth"): Confirmation => ({ atUtc: secondsAgo(60), by });

describe("a site with no equipment at all", () => {
  it("asks for the equipment first and cannot be commissioned", () => {
    const view = computeSetup(input({ devices: [], points: [], gateways: [gateway()] }));
    const addresses = step(view, "addresses");
    expect(addresses?.status).toBe("todo");
    expect(addresses?.detail).toBe("No equipment has been added to this site yet.");
    expect(view.readyToCommission).toBe(false);
    expect(step(view, "commissioned")?.status).toBe("waiting");
  });
});

describe("someone is told", () => {
  const on = { emailOn: true, smsOn: true, contacts: 2, byEmail: 2, bySms: 1 };
  const withNotifications = (notifications: SetupNotifications, confirmations: SetupInput["confirmations"] = {}) => computeSetup(input({ notifications, confirmations }));
  const told = (notifications: SetupNotifications, confirmations?: SetupInput["confirmations"]) => step(withNotifications(notifications, confirmations), "told");

  it("is not a step at all where the platform has no notifications", () => {
    expect(step(computeSetup(input()), "told")).toBeUndefined();
  });

  it("sits between the readings and the checks a person makes at the site", () => {
    const keys = withNotifications(on).steps.map((candidate) => candidate.key);
    expect(keys.indexOf("told")).toBe(keys.indexOf("readings") + 1);
    expect(keys.indexOf("told")).toBeLessThan(keys.indexOf("direction"));
  });

  it("needs attention, and cannot be confirmed, while the platform cannot send anything", () => {
    const result = told({ ...on, emailOn: false, smsOn: false });
    expect(result).toMatchObject({ status: "attention", manual: true, canConfirm: false });
    expect(result?.detail).toBe("This Greecon platform is not set up to send messages, so no alert would reach anyone.");
    expect(result?.nextAction).toContain("Tell Greecon support");
  });

  it("asks for people when nobody is on the list", () => {
    const result = told({ ...on, contacts: 0, byEmail: 0, bySms: 0 });
    expect(result).toMatchObject({ status: "todo", canConfirm: false });
    expect(result?.detail).toBe("Nobody is set to be told. Alerts show in Greecon, but nobody is sent a message.");
  });

  it("needs attention when nobody on the list can be reached the way the platform sends", () => {
    expect(told({ emailOn: true, smsOn: false, contacts: 1, byEmail: 0, bySms: 1 })).toMatchObject({ status: "attention", canConfirm: false });
    expect(told({ emailOn: true, smsOn: false, contacts: 1, byEmail: 0, bySms: 1 })?.detail).toContain("Nobody on the list has an email address");
    expect(told({ emailOn: false, smsOn: true, contacts: 1, byEmail: 1, bySms: 0 })?.detail).toContain("Nobody on the list has a phone number");
  });

  it("asks for a test message before anyone can say it arrived", () => {
    const result = told(on);
    expect(result).toMatchObject({ status: "todo", canConfirm: false });
    expect(result?.detail).toBe("2 people are on the list, and no test message has been sent yet.");
    expect(told({ ...on, contacts: 1 })?.detail).toBe("One person is on the list, and no test message has been sent yet.");
  });

  it("can be confirmed by a person once a test message has gone, and says the platform cannot tell it was read", () => {
    const result = told({ ...on, lastTestAtMs: NOW - 3 * 60_000 });
    expect(result).toMatchObject({ status: "todo", canConfirm: true, manual: true });
    expect(result?.detail).toBe("A test message was sent 3 minutes ago. Greecon cannot tell whether it was read.");
    expect(result?.nextAction).toContain("in the inbox and not in spam");
  });

  it("is done when a person confirmed it, with who and when", () => {
    const result = told({ ...on, lastTestAtMs: NOW - 60_000 }, { told: { atUtc: secondsAgo(30), by: "pm@greecon.earth (Greecon staff)", note: "Besa read it" } });
    expect(result).toMatchObject({ status: "done", confirmedBy: "pm@greecon.earth (Greecon staff)", note: "Besa read it" });
  });

  it("stops being done if the list is emptied or the platform loses its way of sending", () => {
    const confirmed = { told: done() };
    expect(told({ ...on, contacts: 0, byEmail: 0, bySms: 0, lastTestAtMs: NOW }, confirmed)?.status).toBe("todo");
    expect(told({ ...on, emailOn: false, smsOn: false, lastTestAtMs: NOW }, confirmed)?.status).toBe("attention");
  });

  it("holds commissioning back until it is done", () => {
    const base = working();
    const before = computeSetup({ ...base, notifications: { ...on, lastTestAtMs: NOW }, confirmations: { direction: done(), limits: done() } });
    expect(before.readyToCommission).toBe(false);
    expect(step(before, "commissioned")?.status).toBe("waiting");
    const after = computeSetup({ ...base, notifications: { ...on, lastTestAtMs: NOW }, confirmations: { told: done(), direction: done(), limits: done() } });
    expect(after.readyToCommission).toBe(true);
  });
});

describe("a brand-new site made from the hotel template", () => {
  it("starts with everything to do, and commissioning held back", () => {
    const view = computeSetup(input());
    expect(step(view, "prices")?.status).toBe("todo");
    expect(step(view, "box")?.status).toBe("todo");
    expect(step(view, "addresses")?.status).toBe("todo");
    expect(step(view, "mapping")?.status).toBe("todo");
    expect(step(view, "commissioned")?.status).toBe("waiting");
    expect(view.readyToCommission).toBe(false);
    expect(view.commissioned).toBe(false);
    expect(view.doneCount).toBe(0);
    expect(view.totalCount).toBe(view.steps.length);
  });

  it("names each device that still needs an address", () => {
    const addresses = step(computeSetup(input()), "addresses");
    expect(addresses?.items?.map((item) => item.label)).toEqual(["Grid meter", "Solar meter", "Water I/O module"]);
    expect(addresses?.detail).toBe("3 devices still need an address.");
  });

  it("only lists the readings that are not tied to a register, because a known meter fills its own in", () => {
    const mapping = step(computeSetup(input()), "mapping");
    const todo = mapping?.items?.filter((item) => item.status === "todo").map((item) => item.label);
    expect(todo).toEqual(["Tank level on Water I/O module", "Line pressure on Water I/O module", "Pump flow on Water I/O module", "Pump running on Water I/O module"]);
    expect(mapping?.items?.filter((item) => item.status === "done")).toHaveLength(3);
  });

  it("lists answering and arriving from the start, as waiting, so the list does not grow while it is worked down", () => {
    const view = computeSetup(input());
    expect(step(view, "answering")?.status).toBe("waiting");
    expect(step(view, "answering")?.items?.every((item) => item.detail === "Needs its address and its registers first.")).toBe(true);
    expect(step(view, "answering")?.nextAction).toBe("Finish the addresses and registers above first.");
    expect(step(view, "readings")?.status).toBe("waiting");
    expect(step(view, "readings")?.nextAction).toBe("Finish the addresses and registers above first.");
    expect(view.steps.map((candidate) => candidate.key)).toEqual(["prices", "box", "addresses", "mapping", "answering", "readings", "direction", "limits", "commissioned"]);
  });

  it("keeps the same steps all the way to done", () => {
    const keys = (view: ReturnType<typeof computeSetup>) => view.steps.map((candidate) => candidate.key);
    expect(keys(computeSetup(working()))).toEqual(keys(computeSetup(input())));
  });

  it("asks for the direction check and the limits, as the site has a grid meter and a tank", () => {
    const view = computeSetup(input());
    expect(step(view, "direction")?.manual).toBe(true);
    expect(step(view, "limits")?.manual).toBe(true);
  });

  it("does not ask for a direction check when the site has no two-way meter", () => {
    const { devices, points } = hotel();
    const view = computeSetup(input({ devices, points: points.filter((point) => point.canonicalName !== "energy.grid.export.kw") }));
    expect(step(view, "direction")).toBeUndefined();
  });
});

describe("the box", () => {
  it("waits for the install command until the box has used its code", () => {
    const view = computeSetup(input({ gateways: [gateway({ secureIdentityStatus: "placeholder", enrolledAtUtc: undefined, lastSeenUtc: undefined })] }));
    expect(step(view, "box")?.status).toBe("waiting");
    expect(step(view, "box")?.detail).toContain("install command");
  });

  it("waits while a box that has enrolled has not reported", () => {
    const view = computeSetup(input({ gateways: [gateway({ lastSeenUtc: undefined })] }));
    expect(step(view, "box")?.status).toBe("waiting");
  });

  it("is done when the box is online, and says its version", () => {
    const view = computeSetup(input({ gateways: [gateway()] }));
    expect(step(view, "box")?.status).toBe("done");
    expect(step(view, "box")?.detail).toContain("version 0.2.0");
  });

  it("needs attention when the box has gone quiet", () => {
    const late = computeSetup(input({ gateways: [gateway({ lastSeenUtc: secondsAgo(400) })] }));
    expect(step(late, "box")?.status).toBe("attention");
    expect(step(late, "box")?.detail).toContain("6 minutes");
    const offline = computeSetup(input({ gateways: [gateway({ lastSeenUtc: secondsAgo(7200) })] }));
    expect(step(offline, "box")?.detail).toContain("offline");
  });

  it("takes the platform's own word for the box: right after a restart, one not heard from yet is late, not offline", () => {
    const reconnecting = computeSetup(input({ gateways: [gateway({ lastSeenUtc: secondsAgo(7200), contact: "late" })] }));
    expect(step(reconnecting, "box")?.detail).toBe("Plant room box: Last heard from 2 hours ago.");
  });

  it("needs attention when the box's clock is wrong, because readings are stamped with it", () => {
    const fast = computeSetup(input({ gateways: [gateway({ clockSkewSeconds: 3600 })] }));
    expect(step(fast, "box")?.status).toBe("attention");
    expect(step(fast, "box")?.detail).toContain("1 hour fast");
    const slow = computeSetup(input({ gateways: [gateway({ clockSkewSeconds: -400 })] }));
    expect(step(slow, "box")?.detail).toContain("slow");
  });

  it("treats a box set up by hand with a credential as enrolled", () => {
    const view = computeSetup(input({ gateways: [gateway({ enrolledAtUtc: undefined })] }));
    expect(step(view, "box")?.status).toBe("done");
  });
});

describe("devices answering and readings arriving", () => {
  it("is done for a site that is working", () => {
    const view = computeSetup(working());
    for (const key of ["box", "addresses", "mapping", "answering", "readings", "prices"]) expect(step(view, key)?.status, key).toBe("done");
  });

  it("waits for the box to report on a device it has not tried yet", () => {
    const base = working();
    const view = computeSetup({ ...base, gateways: [gateway({ drivers: [] })], latest: [] });
    expect(step(view, "answering")?.status).toBe("waiting");
    expect(step(view, "readings")?.status).toBe("waiting");
    expect(step(view, "readings")?.items?.[0]?.detail).toBe("No reading yet.");
  });

  it("waits, rather than blaming the devices, while the box itself is not online", () => {
    const base = working();
    const view = computeSetup({ ...base, gateways: [gateway({ lastSeenUtc: undefined })] });
    expect(step(view, "answering")?.items?.every((item) => item.detail === "Waiting for the box to be online.")).toBe(true);
  });

  it("puts the box's own words about a failing device on the line", () => {
    const base = working();
    const failing = base.devices[0] as Device;
    const view = computeSetup({
      ...base,
      gateways: [gateway({ drivers: base.devices.map((device) => (device.id === failing.id ? { deviceId: device.id, ok: false, readingsOk: 0, readingsFailed: 2, lastError: "no answer from 192.168.1.50:502 (unit 1)" } : { deviceId: device.id, ok: true, readingsOk: 2, readingsFailed: 0 })) })]
    });
    const answering = step(view, "answering");
    expect(answering?.status).toBe("attention");
    expect(answering?.items?.find((item) => item.label === failing.name)?.detail).toBe("no answer from 192.168.1.50:502 (unit 1)");
  });

  it("flags a reading that cannot be what it is called, and says what to check", () => {
    const base = working();
    const tank = base.points.find((point) => point.canonicalName === "water.tank.level.percent") as Point;
    const view = computeSetup({ ...base, latest: base.latest.map((reading) => (reading.pointId === tank.id ? { ...reading, value: 250 } : reading)) });
    const readings = step(view, "readings");
    expect(readings?.status).toBe("attention");
    expect(readings?.items?.find((item) => item.label === "Tank level")?.detail).toContain("250 cannot be a tank level");
  });

  it("flags a reading that has stopped arriving", () => {
    const base = working();
    const pressure = base.points.find((point) => point.canonicalName === "water.pressure.bar") as Point;
    const view = computeSetup({ ...base, latest: base.latest.map((reading) => (reading.pointId === pressure.id ? { ...reading, freshness: "out_of_date" as const, ageSeconds: 7200 } : reading)) });
    expect(step(view, "readings")?.items?.find((item) => item.label === "Line pressure")?.detail).toBe("Last reading 2 hours ago. It has stopped arriving.");
  });

  it("shows the value and its age on a good reading", () => {
    const view = computeSetup(working());
    expect(step(view, "readings")?.items?.find((item) => item.label === "Tank level")?.detail).toBe("62 %, 8 seconds ago.");
  });
});

describe("the steps a person confirms", () => {
  it("holds commissioning back until every other required step is done", () => {
    const view = computeSetup(working());
    expect(view.readyToCommission).toBe(false);
    expect(step(view, "commissioned")?.status).toBe("waiting");
    expect(step(view, "commissioned")?.detail).toBe("2 steps above must be done first.");
  });

  it("opens commissioning once direction and limits are confirmed, even with no prices", () => {
    const view = computeSetup(working({ profile, confirmations: { direction: done(), limits: done() } }));
    expect(step(view, "prices")?.status).toBe("todo");
    expect(view.readyToCommission).toBe(true);
    expect(step(view, "commissioned")?.status).toBe("todo");
    expect(step(view, "commissioned")?.nextAction).toContain("compare what Greecon shows");
  });

  it("records who confirmed and when", () => {
    const view = computeSetup(working({ confirmations: { direction: { atUtc: "2026-10-19T09:00:00Z", by: "pm@greecon.earth", note: "Import rose with the kettle on" }, limits: done(), commissioned: done("pm@greecon.earth") } }));
    const direction = step(view, "direction");
    expect(direction).toMatchObject({ status: "done", confirmedBy: "pm@greecon.earth", confirmedAtUtc: "2026-10-19T09:00:00Z", note: "Import rose with the kettle on" });
    expect(view.commissioned).toBe(true);
    expect(view.commissionedBy).toBe("pm@greecon.earth");
    expect(view.doneCount).toBe(view.totalCount);
  });

  it("keeps a commissioned site commissioned even if a device stops answering later", () => {
    const base = working({ confirmations: { direction: done(), limits: done(), commissioned: done() } });
    const view = computeSetup({ ...base, gateways: [gateway({ lastSeenUtc: secondsAgo(7200) })] });
    expect(view.commissioned).toBe(true);
    expect(step(view, "box")?.status).toBe("attention");
  });

  it("lists the limits in force, standard and chosen", () => {
    const base = working();
    const tank = base.points.find((point) => point.canonicalName === "water.tank.level.percent") as Point;
    const view = computeSetup({ ...base, points: base.points.map((point) => (point.id === tank.id ? { ...point, thresholdConfig: { critical_low: 20 } } : point)) });
    const detail = step(view, "limits")?.items?.find((item) => item.label === "Tank level")?.detail;
    expect(detail).toBe("Critical below 20 %; Low below 35 % (standard)");
  });
});

describe("prices", () => {
  it("asks only for the prices the site needs", () => {
    const { devices, points } = hotel();
    const waterOnly = computeSetup(input({ devices, points: points.filter((point) => !point.canonicalName.startsWith("energy.")) }));
    expect(step(waterOnly, "prices")?.items?.map((item) => item.label)).toEqual(["Water"]);
  });

  it("is left out entirely for a site that measures neither energy nor water flow", () => {
    const { devices, points } = hotel();
    const view = computeSetup(input({ devices, points: points.filter((point) => point.canonicalName === "water.tank.level.percent") }));
    expect(step(view, "prices")).toBeUndefined();
  });

  it("never holds up commissioning", () => {
    expect(step(computeSetup(input()), "prices")?.optional).toBe(true);
  });
});

describe("a site with nothing on it yet", () => {
  it("still says what to do first", () => {
    const view = computeSetup(input({ devices: [], points: [] }));
    expect(view.steps.map((candidate) => candidate.key)).toEqual(["box", "addresses", "commissioned"]);
    expect(step(view, "box")?.status).toBe("todo");
  });
});
