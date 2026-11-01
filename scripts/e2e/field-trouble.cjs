// What goes wrong at a real customer, seen in a real browser against the real stack (docs/29, S10: a refusal says why and what to do; feedback is as
// loud as the news):
//
//   1. A client is suspended and turned back on, by the Greecon team in the console and as the client's own people see it: the question asked
//      once; the person already signed in is told in words and not shown a page that failed; a sign-in says why and does not read as a wrong
//      password; a wrong password still says only that; too many attempts is not "invalid"; turning it back on needs no new sign-in.
//   2. A box goes silent: the Greecon team is told by message before the customer calls, the console says so, and the customer's own screens
//      say that the readings are out of date and since when.
//
//   bash scripts/e2e/live-up.sh && node scripts/e2e/pm-e2e.cjs      (the second part needs the hotel it leaves, with its box now silent)
//   node scripts/e2e/field-trouble.cjs
//
// Part 2 waits until the box has been silent for a quarter of an hour (GATEWAY_LATE_WITHIN_SECONDS), up to FIELD_WAIT_MINUTES (default 25); with
// FIELD_SKIP_SILENT=1 it is left out.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { base, api, TEAM, signIn, CLIENT } = require("./lib/tour.cjs");

const OUT = process.env.E2E_SHOTS ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "field-trouble");
mkdirSync(OUT, { recursive: true });
const PROVIDER = `http://127.0.0.1:${process.env.FAKE_PROVIDER_PORT ?? 4100}`;
const steps = [];
const ok = (name, cond, extra = "") => {
  steps.push([cond ? "PASS" : "FAIL", name, extra]);
  console.log(cond ? "PASS" : "FAIL", name, extra);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const words = async (locator) => ((await locator.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();

async function call(method, path, token, body) {
  const response = await fetch(api + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { "x-greecon-session": token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : undefined };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => page.on("pageerror", (error) => errors.push(String(error)));

  // ---- 1. A client is suspended ------------------------------------------------------------------------------------------------
  const stamp = String(Date.now()).slice(-6);
  const name = `Vila Mare Guesthouse ${stamp}`;
  const owner = { name: "Arben Hoxha", email: `arben.${stamp}@vila-mare.example`, password: `Vila-Mare-${stamp}-ok` };
  const team = (await call("POST", "/auth/login", undefined, TEAM)).json;
  const made = await call("POST", "/platform-admin/tenants", team.token, { name, ownerName: owner.name, ownerEmail: owner.email });
  ok("the Greecon team onboards a guesthouse", made.status === 201 || made.status === 200, `status ${made.status}`);
  const first = (await call("POST", "/auth/login", undefined, { email: owner.email, password: made.json.temporaryPassword })).json;
  const changed = await call("POST", "/auth/change-password", first.token, { currentPassword: made.json.temporaryPassword, newPassword: owner.password });
  ok("its owner chooses their own password", changed.status === 201 || changed.status === 200, `status ${changed.status}`);

  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ownerPage = await ownerContext.newPage();
  watch(ownerPage);
  await signIn(ownerPage, owner, false);
  ok("the owner signs in and is in the account", new URL(ownerPage.url()).pathname === "/", ownerPage.url());

  const teamContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teamPage = await teamContext.newPage();
  watch(teamPage);
  await signIn(teamPage, TEAM, true);
  await teamPage.goto(base + "/platform", { waitUntil: "networkidle" });
  const row = teamPage.locator("tr", { hasText: name }).first();
  ok("the console lists the client as Active", /Active/.test(await words(row)), await words(row));
  await row.locator("summary", { hasText: "More" }).click();
  await row.getByRole("button", { name: "Suspend this client" }).waitFor();
  ok("the menu says what suspending does before anyone presses it", /cannot sign in/.test(await words(row)) && /Nothing is deleted/.test(await words(row)), await words(row.locator(".row-menu__panel")));

  const clipped = await row.locator(".row-menu__panel").evaluate((panel) => {
    const wrap = panel.closest(".table-wrap");
    return panel.getBoundingClientRect().bottom > wrap.getBoundingClientRect().bottom + 1 || wrap.scrollHeight > wrap.clientHeight + 1;
  });
  ok("the menu opens whole, inside its row, and does not turn the table into a scroll", !clipped);

  // Asked once, and "no" leaves everything as it was.
  let asked = "";
  teamPage.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.dismiss();
  });
  await row.getByRole("button", { name: "Suspend this client" }).click();
  await sleep(700);
  ok("suspending asks first, names the client and says what will happen", asked.includes(name) && /signed out/.test(asked) && /box is turned away/.test(asked) && /Nothing is deleted/.test(asked), asked);
  await teamPage.reload({ waitUntil: "networkidle" });
  ok("saying no changes nothing", /Active/.test(await words(teamPage.locator("tr", { hasText: name }).first())));
  await ownerPage.goto(base + "/", { waitUntil: "networkidle" });
  ok("the owner is still in", new URL(ownerPage.url()).pathname === "/");

  const row2 = teamPage.locator("tr", { hasText: name }).first();
  await row2.locator("summary", { hasText: "More" }).click();
  teamPage.once("dialog", (dialog) => void dialog.accept());
  await row2.getByRole("button", { name: "Suspend this client" }).click();
  await teamPage.locator("tr", { hasText: name }).first().getByText("Suspended").first().waitFor({ timeout: 15000 });
  ok("saying yes suspends it, and the console says Suspended", true);
  await teamPage.screenshot({ path: join(OUT, "01-console-suspended.png"), fullPage: true });
  const suspendedRow = teamPage.locator("tr", { hasText: name }).first();
  const open = suspendedRow.getByRole("button", { name: "Open for setup" });
  ok("a suspended client cannot be opened for setup, and the button looks it", (await open.isDisabled()) && Number(await open.evaluate((el) => getComputedStyle(el).opacity)) < 0.8);

  // The person who was in the account.
  await ownerPage.goto(base + "/sites", { waitUntil: "networkidle" });
  ok("the person already signed in is taken to the sign-in page, not shown a page that failed", ownerPage.url().includes("/login") && ownerPage.url().includes("suspended=1"), ownerPage.url());
  const said = await words(ownerPage.locator("main"));
  ok("and told in words that the account is suspended, and who to write to", /suspended by Greecon/.test(said) && /info@greecon\.earth/.test(said) && !/could not be loaded/i.test(said), said.slice(0, 260));
  ok("not as an error that could be mistaken for their own fault", !/Invalid email or password/.test(said));
  await ownerPage.screenshot({ path: join(OUT, "02-owner-turned-away.png"), fullPage: true });

  // A new sign-in.
  const stranger = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await stranger.newPage();
  watch(phone);
  const attempt = async (email, password) => {
    await phone.goto(base + "/login", { waitUntil: "networkidle" });
    await phone.fill('input[type="email"]', email);
    await phone.fill('input[type="password"]', password);
    await phone.getByRole("button", { name: "Continue" }).click();
    await phone.locator(".login-error[role=alert]").waitFor({ timeout: 15000 });
    return words(phone.locator(".login-error[role=alert]"));
  };
  const refusal = await attempt(owner.email, owner.password);
  ok("a sign-in with the right password says the account is suspended", /suspended by Greecon/.test(refusal) && /info@greecon\.earth/.test(refusal) && !/Invalid email/.test(refusal), refusal);
  await phone.screenshot({ path: join(OUT, "03-sign-in-suspended-phone.png"), fullPage: true });
  const wrong = await attempt(owner.email, "not-the-password-1");
  ok("a wrong password still says only that, and nothing about the account", wrong === "Invalid email or password.", wrong);
  const unknown = await attempt(`nobody.${stamp}@vila-mare.example`, "not-the-password-1");
  ok("and so does an address that has no account (nobody can learn which accounts exist)", unknown === wrong, unknown);

  // Too many attempts at one account from one place is a different thing from a wrong password.
  let flood = "";
  for (let n = 0; n < 10 && !/Too many/.test(flood); n++) flood = await attempt(`flood.${stamp}@vila-mare.example`, "not-the-password-1");
  ok("after too many attempts the page says to wait, not that the password is wrong", /Too many sign-in attempts/.test(flood) && /Wait a minute/.test(flood), flood);

  // Turned back on.
  await teamPage.reload({ waitUntil: "networkidle" });
  const row3 = teamPage.locator("tr", { hasText: name }).first();
  await row3.locator("summary", { hasText: "More" }).click();
  let dialogs = 0;
  teamPage.on("dialog", (dialog) => {
    dialogs++;
    void dialog.accept();
  });
  await row3.getByRole("button", { name: "Reactivate this client" }).click();
  await teamPage.locator("tr", { hasText: name }).first().getByText("Active").first().waitFor({ timeout: 15000 });
  ok("reactivating asks nothing and the console says Active", dialogs === 0, `${dialogs} questions`);
  await ownerPage.goto(base + "/", { waitUntil: "networkidle" });
  ok("the owner's own session works again without signing in", new URL(ownerPage.url()).pathname === "/", ownerPage.url());
  const again = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const againPage = await again.newPage();
  watch(againPage);
  await signIn(againPage, owner, false);
  ok("and a new sign-in works", new URL(againPage.url()).pathname === "/", againPage.url());
  await again.close();

  await ownerContext.close();
  await stranger.close();
  await teamContext.close();

  // ---- 2. A box goes silent -----------------------------------------------------------------------------------------------------
  if (process.env.FIELD_SKIP_SILENT !== "1") {
    const wait = Number(process.env.FIELD_WAIT_MINUTES ?? 25) * 60_000;
    const deadline = Date.now() + wait;
    const log = async () => (await call("GET", "/notifications/log?limit=100", team.token)).json ?? [];
    const recorded = async () => (await (await fetch(`${PROVIDER}/recorded`)).json());
    let told;
    for (;;) {
      told = (await log()).find((entry) => entry.kind === "box_silent" && (entry.subject ?? "").startsWith(`Box silent: ${CLIENT}`));
      if (told || Date.now() > deadline) break;
      await sleep(20_000);
    }
    if (!told) {
      ok("the Greecon team is told when a customer's box goes silent", false, "no message: run pm-e2e first and leave its box off for a quarter of an hour");
    } else {
      // The message is held through the team's quiet hours (it is not Act now): at night it waits in the log with the hour it is due, and
      // by day it has been sent. Either is right; neither is nothing.
      const dueMs = Date.parse(told.dueAtUtc);
      const sent = told.status === "sent";
      const held = told.status === "planned" && dueMs > Date.now();
      ok("the Greecon team is told when a customer's box goes silent: sent, or held for the quiet hours with the hour it is due", sent || held, `${told.status}, due ${told.dueAtUtc}: ${told.subject}`);
      ok("the message is for Greecon's own people and not for the customer", told.contactName === "Eridon Manuka" && !/hotel-adriatik/.test(told.destination ?? ""), `${told.contactName} ${told.destination}`);
      if (sent) {
        const message = (await recorded()).find((entry) => entry.channel === "email" && /^Box silent:/.test(entry.subject ?? ""));
        ok("what was sent names the client and the site, says since when, and what to do first", Boolean(message) && message.text.includes(`Client: ${CLIENT}`) && /Silent since:/.test(message.text) && /phone the customer before they phone you/.test(message.text), (message?.text ?? "").slice(0, 160).replace(/\n/g, " | "));
      }

      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      watch(page);
      await signIn(page, TEAM, true);
      await page.goto(base + "/today", { waitUntil: "networkidle" });
      const today = await words(page.locator("main"));
      ok("Today lists the site under Needs a look, with its box offline", today.includes(CLIENT) && /offline/i.test(today), today.slice(0, 300));
      await page.screenshot({ path: join(OUT, "04-today-box-silent.png"), fullPage: true });

      await page.goto(base + "/settings/people", { waitUntil: "networkidle" });
      const logged = await words(page.locator("main"));
      ok("Who is told shows the message, in the team's own time and not in UTC", logged.includes(`Box silent: ${CLIENT}`) && !/due \d\d:\d\d UTC/.test(logged), logged.slice(logged.indexOf("What was sent"), logged.indexOf("What was sent") + 240));
      await page.screenshot({ path: join(OUT, "05-who-is-told-log.png"), fullPage: true });

      await page.goto(base + "/platform", { waitUntil: "networkidle" });
      const clientRow = page.locator("tr", { hasText: CLIENT }).first();
      await clientRow.getByRole("button", { name: "Open for setup" }).click();
      await page.waitForURL("**/sites");
      await page.waitForLoadState("networkidle");
      // The page is drawn after the address changes (a skeleton first), so wait for the site's own link, not for the "Add a site" one.
      const siteLink = page.locator('a[href^="/sites/"]:not([href$="/new"]):not([href$="/setup"]):not([href$="/handover"])').first();
      await siteLink.waitFor({ timeout: 20000 });
      await page.goto(base + (await siteLink.getAttribute("href")), { waitUntil: "networkidle" });
      const site = await words(page.locator("main"));
      ok("the customer's site page says the readings are out of date", /out of date/i.test(site), site.slice(0, 300));
      await page.screenshot({ path: join(OUT, "06-site-box-silent.png"), fullPage: true });
      await page.goto(base + "/alerts", { waitUntil: "networkidle" });
      const alerts = await words(page.locator("main"));
      ok("and its alerts list says so in a sentence, with the customer's own tank alert still open", /out of date|no readings|not reporting/i.test(alerts) && /Tank level/i.test(alerts), alerts.slice(0, 300));
      await page.screenshot({ path: join(OUT, "07-alerts-box-silent.png"), fullPage: true });
      await context.close();
    }
  }

  await browser.close();
  ok("no script errors in the browser", errors.length === 0, errors.join(" | ").slice(0, 200));
  const failed = steps.filter(([result]) => result === "FAIL");
  console.log(failed.length ? `\n${failed.length} FAILED of ${steps.length}` : "\nALL PASS");
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
