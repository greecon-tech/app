// The owner of Greecon's account gives the project manager a login of their own, in a real browser; the
// project manager signs in, chooses a password, sees the team but cannot change it; the owner turns them
// off and their open page ends at the sign-in page with a sentence that says why.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const SP = process.env.E2E_SHOTS ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "shots");
mkdirSync(SP, { recursive: true });
const base = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const steps = [];
const ok = (name, cond, extra = "") => {
  steps.push([cond ? "PASS" : "FAIL", name, extra]);
  console.log(cond ? "PASS" : "FAIL", name, extra);
};

async function signInAsTeam(page, email, password) {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "Greecon team" }).click();
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: "Continue" }).click();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // The owner.
  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const owner = await ownerContext.newPage();
  owner.on("pageerror", (e) => errors.push(String(e)));
  owner.on("dialog", (dialog) => dialog.accept());
  await signInAsTeam(owner, "eridon.manuka@greecon.earth", "E2E-Admin-Passw0rd!");
  await owner.waitForURL("**/platform");
  const team = owner.locator("section", { hasText: "Greecon team" }).last();
  ok("the console has a Greecon team section with the owner in it, marked as them", (await team.innerText()).includes("(you)"), (await team.innerText()).replace(/\n+/g, " | ").slice(0, 160));
  await owner.screenshot({ path: SP + "/team-1-owner.png", fullPage: true });

  const form = owner.getByRole("form", { name: "Add a team member" });
  await form.getByLabel("Name").fill("Arta Project");
  await form.getByLabel("Email").fill("arta.pm@greecon.earth");
  await form.getByRole("button", { name: "Add to the team" }).click();
  const notice = owner.locator(".credential-notice");
  await notice.waitFor();
  const temporary = (await notice.locator(".credential-notice__value").innerText()).trim();
  ok("a temporary password is shown once, with who it is for", temporary.length >= 12 && (await notice.innerText()).includes("arta.pm@greecon.earth"), (await notice.innerText()).replace(/\n+/g, " | ").slice(0, 200));
  await owner.reload({ waitUntil: "networkidle" });
  ok("the new person is on the list", (await owner.locator("main").innerText()).includes("arta.pm@greecon.earth"));
  ok("and the password is not shown again", (await owner.locator(".credential-notice").count()) === 0);

  // Adding the same address again is refused in words.
  const again = owner.getByRole("form", { name: "Add a team member" });
  await again.getByLabel("Name").fill("Arta Again");
  await again.getByLabel("Email").fill("ARTA.PM@greecon.earth");
  await again.getByRole("button", { name: "Add to the team" }).click();
  const refusal = await owner.locator('main .rule-actions__error[role="alert"]').first().innerText();
  ok("the same address cannot be added twice, and the sentence says what to do", /already has an account/.test(refusal), refusal.slice(0, 160));

  // The project manager.
  const pmContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const pm = await pmContext.newPage();
  pm.on("pageerror", (e) => errors.push(String(e)));
  await signInAsTeam(pm, "arta.pm@greecon.earth", temporary);
  await pm.waitForURL("**/change-password");
  ok("signing in with the temporary password leads straight to choosing a new one", true);
  await pm.screenshot({ path: SP + "/team-2-pm-change.png", fullPage: true });
  const fields = pm.locator('input[type="password"]');
  await fields.nth(0).fill(temporary);
  await fields.nth(1).fill("Arta-chose-this-long-one-7");
  if ((await fields.count()) > 2) await fields.nth(2).fill("Arta-chose-this-long-one-7");
  await pm.getByRole("button", { name: /password/i }).first().click();
  await pm.waitForURL("**/login?changed=1");
  ok("the new password is saved and she is asked to sign in with it", true);
  await signInAsTeam(pm, "arta.pm@greecon.earth", "Arta-chose-this-long-one-7");
  await pm.waitForURL("**/platform");
  const pmTeam = await pm.locator("main").innerText();
  ok("the project manager sees the team", pmTeam.includes("Arta Project") && pmTeam.includes("eridon.manuka@greecon.earth"));
  ok("but is not offered the form to add anyone, and is told why", (await pm.getByRole("form", { name: "Add a team member" }).count()) === 0 && pmTeam.includes("Only the owner of Greecon's account"));
  ok("nor buttons to reset or turn anyone off", (await pm.getByRole("button", { name: "Turn off" }).count()) === 0 && (await pm.getByRole("button", { name: "Reset password" }).count()) === 0);
  await pm.screenshot({ path: SP + "/team-3-pm.png", fullPage: true });

  // A customer's owner is locked out: only the owner of Greecon's account can reset them, and the page says who can't.
  const onboardForm = owner.locator("#onboard form");
  await onboardForm.getByLabel("Client / company name").fill("Hotel Adriatik");
  await onboardForm.getByLabel("Owner name").fill("Besa Krasniqi");
  await onboardForm.getByLabel("Owner email").fill("besa@hotel-adriatik.example");
  await onboardForm.getByRole("button", { name: "Onboard client" }).click();
  await onboardForm.locator(".credential-notice__value").waitFor();
  const besaTemporary = (await onboardForm.locator(".credential-notice__value").innerText()).trim();
  await owner.reload({ waitUntil: "networkidle" });
  const clientRow = owner.locator("tr", { hasText: "Hotel Adriatik" });
  await clientRow.getByText("People", { exact: true }).click();
  await clientRow.getByText("Besa Krasniqi").waitFor();
  ok("the owner of Greecon's account sees the client's people and a reset button", (await clientRow.getByRole("button", { name: "Reset password" }).count()) === 1);
  await clientRow.getByRole("button", { name: "Reset password" }).click();
  const besaNotice = clientRow.locator(".credential-notice");
  await besaNotice.waitFor();
  const besaNew = (await besaNotice.locator(".credential-notice__value").innerText()).trim();
  ok("a new temporary password is shown once, for that person", besaNew.length >= 12 && besaNew !== besaTemporary && (await besaNotice.innerText()).includes("besa@hotel-adriatik.example"));
  const oldTry = await fetch(`${process.env.E2E_API_URL ?? "http://localhost:4000"}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "besa@hotel-adriatik.example", password: besaTemporary }) });
  const newTry = await fetch(`${process.env.E2E_API_URL ?? "http://localhost:4000"}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "besa@hotel-adriatik.example", password: besaNew }) });
  ok("the old password stops working and the new one works, as a temporary one", oldTry.status === 401 && newTry.status === 201 && (await newTry.json()).user.mustChangePassword === true);

  await pm.goto(base + "/platform", { waitUntil: "networkidle" });
  const pmClientRow = pm.locator("tr", { hasText: "Hotel Adriatik" });
  await pmClientRow.getByText("People", { exact: true }).click();
  await pmClientRow.getByText("Besa Krasniqi").waitFor();
  ok("the project manager sees the people but is not offered a reset, and is told why", (await pmClientRow.getByRole("button", { name: "Reset password" }).count()) === 0 && (await pmClientRow.innerText()).includes("Only the owner of Greecon's account resets passwords."));
  await owner.screenshot({ path: SP + "/team-5-client-people.png", fullPage: true });

  // The owner turns her off.
  await owner.reload({ waitUntil: "networkidle" });
  const row = owner.locator("tr", { hasText: "arta.pm@greecon.earth" });
  await row.getByRole("button", { name: "Turn off" }).click();
  await owner.locator("tr", { hasText: "arta.pm@greecon.earth" }).getByText("Turned off").waitFor();
  ok("the owner turns her off and the list says so", true);

  // Her open page ends at the sign-in page on its next click, with the reason.
  await pm.goto(base + "/sites", { waitUntil: "networkidle" });
  ok("her next click ends at the sign-in page", pm.url().includes("/login?ended=1"), pm.url());
  ok("which says her session has ended", (await pm.locator("main").innerText()).includes("Your session has ended"));
  await pm.screenshot({ path: SP + "/team-4-ended.png", fullPage: true });
  await signInAsTeam(pm, "arta.pm@greecon.earth", "Arta-chose-this-long-one-7");
  await pm.getByText("Invalid email or password").waitFor();
  ok("and she cannot sign in again", true);

  // Back on, she can.
  await owner.locator("tr", { hasText: "arta.pm@greecon.earth" }).getByRole("button", { name: "Turn back on" }).click();
  await owner.locator("tr", { hasText: "arta.pm@greecon.earth" }).getByText("Can sign in").waitFor();
  await signInAsTeam(pm, "arta.pm@greecon.earth", "Arta-chose-this-long-one-7");
  await pm.waitForURL("**/platform");
  ok("turned back on, she signs in again with the password she chose", true);

  // The owner resets her password: she sees a new temporary one; her open session ends. (A session is dated to the
  // second and one opened in the very second of a reset is kept; a person takes longer than that.)
  await pm.waitForTimeout(1200);
  await owner.locator("tr", { hasText: "arta.pm@greecon.earth" }).getByRole("button", { name: "Reset password" }).click();
  const resetNotice = owner.locator(".credential-notice");
  await resetNotice.waitFor();
  ok("a reset shows a new temporary password once", (await resetNotice.innerText()).includes("New password"));
  await pm.goto(base + "/sites", { waitUntil: "networkidle" });
  ok("and the session she had open ends", pm.url().includes("/login"), pm.url());

  ok("no script errors in the browser", errors.length === 0, errors.join("; "));
  await browser.close();
  const failed = steps.filter((s) => s[0] === "FAIL").length;
  console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(2);
});
