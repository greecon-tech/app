#!/usr/bin/env node
// Four sites from zero, as a project manager sets each one up: a hotel, a solar plant, a farm and a water station. For each, a customer
// is onboarded, a site is made from its template, the box is installed with the installer the platform serves and left running, and the
// equipment it talks to is a pretend kit that answers the way the real equipment does. The project manager presses Find equipment, and the
// addresses of the equipment Greecon knows are filled in by the box; gives the range printed on each transmitter's label; and types an address
// and a register only for the equipment Greecon does not know (a battery, a soil probe, a weather sensor). Then the things that go wrong in the
// field are done to it, one by one: a reversed clamp, a pump contact that is inverted, a probe in the air, a tank that empties, a meter that
// stops answering.
//
//   API_URL=http://127.0.0.1:4010 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-sites.mjs
//
// Same requirements as smoke-edge.mjs. The four sites run side by side, each with its own customer, box and equipment.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API, call, check, failed, login, onboard, step, until } from "./lib/smoke-helpers.mjs";
import { int16Word, microampsFor, startKit } from "./pretend-meter.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD to the bootstrap administrator.");
  process.exit(2);
}
const VERBOSE = process.env.SMOKE_SHOW === "1";
const run = (command, args, options = {}) => spawnSync(command, args, { encoding: "utf8", ...options });

// ---- What the equipment holds -----------------------------------------------------------------------------------------------
// The transmitters, as their labels read at every one of these sites: the level transmitter 0 to 5 m in a tank 4 m tall, the pressure
// transmitter 0 to 10 bar, the flow meter 0 to 200 litres a minute. A 4 to 20 mA module reports each as a current in microamps.
const LABEL = { levelRange: 5, tankHeight: 4, pressureRange: 10, flowRange: 200 };
const level = (percent) => microampsFor(LABEL.levelRange, (percent / 100) * LABEL.tankHeight);
const waterChannels = ({ tank = 62, pressure = 3.1, flow = 14 } = {}) => [level(tank), microampsFor(LABEL.pressureRange, pressure), microampsFor(LABEL.flowRange, flow)];
const RANGES = [
  { canonicalName: "water.tank.level.percent", range: LABEL.levelRange, tankHeight: LABEL.tankHeight },
  { canonicalName: "water.pressure.bar", range: LABEL.pressureRange },
  { canonicalName: "water.flow.lpm", range: LABEL.flowRange }
];

const KINDS = [
  {
    key: "hotel",
    template: "hotel",
    customer: "Hotel Adriatik",
    siteName: "Hotel Adriatik",
    place: "Durrës",
    // Equipment Greecon knows: found by the box, at the number each has in every kit.
    found: { "Grid meter": 1, "Solar meter": 2, "Water I/O module": 3, "Pump contact module (optional)": 5 },
    // Equipment it does not know: its address is typed.
    typed: {},
    kit: () => ({ meters: { 1: { watts: 4200 }, 2: { watts: 6800 } }, analog: { 3: { channels: waterChannels() } }, digital: { 5: { inputs: [1] } } }),
    ranges: "Water I/O module",
    mapping: {},
    expect: { "energy.grid.import.kw": 4.2, "energy.grid.export.kw": 0, "energy.solar.power.kw": 6.8, "water.tank.level.percent": 62, "water.pressure.bar": 3.1, "water.flow.lpm": 14, "water.pump.status": 1 }
  },
  {
    key: "solar",
    template: "solar_grid",
    customer: "Vila Mare Energji",
    siteName: "Vila Mare solar plant",
    place: "Vlorë",
    found: { "Grid meter": 1, "Solar meter": 2, "Load meter (optional)": 4 },
    typed: { "Battery system (optional)": 8 },
    // The plant is sending 3 kW to the grid (negative power at the grid meter) while it makes 7.2 and the site uses 4.2; a battery at 55 % charging at 1.5 kW.
    // It is a single-phase plant: the grid meter is an SDM230, not the SDM630 the template plans, and the box finds that out.
    kit: () => ({
      meters: { 1: { watts: -3000, model: "SDM230" }, 2: { watts: 7200 }, 4: { watts: 4200 } },
      analog: {},
      digital: {},
      others: { 8: { holding: { 0: 550, 1: int16Word(1500) } } }
    }),
    mapping: {
      "Battery system (optional)": {
        "Battery charge": { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", scale: 0.1 },
        "Battery power": { kind: "modbus", registerType: "holding", address: 1, dataType: "int16", scale: 0.001 }
      }
    },
    expect: { "energy.grid.import.kw": 0, "energy.grid.export.kw": 3, "energy.solar.power.kw": 7.2, "energy.consumption.kw": 4.2, "energy.battery.soc.percent": 55, "energy.battery.power.kw": 1.5 }
  },
  {
    key: "farm",
    template: "farm_irrigation",
    customer: "Ferma Hoxha",
    siteName: "Ferma Hoxha, Lushnjë",
    place: "Lushnjë",
    found: { "Water I/O module": 3, "Pump contact module (optional)": 5 },
    typed: { "Soil probe": 6, "Weather sensor": 7 },
    // Soil at 24.3 %, a frosty morning: -3.5 C and 88 % humidity. Air temperature is a signed number of tenths of a degree.
    kit: () => ({
      meters: {},
      analog: { 3: { channels: waterChannels({ tank: 80, pressure: 2.4, flow: 22 }) } },
      digital: { 5: { inputs: [1] } },
      others: { 6: { holding: { 0: 243 } }, 7: { holding: { 0: int16Word(-35), 1: 880 } } }
    }),
    ranges: "Water I/O module",
    mapping: {
      "Soil probe": { "Soil moisture": { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", scale: 0.1 } },
      "Weather sensor": {
        "Air temperature": { kind: "modbus", registerType: "holding", address: 0, dataType: "int16", scale: 0.1 },
        Humidity: { kind: "modbus", registerType: "holding", address: 1, dataType: "uint16", scale: 0.1 }
      }
    },
    expect: { "agri.soil.moisture.percent": 24.3, "agri.air.temperature.c": -3.5, "agri.humidity.percent": 88, "water.tank.level.percent": 80, "water.pressure.bar": 2.4, "water.flow.lpm": 22, "water.pump.status": 1 }
  },
  {
    key: "water",
    template: "water_station",
    customer: "Ujësjellësi Fshati",
    siteName: "Pump station Fshati",
    place: "Berat",
    found: { "Water I/O module": 3, "Pump contact module (optional)": 5, "Pump meter (optional)": 4 },
    typed: {},
    kit: () => ({ meters: { 4: { watts: 2300, model: "SDM230" } }, analog: { 3: { channels: waterChannels({ tank: 45, pressure: 4.2, flow: 31 }) } }, digital: { 5: { inputs: [1] } } }),
    ranges: "Water I/O module",
    mapping: {},
    expect: { "water.tank.level.percent": 45, "water.pressure.bar": 4.2, "water.flow.lpm": 31, "water.pump.status": 1, "energy.consumption.kw": 2.3 }
  }
];

// ---- One site, from zero --------------------------------------------------------------------------------------------------------

async function site(kind, admin, workDir) {
  const say = (message) => console.log(`[${kind.key}] ${message}`);
  const ok = (condition, message) => check(condition, `[${kind.key}] ${message}`);
  const show = (label, value) => VERBOSE && console.log(`[${kind.key}] ${label}: ${JSON.stringify(value)}`);
  let equipment;
  let box;
  try {
    // 1. Greecon onboards the customer; the project manager makes the site from the template.
    const suffix = Math.random().toString(36).slice(2, 8);
    const customer = await onboard(admin.token, `${kind.customer} ${suffix}`, `${kind.key}-${suffix}@smoke.example`);
    const owner = customer.session;
    const created = await call("POST", "/sites/from-template", { token: owner, body: { templateKey: kind.template, name: kind.siteName, locationName: kind.place } });
    ok(created.status === 201, `the site is made from the ${kind.template} template`);
    const siteId = created.json.site.id;
    const devices = (await call("GET", `/devices?siteId=${siteId}`, { token: owner })).json;
    ok([...Object.keys(kind.found), ...Object.keys(kind.typed)].every((name) => devices.some((device) => device.name === name)), `the template brought ${devices.map((device) => device.name).join(", ")}`);
    const firstSetup = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
    show("first checklist", firstSetup.steps.map((entry) => `${entry.key}:${entry.status}`));
    const startingHealth = (await call("GET", "/sites", { token: owner })).json.find((entry) => entry.id === siteId);
    show("health before anything", startingHealth?.health);

    // 2. The box is added, installed with the platform's own installer, and run.
    const provisioned = await call("POST", "/gateways/provision", { token: owner, body: { siteId, name: "Plant room box" } });
    const code = provisioned.json.enrolment.code;
    const served = await call("GET", "/edge/install.sh");
    const root = join(workDir, `${kind.key}-root`);
    const stateDir = join(workDir, `${kind.key}-state`);
    mkdirSync(stateDir, { recursive: true });
    const env = { ...process.env, GREECON_ROOT: root, GREECON_SKIP_SYSTEM: "1", GREECON_NODE: process.execPath, GREECON_API_URL: API };
    const install = run("bash", ["-s", "--", code], { input: served.text, env });
    ok(install.status === 0, "the installer finishes");
    if (install.status !== 0) say(install.stdout + install.stderr);
    equipment = await startKit(kind.kit());
    box = spawn(join(root, "usr/local/bin/greecon-edge"), ["run"], { env: { ...env, STATE_DIRECTORY: stateDir }, stdio: ["ignore", "pipe", "pipe"] });
    let boxLog = "";
    box.stdout.on("data", (chunk) => (boxLog += chunk));
    box.stderr.on("data", (chunk) => (boxLog += chunk));
    const online = await until("the box to be heard from", async () => (await call("GET", `/gateways?siteId=${siteId}`, { token: owner })).json?.[0]?.contact === "online", { timeoutMs: 60_000 }).catch(() => false);
    ok(online === true, "the platform hears the box");

    // 3. The project manager presses Find equipment. The box looks at the converter and says what answers; the addresses of the equipment Greecon
    //    knows are filled in. (The pretend kit is on this machine and not on a network the box would look over, so the project manager gives its address.)
    const asked = await call("POST", `/sites/${siteId}/discovery`, { token: owner, body: { host: "127.0.0.1", port: equipment.port } });
    ok(asked.status === 201 || asked.status === 200, `Find equipment is pressed (${asked.status} ${asked.text.slice(0, 100)})`);
    const discovery = await until(
      "the box to say what it found",
      async () => {
        const view = (await call("GET", `/sites/${siteId}/discovery`, { token: owner })).json;
        return view?.state === "done" ? view : undefined;
      },
      { timeoutMs: 90_000, everyMs: 1000 }
    ).catch(() => undefined);
    ok(discovery !== undefined, "the box looks at the converter and says what it found");
    if (discovery) {
      show("discovery", discovery.proposals.map((proposal) => `${proposal.name}:${proposal.status}`));
      for (const [name, unit] of Object.entries(kind.found)) {
        const proposal = discovery.proposals.find((entry) => entry.name === name);
        ok(proposal?.status === "already" && proposal.match?.unit === unit, `${name} was found at unit ${unit} and its address filled in (${proposal?.status}: ${proposal?.message})`);
      }
      for (const name of Object.keys(kind.typed)) {
        ok(discovery.proposals.find((entry) => entry.name === name)?.status === "by-hand", `${name}, which Greecon does not know, is left to be addressed by hand`);
      }
    }
    const filledIn = (await call("GET", `/devices?siteId=${siteId}`, { token: owner })).json;
    for (const [name, unit] of Object.entries(kind.found)) {
      const device = filledIn.find((entry) => entry.name === name);
      ok(device?.connection?.port === equipment.port && device.connection.unitId === unit, `${name} reads from unit ${unit} of the converter (${JSON.stringify(device?.connection)})`);
    }
    if (kind.key === "solar") {
      const grid = filledIn.find((entry) => entry.name === "Grid meter");
      ok(grid?.profileKey === "eastron-sdm230-grid", `the grid meter, a single-phase SDM230 where the template planned a three-phase one, is read as one (${grid?.profileKey})`);
    }

    // 3b. What Greecon does not know is addressed from the datasheet, and its registers are mapped.
    for (const [name, unitId] of Object.entries(kind.typed)) {
      const device = filledIn.find((entry) => entry.name === name);
      const set = await call("PATCH", `/devices/${device.id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "127.0.0.1", port: equipment.port, unitId } } });
      if (set.status !== 200) ok(false, `${name} takes its address (${set.status} ${set.text.slice(0, 120)})`);
    }
    // 3c. The range on each transmitter's label is the only thing the module is asked for.
    if (kind.ranges) {
      const module = filledIn.find((entry) => entry.name === kind.ranges);
      const given = await call("PUT", `/devices/${module.id}/ranges`, { token: owner, body: { ranges: RANGES } });
      ok(given.status === 200, `the ranges on the transmitters' labels are given (${given.status} ${given.text.slice(0, 160)})`);
    }
    const points = (await call("GET", "/points", { token: owner })).json.filter((point) => point.siteId === siteId);
    for (const [deviceName, readings] of Object.entries(kind.mapping)) {
      const device = devices.find((entry) => entry.name === deviceName);
      for (const [label, source] of Object.entries(readings)) {
        const point = points.find((entry) => entry.deviceId === device.id && entry.label === label);
        if (!point) {
          ok(false, `${deviceName} has a reading called ${label}`);
          continue;
        }
        const mapped = await call("PATCH", `/points/${point.id}`, { token: owner, body: { source } });
        if (mapped.status !== 200) ok(false, `${label} takes its register (${mapped.status} ${mapped.text.slice(0, 160)})`);
      }
    }

    // 4. Readings arrive, and are what the equipment holds.
    const wanted = Object.keys(kind.expect);
    const latest = await until(
      "every reading to arrive",
      async () => {
        const rows = (await call("GET", `/telemetry/latest?siteId=${siteId}`, { token: owner })).json ?? [];
        return wanted.every((name) => rows.some((row) => row.canonicalName === name)) ? rows : undefined;
      },
      { timeoutMs: 90_000 }
    ).catch(() => undefined);
    ok(latest !== undefined, `all ${wanted.length} readings of the template arrive from the box`);
    if (!latest) {
      say(boxLog.slice(-1500));
      return { say, ok, show, owner, siteId, equipment, devices, points };
    }
    for (const [name, value] of Object.entries(kind.expect)) {
      const reading = latest.find((row) => row.canonicalName === name);
      ok(typeof reading?.value === "number" && Math.abs(reading.value - value) <= Math.max(0.05, Math.abs(value) * 0.01), `${name} is ${value} (it reads ${reading?.value})`);
    }
    const afterSetup = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
    show("checklist with readings", afterSetup.steps.map((entry) => `${entry.key}:${entry.status}`));
    const health = (await call("GET", "/sites", { token: owner })).json.find((entry) => entry.id === siteId);
    show("health with readings", health?.health);
    const flowAnswer = (await call("GET", `/sites/${siteId}`, { token: owner })).json;
    show("site detail keys", Object.keys(flowAnswer ?? {}));
    const states = (await call("GET", `/derived-states?siteId=${siteId}`, { token: owner })).json;
    show("derived states", (states ?? []).map((state) => `${state.stateKey}=${state.stateValue}`));
    const alerts = (await call("GET", `/alerts?siteId=${siteId}`, { token: owner })).json;
    show("alerts", (alerts ?? []).map((alert) => `${alert.severity}:${alert.title}`));
    const afterAll = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
    for (const key of ["addresses", "mapping", "answering", "readings"]) {
      ok(afterAll.steps.find((entry) => entry.key === key)?.status === "done", `the setup list says ${key} is done (${afterAll.steps.find((entry) => entry.key === key)?.detail})`);
    }
    const context = { say, ok, show, owner, siteId, equipment, devices, points, kind, boxLog: () => boxLog, admin, customer };
    await scenarios[kind.key]?.(context);
    return context;
  } catch (error) {
    check(false, `[${kind.key}] could not finish: ${error instanceof Error ? error.message : String(error)}`);
    return { equipment };
  } finally {
    if (box) {
      box.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(), 5000);
        box.on("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }
}

// ---- What goes wrong in the field ----------------------------------------------------------------------------------------------

const waitFor = (description, probe, timeoutMs = 90_000) => until(description, probe, { timeoutMs, everyMs: 1000 }).catch(() => undefined);
const siteView = async ({ owner, siteId }) => (await call("GET", `/sites/${siteId}`, { token: owner })).json;
const healthOf = async ({ owner, siteId }) => (await call("GET", "/sites", { token: owner })).json.find((entry) => entry.id === siteId)?.health;
const alertsOf = async ({ owner, siteId }) => (await call("GET", `/alerts?siteId=${siteId}`, { token: owner })).json ?? [];
const statesOf = async ({ owner, siteId }) => (await call("GET", `/derived-states?siteId=${siteId}`, { token: owner })).json ?? [];
const setupOf = async ({ owner, siteId }) => (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
const pointOf = (context, canonicalName) => context.points.find((point) => point.canonicalName === canonicalName);
const stateIs = async (context, key, value) => (await statesOf(context)).find((state) => state.stateKey === key)?.stateValue === value;
const waitForState = (context, key, value, timeoutMs = 60_000) => waitFor(`${key} to be ${value}`, async () => ((await stateIs(context, key, value)) ? true : undefined), timeoutMs);

/** What every site with a water module goes through: a module that goes quiet, a tank that empties, a pump that runs against nothing. */
async function waterTrouble(context, moduleUnit = 3) {
  const { ok, show, equipment } = context;
  const tank = pointOf(context, "water.tank.level.percent");

  // A module that stops answering: the platform names it and the address that did not answer, and the site stops saying it is fine.
  const limited = await call("PATCH", `/points/${tank.id}`, { token: context.owner, body: { thresholdConfig: { max_age_seconds: 30 } } });
  ok(limited.status === 200, `the tank is told to be out of date after 30 seconds (${limited.status})`);
  equipment.silence(moduleUnit);
  const silent = await waitFor("the checklist to say the module does not answer", async () => (await setupOf(context)).steps.find((entry) => entry.key === "answering")?.items?.find((item) => item.status === "attention"));
  ok(silent !== undefined && /no answer from 127\.0\.0\.1:\d+ \(unit \d+\)/.test(silent.detail ?? ""), `a module that stops answering is named, with the address that did not answer (${silent?.label}: ${silent?.detail})`);
  const quiet = await waitFor("the site to say its readings are out of date", async () => {
    const health = await healthOf(context);
    return health && health.state !== "stable" && /out of date/i.test(health.reasons.map((reason) => reason.message).join(" ")) ? health : undefined;
  }, 120_000);
  show("health while the module is silent", quiet);
  ok(quiet !== undefined, "readings that stop coming turn the site from Stable to a state that says they are out of date");
  equipment.answerAgain(moduleUnit);
  const back = await waitFor("the module to answer again", async () => (await setupOf(context)).steps.find((entry) => entry.key === "answering")?.status === "done");
  ok(back !== undefined, "and it is reading again as soon as it answers");
  await call("PATCH", `/points/${tank.id}`, { token: context.owner, body: { thresholdConfig: { max_age_seconds: 900 } } });

  // A tank that empties.
  equipment.setChannel(moduleUnit, 1, level(8));
  const critical = await waitFor("an alert for the nearly empty tank", async () => (await alertsOf(context)).find((alert) => alert.category === "water_tank_critical" && alert.status !== "resolved"));
  ok(critical !== undefined && critical.severity === "critical", "a tank at 8 % opens an Act now alert, with what to do first");
  ok(Boolean(critical?.suggestedAction), `and says what to do first: ${critical?.suggestedAction}`);
  equipment.setChannel(moduleUnit, 1, level(70));

  // A pump that runs against nothing.
  equipment.setChannel(moduleUnit, 3, microampsFor(LABEL.flowRange, 0));
  const dry = await waitFor("a no-flow alert", async () => (await alertsOf(context)).find((alert) => alert.category === "pump_dry_run_risk" && alert.status !== "resolved"), 120_000);
  ok(dry !== undefined && dry.severity === "critical", "a pump that runs with no flow for 30 seconds opens an Act now alert");
  equipment.setChannel(moduleUnit, 3, microampsFor(LABEL.flowRange, 14));

  // A reading that cannot be real: a level transmitter whose wire has come off reads no current at all, which is below the 4 mA of an empty tank.
  equipment.setChannel(moduleUnit, 1, 0);
  const bad = await waitFor("the reading that cannot be real to be named", async () => (await setupOf(context)).steps.find((entry) => entry.key === "readings")?.items?.find((item) => item.status === "attention"), 60_000);
  ok(bad !== undefined && /cannot be a tank level/.test(bad.detail ?? ""), `a tank level below 0 % (a broken wire) is called out as one that cannot be real (${bad?.label}: ${bad?.detail ?? ""})`.slice(0, 240));
  equipment.setChannel(moduleUnit, 1, level(62));

  // A pump contact that is wired the wrong way round reads stopped while the pump runs: the person checks it by eye (the profile says so), and the
  // platform shows what the contact says, which is the thing to compare.
  equipment.setContact(5, 1, false);
  const stopped = await waitFor("the pump to read stopped", async () => {
    const rows = (await call("GET", `/telemetry/latest?siteId=${context.siteId}`, { token: context.owner })).json ?? [];
    return rows.find((row) => row.canonicalName === "water.pump.status" && row.value === 0);
  }, 60_000);
  ok(stopped !== undefined, "an open pump contact reads as the pump stopped");
  equipment.setContact(5, 1, true);
}

/** A customer that Greecon suspends (it has stopped paying, or has left): nobody in it gets in, with or without a session, and says why; the
 * box is turned away and says so in its own log; and when the customer is turned back on the same session is good and the box is heard again. */
async function suspension(context) {
  const { ok, equipment, owner, siteId, admin, customer, boxLog } = context;
  const status = (value) => call("PATCH", `/platform-admin/tenants/${customer.tenantId}/status`, { token: admin.token, body: { status: value } });

  ok((await status("suspended")).status === 200, "Greecon suspends the customer");
  const turnedAway = await call("GET", "/sites", { token: owner });
  ok(turnedAway.status === 403 && /suspended/i.test(turnedAway.text), `a person already signed in is turned away at once, and told why (${turnedAway.status})`);
  const signIn = await call("POST", "/auth/login", { body: { email: customer.ownerEmail, password: customer.ownPassword } });
  ok(signIn.status === 401 && /suspended/i.test(signIn.text), `a new sign-in with the right password is refused, with the same reason (${signIn.status})`);
  const wrong = await call("POST", "/auth/login", { body: { email: customer.ownerEmail, password: "not-the-password-1" } });
  ok(wrong.status === 401 && /Invalid email or password/.test(wrong.text) && !/suspended/i.test(wrong.text), "while a wrong password is still only a wrong password");

  equipment.setChannel(3, 1, level(33));
  const refused = await waitFor("the box to be turned away", async () => (/the platform answered 403/.test(boxLog()) ? true : undefined), 60_000);
  ok(refused !== undefined, "the box is turned away, and says so in its own log");

  ok((await status("active")).status === 200, "Greecon turns the customer back on");
  const again = await call("GET", "/sites", { token: owner });
  ok(again.status === 200, `the session that was turned away works again, without signing in (${again.status})`);
  const heard = await waitFor("the box to be heard again, with what the equipment holds now", async () => {
    const tank = ((await call("GET", `/telemetry/latest?siteId=${siteId}`, { token: owner })).json ?? []).find((row) => row.canonicalName === "water.tank.level.percent");
    return tank && Math.abs(tank.value - 33) < 0.5 ? tank : undefined;
  });
  ok(heard !== undefined, "and the platform has what the box reads again");
  equipment.setChannel(3, 1, level(62));
}

const scenarios = {
  async hotel(context) {
    await waterTrouble(context);
    const handover = (await call("GET", `/sites/${context.siteId}/handover`, { token: context.owner })).json;
    context.ok(handover.devices.every((device) => device.address && device.readings.every((reading) => reading.register)), "the handover sheet gives every device its address and every reading its register");
  },
  async water(context) {
    await waterTrouble(context);
    await suspension(context);
  },
  async solar(context) {
    const { ok, show, equipment, owner, siteId, devices } = context;
    const flow = (await siteView(context)).energyFlow;
    ok(flow?.headline === "Exporting 3.0 kW to the grid.", `a plant making 7.2 kW and using 4.2 says so in one sentence (${flow?.headline})`);
    ok(flow?.links?.battery?.socPercent === 55, "and shows the battery at 55 %");

    // The grid meter's clamps are on the wrong way round: at night the site "exports" what it uses.
    equipment.setWatts(2, 0);
    equipment.setWatts(4, 500);
    equipment.setWatts(1, -500);
    equipment.setHolding(8, 1, int16Word(0));
    const suspect = await waitForState(context, "energy.grid.direction_suspect", true);
    ok(suspect !== undefined, "energy that goes out at night is called out as a meter fitted the wrong way round");
    const reversed = (await siteView(context)).energyFlow;
    show("energy flow with the clamps reversed at night", reversed?.headline);
    // Turned the right way again: the suspicion goes.
    equipment.setWatts(1, 500);
    const sane = await waitForState(context, "energy.grid.direction_suspect", false);
    ok(sane !== undefined, "and goes again when the clamps are turned round");

    // A battery that runs low overnight, discharging.
    equipment.setHolding(8, 0, 120);
    equipment.setHolding(8, 1, int16Word(-800));
    const constrained = await waitForState(context, "energy.battery.constrained", true);
    ok(constrained !== undefined, "a battery at 12 % is called out as constrained");
    equipment.setHolding(8, 0, 550);
    equipment.setHolding(8, 1, int16Word(1500));

    // No battery after all, and no load meter: the plant is set up without them and nothing about them stays on the list.
    const battery = devices.find((device) => device.name === "Battery system (optional)");
    const load = devices.find((device) => device.name === "Load meter (optional)");
    ok((await call("DELETE", `/devices/${battery.id}`, { token: owner })).status < 300 && (await call("DELETE", `/devices/${load.id}`, { token: owner })).status < 300, "the battery and the load meter, not fitted, are taken off the list");
    const listed = (await setupOf(context)).steps.flatMap((step) => (step.items ?? []).map((item) => item.label));
    ok(!listed.some((label) => /battery|load meter/i.test(label)), "and the setup list no longer asks for their readings");

    // What the value screen says with no price, and with a plant that is not allowed to export.
    const noPrices = (await call("GET", `/sites/${siteId}/value?period=month`, { token: owner })).json;
    ok(noPrices.missing?.length > 0 && /price/i.test(JSON.stringify(noPrices.missing)), `with no prices entered it says what is missing and how to enter it (${noPrices.missing?.map((item) => item.what).join("; ")})`);
    await call("PUT", `/sites/${siteId}/profile`, { token: owner, body: { zeroExport: true, importPricePerKwh: 0.14 } });
    const zero = (await call("GET", `/sites/${siteId}/value?period=month`, { token: owner })).json;
    ok(zero.prices?.importPerKwh === 0.14 && !JSON.stringify(zero.missing ?? []).includes("Electricity price"), "with the price entered, the value no longer asks for it");
  },
  async farm(context) {
    const { ok, show, equipment, owner, siteId } = context;
    const soil = pointOf(context, "agri.soil.moisture.percent");
    const air = pointOf(context, "agri.air.temperature.c");

    // Until the grower says what dry is, and what frost is, the platform says nothing about either.
    ok(!(await statesOf(context)).some((state) => state.stateKey === "agri.irrigation_required" || state.stateKey === "agri.frost_risk"), "with no limits set, nothing is said about irrigation or frost");
    const setups = (await setupOf(context)).steps.find((entry) => entry.key === "limits");
    ok(/not set, so the platform says nothing about it/.test(JSON.stringify(setups?.items ?? [])), "and the limits step says so for each of them");

    ok((await call("PATCH", `/points/${soil.id}`, { token: owner, body: { thresholdConfig: { irrigate_below: 30 } } })).status === 200, "the grower's irrigation limit is entered");
    ok((await waitForState(context, "agri.irrigation_required", true, 60_000)) !== undefined, "a soil at 24.3 % below the grower's 30 % says irrigation is needed");
    ok(!(await alertsOf(context)).some((alert) => /soil|irrigat/i.test(alert.title)), "which is ordinary operation, not an alert");

    const set = await call("PATCH", `/points/${air.id}`, { token: owner, body: { thresholdConfig: { frost_below: 1 } } });
    ok(set.status === 200, `the grower's frost limit is entered (${set.status})`);
    ok((await waitForState(context, "agri.frost_risk", true, 60_000)) !== undefined, "an air temperature of -3.5 C, below the grower's 1 C, is frost");
    equipment.setHolding(7, 0, int16Word(62));
    ok((await waitForState(context, "agri.frost_risk", false, 60_000)) !== undefined, "and is not frost at 6.2 C");
    equipment.setHolding(7, 0, int16Word(-35));
    const bad = await call("PATCH", `/points/${air.id}`, { token: owner, body: { thresholdConfig: { frost_below: 99 } } });
    ok(bad.status === 400, "a frost limit that cannot be right (99 C) is refused");
    show("health at the end", await healthOf(context));
    void siteId;
  }
};

const workDir = mkdtempSync(join(tmpdir(), "greecon-smoke-sites-"));
let exitCode = 0;
try {
  step("Four sites from zero");
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const only = process.env.SMOKE_ONLY?.split(",");
  const results = await Promise.all(KINDS.filter((kind) => !only || only.includes(kind.key)).map((kind) => site(kind, admin, workDir)));
  for (const result of results) result?.equipment?.close();
} catch (error) {
  console.error(`\nThe site smoke test could not finish: ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

const failures = failed();
console.log(failures === 0 && exitCode === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 && exitCode === 0 ? 0 : 1);
