// A gallery of the platform as each kind of person sees it: every page, on a desktop and on a phone, for the Greecon team, for a
// client's administrator (the team's own support session, which is the same screens), and for the published demo login.
// It also reports what is easy to get wrong and hard to see: a page that scrolls sideways on a phone, a console error, a control
// with no name for a screen reader, text smaller than 12 px, a tap target smaller than 40 px on a phone.
//
//   bash scripts/e2e/live-up.sh && node scripts/e2e/pm-e2e.cjs      (leaves a client with a site and a box, to look at)
//   node scripts/e2e/ux-tour.cjs [output directory]
//
// Needs Playwright with a Chromium (PLAYWRIGHT_MODULE if require("playwright") does not find it).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const OUT = process.argv[2] ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "tour");
mkdirSync(OUT, { recursive: true });
const base = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const api = process.env.E2E_API_URL ?? "http://localhost:4000";
const TEAM = { email: process.env.E2E_TEAM_EMAIL ?? "eridon.manuka@greecon.earth", password: process.env.E2E_TEAM_PASSWORD ?? "E2E-Admin-Passw0rd!" };
const DEMO = { email: "demo@greecon.earth", password: "demo123" };
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const findings = [];

async function signIn(page, who, team) {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  if (team) await page.getByRole("radio", { name: "Greecon team" }).click();
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="password"]', who.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function audit(page, label, size) {
  const result = await page.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, unnamed: [], small: [], tiny: [] };
    const nameOf = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.textContent || "").trim();
    for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const labelled = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const wrapped = el.closest("label");
      if (!nameOf(el) && !labelled && !wrapped && !el.getAttribute("aria-labelledby") && el.type !== "submit") out.unnamed.push(el.tagName.toLowerCase() + (el.getAttribute("href") ? `[${el.getAttribute("href")}]` : ""));
      const rect = el.getBoundingClientRect();
      // A link inside a sentence is a target by its words (WCAG 2.5.8 exempts it): only a link that stands alone must be big enough for a thumb.
      const inSentence = el.tagName === "A" && [...(el.parentElement?.childNodes ?? [])].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (rect.width && rect.height && (rect.height < 40 || rect.width < 40) && window.innerWidth < 500 && el.tagName !== "INPUT" && !inSentence) out.small.push(`${nameOf(el).slice(0, 24) || el.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    for (const el of document.querySelectorAll("p, li, td, th, span, label, a, button, dt, dd, small")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) out.tiny.push(`${(el.textContent || "").trim().slice(0, 24)} ${size}px`);
    }
    return out;
  });
  const note = (kind, items) => items.length && findings.push(`${label} [${size}] ${kind}: ${[...new Set(items)].slice(0, 6).join("; ")}${items.length > 6 ? ` (+${items.length - 6})` : ""}`);
  if (result.overflow > 1) findings.push(`${label} [${size}] scrolls sideways by ${result.overflow}px`);
  note("controls with no name", result.unnamed);
  note("tap targets under 40px", result.small);
  note("text under 12px", result.tiny);
}

async function shoot(browser, name, who, team, paths, after) {
  for (const [sizeName, viewport] of Object.entries(SIZES)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => findings.push(`${name} [${sizeName}] page error: ${String(error).slice(0, 160)}`));
    page.on("console", (message) => message.type() === "error" && !/favicon|Failed to load resource/.test(message.text()) && findings.push(`${name} [${sizeName}] console error: ${message.text().slice(0, 160)}`));
    await signIn(page, who, team);
    if (after) await after(page);
    for (const path of paths) {
      const resolved = typeof path === "function" ? await path(page) : path;
      if (!resolved) continue;
      const response = await page.goto(base + resolved, { waitUntil: "networkidle" }).catch(() => undefined);
      await page.waitForTimeout(700); // the energy picture and the charts settle
      const slug = resolved.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
      await page.screenshot({ path: join(OUT, `${name}-${sizeName}-${slug}.png`), fullPage: true });
      await audit(page, `${name} ${resolved}`, sizeName);
      if (response && response.status() >= 400) findings.push(`${name} ${resolved} [${sizeName}] answered ${response.status()}`);
    }
    // The person's menu, open: on a phone it is the only way to Account, Help and Log out.
    if (sizeName === "phone") {
      await page.goto(base + (paths.find((path) => typeof path === "string") ?? "/"), { waitUntil: "networkidle" });
      await page.locator(".user-menu summary").first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `${name}-phone-menu.png`) });
    }
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  // 1. The published demo login: an operator in a client account with three simulated sites.
  const firstSite = async (page) => {
    await page.goto(base + "/sites", { waitUntil: "networkidle" });
    const href = await page.locator('a[href^="/sites/"]').first().getAttribute("href").catch(() => null);
    return href && !href.endsWith("/setup") && !href.endsWith("/new") ? href : null;
  };
  // (The demo login is an operator: it has no Reports downloads, People, Who is told or Audit log, and the tour only visits what it may open.)
  await shoot(browser, "demo", DEMO, false, ["/", "/sites", firstSite, "/alerts", "/maintenance", "/analytics", "/settings", "/help", "/privacy"]);

  // 2. The Greecon team on its own console. One request is made first (as a visitor would on the Request access page), so Requests and Today show a line.
  await fetch(api + "/public/access-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Arben Hoxha", company: "Vila Mare Guesthouse", email: "arben@vila-mare.example", phone: "+355 69 555 0101", siteType: "hotel", message: "A guesthouse with a solar roof and a well pump." })
  }).catch(() => undefined);
  await shoot(browser, "team", TEAM, true, ["/today", "/platform", "/platform?onboard=new", "/platform/requests", "/platform/team", "/settings/people", "/audit", "/settings", "/help"]);

  // 3. The team inside a client's account, which is what a client's administrator sees (and a project manager sets up).
  const intoHotel = async (page) => {
    await page.goto(base + "/platform", { waitUntil: "networkidle" });
    const row = page.locator("tr", { hasText: process.env.E2E_CLIENT ?? "Hotel Adriatik" }).first();
    if (!(await row.count())) throw new Error("No client to open; run scripts/e2e/pm-e2e.cjs first.");
    await row.getByRole("button", { name: "Open for setup" }).click();
    await page.waitForURL("**/sites"); // opening an account answers with a redirect to its Sites; leave only once it has landed
    await page.waitForLoadState("networkidle");
  };
  const clientSite = async (page) => {
    await page.goto(base + "/sites", { waitUntil: "networkidle" });
    const links = await page.locator('a[href^="/sites/"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    return links.find((href) => href && !href.endsWith("/setup") && !href.endsWith("/handover") && !href.endsWith("/new")) ?? null;
  };
  const siteSub = (suffix) => async (page) => {
    const site = await clientSite(page);
    return site ? site + suffix : null;
  };
  await shoot(browser, "client", TEAM, true, ["/", "/sites", "/sites/new", clientSite, siteSub("/equipment"), siteSub("/setup"), siteSub("/handover"), "/alerts", "/analytics", "/reports", "/settings", "/settings/people", "/admin", "/audit", "/maintenance", "/help"], intoHotel);

  // 4. The public pages.
  const context = await browser.newContext({ viewport: SIZES.desktop });
  const page = await context.newPage();
  for (const path of ["/login", "/request-access", "/privacy", "/help"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, `public-desktop-${path.slice(1)}.png`), fullPage: true });
    await audit(page, `public ${path}`, "desktop");
  }
  await context.close();
  await browser.close();

  writeFileSync(join(OUT, "findings.txt"), findings.join("\n") + "\n");
  console.log(findings.length ? findings.join("\n") : "No findings.");
  console.log(`\nScreenshots are in ${OUT}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
