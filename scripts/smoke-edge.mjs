#!/usr/bin/env node
// Installs a box the way a project manager does, from the installer the platform serves, and runs it
// against a pretend meter: the software that is built into the platform, the installer, the box's own
// process, the Modbus conversation and the platform's checklist, all at once, over real sockets.
//
//   API_URL=http://127.0.0.1:4010 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-edge.mjs
//
// Same requirements as smoke-api.mjs, and the box software must have been built into the API
// (npm run build:edge-bundle) so that there is something to install.

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API, call, check, failed, login, onboard, step, until } from "./lib/smoke-helpers.mjs";
import { startMeter } from "./pretend-meter.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD to the bootstrap administrator.");
  process.exit(2);
}

const run = (command, args, options = {}) => spawnSync(command, args, { encoding: "utf8", ...options });

const workDir = mkdtempSync(join(tmpdir(), "greecon-smoke-edge-"));
let boxProcess;
let meter;
let exitCode = 0;

try {
  step("A customer with a hotel site, and a box added to it");
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const suffix = Math.random().toString(36).slice(2, 8);
  const customer = await onboard(admin.token, `Edge Hotel ${suffix}`, `edge-${suffix}@smoke.example`);
  const owner = customer.session;
  const created = await call("POST", "/sites/from-template", { token: owner, body: { templateKey: "hotel", name: "Hotel Edge", locationName: "Vlorë" } });
  const siteId = created.json.site.id;
  const provisioned = await call("POST", "/gateways/provision", { token: owner, body: { siteId, name: "Plant room box" } });
  const code = provisioned.json.enrolment.code;
  check(provisioned.status === 201 && Boolean(code), "the box is added and has a code");

  step("The installer the platform serves");
  const served = await call("GET", "/edge/install.sh");
  check(served.status === 200 && served.text.includes(`${API}`) && !served.text.includes("__GREECON_API_URL__"), "GET /edge/install.sh names this platform");
  const noCode = await call("GET", "/edge/bundle.json");
  check(noCode.status === 401, "the software is not given to someone with no code");
  const wrongCode = await call("GET", "/edge/bundle.json", { headers: { "x-enrolment-code": "GRC-AAAA-BBBB-CCCC" } });
  check(wrongCode.status === 401, "or with a code nobody issued");
  const peek = await call("GET", "/edge/bundle.json", { headers: { "x-enrolment-code": code } });
  check(peek.status === 200 && /^[0-9a-f]{64}$/.test(peek.json?.sha256 ?? ""), "but is described to a box with its code");
  const version = peek.json?.version;

  step("Running the installer, with the script arriving on standard input as it does from curl");
  const root = join(workDir, "root");
  const env = { ...process.env, GREECON_ROOT: root, GREECON_SKIP_SYSTEM: "1", GREECON_NODE: process.execPath, GREECON_API_URL: API };
  const install = run("bash", ["-s", "--", code], { input: served.text, env });
  check(install.status === 0, `the installer finishes (exit ${install.status})`);
  if (install.status !== 0) console.error(install.stdout, install.stderr);
  const identityPath = join(root, "etc/greecon/edge.json");
  const command = join(root, "usr/local/bin/greecon-edge");
  check(existsSync(identityPath) && (statSync(identityPath).mode & 0o777) === 0o600, "the box's credential is saved, readable only by its owner");
  check(!install.stdout.includes(JSON.parse(readFileSync(identityPath, "utf8")).secret), "and is not printed");
  check(run(command, ["version"], { env }).stdout.trim() === version, "the installed software is the version the platform has");
  check(readlinkSync(join(root, "opt/greecon/edge/current")).endsWith(version), "and is the current one");
  check(existsSync(join(root, "opt/greecon/run-edge")), "the program the service runs is in place");

  const again = run("bash", ["-s", "--", code], { input: served.text, env });
  check(again.status !== 0 && /Greecon did not give the software|not accepted/.test(again.stderr), "the same code cannot install a second box");
  const repair = run("bash", ["-s"], { input: served.text, env });
  check(repair.status === 0 && /already has its credential/.test(repair.stdout), "running it again without a code repairs the installation and keeps the box's credential");

  step("The box is told what to read, and reads it");
  meter = await startMeter({ watts: 4213.5 });
  const devices = (await call("GET", `/devices?siteId=${siteId}`, { token: owner })).json;
  const grid = devices.find((device) => device.name === "Grid meter");
  const set = await call("PATCH", `/devices/${grid.id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "127.0.0.1", port: meter.port, unitId: 1 } } });
  check(set.status === 200, "the grid meter is given the pretend meter's address");

  const stateDir = join(workDir, "state");
  mkdirSync(stateDir, { recursive: true });
  boxProcess = spawn(command, ["run"], { env: { ...env, STATE_DIRECTORY: stateDir }, stdio: ["ignore", "pipe", "pipe"] });
  let boxLog = "";
  boxProcess.stdout.on("data", (chunk) => (boxLog += chunk));
  boxProcess.stderr.on("data", (chunk) => (boxLog += chunk));

  const checklist = await until(
    "the checklist to show the grid meter's readings",
    async () => {
      const view = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
      const readings = view.steps.find((entry) => entry.key === "readings");
      return readings?.items?.some((item) => item.label === "Grid import" && item.status === "done") ? view : undefined;
    },
    { timeoutMs: 60_000 }
  ).catch(() => undefined);
  check(checklist !== undefined, "the platform sees the box online and the grid meter's readings arriving");
  if (!checklist) console.error(boxLog);

  const latest = (await call("GET", `/telemetry/latest?siteId=${siteId}`, { token: owner })).json ?? [];
  check(latest.find((reading) => reading.canonicalName === "energy.grid.import.kw")?.value === 4.2135, "the grid import is the meter's 4213.5 W as 4.2135 kW");
  check(latest.find((reading) => reading.canonicalName === "energy.grid.export.kw")?.value === 0, "and nothing is being exported");
  const gateway = (await call("GET", `/gateways?siteId=${siteId}`, { token: owner })).json?.[0];
  check(gateway?.contact === "online" && gateway?.softwareVersion === version, "the box reports its version and is online");

  step("The box takes a change without being touched");
  await call("PATCH", `/devices/${grid.id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "127.0.0.1", port: meter.port, unitId: 7 } } });
  const wrongUnit = await until(
    "the platform to hear that the meter has stopped answering",
    async () => {
      const view = (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json;
      return view.steps.find((entry) => entry.key === "answering")?.items?.find((item) => item.label === "Grid meter" && item.status === "attention");
    },
    { timeoutMs: 60_000 }
  ).catch(() => undefined);
  check(wrongUnit !== undefined && /no answer from 127\.0\.0\.1:\d+ \(unit 7\)/.test(wrongUnit.detail), "a wrong unit number is reported in words the person at the site can use");
  await call("PATCH", `/devices/${grid.id}`, { token: owner, body: { connection: { kind: "modbus_tcp", host: "127.0.0.1", port: meter.port, unitId: 1 } } });
  const recovered = await until(
    "the meter to answer again",
    async () => (await call("GET", `/sites/${siteId}/setup`, { token: owner })).json.steps.find((entry) => entry.key === "answering")?.items?.find((item) => item.label === "Grid meter" && item.status === "done"),
    { timeoutMs: 90_000 }
  ).catch(() => undefined);
  check(recovered !== undefined, "and it is reading again once the unit number is put right");

  const status = run(command, ["status"], { env: { ...env, STATE_DIRECTORY: stateDir } });
  check(status.status === 0 && /Grid meter/.test(status.stdout), "greecon-edge status says how the box is");

  boxProcess.kill("SIGTERM");
  const stopped = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 10_000);
    boxProcess.on("close", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  check(stopped, "the box stops cleanly when asked");
  boxProcess = undefined;

  step("A new version that will not start is gone back from");
  const releases = join(root, "opt/greecon/edge/releases");
  const stateForRollback = join(workDir, "rollback-state");
  const bad = "9.9.9+broken";
  mkdirSync(join(releases, bad), { recursive: true });
  writeFileSync(join(releases, bad, "greecon-edge.mjs"), 'process.stderr.write("broken\\n"); process.exit(1);\n');
  const good = readlinkSync(join(root, "opt/greecon/edge/current")).split("/").pop();
  // As the updater leaves things: the new version is current, on probation, with the old one noted.
  rmSync(join(root, "opt/greecon/edge/current"), { force: true });
  run("ln", ["-s", join(releases, bad), join(root, "opt/greecon/edge/current")]);
  mkdirSync(join(stateForRollback, "probation"), { recursive: true });
  writeFileSync(join(stateForRollback, "probation", "version"), bad);
  writeFileSync(join(stateForRollback, "probation", "previous"), good);
  writeFileSync(join(stateForRollback, "probation", "attempts"), "0");
  // The program the service runs is the one the installer wrote, with the state directory it was given.
  const runEdge = join(root, "opt/greecon/run-edge");
  const starts = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    // The fourth start goes back and then runs the good version, which does not end by itself: it is
    // stopped after a few seconds, once it has had time to say what it did.
    const result = run("sh", [runEdge], { env: { ...env, STATE_DIRECTORY: stateForRollback }, timeout: 4000, killSignal: "SIGTERM" });
    starts.push({ status: result.status, out: `${result.stdout}${result.stderr}` });
  }
  check(starts.slice(0, 3).every((start) => start.status === 1 && start.out.includes("broken")), "the broken version is started three times and fails each time");
  check(/did not start properly three times/.test(starts[3].out), "the fourth start says it is going back");
  check(readlinkSync(join(root, "opt/greecon/edge/current")).endsWith(good), "and the previous version is current again");
  check(existsSync(join(stateForRollback, "rejected-version")) && readFileSync(join(stateForRollback, "rejected-version"), "utf8").trim() === bad, "the version that failed is remembered, so it is not tried again");
  check(!existsSync(join(stateForRollback, "probation")), "and the probation is over");
  check(starts[3].out.includes(`Greecon edge ${good} starting`), "and it is the good version that runs after that");
} catch (error) {
  console.error(`\nThe edge smoke test could not finish: ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  boxProcess?.kill("SIGKILL");
  meter?.close();
  rmSync(workDir, { recursive: true, force: true });
}

const failures = failed();
console.log(failures === 0 && exitCode === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 && exitCode === 0 ? 0 : 1);
