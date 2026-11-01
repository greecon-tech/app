# Testing and verification

Four layers, from cheapest to most real. A change is not done until the layers it touches are green. CI runs the first
three on every pull request and every push to `main` (`.github/workflows/ci.yml`); the fourth is run by hand before a
release goes to a project manager.

## 1. Unit tests (`npm test`)

Pure functions and services with no database: the rules and alerts (`packages/gaia-core`), the contracts and wording
(`packages/shared`), the API's services against their in-memory stores, the box's reader, queue and updater against a
fake Modbus server and a fake platform. What they pin, in outline:

- **Safety:** a command is blocked by dry running, overpressure, a bad sensor reading, an expired override; every
  command is simulated and nothing is sent. Stopping is never blocked by a missing reading (`adr/0002`).
- **Truth:** a state is computed from readings and their age, never stored; silence is never "fine".
- **Isolation:** one client never sees, changes or learns of another's data. `platform.isolation.spec.ts` reads and
  attacks every service method with a second client's principal, and fails if a new method that takes a principal is
  not covered.
- **Roles and access:** RBAC per route; support sessions cannot change who may sign in; only the owner of Greecon's account
  changes the team.
- **Telling people:** the plan for each alert (who, when, by which way), quiet hours, acknowledgement, the morning
  message, the delivery log, retries, limits, and what each message says (`apps/api/src/notifications`).
- **Downloads:** the files' columns, the spreadsheet protections, the audit line for each download.
- **The box:** register decoding (word order, scaling, 4 to 20 mA lines), what a failed device does to a round, the queue
  through a long outage, an update that fails three times going back.

## 2. Integration tests against a real PostgreSQL

Run when `TEST_DATABASE_URL` points at a PostgreSQL the tests may create databases in, and skipped when it does not. Each test
makes and drops its own database. They cover what a fake cannot: the migration runner and its ledger (including a database
made before the ledger), the account safeguards (published passwords closed, the bootstrap administrator), the outbox
(`FOR UPDATE SKIP LOCKED`, restarts, duplicates), the chart history (bucketed with `date_bin`), the downloads over a real
window of readings, and the team, session revocation and password resets. CI provides a `postgres:16` service; locally
`pg_ctlcluster 16 main start` and `TEST_DATABASE_URL=postgres://user:password@127.0.0.1:5432/postgres npm test`.

## 3. The smoke test (`node scripts/run-smoke.mjs`)

Starts the built API on a fresh database in production mode and runs two scripts over real sockets: `smoke-api.mjs` (onboard
a customer, make a site from a template, address devices, enrol a box with its code, heartbeat, readings, the checklist
following, who is told, the downloads, another customer unable to reach any of it, a replacement box, a project manager
signing in under their own name, the team, turning someone off) and `smoke-edge.mjs` (run **the real installer** against
the platform, install a box from a code, read a pretend meter, take a change without touching it, and go back from a
version that will not start). Unit tests cannot see a missing provider, a route the guard turns away or a validation rule
that refuses a good request; this can.

A third script, `smoke-sites.mjs` (`node scripts/run-smoke.mjs smoke-sites.mjs`), runs **four kinds of site from zero**: a
hotel, a solar plant with a battery, a farm and a water station, each with its own customer, the real installer and a real
box, against pretend equipment that holds what real equipment holds (a 4 to 20 mA tank level, a meter's float, a signed
air temperature, a battery's signed power, separate registers for each unit on one cable). Then it does to each what goes
wrong in the field: a meter's clamps the wrong way round, an inverted pump contact, a module that stops answering, a tank
that empties, a level above its range, a frost, and a customer that Greecon suspends and turns back on. It is not in CI's
default list because it takes minutes; run it before a release.

## 4. The browser journeys and the demo build, by hand

- `scripts/e2e/` drives **the whole project manager's job in a real browser** against a real stack (a real API and database,
  the built web app, a stand-in for the email and text providers): onboarding, opening an account, a site from a template, the
  install command, addresses and registers, the checklist following a pretend box, who is told and a test message, an Act now
  email within seconds, acknowledging, the downloads, the handover sheet and its print view, the fleet and Greecon's own
  morning message, and the team.
- `scripts/e2e/a11y-audit.cjs` measures **the standards of `29-apple-notion-standards.md`** page by page as each kind of person
  sees it (axe, a keyboard walk, text at 200 %, 320 px wide, the dark, more contrast, less motion, touch sizes, names);
  `first-day.cjs` runs **a customer's first day on an empty platform**; `field-trouble.cjs` does **what goes wrong at a
  customer** (a client suspended, a box gone silent) and checks what each person is told.
- **The five-role static export** that GitHub Pages publishes must build for each role (`apps/web/scripts/build-static.sh`,
  see `12-deployment-github-pages.md`). A route or page that works live can break it (a Server Action, a dynamic route with no
  parameters); CI's Pages workflow is the only automatic check, so run it before merging a change to the web app.
- **An upgrade from an old database:** start the new API on a copy of a database made by an earlier version; it must come up
  and keep the data (the migration ledger baselines what is already there).

## What is not tested

Real meters, real text delivery to Albanian networks, real email deliverability, a real Railway deployment, a power cut on
real hardware, and anything about customers' behaviour. Each is a step in `docs/launch/`, done by a person, once.
