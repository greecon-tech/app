# End-to-end checks

The same journeys as the smoke test (`node scripts/run-smoke.mjs`), but in a real browser against a real stack, plus the two
checks that cannot be a unit test: the five-role demo build GitHub Pages publishes, and an upgrade from an old database.
Run them before a release goes to a project manager (`docs/09-testing-and-verification.md`, layer 4).

**You need:** PostgreSQL 14 or newer with a role that may create databases (`E2E_DATABASE_ADMIN_URL`, default
`postgres://greecon:greecon@127.0.0.1:5432/postgres`); Node.js 22; `psql`; and, for the browser journeys, Playwright with a
Chromium (it is not a dependency of the repository: `npm i -g playwright && npx playwright install chromium`, then set
`PLAYWRIGHT_MODULE` to the module's path if `require("playwright")` does not find it).

```bash
npm run build                                   # the API, the web app and the box's software
bash scripts/e2e/live-up.sh > /tmp/up.log 2>&1  # fresh database, real API with a stand-in for email and text, the web app
tail -1 /tmp/up.log                             # LIVE-UP

node scripts/e2e/pm-e2e.cjs                     # the project manager's whole job, a critical tank, the downloads,
                                                # the handover sheet, the fleet and Greecon's own morning message
bash scripts/e2e/live-down.sh && bash scripts/e2e/live-up.sh > /tmp/up.log 2>&1   # a fresh database for the next one
node scripts/e2e/team-e2e.cjs                   # the owner adds a project manager; sessions end when access does;
                                                # a locked-out customer person is reset
bash scripts/e2e/live-down.sh

bash scripts/e2e/static-export.sh               # the five role builds of the demo; do not edit apps/web meanwhile
bash scripts/e2e/upgrade-from-legacy.sh         # an old database to start the current API on
```

Each journey prints `PASS` or `FAIL` for every step and ends `ALL PASS` or `N FAILED`. Screenshots go to
`$E2E_DIR/shots` (`E2E_DIR` defaults to `$TMPDIR/greecon-e2e`). The stand-in provider (`fake-provider.cjs`, port 4100) records
every email and text the platform would have sent and lists them at `GET /recorded`. The sign-in of the first administrator
is `eridon.manuka@greecon.earth` with the password in `live-up.sh`; it is a test value that exists only in that database.
