#!/usr/bin/env node
// Starts the built API on a fresh database, runs the smoke scripts against it, stops it and drops the
// database. What CI runs after the build, and what to run before handing a release to a project manager:
//
//   npm run build && node scripts/run-smoke.mjs
//
// Needs a PostgreSQL it may create a database in: SMOKE_DATABASE_ADMIN_URL, or TEST_DATABASE_URL.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/api/package.json"));
const { Pool } = require("pg");

const adminUrl = process.env.SMOKE_DATABASE_ADMIN_URL ?? process.env.TEST_DATABASE_URL;
if (!adminUrl) {
  console.error("Set SMOKE_DATABASE_ADMIN_URL (or TEST_DATABASE_URL) to a PostgreSQL the smoke test may create a database in.");
  process.exit(2);
}

const port = Number(process.env.SMOKE_PORT ?? 4010);
const name = `greecon_smoke_${randomBytes(4).toString("hex")}`;
const adminEmail = "admin@smoke.example";
const adminPassword = "Smoke-admin-password-1";

const admin = new Pool({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.query(`CREATE DATABASE ${name}`);
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${name}`;

let api;
let exitCode = 1;
try {
  api = spawn(process.execPath, [resolve(root, "apps/api/dist/main.js")], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl.toString(),
      JWT_SECRET: "smoke-test-secret-that-is-long-enough-0123456789",
      NODE_ENV: "production",
      BOOTSTRAP_ADMIN_EMAIL: adminEmail,
      BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
      PORT: String(port),
      TRUST_PROXY: "1",
      PUBLIC_API_URL: `http://127.0.0.1:${port}`,
      // After its own start the platform will not call a box silent for ten minutes (it cannot yet tell a box that is reconnecting from one
      // that is quiet). A smoke run is shorter than that and wants to see a silent module reported, so it waits one minute, as the browser
      // journeys do.
      RESTART_GRACE_MINUTES: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  api.stdout.on("data", (chunk) => (log += chunk));
  api.stderr.on("data", (chunk) => (log += chunk));

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (api.exitCode !== null) throw new Error(`The API stopped while starting:\n${log.slice(-3000)}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) throw new Error(`The API did not come up within a minute:\n${log.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const env = { ...process.env, API_URL: `http://127.0.0.1:${port}`, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword };
  const scripts = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["smoke-api.mjs", "smoke-edge.mjs"];
  let worst = 0;
  for (const script of scripts) {
    console.log(`\n=== ${script} ===`);
    const code = await new Promise((resolveCode) => {
      const child = spawn(process.execPath, [resolve(root, "scripts", script)], { cwd: root, env, stdio: "inherit" });
      child.on("close", (status) => resolveCode(status ?? 1));
    });
    worst = Math.max(worst, code);
  }
  if (worst !== 0) console.error(`\n--- the API's own log, last lines ---\n${log.slice(-3000)}`);
  exitCode = worst;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (api && api.exitCode === null) {
    api.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        api.kill("SIGKILL");
        resolve();
      }, 5000);
      api.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
  await admin.end().catch(() => undefined);
}
process.exit(exitCode);
