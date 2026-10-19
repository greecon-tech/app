#!/usr/bin/env node
// Drives a running API through the project manager's whole job over HTTP, the way the web app and a
// box at a site do: onboard a customer, make a site from a template, address its devices, add the box,
// enrol it with its code, let it ask what to read and say how it is, and hand over. Unit tests cannot
// see wiring mistakes (a missing provider, a route the guard turns away, a validation rule that
// refuses a good request), and this can.
//
//   API_URL=http://127.0.0.1:4010 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-api.mjs
//
// The API must be running with a fresh database and BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD
// set to the same administrator, NODE_ENV=production and JWT_SECRET set.

import { API, call, check, failed, login, onboard, step } from "./lib/smoke-helpers.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD to the bootstrap administrator.");
  process.exit(2);
}

let failures = 0;
const flag = () => {
  failures = failed();
};

try {
  step("The API is up");
  const health = await call("GET", "/health");
  check(health.status === 200, "GET /health answers without a credential");
  const anonymous = await call("GET", "/sites");
  check(anonymous.status === 401, "GET /sites without a session is refused");

  step("Greecon onboards a customer");
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  check(admin.user.isPlatformAdmin === true, "the bootstrap administrator is a platform administrator");
  const suffix = Math.random().toString(36).slice(2, 8);
  const customer = await onboard(admin.token, `Smoke Hotel ${suffix}`, `owner-${suffix}@smoke.example`);
  check(customer.first.user.mustChangePassword === true, "the owner's first session is for choosing a password");
  const locked = await call("GET", "/sites", { token: customer.first.token });
  check(locked.status === 403 && locked.json?.code === "PASSWORD_CHANGE_REQUIRED", "a temporary-password session can do nothing else");
  const owner = customer.session;

  step("The project manager makes a site from the hotel template");
  const created = await call("POST", "/sites/from-template", { token: owner, body: { templateKey: "hotel", name: "Hotel Adriatik", locationName: "Durrës", timezone: "Europe/Tirane", currency: "EUR" } });
  check(created.status === 201, `POST /sites/from-template makes a site (${created.status})`);
  const siteId = created.json?.site?.id;
  check(typeof siteId === "string", "the site has an id");
  check(created.json?.setup?.steps?.some((s) => s.key === "box" && s.status === "todo"), "the checklist starts with the box to do");

  const refusedTemplate = await call("POST", "/sites/from-template", { token: owner, body: { templateKey: "castle", name: "x", locationName: "x" } });
  check(refusedTemplate.status === 400, "an unknown template is refused");

  const devices = (await call("GET", `/devices?siteId=${siteId}`, { token: owner })).json;
  check(Array.isArray(devices) && devices.length === 3, "the hotel has three devices");

  step("Each device is given an address");
  const bad = await call("PATCH", `/devices/${devices[0].id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "192.168.1.999", port: 502, unitId: 1 } } });
  check(bad.status === 400 && /IP address/.test(bad.text), "a wrong address is refused in words");
  for (const [index, device] of devices.entries()) {
    const set = await call("PATCH", `/devices/${device.id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "192.168.1.50", port: 502, unitId: index + 1 } } });
    check(set.status === 200 && set.json?.connection?.unitId === index + 1, `${device.name} has its address`);
  }

  step("A reading is tied to a register");
  const points = (await call("GET", "/points", { token: owner })).json.filter((p) => p.siteId === siteId);
  const tank = points.find((p) => p.canonicalName === "water.tank.level.percent");
  const mapped = await call("PATCH", `/points/${tank.id}`, { token: owner, body: { source: { kind: "modbus", registerType: "holding", address: 0, dataType: "uint16", linear: { rawLow: 4, rawHigh: 20, engLow: 0, engHigh: 100 } } } });
  check(mapped.status === 200 && mapped.json?.source?.linear?.rawHigh === 20, "the tank level has its register and 4-20 mA conversion");
  const wrong = await call("PATCH", `/points/${tank.id}`, { token: owner, body: { source: { kind: "modbus", registerType: "holding", address: -1, dataType: "uint16" } } });
  check(wrong.status === 400, "a register that cannot exist is refused");

  step("The box is added and given its code");
  const provisioned = await call("POST", "/gateways/provision", { token: owner, body: { siteId, name: "Plant room box" } });
  check(provisioned.status === 201, `POST /gateways/provision (${provisioned.status})`);
  const code = provisioned.json?.enrolment?.code;
  check(/^GRC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code ?? ""), "the code looks like GRC-XXXX-XXXX-XXXX");
  check(provisioned.json?.enrolment?.installCommand === `curl -fsSL ${API}/edge/install.sh | sudo bash -s -- ${code}`, "the install command names this API and the code");
  const gatewayId = provisioned.json?.gatewayId;

  step("The box presents its code");
  const noCode = await call("POST", "/edge/enrol", { body: { code: "hello" } });
  check(noCode.status === 400, "something that is not a code is refused");
  const unknown = await call("POST", "/edge/enrol", { body: { code: "GRC-AAAA-BBBB-CCCC" } });
  check(unknown.status === 401, "a code nobody issued is refused");
  const enrolled = await call("POST", "/edge/enrol", { body: { code } });
  check(enrolled.status === 201 && /^[0-9a-f]{64}$/.test(enrolled.json?.secret ?? ""), "a good code gives the box its credential");
  check(enrolled.json?.gatewayId === gatewayId && enrolled.json?.siteId === siteId && enrolled.json?.tenantId === customer.tenantId, "the credential says whose box it is");
  const secret = enrolled.json?.secret;
  const again = await call("POST", "/edge/enrol", { body: { code } });
  check(again.status === 401, "the same code cannot be used twice");

  step("The box asks what to read, and says how it is");
  const noCredential = await call("GET", "/edge/config");
  check(noCredential.status === 401, "GET /edge/config without a credential is refused");
  const asPerson = await call("GET", "/edge/config", { token: owner });
  check(asPerson.status === 403, "a person's session is not a box");
  const config = await call("GET", "/edge/config", { box: secret });
  check(config.status === 200 && config.json?.gatewayId === gatewayId, "GET /edge/config with the credential");
  check(config.json?.devices?.length === 3, "all three addressed devices are in the configuration");
  const gridDevice = config.json?.devices?.find((d) => d.name === "Grid meter");
  check(gridDevice?.points?.length === 2 && gridDevice.points[0].source.address === 52, "the grid meter reads two readings from register 52");
  const heartbeat = await call("POST", "/edge/heartbeat", {
    box: secret,
    body: {
      agentVersion: "smoke-1",
      uptimeSeconds: 5,
      sentAtUtc: new Date().toISOString(),
      bufferDepth: 0,
      configVersion: config.json.version,
      devices: devices.map((device) => ({ deviceId: device.id, ok: true, readingsOk: 2, readingsFailed: 0 }))
    }
  });
  check(heartbeat.status === 201 && heartbeat.json?.configVersion === config.json.version, "the heartbeat is answered with the configuration version");
  const badHeartbeat = await call("POST", "/edge/heartbeat", { box: secret, body: { agentVersion: "", devices: "none" } });
  check(badHeartbeat.status === 400, "a heartbeat that is not one is refused");
  const stolen = await call("GET", "/sites", { box: secret });
  check(stolen.status === 401, "the box's credential opens nothing else");

  step("The checklist follows");
  const setup = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
  const status = (key) => setup.steps.find((s) => s.key === key)?.status;
  check(status("box") === "done", "the box is online");
  check(status("addresses") === "done", "every device has an address");
  check(status("answering") === "done", "every device is answering");
  check(status("readings") === "waiting", "no readings have arrived yet");
  const early = await call("PUT", `/sites/${siteId}/setup/steps/commissioned`, { token: owner, body: {} });
  check(early.status === 409, "the site cannot be commissioned before the rest is done");
  const confirmed = await call("PUT", `/sites/${siteId}/setup/steps/direction`, { token: owner, body: { note: "Import rose with the kettle on" } });
  check(confirmed.status === 200 && confirmed.json?.steps?.find((s) => s.key === "direction")?.status === "done", "the grid direction can be confirmed by a person");
  const notManual = await call("PUT", `/sites/${siteId}/setup/steps/box`, { token: owner, body: {} });
  check(notManual.status === 400, "a step the platform works out cannot be confirmed by hand");

  step("A box's readings arrive");
  const now = new Date().toISOString();
  const gridImport = points.find((p) => p.canonicalName === "energy.grid.import.kw");
  const ingest = await call("POST", "/telemetry/ingest", {
    box: secret,
    body: {
      messageType: "telemetry",
      tenantId: customer.tenantId,
      siteId,
      deviceId: gridImport.deviceId,
      publishedAtUtc: now,
      correlationId: "smoke",
      readings: [{ timestampUtc: now, tenantId: customer.tenantId, siteId, deviceId: gridImport.deviceId, pointId: gridImport.id, canonicalName: "energy.grid.import.kw", value: 4.2, unit: "kW", quality: "OK", source: "edge", ingestionTimestampUtc: now }]
    }
  });
  check(ingest.status === 201 && ingest.json?.accepted === true, "a reading from the box is accepted");

  step("The handover sheet");
  const handover = await call("GET", `/sites/${siteId}/handover`, { token: owner });
  check(handover.status === 200 && handover.json?.customer === `Smoke Hotel ${suffix}`, "the handover names the customer");
  const grid = handover.json?.devices?.find((d) => d.name === "Grid meter");
  check(grid?.address === "192.168.1.50:502, unit 1" || /192\.168\.1\.50:502, unit \d/.test(grid?.address ?? ""), "the handover gives the device's address");
  check(handover.json?.devices?.some((d) => d.readings.some((r) => r.latestValue === 4.2)), "the handover shows the latest reading");

  step("Who is told when something needs a person");
  const state = await call("GET", "/notifications/status", { token: owner });
  check(state.status === 200 && state.json?.email?.configured === false && state.json?.sms?.configured === false, "this platform says plainly that it can send nothing");
  check(state.json?.words?.[0]?.startsWith("Alert messages are off on this Greecon platform."), "in words a person can read");
  const badList = await call("PUT", "/notifications/contacts", { token: owner, body: { contacts: [{ name: "Besa", email: "not an address" }] } });
  check(badList.status === 400 && /not an email address/.test(badList.text), "a mistyped address is refused in words");
  const list = await call("PUT", "/notifications/contacts", { token: owner, body: { contacts: [{ name: "Besa Krasniqi", email: `besa-${suffix}@smoke.example`, phone: "+355 69 123 4567" }] } });
  check(list.status === 200 && list.json?.[0]?.phone === "+355691234567" && typeof list.json?.[0]?.id === "string", "the list is saved, the number in international form");
  const contactId = list.json?.[0]?.id;
  const settings = await call("PUT", "/notifications/settings", { token: owner, body: { quietFrom: "23:00", quietTo: "06:30" } });
  check(settings.status === 200 && settings.json?.quietFrom === "23:00" && settings.json?.timezone === "Europe/Tirane", "quiet hours can be set, the rest staying as it was");
  check((await call("PUT", "/notifications/settings", { token: owner, body: { digestAt: "7am" } })).status === 400, "a time that is not a time is refused");
  const test = await call("POST", `/notifications/contacts/${contactId}/test`, { token: owner });
  check(test.status === 201 && test.json?.length === 2 && test.json.every((entry) => entry.status === "failed" && /not set up on this Greecon platform/.test(entry.error)), "a test message says it was not sent, and why");
  const notifyLog = await call("GET", "/notifications/log", { token: owner });
  check(notifyLog.status === 200 && notifyLog.json?.length === 2 && notifyLog.json.every((entry) => !entry.destination.includes("besa-")), "the log shows each attempt, the address hidden in part");
  const toldSetup = await call("GET", `/sites/${siteId}/setup`, { token: owner });
  const toldStep = toldSetup.json?.steps?.find((candidate) => candidate.key === "told");
  check(toldStep?.status === "attention" && toldStep?.canConfirm === false, "the checklist holds the site back, because nothing can be sent");
  const tooEarly = await call("PUT", `/sites/${siteId}/setup/steps/told`, { token: owner, body: {} });
  check(tooEarly.status === 409, "and refuses to confirm that people are told");
  check(handover.json?.told?.length === 0 || Array.isArray(handover.json?.told), "the handover has a list of who is told");

  step("The customer can take their data away");
  const csv = await call("GET", `/exports/readings.csv?siteId=${siteId}&days=7&resolution=hourly`, { token: owner });
  check(csv.status === 200 && csv.headers["content-type"]?.startsWith("text/csv") && /^attachment; filename="greecon-readings-.*-hourly\.csv"$/.test(csv.headers["content-disposition"] ?? ""), "the readings come as a spreadsheet file");
  // (fetch drops the byte-order mark when it reads text; the unit tests check it is written.)
  check(csv.text.startsWith("hour_utc,hour_local,site,device,reading,canonical_name,average,minimum,maximum,unit,samples\r\n"), "with a head row that says what each column is");
  check(csv.headers["cache-control"] === "no-store", "that nothing keeps a copy of");
  const euCsv = await call("GET", `/exports/readings.csv?siteId=${siteId}&days=7&resolution=raw&style=eu`, { token: owner });
  check(euCsv.status === 200 && euCsv.text.includes("time_utc;time_local;site;device;reading;canonical_name;value;unit;quality"), "and in the European style, with semicolons");
  const tooLong = await call("GET", `/exports/readings.csv?siteId=${siteId}&days=40&resolution=raw`, { token: owner });
  check(tooLong.status === 400 && /up to 31 days/.test(tooLong.text), "every reading for more than a month is refused, saying to ask for hourly averages");
  const alertsCsv = await call("GET", "/exports/alerts.csv?days=30", { token: owner });
  check(alertsCsv.status === 200 && alertsCsv.text.includes("raised_utc,raised_local,site,priority,alert"), "the alerts come as a spreadsheet too");
  const accountJson = await call("GET", "/exports/account.json", { token: owner });
  check(accountJson.status === 200 && accountJson.json?.format === "greecon-account-export/1" && accountJson.json?.sites?.length === 1, "everything about the account's setup comes as one file");
  check(!/password|secret|hash/i.test(JSON.stringify({ ...accountJson.json, about: "" })), "with nothing in it that would open the account");
  const exportAudit = (await call("GET", "/exports/audit.csv", { token: owner })).text;
  check(exportAudit.includes("export.downloaded") && exportAudit.includes("Hourly averages of Hotel Adriatik"), "and every download is in the audit trail, with what was taken");

  step("Another customer cannot reach any of it");
  const other = await onboard(admin.token, `Smoke Other ${suffix}`, `other-${suffix}@smoke.example`);
  for (const [method, path, body] of [
    ["GET", `/sites/${siteId}/setup`],
    ["GET", `/sites/${siteId}/handover`],
    ["PUT", `/sites/${siteId}/setup/steps/direction`, {}],
    ["POST", "/gateways/provision", { siteId, name: "Intruder" }],
    ["POST", `/gateways/${gatewayId}/enrolment`],
    ["POST", "/devices/from-profile", { siteId, profileKey: "eastron-sdm630-grid" }],
    ["POST", `/notifications/contacts/${contactId}/test`],
    ["GET", `/exports/readings.csv?siteId=${siteId}&days=7&resolution=hourly`]
  ]) {
    const result = await call(method, path, { token: other.session, body });
    check(result.status === 403 || result.status === 404, `${method} ${path} is refused for another customer (${result.status})`);
  }

  const theirList = await call("GET", "/notifications/contacts", { token: other.session });
  check(theirList.status === 200 && theirList.json?.length === 0, "another customer's list of people is their own, and empty");
  const theirLog = await call("GET", "/notifications/log", { token: other.session });
  check(theirLog.status === 200 && theirLog.json?.length === 0, "and so is its log");

  step("A replacement box");
  const newCode = await call("POST", `/gateways/${gatewayId}/enrolment`, { token: owner });
  check(newCode.status === 201, "a new code can be made for the same box");
  const replaced = await call("POST", "/edge/enrol", { body: { code: newCode.json.code } });
  check(replaced.status === 201 && replaced.json.secret !== secret, "the replacement box gets a new credential");
  const oldCredential = await call("GET", "/edge/config", { box: secret });
  check(oldCredential.status === 401, "the old credential stops working at once");
  check((await call("GET", "/edge/config", { box: replaced.json.secret })).status === 200, "the new credential works");

  step("Greecon's project manager opens the customer's account to set it up");
  const staff = admin.user;
  const opened = await call("POST", `/platform-admin/tenants/${customer.tenantId}/support-session`, { token: admin.token });
  check(opened.status === 201 && opened.json?.user?.support === true && opened.json?.customer === `Smoke Hotel ${suffix}`, "a platform administrator can open a customer's account");
  const support = opened.json?.token;
  check((await call("GET", "/sites", { token: support })).status === 200, "the session works in the customer's account");
  check((await call("GET", `/sites/${siteId}/setup`, { token: support })).status === 200, "and sees the site's setup");
  check((await call("GET", "/platform-admin/tenants", { token: support })).status === 403, "but not Greecon's own console");
  const noPeople = await call("POST", "/users", { token: support, body: { name: "New", email: `new-${suffix}@smoke.example`, role: "viewer" } });
  check(noPeople.status === 403 && /cannot add people/.test(noPeople.text), "it cannot add people to the account");
  const made = await call("POST", "/sites/from-template", { token: support, body: { templateKey: "blank", name: "Set up by staff", locationName: "x" } });
  check(made.status === 201, "it can set up a site");
  const audit = (await call("GET", "/audit", { token: owner })).json ?? [];
  check(audit.some((event) => event.eventType === "support.session_started" && event.actor === `Greecon staff (${staff.email})`), "the customer's audit trail says Greecon staff opened the account");
  check(audit.some((event) => event.eventType === "site.created" && event.actor === `Greecon staff (${staff.email})`), "and that the site was made by them");
  check((await call("POST", `/platform-admin/tenants/${customer.tenantId}/support-session`, { token: owner })).status === 403, "a customer's owner cannot open anyone's account");
  check((await call("POST", `/platform-admin/tenants/${customer.tenantId}/support-session`, { token: support })).status === 403, "nor can a support session open another");

  step("Greecon's own team: the owner gives the project manager a login of their own");
  const pmEmail = `pm-${suffix}@greecon.earth`;
  const added = await call("POST", "/platform-admin/staff", { token: admin.token, body: { name: "Arta Project", email: pmEmail } });
  check(added.status === 201 && typeof added.json?.temporaryPassword === "string", "the owner adds a project manager and is given a temporary password, once");
  const pmFirst = await login(pmEmail, added.json.temporaryPassword);
  check(pmFirst.user.isPlatformAdmin === true && pmFirst.user.mustChangePassword === true, "who signs in as Greecon staff, to choose a password of their own");
  const pmPassword = `Own-password-${suffix}-PM-1`;
  // A person takes a moment to choose a password. A session is dated to the second, and one opened in the very
  // second a password changes is kept, so that signing in straight after a reset is never refused.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const pmChanged = await call("POST", "/auth/change-password", { token: pmFirst.token, body: { currentPassword: added.json.temporaryPassword, newPassword: pmPassword } });
  check(pmChanged.status === 201 || pmChanged.status === 200, "and does");
  check((await call("GET", "/auth/session", { token: pmFirst.token })).status === 401, "the session the temporary password opened ends the moment the new password is chosen");
  const pm = await login(pmEmail, pmPassword);
  const team = await call("GET", "/platform-admin/staff", { token: pm.token });
  check(team.status === 200 && team.json.length >= 2 && team.json.some((member) => member.email === pmEmail && member.isYou === true), "the project manager sees the team, and which one is them");
  check((await call("POST", "/platform-admin/staff", { token: pm.token, body: { name: "More", email: `more-${suffix}@greecon.earth` } })).status === 403, "but cannot add anyone to it");
  check((await call("POST", "/platform-admin/staff", { token: admin.token, body: { name: "Again", email: pmEmail.toUpperCase() } })).status === 409, "an address already in use cannot be used again, however it is spelled");
  const onboardedAgain = await call("POST", "/platform-admin/tenants", { token: admin.token, body: { name: `Clash ${suffix}`, ownerName: "Owner", ownerEmail: `Owner-${suffix}@Smoke.example` } });
  check(onboardedAgain.status === 409, "nor can a customer's owner share an address with someone already signed up");
  const fleet = await call("GET", "/platform-admin/fleet", { token: pm.token });
  const fleetRow = fleet.json?.find?.((entry) => entry.client === `Smoke Hotel ${suffix}` && entry.site === "Hotel Adriatik");
  check(fleet.status === 200 && fleetRow !== undefined, "the project manager sees every customer's sites in one list");
  check(fleetRow?.box?.status === "never" && fleetRow?.commissionedAtUtc === undefined, "where the replacement box, installed but not yet heard from, says so, and the site is still being set up");
  check((await call("GET", "/platform-admin/fleet", { token: owner })).status === 403, "a customer cannot see that list");
  const pmOpened = await call("POST", `/platform-admin/tenants/${customer.tenantId}/support-session`, { token: pm.token });
  check(pmOpened.status === 201, "the project manager opens the customer's account");
  check((await call("GET", `/sites/${siteId}/setup`, { token: pmOpened.json.token })).status === 200, "and works in it");
  const pmAudit = (await call("GET", "/audit", { token: owner })).json ?? [];
  check(pmAudit.some((event) => event.eventType === "support.session_started" && event.actor === `Greecon staff (${pmEmail})`), "the customer's audit trail names the project manager, not the owner of Greecon");

  const off = await call("PATCH", `/platform-admin/staff/${pm.user.id}`, { token: admin.token, body: { status: "disabled" } });
  check(off.status === 200 && off.json?.status === "disabled", "the owner turns the project manager off");
  check((await call("GET", "/platform-admin/staff", { token: pm.token })).status === 401, "their open session ends on its next request, not hours later");
  check((await call("GET", `/sites/${siteId}/setup`, { token: pmOpened.json.token })).status === 401, "and so does the customer's account they had open");
  check((await call("POST", "/auth/login", { body: { email: pmEmail, password: pmPassword } })).status === 401, "and they cannot sign in again");
  const on = await call("PATCH", `/platform-admin/staff/${pm.user.id}`, { token: admin.token, body: { status: "active" } });
  check(on.status === 200, "turned back on, they can sign in again");
  check((await call("POST", "/auth/login", { body: { email: pmEmail, password: pmPassword } })).status < 300, "with the password they chose");
  check((await call("PATCH", `/platform-admin/staff/${admin.user.id}`, { token: admin.token, body: { status: "disabled" } })).status === 403, "the owner cannot turn themselves off");
} catch (error) {
  console.error(`\nThe smoke test could not finish: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

flag();
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
