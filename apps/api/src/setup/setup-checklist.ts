import {
  ALERT_LIMIT_KEYS,
  Device,
  EdgeGateway,
  Point,
  SetupStep,
  SetupStepItem,
  SetupStepStatus,
  SetupView,
  SiteProfile,
  describeAge,
  describeConnection,
  gatewayContact,
  limitsFor,
  plausibilityProblem
} from "@greecon/shared";

// The checklist a project manager works down at a new site. Every line is worked out from what the
// platform can see: a step is "done" because a reading arrived, never because someone ticked it. The
// few things the platform cannot see (which way the clamps point, whether the customer agreed the
// limits, whether the numbers match the real world) are confirmed by a person, with their name and
// the time, and the last of them is held back until everything else is done.

export interface LatestForSetup {
  pointId: string;
  value: number | boolean | string;
  unit: string;
  timestampUtc: string;
  ageSeconds?: number;
  freshness: "current" | "out_of_date";
}

export interface Confirmation {
  atUtc: string;
  by: string;
  note?: string;
}

/** What the checklist needs to know about telling people: which ways the platform can send, who is on the list,
 * and when a test message last went through. Absent where the platform has no notifications (some tests). */
export interface SetupNotifications {
  emailOn: boolean;
  smsOn: boolean;
  contacts: number;
  byEmail: number;
  bySms: number;
  lastTestAtMs?: number;
}

export interface SetupInput {
  nowMs: number;
  site: { id: string; name: string };
  templateKey?: string;
  profile: SiteProfile;
  gateways: readonly EdgeGateway[];
  devices: readonly Device[];
  points: readonly Point[];
  latest: readonly LatestForSetup[];
  confirmations: Readonly<Record<string, Confirmation | undefined>>;
  notifications?: SetupNotifications;
}

/** The box's clock is wrong by more than this: readings are stamped with it, so it matters. */
const CLOCK_SKEW_LIMIT_SECONDS = 120;

function rollup(items: readonly SetupStepItem[]): SetupStepStatus {
  if (items.some((item) => item.status === "attention")) return "attention";
  if (items.every((item) => item.status === "done")) return "done";
  if (items.some((item) => item.status === "todo")) return "todo";
  return "waiting";
}

function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function shown(value: number | boolean | string): string {
  return typeof value === "number" ? String(Number(value.toFixed(3))) : String(value);
}

export function computeSetup(input: SetupInput): SetupView {
  const { nowMs, profile } = input;
  const modbusDevices = input.devices.filter((device) => device.protocol === "modbus");
  const readablePoints = input.points.filter((point) => point.capability !== "write");
  const latestByPoint = new Map(input.latest.map((reading) => [reading.pointId, reading]));
  const confirmation = (key: string): Confirmation | undefined => input.confirmations[key];
  const steps: SetupStep[] = [];

  // 1. Prices ---------------------------------------------------------------
  const needsEnergyPrice = input.points.some((point) => point.canonicalName.startsWith("energy."));
  const needsWaterPrice = input.points.some((point) => point.canonicalName === "water.flow.lpm");
  if (needsEnergyPrice || needsWaterPrice) {
    const items: SetupStepItem[] = [];
    if (needsEnergyPrice) {
      items.push(
        profile.importPricePerKwh !== undefined
          ? { label: "Electricity", status: "done", detail: `${profile.importPricePerKwh} ${profile.currency} per kWh` }
          : { label: "Electricity", status: "todo", detail: "Not set: Greecon shows kWh but cannot say what they are worth." }
      );
    }
    if (needsWaterPrice) {
      items.push(
        profile.waterPricePerM3 !== undefined
          ? { label: "Water", status: "done", detail: `${profile.waterPricePerM3} ${profile.currency} per m³` }
          : { label: "Water", status: "todo", detail: "Not set: Greecon shows cubic metres but cannot say what they are worth." }
      );
    }
    const status = rollup(items);
    steps.push({
      key: "prices",
      title: "Prices from the customer's bills",
      status,
      detail: status === "done" ? "The prices are entered, so what the energy and water are worth can be shown." : "Greecon shows what the site's energy and water are worth at the customer's own prices.",
      ...(status === "done" ? {} : { nextAction: "Open Prices and enter what the customer pays, from the latest bill." }),
      items,
      optional: true
    });
  }

  // 2. The box ------------------------------------------------------------
  {
    const gatewayItems: SetupStepItem[] = input.gateways.map((gateway) => {
      // The platform's own word for the box when it has one: right after a restart a box not heard from yet is late, not offline.
      const contact = gateway.contact ?? gatewayContact(gateway.lastSeenUtc, nowMs);
      const enrolled = gateway.enrolledAtUtc !== undefined || gateway.secureIdentityStatus === "provisioned";
      const age = gateway.lastSeenUtc ? describeAge(Math.max(0, (nowMs - Date.parse(gateway.lastSeenUtc)) / 1000)) : undefined;
      if (!enrolled) return { label: gateway.name, status: "waiting", detail: "Waiting for the install command to be run on the box." };
      if (contact === "never") return { label: gateway.name, status: "waiting", detail: "The box has its credential but has not reported yet." };
      if (contact === "late" || contact === "offline") {
        return { label: gateway.name, status: "attention", detail: `Last heard from ${age} ago${contact === "offline" ? ": it is offline" : ""}.` };
      }
      const skew = gateway.clockSkewSeconds;
      if (skew !== undefined && Math.abs(skew) > CLOCK_SKEW_LIMIT_SECONDS) {
        return { label: gateway.name, status: "attention", detail: `Online, but its clock is ${describeAge(Math.abs(skew))} ${skew > 0 ? "fast" : "slow"}. Readings are stamped with it. Check the box's network time.` };
      }
      return { label: gateway.name, status: "done", detail: `Online${gateway.softwareVersion ? `, version ${gateway.softwareVersion}` : ""}. Heard from ${age} ago.` };
    });

    if (input.gateways.length === 0) {
      steps.push({
        key: "box",
        title: "Install the box",
        status: "todo",
        detail: "No box has been added for this site yet.",
        nextAction: "Add the box. Greecon gives a one-line command to run on it."
      });
    } else {
      const status = rollup(gatewayItems);
      const first = gatewayItems[0] as SetupStepItem;
      steps.push({
        key: "box",
        title: "Install the box",
        status,
        detail: gatewayItems.length === 1 ? `${first.label}: ${first.detail}` : `${plural(gatewayItems.filter((item) => item.status === "done").length, "box")} of ${gatewayItems.length} online.`,
        ...(status === "done"
          ? {}
          : {
              nextAction:
                status === "attention"
                  ? "Check the box has power and a network connection. On the box, `journalctl -u greecon-edge -n 50` says what it is doing."
                  : "Run the install command on the box. It is shown once; make a new one if it has been lost."
            }),
        items: gatewayItems
      });
    }
  }

  // 3. Where each device is on the network ---------------------------------
  if (input.devices.length === 0) {
    // A site made from the blank template: without equipment there is nothing to read, and it must not look ready.
    steps.push({
      key: "addresses",
      title: "Where each device is on the network",
      status: "todo",
      detail: "No equipment has been added to this site yet.",
      nextAction: "Add the equipment the site has. Pick it from the list if Greecon knows it; the box needs each device's IP address, port and unit number."
    });
  } else if (modbusDevices.length > 0) {
    const items: SetupStepItem[] = modbusDevices.map((device) =>
      device.connection
        ? { label: device.name, status: "done", detail: describeConnection(device.connection) }
        : { label: device.name, status: "todo", detail: "No address yet." }
    );
    const status = rollup(items);
    steps.push({
      key: "addresses",
      title: "Where each device is on the network",
      status,
      detail: status === "done" ? "Every device has an address." : `${plural(items.filter((item) => item.status === "todo").length, "device")} still need an address.`,
      ...(status === "done" ? {} : { nextAction: "Enter each device's IP address, port and unit number. The converter's address goes on every meter behind it; the meters differ by unit number." }),
      items
    });
  }

  // 4. Which register is which reading -------------------------------------
  const modbusDeviceIds = new Set(modbusDevices.map((device) => device.id));
  const modbusPoints = readablePoints.filter((point) => modbusDeviceIds.has(point.deviceId));
  if (modbusPoints.length > 0) {
    const deviceName = new Map(input.devices.map((device) => [device.id, device.name]));
    const items: SetupStepItem[] = modbusPoints.map((point) =>
      point.source
        ? { label: `${point.label} on ${deviceName.get(point.deviceId)}`, status: "done" }
        : { label: `${point.label} on ${deviceName.get(point.deviceId)}`, status: "todo", detail: "No register chosen." }
    );
    const status = rollup(items);
    steps.push({
      key: "mapping",
      title: "Which register holds which reading",
      status,
      detail: status === "done" ? "Every reading is tied to a register." : `${plural(items.filter((item) => item.status === "todo").length, "reading")} not tied to a register yet.`,
      ...(status === "done" ? {} : { nextAction: "Open each reading and enter its register from the device's datasheet. Known meters fill this in by themselves." }),
      items
    });
  }

  // 5. Is each device answering the box ------------------------------------
  // Listed from the start, as waiting, so the list a person works down does not grow while they work.
  const gatewayOnline = input.gateways.some((gateway) => (gateway.contact ?? gatewayContact(gateway.lastSeenUtc, nowMs)) === "online");
  const driverStatus = new Map(input.gateways.flatMap((gateway) => (gateway.drivers ?? []).map((driver) => [driver.deviceId, driver] as const)));
  const readDevices = modbusDevices.filter((device) => device.connection && modbusPoints.some((point) => point.deviceId === device.id && point.source));
  const isRead = (deviceId: string): boolean => readDevices.some((device) => device.id === deviceId);
  if (modbusDevices.length > 0) {
    const items: SetupStepItem[] = modbusDevices.map((device) => {
      if (!isRead(device.id)) return { label: device.name, status: "waiting", detail: "Needs its address and its registers first." };
      const driver = driverStatus.get(device.id);
      if (!gatewayOnline) return { label: device.name, status: "waiting", detail: "Waiting for the box to be online." };
      if (!driver) return { label: device.name, status: "waiting", detail: "The box has not reported on this device yet. It picks up changes within a minute." };
      if (driver.ok) return { label: device.name, status: "done", detail: `Answering (${plural(driver.readingsOk, "reading")}).` };
      return { label: device.name, status: "attention", detail: driver.lastError ?? "Not answering." };
    });
    const status = rollup(items);
    const notReady = modbusDevices.filter((device) => !isRead(device.id)).length;
    steps.push({
      key: "answering",
      title: "Every device answers the box",
      status,
      detail: status === "done" ? "Every device is answering." : status === "attention" ? "At least one device is not answering the box." : notReady > 0 ? "Waiting for the addresses and registers above." : "Waiting for the box to try each device.",
      ...(status === "done"
        ? {}
        : status === "attention"
          ? { nextAction: "Check the address, the unit number and the cable of the device named below. A wrong unit number and a wrong address look the same from here." }
          : { nextAction: notReady > 0 ? "Finish the addresses and registers above first." : "Wait a minute. If this does not change, check that the box is online." }),
      items
    });
  }

  // 6. Are readings arriving, and could they be real ----------------------
  if (modbusPoints.length > 0) {
    const items: SetupStepItem[] = modbusPoints.map((point) => {
      if (!point.source || !isRead(point.deviceId)) return { label: point.label, status: "waiting", detail: "Needs its address and its register first." };
      const reading = latestByPoint.get(point.id);
      if (!reading) return { label: point.label, status: "waiting", detail: "No reading yet." };
      if (reading.freshness === "out_of_date") {
        return { label: point.label, status: "attention", detail: `Last reading ${describeAge(reading.ageSeconds ?? 0)} ago. It has stopped arriving.` };
      }
      const problem = typeof reading.value === "number" ? plausibilityProblem(point.canonicalName, reading.value) : undefined;
      if (problem) return { label: point.label, status: "attention", detail: problem };
      return { label: point.label, status: "done", detail: `${shown(reading.value)} ${reading.unit}, ${describeAge(reading.ageSeconds ?? 0)} ago.` };
    });
    const status = rollup(items);
    const notReady = modbusPoints.filter((point) => !point.source || !isRead(point.deviceId)).length;
    steps.push({
      key: "readings",
      title: "Readings arrive and look right",
      status,
      detail: status === "done" ? "Every reading is arriving and could be real." : status === "attention" ? "At least one reading is missing or does not look right." : "Waiting for the first readings.",
      ...(status === "done"
        ? {}
        : {
            nextAction:
              status === "attention"
                ? "Read the line below. A value that cannot be real is usually a wrong register, a wrong scale or a wiring fault."
                : notReady > 0
                  ? "Finish the addresses and registers above first."
                  : "Wait a minute for the next round of readings."
          }),
      items
    });
  }

  // 7. Someone is told (the platform sees the list and the test; a person confirms it arrived) --------
  if (input.notifications) steps.push(toldStep(input.notifications, confirmation("told"), nowMs));

  // 8. Direction of the grid meter (a person checks) -----------------------
  const hasGrid = input.points.some((point) => point.canonicalName === "energy.grid.import.kw") && input.points.some((point) => point.canonicalName === "energy.grid.export.kw");
  if (hasGrid) {
    steps.push(manualStep("direction", "Grid meter direction checked", confirmation("direction"), {
      todo: "Greecon cannot see which way the meter's clamps point. A reversed clamp swaps what the site buys and what it sells, and every saving figure with it.",
      next: "With the sun down or the solar switched off, switch on a known load. Grid import must go up. If Grid export goes up instead, turn the clamps round, then confirm here."
    }));
  }

  // 9. The alert limits (a person agrees them with the customer) -----------
  const limitPoints = input.points.filter((point) => limitsFor(point.canonicalName).some((definition) => ALERT_LIMIT_KEYS.includes(definition.key)));
  if (limitPoints.length > 0) {
    const step = manualStep("limits", "Alert limits agreed with the customer", confirmation("limits"), {
      todo: "Greecon alerts people when a reading crosses its limits. Until they are changed, the standard ones apply.",
      next: "Go through the limits below with the customer. Change any that do not suit the site, then confirm here."
    });
    step.items = limitPoints.map((point) => {
      const parts = limitsFor(point.canonicalName)
        .filter((definition) => ALERT_LIMIT_KEYS.includes(definition.key))
        .map((definition) => {
          const set = point.thresholdConfig?.[definition.key];
          if (set !== undefined) return `${definition.label} ${set} ${definition.unit}`;
          return definition.fallback !== null ? `${definition.label} ${definition.fallback} ${definition.unit} (standard)` : `${definition.label}: not set, so no advice is given`;
        });
      return { label: point.label, status: step.status === "done" ? "done" : "todo", detail: parts.join("; ") };
    });
    steps.push(step);
  }

  // 10. Commissioning (a person confirms the numbers match the real world) ---
  const blocking = steps.filter((step) => !step.optional && step.status !== "done");
  const readyToCommission = blocking.length === 0;
  const commissioning = confirmation("commissioned");
  if (commissioning) {
    steps.push({ key: "commissioned", title: "Commissioned", status: "done", detail: "Checked on site against the real world.", manual: true, confirmedAtUtc: commissioning.atUtc, confirmedBy: commissioning.by, note: commissioning.note });
  } else if (readyToCommission) {
    steps.push({
      key: "commissioned",
      title: "Commissioned",
      status: "todo",
      detail: "Everything above is in place.",
      nextAction: "On site, compare what Greecon shows with what you can see: the meter's own display, the tank, the pressure gauge. When they agree, confirm here.",
      manual: true,
      canConfirm: true
    });
  } else {
    steps.push({
      key: "commissioned",
      title: "Commissioned",
      status: "waiting",
      detail: `${plural(blocking.length, "step")} above must be done first.`,
      nextAction: "Finish the steps above.",
      manual: true,
      canConfirm: false
    });
  }

  return {
    siteId: input.site.id,
    siteName: input.site.name,
    ...(input.templateKey ? { templateKey: input.templateKey } : {}),
    steps,
    doneCount: steps.filter((step) => step.status === "done").length,
    totalCount: steps.length,
    readyToCommission,
    commissioned: commissioning !== undefined,
    ...(commissioning ? { commissionedAtUtc: commissioning.atUtc, commissionedBy: commissioning.by } : {})
  };
}

function manualStep(key: string, title: string, confirmed: Confirmation | undefined, words: { todo: string; next: string }): SetupStep {
  if (confirmed) {
    return { key, title, status: "done", detail: "Checked on site.", manual: true, confirmedAtUtc: confirmed.atUtc, confirmedBy: confirmed.by, note: confirmed.note };
  }
  return { key, title, status: "todo", detail: words.todo, nextAction: words.next, manual: true, canConfirm: true };
}

/** Telling people has three parts the platform can see (a way to send, someone on the list, a test that the
 * provider accepted) and one it cannot: that the person read it. The last is confirmed by hand, once the first
 * three are in place, because a message accepted by a provider can still land in a spam folder. */
function toldStep(notifications: SetupNotifications, confirmed: Confirmation | undefined, nowMs: number): SetupStep {
  const base = { key: "told", title: "Someone is told when the site needs attention", manual: true } as const;
  const reachable = (notifications.emailOn && notifications.byEmail > 0) || (notifications.smsOn && notifications.bySms > 0);

  if (!notifications.emailOn && !notifications.smsOn) {
    return {
      ...base,
      status: "attention",
      canConfirm: false,
      detail: "This Greecon platform is not set up to send messages, so no alert would reach anyone.",
      nextAction: "Tell Greecon support: alert messages need the email service switched on before a site can be commissioned."
    };
  }
  if (notifications.contacts === 0) {
    return {
      ...base,
      status: "todo",
      canConfirm: false,
      detail: "Nobody is set to be told. Alerts show in Greecon, but nobody is sent a message.",
      nextAction: "Open Who is told and add the people who should hear first, in the order they should be told. Then send each of them a test message."
    };
  }
  if (!reachable) {
    return {
      ...base,
      status: "attention",
      canConfirm: false,
      detail: notifications.emailOn ? "Nobody on the list has an email address, and email is the way alerts reach people." : "Nobody on the list has a phone number, and text is the only way messages can go from this platform.",
      nextAction: "Open Who is told and add an address or number for each person."
    };
  }
  if (confirmed) {
    return { ...base, status: "done", detail: "A test message reached the person on the list.", canConfirm: true, confirmedAtUtc: confirmed.atUtc, confirmedBy: confirmed.by, note: confirmed.note };
  }
  if (notifications.lastTestAtMs === undefined) {
    return {
      ...base,
      status: "todo",
      canConfirm: false,
      detail: `${notifications.contacts === 1 ? "One person is" : `${notifications.contacts} people are`} on the list, and no test message has been sent yet.`,
      nextAction: "Open Who is told and send a test message to each person. Then ask them whether it arrived."
    };
  }
  return {
    ...base,
    status: "todo",
    canConfirm: true,
    detail: `A test message was sent ${describeAge(Math.max(0, (nowMs - notifications.lastTestAtMs) / 1000))} ago. Greecon cannot tell whether it was read.`,
    nextAction: "Ask the person whether the test message arrived, in the inbox and not in spam, and on their phone. When they say yes, confirm here."
  };
}
