// A customer's first day, from nothing, through the screens: a fresh platform with no client in it; a visitor asks for access; Greecon
// onboards them; the owner signs in with the temporary password, chooses their own, and finds an account with nothing in it; they say
// who is to be told; Greecon makes their first site; and the owner looks at it before any box has spoken. At every stop it checks that the
// screen says what is here, why there is nothing, and what happens next, and takes a picture of it on a desk and on a phone.
//
//   bash scripts/e2e/live-up.sh        (a fresh database: this is the one journey that needs the platform to be empty)
//   node scripts/e2e/first-day.cjs [output directory]
//
// Needs Playwright with a Chromium (PLAYWRIGHT_MODULE if require("playwright") does not find it).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { base, TEAM, signIn } = require("./lib/tour.cjs");

const OUT = process.argv[2] ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "first-day");
mkdirSync(OUT, { recursive: true });
const steps = [];
const ok = (name, condition, extra = "") => {
  steps.push([condition ? "PASS" : "FAIL", name, extra]);
  console.log(condition ? "PASS" : "FAIL", name, extra);
};
// The page's words, once it has been drawn: while it is being fetched the frame shows a skeleton and a line that says it is loading.
const text = async (page) => {
  await page.locator(".skeleton-page").waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
  return (await page.locator("main").innerText()).replace(/\s+/g, " ").trim();
};
const OWNER = { name: "Besa Krasniqi", email: "besa@guesthouse-bardhi.example", company: "Guesthouse Bardhi", password: "Bardhi-own-passw0rd!" };
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

/** A picture of the page as it is now, on a desk and on a phone, in the same person's session. */
async function pictures(browser, storageState, path, name) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    const context = await browser.newContext({ viewport, storageState });
    const page = await context.newPage();
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, `${name}-${size}.png`), fullPage: true });
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // 1. The Greecon team, on a platform with nobody in it.
  const teamContext = await browser.newContext({ viewport: SIZES.desktop });
  const team = await teamContext.newPage();
  team.on("pageerror", (error) => errors.push(String(error)));
  await signIn(team, TEAM, true);
  await team.goto(base + "/today", { waitUntil: "networkidle" });
  let words = await text(team);
  ok("Today, on an empty platform, says there is nothing live and offers the next step", /No customer site is live yet/.test(words) && (await team.getByRole("link", { name: "Onboard a client" }).count()) >= 1, words.slice(0, 160));
  await pictures(browser, await teamContext.storageState(), "/today", "01-team-today-empty");
  await team.goto(base + "/platform", { waitUntil: "networkidle" });
  words = await text(team);
  ok("Clients, with none, says so and says what to do", /No client yet/.test(words) && /Onboard a client/.test(words), words.slice(0, 200));
  await pictures(browser, await teamContext.storageState(), "/platform", "02-team-clients-empty");
  await team.goto(base + "/platform/requests", { waitUntil: "networkidle" });
  words = await text(team);
  ok("Requests, with none, says what will appear there", /No one is waiting/.test(words), words.slice(0, 160));
  await pictures(browser, await teamContext.storageState(), "/platform/requests", "03-team-requests-empty");

  // 2. A visitor asks for access on the public page.
  const visitorContext = await browser.newContext({ viewport: SIZES.phone });
  const visitor = await visitorContext.newPage();
  await visitor.goto(base + "/request-access", { waitUntil: "networkidle" });
  await visitor.screenshot({ path: join(OUT, "04-request-access-phone.png"), fullPage: true });
  await visitor.getByLabel("Your name").fill(OWNER.name);
  await visitor.getByLabel("Company or property").fill(OWNER.company);
  await visitor.getByLabel("Email").fill(OWNER.email);
  await visitor.getByLabel("Phone (optional)").fill("+355 69 444 0102");
  await visitor.getByLabel("What do you run?").selectOption({ index: 0 });
  await visitor.getByLabel("Anything we should know (optional)").fill("A guesthouse with a solar roof and a water tank.");
  await visitor.getByRole("button", { name: "Send request" }).click();
  await visitor.getByText("Thank you. We have your request.").waitFor();
  ok("the visitor is thanked and told when to expect a call", /within one working day/.test(await visitor.locator("main").innerText()));
  await visitor.screenshot({ path: join(OUT, "05-request-received-phone.png"), fullPage: true });
  await visitorContext.close();

  // 3. The team sees it, and onboards from it.
  await team.goto(base + "/today", { waitUntil: "networkidle" });
  words = await text(team);
  ok("Today now shows the request, by who asked", words.includes(OWNER.company), words.slice(0, 200));
  await pictures(browser, await teamContext.storageState(), "/today", "06-team-today-request");
  await team.goto(base + "/platform/requests", { waitUntil: "networkidle" });
  await team.getByRole("link", { name: "Onboard" }).first().click();
  await team.waitForURL("**/platform?onboard=*");
  const filled = await team.locator("#onboard").evaluate((el) => el.open && el.querySelector("input")?.value);
  ok("Onboard opens the form with the visitor's company already in it", filled === OWNER.company, String(filled));
  await team.getByRole("button", { name: "Onboard client" }).click();
  await team.locator(".credential-notice__value").waitFor();
  const temporary = (await team.locator(".credential-notice__value").first().innerText()).trim();
  const notice = (await team.locator(".credential-notice").first().innerText()).replace(/\s+/g, " ");
  ok("the temporary password is shown once, with who it is for and what to do with it", temporary.length >= 10 && /once|only/i.test(notice) && notice.includes(OWNER.email), notice.slice(0, 220));
  await team.screenshot({ path: join(OUT, "07-team-onboarded.png"), fullPage: true });
  await team.goto(base + "/platform/requests", { waitUntil: "networkidle" });
  words = await text(team);
  ok("the request is closed by onboarding, so the inbox is true", /No one is waiting/.test(words), words.slice(0, 160));

  // 4. The owner's first sign-in: only a new password is possible.
  const ownerContext = await browser.newContext({ viewport: SIZES.phone });
  const owner = await ownerContext.newPage();
  owner.on("pageerror", (error) => errors.push(String(error)));
  await owner.goto(base + "/login", { waitUntil: "networkidle" });
  await owner.fill('input[type="email"]', OWNER.email);
  await owner.fill('input[type="password"]', temporary);
  await owner.getByRole("button", { name: "Continue" }).click();
  await owner.waitForURL("**/change-password");
  await owner.getByRole("heading", { name: "Choose your own password" }).waitFor();
  words = await owner.locator("main").innerText();
  ok("signing in with the temporary password leads to choosing one's own, and says why", /Choose your own password/.test(words) && /only for the first sign-in/.test(words) && words.toLowerCase().includes(OWNER.name.toLowerCase()), words.replace(/\s+/g, " ").slice(0, 160));
  await owner.screenshot({ path: join(OUT, "08-owner-change-password-phone.png"), fullPage: true });
  await owner.goto(base + "/sites", { waitUntil: "networkidle" });
  ok("until then nothing else opens", owner.url().includes("/change-password") || owner.url().includes("/login"), owner.url());
  await owner.goto(base + "/change-password", { waitUntil: "networkidle" });
  await owner.getByLabel("Temporary password you were given").fill(temporary);
  await owner.getByLabel("New password (at least 10 characters)").fill("short");
  await owner.getByLabel("Confirm new password").fill("short");
  await owner.getByRole("button", { name: "Change password" }).click();
  // The browser's own minLength stops a short password before the platform is asked; a long one that does not match is refused in words.
  await owner.getByLabel("New password (at least 10 characters)").fill(OWNER.password);
  await owner.getByLabel("Confirm new password").fill(OWNER.password + "x");
  await owner.getByRole("button", { name: "Change password" }).click();
  const mismatch = await owner.locator('form [role="alert"]').innerText();
  ok("a confirmation that does not match is refused in words", /don't match/.test(mismatch), mismatch);
  await owner.getByLabel("Confirm new password").fill(OWNER.password);
  await owner.getByRole("button", { name: "Change password" }).click();
  await owner.waitForURL("**/login**");
  ok("after choosing, the person is asked to sign in again with the new one", /changed=1/.test(owner.url()) || (await owner.locator("main").innerText()).includes("saved"), owner.url());
  await owner.fill('input[type="email"]', OWNER.email);
  await owner.fill('input[type="password"]', OWNER.password);
  await owner.getByRole("button", { name: "Continue" }).click();
  await owner.waitForURL((url) => !url.pathname.startsWith("/login"));
  await owner.waitForLoadState("networkidle");
  const ownerState = await ownerContext.storageState();

  // 5. The account, with nothing in it.
  const places = [
    ["/", "10-owner-overview-empty"],
    ["/sites", "11-owner-sites-empty"],
    ["/alerts", "12-owner-alerts-empty"],
    ["/reports", "13-owner-reports-empty"],
    ["/analytics", "14-owner-trends-empty"],
    ["/settings/people", "15-owner-who-is-told-empty"],
    ["/admin", "16-owner-people"],
    ["/help", "17-owner-help"]
  ];
  for (const [path, name] of places) {
    const response = await owner.goto(base + path, { waitUntil: "networkidle" });
    const heading = await owner.locator("h1").first().innerText().catch(() => "");
    words = await text(owner);
    ok(`${path} opens for the owner, with a title and no error`, response.status() < 400 && heading.length > 0 && !/could not be loaded|went wrong/i.test(words), `${response.status()} "${heading}"`);
    await pictures(browser, ownerState, path, name);
  }
  await owner.goto(base + "/", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("the Overview of an account with no site says what a site is and what happens next", /No site yet/.test(words) && /Greecon/.test(words), words.slice(0, 260));
  ok("and says who will set it up, and when readings will appear", /sets up|set up|fits a small box|installs?/i.test(words) && /first readings arrive/i.test(words), words.slice(0, 300));
  ok("and gives the owner something to do now: say who is to be told", (await owner.getByRole("link", { name: /who is told|add the people/i }).count()) >= 1, "");
  await owner.goto(base + "/alerts", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("Alerts, with nothing open, says what will appear there", /Nothing is open/.test(words), words.slice(0, 160));
  await owner.goto(base + "/reports", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("Reports, with no site, says there is nothing to download yet and why", /no site yet|nothing to download|once .*site/i.test(words), words.slice(0, 260));
  await owner.goto(base + "/analytics", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("Trends, with no site, says what will be charted and when", /site|reading/i.test(words), words.slice(0, 260));

  // 6. Before the site exists, the owner says who is to be told.
  await owner.goto(base + "/settings/people", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("Who is told explains itself on an empty list", /email|text/i.test(words) && /told/i.test(words), words.slice(0, 260));

  // 7. Greecon makes the first site from a template and opens the account.
  await team.goto(base + "/platform", { waitUntil: "networkidle" });
  const row = team.locator("tr", { hasText: OWNER.company }).first();
  await row.getByRole("button", { name: "Open for setup" }).click();
  await team.waitForURL("**/sites");
  words = await text(team);
  ok("inside the new account, Sites offers to add the first site", /No site yet/.test(words) && (await team.getByRole("link", { name: "Add a site" }).count()) >= 1, words.slice(0, 200));
  await team.getByRole("link", { name: "Add a site" }).first().click();
  await team.waitForURL("**/sites/new");
  await pictures(browser, await teamContext.storageState(), "/sites/new", "20-team-new-site");
  const form = team.getByRole("form", { name: "New site from a template" });
  await form.getByLabel("What kind of site").selectOption({ label: "Hotel or guesthouse" });
  await form.getByLabel("Site name").fill("Guesthouse Bardhi");
  await form.getByLabel("Where it is").fill("Gjirokastër, Albania");
  await form.getByRole("button", { name: "Create the site and start setting it up" }).click();
  await team.waitForURL("**/sites/*/setup");
  const siteId = team.url().split("/sites/")[1].split("/")[0];
  await team.screenshot({ path: join(OUT, "21-team-setup-start.png"), fullPage: true });
  ok("the new site opens on its setup list, with nothing done and the next step named", /^0 of \d+ steps done/.test(await team.locator(".setup-progress__words").innerText()) && (await team.locator(".setup-next").innerText()).length > 10);

  // 8. The owner looks at the site before any box has spoken.
  await owner.goto(base + "/sites", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("the owner's Sites list shows the new site, and says it has no readings yet", words.includes("Guesthouse Bardhi") && /No readings yet/.test(words), words.slice(0, 220));
  await pictures(browser, ownerState, "/sites", "22-owner-sites-new");
  await owner.goto(`${base}/sites/${siteId}`, { waitUntil: "networkidle" });
  words = await text(owner);
  ok("the site's own page says it is being set up, who is doing it, and what comes next, instead of an empty wall", /being set up|set up by Greecon|waiting for|not yet|installs?/i.test(words), words.slice(0, 400));
  await pictures(browser, ownerState, `/sites/${siteId}`, "23-owner-site-before-box");
  await owner.goto(base + "/", { waitUntil: "networkidle" });
  words = await text(owner);
  ok("the Overview now answers about the one site, and does not claim it is fine", !/Stable/.test(words.slice(0, 200)) || /Unknown|setting up|no readings/i.test(words), words.slice(0, 240));
  await pictures(browser, ownerState, "/", "24-owner-overview-new-site");

  ok("no script errors in the browser", errors.length === 0, errors.join("; "));
  await browser.close();
  const failed = steps.filter((step) => step[0] === "FAIL").length;
  console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
  console.log(`Pictures are in ${OUT}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("E2E ERROR", error);
  process.exit(2);
});
