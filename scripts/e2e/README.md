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

node scripts/e2e/ux-tour.cjs [folder]           # every screen as the team, as a client and as the demo, on a desk and on a phone:
                                                # a gallery of pictures, and the findings (sideways scrolling, controls with no
                                                # name, buttons too small for a thumb, text under 12 px, errors in the console)
                                                # (run it after pm-e2e, which leaves a client with a site to look at)

PLAYWRIGHT_MODULE=… AXE_MODULE=… node scripts/e2e/a11y-audit.cjs [folder]
                                                # the standards of docs/29 measured page by page, as each kind of person sees it, in the
                                                # light and the dark, with more contrast and less motion, at 200 % text and at 320 px:
                                                # axe (WCAG 2.2 AA), a Tab walk, quick find, touch targets, names, words that overlap or
                                                # spill at 200 %, and a scan of the source for timers that could close a message. It reports; with
                                                # A11Y_STRICT=1 a finding fails it. A11Y_SHOTS=1 keeps a picture of every page in each
                                                # setting. axe-core is not a dependency either (npm i -g axe-core; AXE_MODULE is its folder).
                                                # Run it after pm-e2e, which leaves a client with a site.

node scripts/e2e/field-trouble.cjs [folder]    # what goes wrong at a customer, in the browser: a client is suspended and turned back on (the
                                                # question asked once; the person signed in is told in words; the sign-in says why and
                                                # does not read as a wrong password; too many attempts is not "invalid"), and a box goes
                                                # silent (the team is told, or the message waits for quiet hours with its time; Today, the
                                                # site and its alerts say so). Run it after pm-e2e: its second part waits until the hotel's
                                                # box has been silent a quarter of an hour (FIELD_WAIT_MINUTES, default 25; FIELD_SKIP_SILENT=1
                                                # leaves that part out).

bash scripts/e2e/live-down.sh && bash scripts/e2e/live-up.sh > /tmp/up.log 2>&1
node scripts/e2e/first-day.cjs [folder]         # a customer's first day on an EMPTY platform: a request, onboarding, the first sign-in,
                                                # an account with nothing in it, a site before its box has spoken. It checks that every
                                                # screen says what is here and what comes next, and takes pictures. Needs a fresh database.

node scripts/e2e/guided-setup.cjs               # guided setup with the REAL box: the platform's own installer is run on a pretend box root, the box it installs
                                                # starts, and a pretend kit (scripts/pretend-meter.mjs, startKit) answers as the real equipment does. The
                                                # project manager types no address and no register: Find equipment, the ranges on the labels, a reading taken
                                                # off for a flow meter that is not there, a module that goes silent and is found again, a device the site does
                                                # not have taken off the list. The page follows the box by itself, with no reload. Any fresh or used database.

node scripts/run-smoke.mjs smoke-sites.mjs      # (separate from the browser journeys, with its own API) four sites from zero with the
                                                # real installer and box against pretend equipment, and what goes wrong in the field

bash scripts/e2e/static-export.sh               # the five role builds of the demo; do not edit apps/web meanwhile
bash scripts/e2e/upgrade-from-legacy.sh         # an old database to start the current API on
```

Each journey prints `PASS` or `FAIL` for every step and ends `ALL PASS` or `N FAILED`. Screenshots go to
`$E2E_DIR/shots` (`E2E_DIR` defaults to `$TMPDIR/greecon-e2e`). The stand-in provider (`fake-provider.cjs`, port 4100) records
every email and text the platform would have sent and lists them at `GET /recorded`. The sign-in of the first administrator
is `eridon.manuka@greecon.earth` with the password in `live-up.sh`; it is a test value that exists only in that database.
