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

  step("Another customer cannot reach any of it");
  const other = await onboard(admin.token, `Smoke Other ${suffix}`, `other-${suffix}@smoke.example`);
  for (const [method, path, body] of [
    ["GET", `/sites/${siteId}/setup`],
    ["GET", `/sites/${siteId}/handover`],
    ["PUT", `/sites/${siteId}/setup/steps/direction`, {}],
    ["POST", "/gateways/provision", { siteId, name: "Intruder" }],
    ["POST", `/gateways/${gatewayId}/enrolment`],
    ["POST", "/devices/from-profile", { siteId, profileKey: "eastron-sdm630-grid" }]
  ]) {
    const result = await call(method, path, { token: other.session, body });
    check(result.status === 403 || result.status === 404, `${method} ${path} is refused for another customer (${result.status})`);
  }

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
} catch (error) {
  console.error(`\nThe smoke test could not finish: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

flag();
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
