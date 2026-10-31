// What the two browser tours (ux-tour.cjs, a11y-audit.cjs) have in common: where the stack is, who signs in, and which pages each
// kind of person has. They visit the same screens so that a picture and a measurement can be compared.
const base = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const api = process.env.E2E_API_URL ?? "http://localhost:4000";
const TEAM = { email: process.env.E2E_TEAM_EMAIL ?? "eridon.manuka@greecon.earth", password: process.env.E2E_TEAM_PASSWORD ?? "E2E-Admin-Passw0rd!" };
const DEMO = { email: "demo@greecon.earth", password: "demo123" };
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const PUBLIC_PATHS = ["/login", "/request-access", "/privacy", "/help"];

async function signIn(page, who, team) {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  if (team) await page.getByRole("radio", { name: "Greecon team" }).click();
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="password"]', who.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

// A visitor asks for access, so that Requests and Today have a line to show.
async function oneRequest() {
  await fetch(api + "/public/access-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Arben Hoxha", company: "Vila Mare Guesthouse", email: "arben@vila-mare.example", phone: "+355 69 555 0101", siteType: "hotel", message: "A guesthouse with a solar roof and a well pump." })
  }).catch(() => undefined);
}

// The published demo login is an operator in a client account with three simulated sites.
const firstSite = async (page) => {
  await page.goto(base + "/sites", { waitUntil: "networkidle" });
  const href = await page.locator('a[href^="/sites/"]').first().getAttribute("href").catch(() => null);
  return href && !href.endsWith("/setup") && !href.endsWith("/new") ? href : null;
};

// The team inside a client's account, which is what a client's administrator sees (and a project manager sets up).
const intoClient = (name) => async (page) => {
  await page.goto(base + "/platform", { waitUntil: "networkidle" });
  const row = page.locator("tr", { hasText: name }).first();
  if (!(await row.count())) throw new Error(`No client called ${name} to open; run scripts/e2e/pm-e2e.cjs first.`);
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

const CLIENT = process.env.E2E_CLIENT ?? "Hotel Adriatik";

/**
 * The pages each kind of person has. A path may be a function that finds the page (the first site, say) and answers null when there is none.
 * `before` runs once, before the first person signs in; `after` runs once the person is signed in, before their pages.
 */
const PLANS = [
  // The demo login is an operator: it has no Reports downloads, People, Who is told or Audit log, and the tour only visits what it may open.
  { name: "demo", who: DEMO, team: false, paths: ["/", "/sites", firstSite, "/alerts", "/maintenance", "/analytics", "/settings", "/help", "/privacy"] },
  // One request is made first (as a visitor would on the Request access page), so Requests and Today show a line.
  { name: "team", who: TEAM, team: true, before: oneRequest, paths: ["/today", "/platform", "/platform?onboard=new", "/platform/requests", "/platform/team", "/settings/people", "/audit", "/settings", "/help"] },
  {
    name: "client",
    who: TEAM,
    team: true,
    after: intoClient(CLIENT),
    paths: ["/", "/sites", "/sites/new", clientSite, siteSub("/equipment"), siteSub("/setup"), siteSub("/install-card"), siteSub("/handover"), "/alerts", "/analytics", "/reports", "/settings", "/settings/people", "/admin", "/audit", "/maintenance", "/help"]
  }
];

module.exports = { base, api, TEAM, DEMO, SIZES, PUBLIC_PATHS, PLANS, CLIENT, signIn, oneRequest, intoClient, clientSite, siteSub, firstSite };
