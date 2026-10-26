// The project manager's whole job in a real browser against the real stack: Greecon staff onboard a client,
// open its account for setup, make the site from the hotel template, add a box, enter addresses and
// registers, watch the checklist follow what the box reports, confirm what only a person can, commission,
// and print the handover sheet; then leave the customer's account and find their own session intact.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const SP = process.env.E2E_SHOTS ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "shots");
mkdirSync(SP, { recursive: true });
const base = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const api = process.env.E2E_API_URL ?? "http://localhost:4000";
const steps = [];
const ok = (name, cond, extra = "") => {
  steps.push([cond ? "PASS" : "FAIL", name, extra]);
  console.log(cond ? "PASS" : "FAIL", name, extra);
};

async function recorded() {
  return (await fetch(`http://127.0.0.1:${process.env.FAKE_PROVIDER_PORT ?? 4100}/recorded`)).json();
}

async function boxCall(secret, method, path, body) {
  const response = await fetch(api + path, { method, headers: { "content-type": "application/json", "x-edge-device-token": secret }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : undefined };
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (dialog) => dialog.accept());

  // 1. Greecon staff sign in and onboard the client.
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "Greecon team" }).click();
  await page.fill('input[type="email"]', "eridon.manuka@greecon.earth");
  await page.fill('input[type="password"]', "E2E-Admin-Passw0rd!");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/today");
  await page.locator("main").getByText("No customer site is live yet.").waitFor(); // the URL changes a moment before the page is drawn
  ok("staff sign in to the Greecon console and land on Today", true);
  ok("Today says no customer site is live yet, and offers to onboard one", (await page.locator("main").innerText()).includes("No customer site is live yet.") && (await page.getByRole("link", { name: "Onboard a client" }).count()) >= 1);

  await page.goto(base + "/platform?onboard=new", { waitUntil: "networkidle" });
  ok("the Clients page opens the onboarding panel when asked", await page.locator("#onboard").evaluate((el) => el.open));
  await page.fill('input[placeholder^="e.g. Vjosa"]', "Hotel Adriatik");
  await page.fill('input[placeholder="Full name"]', "Besa Krasniqi");
  await page.fill('input[type="email"]', "besa@hotel-adriatik.example");
  await page.getByRole("button", { name: "Onboard client" }).click();
  await page.locator(".credential-notice__value").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  const row = page.locator("tr", { hasText: "Hotel Adriatik" }).first();
  ok("the client is in the console with an 'Open for setup' button", await row.getByRole("button", { name: "Open for setup" }).isVisible());
  await page.screenshot({ path: SP + "/pm-1-console.png", fullPage: true });

  // 2. Staff go into the client's account.
  await row.getByRole("button", { name: "Open for setup" }).click();
  await page.waitForURL("**/sites");
  const banner = page.locator(".support-banner");
  ok("a banner says staff are inside the client's account", (await banner.innerText()).includes("Hotel Adriatik"), (await banner.innerText()).slice(0, 80));
  ok("inside, the navigation is the client's: Overview, Sites, Alerts, Reports, Settings", (await page.locator(".main-nav").innerText()).replace(/\s+/g, " ").trim() === "Overview Sites Alerts Reports Settings");
  await page.goto(base + "/admin", { waitUntil: "networkidle" });
  ok("staff cannot add people while inside", (await page.getByRole("heading", { name: "Add a person" }).count()) === 0);
  ok("nor reset passwords", (await page.getByRole("button", { name: /reset password/i }).count()) === 0);
  await page.screenshot({ path: SP + "/pm-2-support-admin.png", fullPage: true });

  // 3. A site from the hotel template.
  await page.goto(base + "/sites", { waitUntil: "networkidle" });
  ok("the new account has no site, and Sites offers to add one", (await page.locator("main").innerText()).includes("No site yet"));
  await page.getByRole("link", { name: "Add a site" }).first().click();
  await page.waitForURL("**/sites/new");
  const form = page.getByRole("form", { name: "New site from a template" });
  await form.getByLabel("What kind of site").selectOption({ label: "Hotel or guesthouse" });
  await form.getByLabel("Site name").fill("Hotel Adriatik");
  await form.getByLabel("Where it is").fill("Durrës, Albania");
  ok("the template's contents are shown before creating", (await form.locator(".template-choice").innerText()).includes("Grid meter"));
  await form.getByRole("button", { name: "Create the site and start setting it up" }).click();
  await page.waitForURL("**/sites/*/setup");
  const siteId = page.url().split("/sites/")[1].split("/")[0];
  ok("creating the site lands on its setup list", (await page.getByRole("heading", { name: "Set up Hotel Adriatik" }).count()) === 1);
  const words = await page.locator(".setup-progress__words").innerText();
  ok("nothing is marked done yet", /^0 of \d+ steps done/.test(words), words);
  ok("the next thing to do is the box", (await page.locator(".setup-next").innerText()).includes("Install the box"));
  await page.screenshot({ path: SP + "/pm-3-setup-start.png", fullPage: true });

  // 4. The box: one command, shown once.
  await page.getByRole("button", { name: "Add the box and get its install command" }).click();
  const commandLine = page.locator(".install-command__line");
  await commandLine.waitFor();
  const command = (await commandLine.innerText()).trim();
  const code = command.match(/GRC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)?.[0];
  ok("an install command with an enrolment code is shown", Boolean(code) && command.startsWith("curl -fsSL http"), command);
  await page.screenshot({ path: SP + "/pm-4-install-command.png", fullPage: true });

  // The box, at the site, runs it. (The real installer is exercised by the smoke test; here the box's side is played by calls.)
  const enrol = await fetch(api + "/edge/enrol", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const enrolled = await enrol.json();
  ok("the box enrols with the code", enrol.status === 201 && typeof enrolled.secret === "string");
  const secret = enrolled.secret;
  let config = (await boxCall(secret, "GET", "/edge/config")).json;
  const heartbeat = async (deviceStates) =>
    boxCall(secret, "POST", "/edge/heartbeat", { agentVersion: "e2e-1", uptimeSeconds: 30, sentAtUtc: new Date().toISOString(), bufferDepth: 0, configVersion: config.version, devices: deviceStates });
  await heartbeat([]);

  await page.reload({ waitUntil: "networkidle" });
  const boxStep = page.locator("#step-box");
  ok("the box step becomes Done by itself once the box reports", (await boxStep.locator("summary").first().innerText()).includes("Done"), (await boxStep.locator("summary").first().innerText()).replace(/\n/g, " | "));
  ok("the next thing is each device's address", (await page.locator(".setup-next").innerText()).includes("Where each device is on the network"));

  // 5. Addresses.
  const addresses = page.locator("#step-addresses");
  const units = { "Grid meter": 1, "Solar meter": 2, "Water I/O module": 3 };
  for (const [name, unit] of Object.entries(units)) {
    const addressForm = addresses.getByRole("form", { name: `Address of ${name}` });
    await addressForm.getByLabel("IP address").fill("192.168.1.50");
    await addressForm.getByLabel("Unit number").fill(String(unit));
    await addressForm.getByRole("button", { name: "Save" }).click();
    await addressForm.getByText("Saved.").waitFor();
  }
  ok("all three devices have addresses", true);

  // A finished step stays open until the reader closes it, so the last "Saved." is still there to be seen.
  ok("a finished step stays open, so its confirmation stays on screen", await addresses.evaluate((el) => el.open));

  // A wrong address is refused in words.
  const wrong = addresses.getByRole("form", { name: "Address of Grid meter" });
  await wrong.getByLabel("IP address").fill("not an address");
  await wrong.getByRole("button", { name: "Change" }).click();
  const refusal = await wrong.getByRole("alert").innerText();
  ok("a wrong address is refused with a sentence that says what to do", /IP address/i.test(refusal), refusal);
  await wrong.getByLabel("IP address").fill("192.168.1.50");
  await wrong.getByRole("button", { name: "Change" }).click();
  await wrong.getByText("Saved.").waitFor();

  // 6. Registers for the water module (the meters are known, the module is not).
  await page.reload({ waitUntil: "networkidle" });
  const mapping = page.locator("#step-mapping");
  ok("the mapping step is the next to do", (await page.locator(".setup-next").innerText()).includes("Which register holds which reading"));
  const readings = ["Tank level", "Line pressure", "Pump flow", "Pump running"];
  for (const [index, label] of readings.entries()) {
    const registerForm = mapping.getByRole("form", { name: `Register for ${label}` });
    if (!(await registerForm.isVisible())) await mapping.locator(".setup-point", { hasText: label }).locator("summary").click();
    await registerForm.getByLabel("Address").fill(String(index));
    await registerForm.getByRole("button", { name: "Save the register" }).click();
    await registerForm.getByText("Saved.").waitFor();
  }
  await page.waitForFunction(() => document.querySelector("#step-mapping summary")?.textContent?.includes("Done"), null, { timeout: 15000 });
  ok("all four water readings are tied to registers, and the step is Done", true);

  // 7. The box now reads: its configuration changed, and it reports each device answering.
  config = (await boxCall(secret, "GET", "/edge/config")).json;
  const now = new Date().toISOString();
  const answered = await heartbeat(config.devices.map((device) => ({ deviceId: device.deviceId, ok: true, readingsOk: device.points.length, readingsFailed: 0, lastOkAtUtc: now })));
  ok("the box reports every device answering", answered.status === 201, JSON.stringify(answered.json).slice(0, 120));
  const messages = config.devices.map((device) => ({
    messageType: "telemetry",
    tenantId: config.tenantId,
    siteId: config.siteId,
    deviceId: device.deviceId,
    publishedAtUtc: now,
    correlationId: "e2e",
    readings: device.points.map((point) => ({
      timestampUtc: now,
      tenantId: config.tenantId,
      siteId: config.siteId,
      deviceId: device.deviceId,
      pointId: point.pointId,
      canonicalName: point.canonicalName,
      value: { "water.tank.level.percent": 62, "water.pressure.bar": 3.1, "water.flow.lpm": 14, "water.pump.status": 1, "energy.grid.import.kw": 4.2, "energy.grid.export.kw": 0, "energy.solar.power.kw": 6.8 }[point.canonicalName] ?? 1,
      unit: point.unit,
      quality: "OK",
      source: "edge",
      ingestionTimestampUtc: now
    }))
  }));
  const batch = await boxCall(secret, "POST", "/telemetry/ingest-batch", { messages });
  ok("the box's readings are accepted", batch.status === 201 && batch.json.results.every((r) => r.accepted), JSON.stringify(batch.json).slice(0, 160));

  await page.reload({ waitUntil: "networkidle" });
  for (const key of ["box", "addresses", "mapping", "answering", "readings"]) {
    const text = await page.locator(`#step-${key} summary`).first().innerText();
    ok(`the platform marks "${key}" done because it saw it work`, text.includes("Done"), text.replace(/\n/g, " | "));
  }
  await page.screenshot({ path: SP + "/pm-5-checklist-working.png", fullPage: true });

  // 7b. Who is told: nothing can be confirmed until people are on the list and a test message has gone.
  const toldStep = page.locator("#step-told");
  ok("the next thing is to say who is told", (await page.locator(".setup-next").innerText()).includes("Someone is told when the site needs attention"));
  ok("it cannot be confirmed before anyone is on the list", await toldStep.getByRole("button", { name: "I checked this" }).isDisabled());
  await toldStep.getByRole("link", { name: "Open Who is told" }).click();
  await page.waitForURL("**/settings/people");
  const status = await page.locator(".setup-guidance").first().innerText();
  ok("the page says email and text messages are on", status.includes("Email is on.") && status.includes("Text messages are on."), status.replace(/\n+/g, " "));

  const peopleForm = page.getByRole("form", { name: "People to tell" });
  await peopleForm.getByRole("button", { name: "Add a person" }).click();
  await peopleForm.getByLabel("Name").nth(0).fill("Besa Krasniqi");
  await peopleForm.getByLabel("Email").nth(0).fill("besa@hotel-adriatik.example");
  await peopleForm.getByLabel("Mobile phone, with country code").nth(0).fill("069 123 4567");
  await peopleForm.getByRole("button", { name: "Save the list" }).click();
  const refusal2 = await peopleForm.getByRole("alert").innerText();
  ok("a phone number without its country code is refused, in words", refusal2.includes("country code"), refusal2);
  await peopleForm.getByLabel("Mobile phone, with country code").nth(0).fill("+355 69 123 4567");
  await peopleForm.getByRole("button", { name: "Add a person" }).click();
  await peopleForm.getByLabel("Name").nth(1).fill("Arben Hoxha");
  await peopleForm.getByLabel("Email").nth(1).fill("arben@hotel-adriatik.example");
  await peopleForm.getByRole("button", { name: "Save the list" }).click();
  await peopleForm.getByText("Saved. Now send each person a test message.").waitFor();
  ok("the list is saved, in order", (await peopleForm.innerText()).includes("Told first"));

  await peopleForm.getByRole("button", { name: "Send a test message" }).first().click();
  await peopleForm.getByText("Accepted for delivery").first().waitFor();
  const testResults = await peopleForm.locator(".setup-items").first().innerText();
  ok("the test says what happened to the email and to the text", testResults.includes("Email") && testResults.includes("Text message") && !testResults.includes("Not sent"), testResults.replace(/\n+/g, " | "));
  const afterTest = await recorded();
  // The platform's own 30-second round can send the morning message in between, so the test is picked out by what it says.
  const testMail = afterTest.find((item) => item.channel === "email" && item.to === "besa@hotel-adriatik.example" && /This is a test message/.test(item.text ?? ""));
  const testText = afterTest.find((item) => item.channel === "sms" && item.to === "+355691234567" && /test message/i.test(item.text ?? ""));
  ok("the provider was asked to send the email, from Greecon's alert address, with the platform's key", testMail?.from === "Greecon <alerts@e2e.example>" && testMail?.auth === "Bearer re_e2e", JSON.stringify(testMail)?.slice(0, 160));
  ok("the test email says it is a test and that nothing is wrong", testMail?.text.includes("This is a test message from Greecon for Hotel Adriatik") && testMail?.text.includes("Nothing is wrong"));
  ok("and the provider was asked to send the text", testText?.text.startsWith("Greecon test message for Hotel Adriatik."), testText?.text);
  await page.screenshot({ path: SP + "/pm-10-people.png", fullPage: true });

  await page.goto(`${base}/sites/${siteId}/setup`, { waitUntil: "networkidle" });
  ok("the step now says a test was sent and that Greecon cannot tell it was read", (await page.locator("#step-told").innerText()).includes("Greecon cannot tell whether it was read"));
  await toldStep.getByLabel("What you saw (optional)").fill("Besa read both on her phone");
  await toldStep.getByRole("button", { name: "I checked this" }).click();
  await toldStep.getByText("Confirmed by").waitFor();
  ok("a person confirming it makes it done", true);

  // 8. What only a person can check.
  const direction = page.locator("#step-direction");
  if (!(await direction.evaluate((el) => el.open))) await direction.locator("summary").first().click();
  ok("the direction step says how to check", (await direction.innerText()).includes("Grid import must go up"));
  await direction.getByLabel("What you saw (optional)").fill("Import rose with the kettle on");
  await direction.getByRole("button", { name: "I checked this" }).click();
  await direction.getByText("Confirmed by").waitFor();
  ok("confirming records who", (await direction.innerText()).includes("Confirmed by"));

  const limits = page.locator("#step-limits");
  if (!(await limits.evaluate((el) => el.open))) await limits.locator("summary").first().click();
  await limits.getByRole("button", { name: "I checked this" }).click();
  await limits.getByText("Confirmed by").waitFor();

  const commissioning = page.locator("#step-commissioned");
  if (!(await commissioning.evaluate((el) => el.open))) await commissioning.locator("summary").first().click();
  await commissioning.getByLabel("What you saw (optional)").fill("Meter display and Greecon agree");
  await commissioning.getByRole("button", { name: "Commission this site" }).click();
  await commissioning.getByText("Confirmed by").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  ok("the progress says commissioned", (await page.locator(".setup-progress__words").innerText()).startsWith("Commissioned."));
  await page.screenshot({ path: SP + "/pm-6-commissioned.png", fullPage: true });

  // 8b. After commissioning, a tank goes critical and the first person on the list is told.
  await page.waitForTimeout(1200); // the next reading must be later than the last
  const tankPoint = config.devices.flatMap((device) => device.points.map((point) => ({ device, point }))).find((entry) => entry.point.canonicalName === "water.tank.level.percent");
  const critical = new Date().toISOString();
  const alertBatch = await boxCall(secret, "POST", "/telemetry/ingest-batch", {
    messages: [
      {
        messageType: "telemetry",
        tenantId: config.tenantId,
        siteId: config.siteId,
        deviceId: tankPoint.device.deviceId,
        publishedAtUtc: critical,
        correlationId: "e2e-critical",
        readings: [{ timestampUtc: critical, tenantId: config.tenantId, siteId: config.siteId, deviceId: tankPoint.device.deviceId, pointId: tankPoint.point.pointId, canonicalName: "water.tank.level.percent", value: 5, unit: "%", quality: "OK", source: "edge", ingestionTimestampUtc: critical }]
      }
    ]
  });
  ok("the box reports a nearly empty tank", alertBatch.status === 201 && alertBatch.json.results.every((r) => r.accepted));
  let actNow;
  for (let attempt = 0; attempt < 40 && !actNow; attempt += 1) {
    actNow = (await recorded()).find((item) => item.channel === "email" && item.subject?.startsWith("Act now"));
    if (!actNow) await page.waitForTimeout(500);
  }
  ok("the first person is emailed within seconds, Act now, with the first step", actNow?.to === "besa@hotel-adriatik.example" && actNow?.subject === "Act now: Tank level is critical, Hotel Adriatik" && actNow?.text.includes("First step: Check the water supply"), actNow?.subject);
  ok("the email links to the alert in Greecon", actNow?.text.includes("http://localhost:3000/alerts"));
  ok("nobody else is told yet, and no text yet", !(await recorded()).some((item) => item.to === "arben@hotel-adriatik.example" && item.subject?.startsWith("Act now")) && !(await recorded()).some((item) => item.channel === "sms" && item.text.startsWith("Act now")));

  // 8c. The link in the email: opening it changes nothing; pressing its button is what acknowledges. A person on a phone who never signed in.
  const ackLink = (actNow.text.match(/https?:\/\/\S+\/ack\/[A-Za-z0-9_-]{36}/) ?? [])[0];
  ok("the Act now email carries an 'I have seen this' link, on a line of its own", Boolean(ackLink) && actNow.text.split("\n").includes(ackLink), ackLink);
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (e) => errors.push(String(e)));
  await phone.goto(ackLink, { waitUntil: "networkidle" });
  const linkText = await phone.locator("main").innerText();
  ok("the link opens, with no sign-in, on a page that names the alert and the site", linkText.includes("Tank level is critical") && linkText.includes("Hotel Adriatik") && linkText.includes("Act now"), linkText.replace(/\n+/g, " | ").slice(0, 160));
  ok("it has one button, and says what pressing it does and does not do", (await phone.getByRole("button", { name: "Yes, I have seen it" }).count()) === 1 && linkText.includes("does not fix anything"));
  await phone.screenshot({ path: SP + "/pm-10a-ack-link.png", fullPage: true });
  await phone.reload({ waitUntil: "networkidle" });
  await page.goto(`${base}/alerts`, { waitUntil: "networkidle" });
  ok("the alert is on the Alerts page, and opening the link twice acknowledged nothing", (await page.locator("main").innerText()).includes("Tank level is critical") && (await page.getByRole("button", { name: /Acknowledge/ }).count()) >= 1);
  const wrongLink = ackLink.slice(0, -1) + (ackLink.endsWith("A") ? "B" : "A");
  await phone.goto(wrongLink, { waitUntil: "networkidle" });
  ok("a link with one character changed says only that it no longer works", (await phone.locator("main").innerText()).includes("This link no longer works") && (await phone.getByRole("button", { name: "Yes, I have seen it" }).count()) === 0);
  await phone.goto(ackLink, { waitUntil: "networkidle" });
  await phone.getByRole("button", { name: "Yes, I have seen it" }).click();
  await phone.getByText("Thank you. Greecon has your answer.").waitFor();
  ok("pressing the button answers, in words, that nobody else will be reminded", (await phone.locator("main").innerText()).includes("Nobody else will be reminded"));
  // Besa is the only person who was told, and she is the one who pressed it: nobody is told "Acknowledged by" about their own acknowledgement.
  await page.waitForTimeout(3000);
  ok("nobody is sent an 'Acknowledged by' note: the only person told is the one who pressed the button", !(await recorded()).some((item) => item.subject?.startsWith("Acknowledged")));
  await page.goto(`${base}/alerts`, { waitUntil: "networkidle" });
  const alertsText = await page.locator("main").innerText();
  ok("Greecon now shows the alert as acknowledged and not yet cleared, and offers no second Acknowledge", alertsText.includes("Acknowledged, not yet cleared") && (await page.getByRole("button", { name: /Acknowledge/ }).count()) === 0, alertsText.replace(/\n+/g, " | ").slice(0, 200));
  await phone.reload({ waitUntil: "networkidle" });
  ok("the link, opened again, says it was already acknowledged", (await phone.locator("main").innerText()).includes("Already acknowledged"));
  await phoneContext.close();

  await page.goto(`${base}/settings/people`, { waitUntil: "networkidle" });
  const logText = await page.locator("main").innerText();
  ok("the log shows what was sent, and what is still waiting", logText.includes("What was sent") && logText.includes("Alert") && logText.includes("Sent") && logText.includes("Waiting"));
  await page.screenshot({ path: SP + "/pm-11-log.png", fullPage: true });

  // 8d. The customer's data can be taken away as files.
  await page.goto(`${base}/reports`, { waitUntil: "networkidle" });
  ok("the Reports page offers downloads, not a pretend request", (await page.locator("main").innerText()).includes("Your data is yours") && (await page.getByRole("button", { name: "Request export" }).count()) === 0);
  const readingsForm = page.getByRole("form", { name: "Download readings" });
  await readingsForm.getByLabel("Period").selectOption("7");
  const [csvDownload] = await Promise.all([page.waitForEvent("download"), readingsForm.getByRole("button", { name: "Download readings" }).click()]);
  ok("the readings arrive as a named spreadsheet file", /^greecon-readings-hotel-adriatik-\d{4}-\d\d-\d\d-hourly\.csv$/.test(csvDownload.suggestedFilename()), csvDownload.suggestedFilename());
  const csvBytes = await require("fs").promises.readFile(await csvDownload.path());
  ok("opening with the byte-order mark so a spreadsheet reads Durrës right", csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf);
  const csvText = csvBytes.toString("utf8");
  ok("with a head row, and the tank's hourly average in it", csvText.includes("hour_utc,hour_local,site,device,reading,canonical_name,average") && csvText.includes("water.tank.level.percent"), csvText.split("\r\n").slice(0, 2).join(" | ").slice(0, 160));

  await readingsForm.getByLabel("Period").selectOption("366");
  await readingsForm.getByLabel("Detail").selectOption("raw");
  await readingsForm.getByRole("button", { name: "Download readings" }).click();
  await page.waitForURL("**/reports?problem=*");
  const problem = await page.locator('.setup-guidance[role="alert"]').innerText();
  ok("a year of every reading is refused in words, on the same page", problem.includes("up to 31 days") && problem.includes("hourly averages"), problem.replace(/\n+/g, " "));

  const [accountDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download the account (JSON)" }).click()]);
  const accountFile = JSON.parse(await require("fs").promises.readFile(await accountDownload.path(), "utf8"));
  ok("the account's whole setup downloads as one file", accountFile.format === "greecon-account-export/1" && accountFile.sites[0].name === "Hotel Adriatik" && accountFile.whoIsTold.people.length === 2, accountDownload.suggestedFilename());
  ok("with nothing in it that would open the account", !/password|secret|hash/i.test(JSON.stringify({ ...accountFile, about: "" })));
  await page.screenshot({ path: SP + "/pm-12-reports.png", fullPage: true });

  // 9. The handover sheet.
  await page.goto(`${base}/sites/${siteId}/setup`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Open the handover sheet" }).first().click();
  await page.waitForURL("**/handover");
  const sheet = await page.locator(".handover").innerText();
  ok("the sheet names the customer and the site", sheet.includes("Hotel Adriatik") && sheet.includes("Durrës"));
  ok("the sheet says where each device is", sheet.includes("192.168.1.50:502, unit 2"));
  ok("the sheet has the register of the grid meter", sheet.includes("input register 52, float32"));
  ok("the sheet says who commissioned it", /Commissioned by .+ on \d{4}-\d\d-\d\d/.test(sheet));
  ok("the sheet tells the customer how to reach Greecon", sheet.includes("info@greecon.earth"));
  ok("the sheet says who is told, in order, with how to reach them", sheet.includes("Who is told when something needs attention") && sheet.includes("arben@hotel-adriatik.example") && sheet.includes("+355691234567"));
  await page.screenshot({ path: SP + "/pm-7-handover.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  ok("printing hides the console around the sheet", !(await page.locator(".sidebar").isVisible()) && (await page.locator(".handover").isVisible()));
  await page.screenshot({ path: SP + "/pm-8-handover-print.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });

  // 10. The audit trail shows who did this.
  await page.goto(base + "/audit", { waitUntil: "networkidle" });
  const audit = await page.locator("main").innerText();
  ok("the audit trail says the alert was acknowledged with the link in an alert message, and for whom", audit.includes("Alert acknowledged with the link in an alert message sent to Besa Krasniqi"), audit.slice(0, 120).replace(/\n/g, " | "));
  ok("the customer's audit trail shows Greecon staff by name", audit.includes("Greecon staff (eridon.manuka@greecon.earth)") || audit.includes("eridon.manuka@greecon.earth"), audit.slice(0, 200).replace(/\n/g, " | "));

  // 11. Back to Greecon's own console, still signed in as staff.
  await page.getByRole("button", { name: "Back to the Greecon console" }).click();
  await page.waitForURL("**/today");
  await page.getByRole("button", { name: /Open account|Continue setup/ }).first().waitFor();
  ok("leaving returns to Today with the staff session intact", (await page.getByRole("button", { name: /Open account|Continue setup/ }).count()) >= 1);
  ok("and the banner is gone", (await page.locator(".support-banner").count()) === 0);

  // 11b. Greecon's team sees every customer's sites in one list, and is sent the morning check about them.
  await page.goto(base + "/today", { waitUntil: "networkidle" });
  const fleetSection = page.locator("section.section", { has: page.getByRole("heading", { name: "Needs a look", exact: true }) }).first();
  const fleetText = await fleetSection.innerText();
  ok("Today lists the hotel's site under Needs a look, with its state and what is wrong", fleetText.includes("Hotel Adriatik") && fleetText.includes("Action required") && fleetText.includes("Tank level is critical"), fleetText.replace(/\n+/g, " | ").slice(0, 260));
  ok("with the box's state, the open alert and the day it is on", /Online|Late|Offline/.test(fleetText) && fleetText.includes("1 Act now") && fleetText.includes("Day 1"), fleetText.replace(/\n+/g, " | ").slice(0, 400));
  await page.screenshot({ path: SP + "/pm-13-fleet.png", fullPage: true });

  await page.goto(base + "/settings/people", { waitUntil: "networkidle" });
  const teamPeople = page.getByRole("form", { name: "People to tell" });
  await teamPeople.getByRole("button", { name: "Add a person" }).click();
  await teamPeople.getByLabel("Name").nth(0).fill("Eridon Manuka");
  await teamPeople.getByLabel("Email").nth(0).fill("eridon.manuka@greecon.earth");
  await teamPeople.getByRole("button", { name: "Save the list" }).click();
  await teamPeople.getByText(/Saved/).waitFor();
  const fiveMinutesAgo = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Tirane", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(Date.now() - 5 * 60_000);
  const morningForm = page.getByRole("form", { name: "Quiet hours and the morning message" });
  await morningForm.getByLabel("Morning message time").fill(fiveMinutesAgo);
  await morningForm.getByRole("button", { name: "Save" }).click();
  await morningForm.getByText("Saved.").waitFor();
  let morning;
  for (let attempt = 0; attempt < 90 && !morning; attempt += 1) {
    morning = (await recorded()).find((item) => item.channel === "email" && item.to === "eridon.manuka@greecon.earth" && item.subject?.startsWith("Greecon,"));
    if (!morning) await page.waitForTimeout(1000);
  }
  ok("Greecon's own account is sent the morning check, led by the answer", morning?.subject?.includes("Action required. 1 of 1 site needs a look."), morning?.subject);
  ok("which names the client, the site, how many days it has been live, and what is wrong", morning?.text.includes("Hotel Adriatik: Hotel Adriatik (day 1): Action required.") && morning?.text.includes("Tank level is critical"), morning?.text?.split("\n").slice(0, 4).join(" | "));
  ok("and says it is the message Greecon's account gets each morning", morning?.text.includes("each morning at") && morning?.text.includes("for Greecon"));

  // 12. A phone-width look at the setup list.
  await page.goto(base + "/platform", { waitUntil: "networkidle" });
  await page.locator("tr", { hasText: "Hotel Adriatik" }).first().getByRole("button", { name: "Open for setup" }).click();
  await page.waitForURL("**/sites");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/sites/${siteId}/setup`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("the setup list does not scroll sideways on a phone", overflow <= 1, `overflow ${overflow}px`);
  await page.screenshot({ path: SP + "/pm-9-setup-phone.png", fullPage: true });

  ok("no script errors in the browser", errors.length === 0, errors.join("; "));
  await browser.close();
  const failed = steps.filter((s) => s[0] === "FAIL").length;
  console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(2);
});
