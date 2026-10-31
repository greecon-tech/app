// Guided setup, as a project manager with no engineering skills does it, in a real browser with the REAL box: the platform's own installer is
// run on a pretend box root, the box it installs is started, and the equipment it talks to is a pretend kit that answers the way the real
// equipment does (scripts/pretend-meter.mjs, startKit). The project manager types no address and no register: she presses Find equipment,
// gives the range printed on each transmitter's label, takes off what the site does not have, and the page follows the box by itself.
// Then what goes wrong in the field is done to the kit, and the page says what to check.
//
//   bash scripts/e2e/live-up.sh && node scripts/e2e/guided-setup.cjs
//
// (The kit is on this machine, not on a network the box would look over, so the one step a person would not need — the converter's own
// address — is typed. On a site the box finds the converter without it.)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { spawn, spawnSync } = require("child_process");
const { mkdirSync, mkdtempSync, rmSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { base, api, TEAM, signIn } = require("./lib/tour.cjs");

const OUT = process.env.E2E_SHOTS ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "guided");
mkdirSync(OUT, { recursive: true });
const steps = [];
const ok = (name, cond, extra = "") => {
  steps.push([cond ? "PASS" : "FAIL", name, extra]);
  console.log(cond ? "PASS" : "FAIL", name, extra);
};

async function call(method, path, token, body) {
  const response = await fetch(api + path, { method, headers: { "content-type": "application/json", ...(token ? { "x-greecon-session": token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : undefined };
}

/** What the box found, line by line as the page shows it: the word, the device and what it says. */
const proposalsOn = (page) =>
  page.locator("#step-addresses .setup-find__result .setup-item").evaluateAll((items) =>
    items.map((li) => ({ word: li.querySelector(".status")?.textContent?.trim(), name: li.querySelector("strong")?.textContent?.trim(), detail: li.querySelector(".setup-item__detail")?.textContent?.trim() }))
  );

const until = async (description, probe, timeoutMs = 120_000, everyMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await probe();
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`Gave up waiting for ${description}.`);
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
};

(async () => {
  const { startKit, microampsFor } = await import("../pretend-meter.mjs");
  // The transmitters as their labels read: the level transmitter 0 to 5 m in a tank 4 m tall, the pressure transmitter 0 to 10 bar.
  const level = (percent) => microampsFor(5, (percent / 100) * 4);
  const work = mkdtempSync(join(tmpdir(), "greecon-guided-"));
  let box;
  let kit;
  let browser;
  let diagnose = async () => undefined;
  try {
    // A customer, as Greecon staff onboard one, and the site made from the hotel template.
    const suffix = String(Date.now()).slice(-6);
    const team = (await call("POST", "/auth/login", undefined, TEAM)).json;
    const owner = { email: `guided.${suffix}@guided.example`, password: `Guided-${suffix}-Passw0rd` };
    const made = await call("POST", "/platform-admin/tenants", team.token, { name: `Guided ${suffix}`, ownerName: "Besa Krasniqi", ownerEmail: owner.email });
    const first = (await call("POST", "/auth/login", undefined, { email: owner.email, password: made.json.temporaryPassword })).json;
    await call("POST", "/auth/change-password", first.token, { currentPassword: made.json.temporaryPassword, newPassword: owner.password });
    const session = (await call("POST", "/auth/login", undefined, owner)).json;
    const created = await call("POST", "/sites/from-template", session.token, { templateKey: "hotel", name: "Guided hotel", locationName: "Durrës" });
    const siteId = created.json.site.id;
    ok("a hotel site is made from its template", created.status === 201);
    let boxLogText = () => "";

    kit = await startKit({ meters: { 1: { watts: 4200 }, 2: { watts: 6800 } }, analog: { 3: { channels: [level(62), microampsFor(10, 3.1), microampsFor(200, 14)] } }, digital: { 5: { inputs: [1] } } });

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("dialog", (dialog) => dialog.accept());
    await signIn(page, owner, false);
    await page.goto(`${base}/sites/${siteId}/setup`, { waitUntil: "networkidle" });

    // 1. The papers.
    const paperwork = page.locator("#step-paperwork");
    await paperwork.getByLabel("Who signed for the customer, and on what date").fill("Signed for the hotel by Besa Krasniqi on 19 October");
    await paperwork.getByRole("button", { name: "The papers are signed" }).click();
    await paperwork.getByText("Confirmed by").waitFor();
    ok("the papers are confirmed, with who signed", true);

    // 2. The box: the command is shown once; the real installer runs it, and the real box starts.
    await page.getByRole("button", { name: "Add the box and get its install command" }).click();
    const commandLine = page.locator(".install-command__line");
    await commandLine.waitFor();
    const code = (await commandLine.innerText()).match(/GRC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)?.[0];
    ok("an install command is shown", Boolean(code));
    const served = await (await fetch(`${api}/edge/install.sh`)).text();
    const root = join(work, "root");
    const stateDir = join(work, "state");
    mkdirSync(stateDir, { recursive: true });
    const env = { ...process.env, GREECON_ROOT: root, GREECON_SKIP_SYSTEM: "1", GREECON_NODE: process.execPath, GREECON_API_URL: api };
    const install = spawnSync("bash", ["-s", "--", code], { input: served, env, encoding: "utf8" });
    ok("the platform's own installer finishes on the box", install.status === 0, install.status === 0 ? "" : (install.stdout + install.stderr).slice(-300));
    box = spawn(join(root, "usr/local/bin/greecon-edge"), ["run"], { env: { ...env, STATE_DIRECTORY: stateDir }, stdio: ["ignore", "pipe", "pipe"] });
    let boxLog = "";
    box.stdout.on("data", (chunk) => (boxLog += chunk));
    box.stderr.on("data", (chunk) => (boxLog += chunk));
    boxLogText = () => boxLog;
    diagnose = async () => {
      console.log("--- the platform's view of the search:", JSON.stringify((await call("GET", `/sites/${siteId}/discovery`, session.token)).json)?.slice(0, 1500));
      console.log("--- the addresses step:", (await page.locator("#step-addresses").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 1200));
      console.log("--- the box's log:", boxLogText().slice(-1500));
    };
    await page.waitForFunction(() => document.querySelector("#step-box summary")?.textContent?.includes("Done"), null, { timeout: 90_000 });
    ok("the page shows the box online by itself, without a reload", true);

    // 3. Find equipment. The page is not touched again until the box has said.
    const addresses = page.locator("#step-addresses");
    if (!(await addresses.evaluate((element) => element.open))) await addresses.locator("summary").first().click();
    ok("Find equipment is offered, and the equipment is not yet addressed", (await addresses.getByRole("button", { name: "Find equipment" }).isEnabled()) && (await addresses.innerText()).includes("No address yet"));
    await addresses.getByText("I know the converter's address").click();
    const lookForm = addresses.getByRole("form", { name: "Look at one address" });
    await lookForm.getByLabel("Converter's IP address").fill("127.0.0.1");
    await lookForm.getByLabel("Port").fill(String(kit.port));
    await lookForm.getByRole("button", { name: "Look at this address" }).click();
    await addresses.getByText("The box is looking at the network now.").waitFor();
    ok("pressing it says the box is looking", true);
    await page.waitForFunction(() => document.querySelector("#step-addresses")?.textContent?.includes("Every device has the address it was found at"), null, { timeout: 120_000 });
    ok("the page follows the box and shows what it found, with no reload and nothing typed", true);
    const found = await addresses.innerText();
    const lines = await proposalsOn(page);
    const line = (name) => lines.find((entry) => entry.name === name);
    ok("each device is listed, in words, at the number the kit gives it", /unit 1: an Eastron meter, reading 4.20 kW at 231 V/.test(line("Grid meter")?.detail ?? "") && /unit 2: an Eastron meter/.test(line("Solar meter")?.detail ?? "") && /unit 3: a 4 to 20 mA input module/.test(line("Water I\/O module")?.detail ?? "") && /unit 5: a digital input module/.test(line("Pump contact module (optional)")?.detail ?? ""), JSON.stringify(lines).slice(0, 300));
    ok("and every one is marked Set", lines.length === 4 && lines.every((entry) => entry.word === "Set"));
    ok("and what the box looked at", found.includes("looked at 1 address, unit numbers 1 to 10"));
    ok("the addresses step is Done", (await page.locator("#step-addresses summary").first().innerText()).includes("Done"));
    await page.screenshot({ path: join(OUT, "guided-1-found.png"), fullPage: true });

    // 4. The ranges on the labels: the only thing typed. The flow meter is not fitted at this site.
    const mapping = page.locator("#step-mapping");
    if (!(await mapping.evaluate((element) => element.open))) await mapping.locator("summary").first().click();
    const ranges = mapping.getByRole("form", { name: "Transmitter ranges for Water I/O module" });
    await ranges.getByLabel("Range on the label (m)").fill("5");
    await ranges.getByLabel("How tall the tank is inside (m)").fill("4");
    await ranges.getByLabel("Top of the range (bar)").fill("10");
    await ranges.locator("fieldset", { hasText: "Flow meter" }).getByLabel("Not fitted at this site").check();
    await ranges.getByRole("button", { name: "Save the ranges" }).click();
    await ranges.getByText("Saved.").waitFor();
    await page.waitForFunction(() => document.querySelector("#step-mapping summary")?.textContent?.includes("Done"), null, { timeout: 30_000 });
    ok("with the two ranges given and the flow meter taken off, every reading is tied to a register", true);
    ok("and the reading for the flow meter that is not there is gone, so that nothing waits for it", !(await page.locator("#step-mapping").innerText()).includes("Pump flow"));

    // 5. The real box reads the pretend kit, and the platform checks the numbers could be real.
    await page.waitForFunction(() => document.querySelector("#step-readings summary")?.textContent?.includes("Done"), null, { timeout: 120_000 });
    ok("the page shows that readings are arriving and could be real, by itself", true);
    const latest = (await call("GET", `/telemetry/latest?siteId=${siteId}`, session.token)).json ?? [];
    const value = (name) => latest.find((row) => row.canonicalName === name)?.value;
    ok("the tank reads 62 %, from a 4 to 20 mA signal and the two numbers on a label", Math.abs(value("water.tank.level.percent") - 62) < 0.5, String(value("water.tank.level.percent")));
    ok("the pressure reads 3.1 bar and the grid import 4.2 kW", Math.abs(value("water.pressure.bar") - 3.1) < 0.05 && Math.abs(value("energy.grid.import.kw") - 4.2) < 0.05);
    ok("the pump contact says the pump is running, and there is no flow reading", value("water.pump.status") === 1 && value("water.flow.lpm") === undefined);
    await page.screenshot({ path: join(OUT, "guided-2-readings.png"), fullPage: true });

    // 6. What goes wrong in the field: the 4 to 20 mA module stops answering (a wire, a fuse). The page says what to check, and changes nothing else.
    kit.silence(3);
    await lookForm.getByRole("button", { name: "Look at this address" }).click();
    await page.waitForFunction(
      () => [...document.querySelectorAll("#step-addresses .setup-find__result .setup-item")].some((li) => li.querySelector("strong")?.textContent === "Water I/O module" && li.querySelector(".status")?.textContent === "Not found"),
      null,
      { timeout: 120_000 }
    );
    const trouble = await proposalsOn(page);
    const named = (name) => trouble.find((line) => line.name === name);
    ok("the module that does not answer is listed as not found, with what to check", named("Water I/O module")?.detail === "Nothing that looks like a 4 to 20 mA input module answers at unit 3. Check the address set on it, the speed, and the A and B wires.", named("Water I/O module")?.detail);
    ok("while the meters and the contact are still found, and nothing about them changed", ["Grid meter", "Solar meter", "Pump contact module (optional)"].every((name) => named(name)?.word === "Set"), JSON.stringify(trouble.map((line) => `${line.name}: ${line.word}`)));
    await until("the answering step to name the module that does not answer", async () => (await call("GET", `/sites/${siteId}/setup`, session.token)).json?.steps?.find((entry) => entry.key === "answering")?.items?.find((item) => item.status === "attention" && /no answer from 127\.0\.0\.1:\d+ \(unit 3\)/.test(item.detail ?? "")), 120_000);
    ok("and the setup list names it, with the address that did not answer", true);
    await page.screenshot({ path: join(OUT, "guided-3-module-missing.png"), fullPage: true });
    kit.answerAgain(3);
    await lookForm.getByRole("button", { name: "Look at this address" }).click();
    await page.waitForFunction(
      () => {
        const lines = [...document.querySelectorAll("#step-addresses .setup-find__result .setup-item")];
        return lines.length === 4 && lines.every((li) => li.querySelector(".status")?.textContent === "Set");
      },
      null,
      { timeout: 120_000 }
    );
    ok("when the wire is back, the next look finds it and every device is set again", true);

    // 7. A device the site does not have is taken off in one press, and the next look says nothing about it.
    await addresses.getByRole("button", { name: "The site does not have this: remove it" }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll("#step-addresses .setup-device__head strong")].some((element) => element.textContent?.startsWith("Pump contact module")), null, { timeout: 30_000 });
    ok("the pump contact module, not fitted, is taken off the list", true);
    ok("and the platform no longer reads a pump contact", (await call("GET", `/devices?siteId=${siteId}`, session.token)).json.every((device) => !/Pump contact/.test(device.name)));

    // 8. The install card for the site as it is now: the device that was taken off is not on it.
    await page.goto(`${base}/sites/${siteId}/install-card`, { waitUntil: "networkidle" });
    const card = await page.locator(".install-card").innerText();
    ok("the install card lists the three devices that are left and not the one taken off", card.includes("Grid meter") && card.includes("Water I/O module") && !card.includes("Pump contact module"));

    // 9. A phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/sites/${siteId}/setup`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("the setup list does not scroll sideways on a phone", overflow <= 1, `overflow ${overflow}px`);
    await page.screenshot({ path: join(OUT, "guided-4-phone.png"), fullPage: true });

    ok("no script errors in the browser", errors.length === 0, errors.join("; "));
    if (!boxLog.includes("Looking for equipment on the site's network")) ok("the box's own log says it looked", false, boxLog.slice(-400));
    else ok("the box's own log says it looked at the network when asked", true);
  } catch (error) {
    await diagnose();
    throw error;
  } finally {
    if (browser) await browser.close();
    if (box) {
      box.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        box.on("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    kit?.close();
    rmSync(work, { recursive: true, force: true });
  }
  const failed = steps.filter((entry) => entry[0] === "FAIL").length;
  console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("E2E ERROR", error);
  process.exit(2);
});
