// Every kind of site a customer can add (a hotel, a solar plant, a farm, a water station, a blank one), and every page that belongs to a
// site, opened in a real browser by the customer's own administrator. A page that could not be made says "This page could not be loaded";
// none may. This is the check that would have caught a setup list that failed for any site with no grid meter, because the first
// journeys only ever made a hotel.
//
//   bash scripts/e2e/live-up.sh && node scripts/e2e/site-kinds.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { base, api, TEAM, signIn } = require("./lib/tour.cjs");

const OUT = process.env.E2E_SHOTS ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "site-kinds");
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

const KINDS = [
  { template: "hotel", name: "Hotel kind", place: "Durrës" },
  { template: "solar_grid", name: "Solar kind", place: "Vlorë" },
  { template: "farm_irrigation", name: "Farm kind", place: "Lushnjë" },
  { template: "water_station", name: "Water kind", place: "Berat" },
  { template: "blank", name: "Blank kind", place: "Tiranë" }
];
const PAGES = ["", "/setup", "/equipment", "/handover"];

(async () => {
  const suffix = String(Date.now()).slice(-6);
  const team = (await call("POST", "/auth/login", undefined, TEAM)).json;
  const owner = { email: `kinds.${suffix}@kinds.example`, password: `Kinds-${suffix}-Passw0rd` };
  const made = await call("POST", "/platform-admin/tenants", team.token, { name: `Kinds ${suffix}`, ownerName: "Kinds Owner", ownerEmail: owner.email });
  const first = (await call("POST", "/auth/login", undefined, { email: owner.email, password: made.json.temporaryPassword })).json;
  await call("POST", "/auth/change-password", first.token, { currentPassword: made.json.temporaryPassword, newPassword: owner.password });
  const session = (await call("POST", "/auth/login", undefined, owner)).json;

  const sites = [];
  for (const kind of KINDS) {
    const created = await call("POST", "/sites/from-template", session.token, { templateKey: kind.template, name: kind.name, locationName: kind.place });
    ok(`a ${kind.template} site is made`, created.status === 201, `status ${created.status}`);
    if (created.status === 201) sites.push({ ...kind, id: created.json.site.id });
  }

  const browser = await chromium.launch();
  const errors = [];
  for (const size of [{ name: "desk", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await signIn(page, owner, false);
    for (const site of sites) {
      for (const suffixPath of PAGES) {
        await page.goto(`${base}/sites/${site.id}${suffixPath}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        const broken = await page.getByText("This page could not be loaded").count();
        const heading = (await page.locator("h1").first().innerText().catch(() => "")).replace(/\s+/g, " ");
        ok(`${site.template} ${suffixPath || "/"} opens on a ${size.name}`, broken === 0 && heading.length > 0, broken ? "the page could not be loaded" : heading);
        if (suffixPath === "/setup") await page.screenshot({ path: join(OUT, `${site.template}-setup-${size.name}.png`), fullPage: true });
      }
    }
    await context.close();
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
