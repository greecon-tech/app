# 18. Reality audit: what we found, what we fixed, what is still open

Status: first written 2026-10-18 for the work from 2026-10-10 to 2026-10-18; extended 2026-10-19 with
the work that made the platform something a project manager can install and run (findings 29 to 42).
This is the honest ledger. It exists so that nobody has to guess whether a screen, a guide or a
sentence in a sales conversation matches the running platform. Where the platform fell short of what
it showed, it says so plainly.

Everything marked fixed has a commit and a test or a check you can run. Everything marked open is
listed again, in priority order, in `docs/25-roadmap-and-proof-gates.md`. A change that alters what
the platform does updates this page in the same commit.

## 1. How things were checked

- `npm run typecheck` and `npm test` for every package. At the time of writing: API 784 tests,
  edge agent 123, edge simulator 1, GAIA core 107, shared 78, all passing. (The separate Modbus
  driver service of the first pass is gone: its job is done inside the edge agent.)
- A real PostgreSQL 16, not a fake, for the parts where a fake would hide the bug: the migration
  ledger and account safeguards, requests for access, sign-in, the messages outbox, chart history,
  staff and sessions, downloads, enrolment codes and the setup list, and the value totals. CI
  starts a `postgres:16` service for them.
- Mutation checks: for the findings that matter most, the fix was removed on purpose and the test
  was confirmed to fail (for example, the tenant-isolation test showed a client seeing the demo
  tenant's 18.6 kW before the fix).
- A black-box run of the production-mode API (rate limits, public routes, rejected callers), and a
  smoke run (`node scripts/run-smoke.mjs`) that starts the built API on a fresh database and
  drives the whole platform: a request for access, onboarding, a site from a template, a box that
  enrols and reads a pretend meter over the real Modbus protocol, a critical alert, the email a
  stand-in provider receives, the downloads, the Greecon team, the fleet table, a support session
  and a locked-out customer's reset. CI runs it after the build.
- Two journeys in a real browser against the real stack (`scripts/e2e`): the project manager's whole
  job from onboarding to handover, and the Greecon team's (the owner adds a person, sessions end
  when access does, a locked-out customer's person is reset).
- An upgrade from a database built the old way, with the old migration that used to reset the
  founder's password: the password survives (`scripts/e2e/upgrade-from-legacy.sh`).
- The GitHub Pages export built for all five roles against the seeded API, then served and opened
  in a real browser (no console errors) (`scripts/e2e/static-export.sh`).
- The two container images the host builds (`infra/docker`) built from their Dockerfiles and started the way a
  host starts them: the API against a real PostgreSQL (it migrated itself, made the first administrator, answered
  `/health` and served the box installer), the web image serving its public pages. CI now does the same on every change.
- Three independent reviews by reviewers who had not written the code (security and access; reliability and data
  flow; the launch pages against the code), and then a second review of the reworked alert messaging. Their
  findings are 44 to 66; each was checked against the code before anything was changed.
- The live app built and opened in a real browser as a seeded client account in every state
  (critical, warning, stable, never reported, gone quiet), on a desktop and a phone width.

What was not done: nothing here was tested on real hardware, with real customers or on the
production Railway deployment, which this work cannot reach. No real Eastron meter has been read by
this software; no email or text message has been sent by a real provider; no phone on an Albanian
network has received one. The launch pages say where each of these is done first
(`docs/launch/01-founder-go-live.md`, `docs/launch/02-project-manager-manual.md`).

## 2. What was wrong, and what was done

Severity means what it would have cost a real customer: **High** is wrong information that could
lead to harm or loss, or exposure of one customer's data to another; **Medium** is a false or
missing signal that costs trust or time; **Low** is polish.

### The screen said things the platform did not know

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 1 | A site's status ("OK") and its edge status were typed once and never recomputed. A brand new site read OK. | High | Fixed. Computed from readings and alerts on every read (`743d32a`, `783758f`); `platform.status.spec.ts` |
| 2 | Readings never expired. A three-day-old tank level looked current and was used to judge whether a command was safe. | High | Fixed. Every reading has an age and a limit; old readings are shown as out of date and block a start (`2d7083e`, `743d32a`); `freshness.spec.ts`, `derived-states.spec.ts` |
| 3 | Alerts were never generated. Only two seeded examples existed, while the guides promised alerts. | High | Fixed. One alert per condition, with an on-delay for a pump that has just started, a window so a hovering level reopens the same alert, and no auto-clearing when readings merely go quiet (`2d7083e`, `743d32a`); `alerts.spec.ts`, `platform.alerts.spec.ts` |
| 4 | A device's "health: OK" and "last seen" were stamped at registration and never updated. | Medium | Fixed. Computed from what the device has reported (`783758f`) |
| 5 | Thresholds were stored on each point but never read; the engine used fixed numbers. | Medium | Fixed. Read and applied (`2d7083e`); editable per reading with validation, audit and immediate effect (`3072825`) |
| 6 | "Dry-run risk" was derived from low flow even when the pump was stopped, which is the normal state of a stopped pump. | High | Fixed. It now requires the pump to be confirmed running, and says nothing if that is unknown (`743d32a`) |
| 7 | Irrigation advice came from a built-in 28% and "solar surplus" from a built-in 1.5 kW. The same 28% is waterlogged in sandy soil and dry in clay; 1.5 kW is a third of one plant and a rounding error on another. | Medium | Fixed. A site states its own limit; without it the platform says nothing (`6edb18c`, `a7d78a9`); `derived-states.spec.ts` |
| 8 | The Overview showed hard-coded "OK" chips and static notes ("Within operating range", "Irrigation rule simulated"), repeated the 35%, 28% and 25% rules in the web code, and carried a marketing paragraph. | Medium | Fixed. Cards show where a value came from and how old it is, and a word only when there is something to say (`783758f`) |
| 9 | The equipment map and the cards judged a reading by sensor quality alone, so a tank at 6% showed OK. | Medium | Fixed. They use the same verdicts as the alerts (`783758f`) |
| 10 | Asset and gateway "status" columns showed values nothing ever updated. | Low | Removed from view (`783758f`). A real asset health model is open (see 4) |

### One customer's data could reach another's

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 11 | The Overview summed all tenants' readings and states: a client saw the demo tenant's values. | High | Fixed. Every lookup is tenant-scoped (`2d7083e`); `platform.overview.spec.ts` |
| 12 | Ingestion accepted a reading whose tenant or site did not match its message, timestamps far in the future, and let a late reading overwrite a newer one. | High | Fixed. Validated; newest wins (`2d7083e`); `platform.overview.spec.ts`, shared validation |
| 27 | A report export could be created for a site that belongs to another tenant. Found by the whole-service isolation test, not by anyone reporting it. | High | Fixed. The export now requires a site the caller's tenant owns (`d31ce15`). `platform.isolation.spec.ts` calls every read and write on the service as a second tenant and expects refusal or an empty answer; it failed on this before the fix |

### Command safety

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 13 | Process interlocks blocked the stop command: "off" was refused while pressure was over the limit, and after an override expired. A guard that cannot be stopped is a hazard. | High | Fixed. Stopping, closing and disabling are never blocked by a process condition; starting is gated; an unfamiliar value counts as the hazardous direction (`743d32a`). Tests that had enshrined the bug were corrected and now assert the opposite |
| 14 | A start was judged on readings of unknown age or with no timestamp. | High | Fixed. Stale or unknown-timestamp required readings block a start (`743d32a`) |

| 28 | Command history and the confirmation said a command was "Dispatched" when it had only been simulated, so a person could believe equipment had moved. | Medium | Fixed. Every command record carries `executionMode: "simulated"` and the interface says "Simulated" wherever a command appears (`a81330f`); `platform.service.spec.ts` |

All commands are still simulated; nothing is written to equipment (see 2 in the open list).

### Edge delivery, public surface and pipeline

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 15 | The edge buffer was in memory; a rejected or failed delivery lost data. | High | Fixed. Durable, bounded, ordered, at-least-once; permanent and transient failures are told apart (`7b3dd72`); `offline-buffer.spec.ts`, `forwarder.spec.ts` |
| 16 | The API documentation (Swagger) was public in production and the proxy setting was missing, so per-client limits could be wrong. | Medium | Fixed. Off unless enabled; proxy hops are explicit (`1ae1da1`); `runtime-config.spec.ts` |
| 17 | Rate limits were per source address, and the ingest limit was too low for one gateway's batches. | Medium | Fixed. Per user and per login account, and 600 a minute on ingest (`4bed9ef`, `1ae1da1`) |
| 18 | The GitHub Pages demo had failed to build for 19 runs: pages for roles without permission fetched forbidden endpoints. | Medium | Fixed (`3103da5`) |
| 19 | Vulnerable production dependencies. | Medium | Fixed (`26574ef`) |
| 20 | No continuous integration. | Medium | Fixed. Type check, tests and build on every push (`1ae1da1`) |

### Navigation, accessibility and honesty of the interface

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 21 | The sidebar "Sites" link pointed at one hard-coded demo site. A real client could not open it. | High | Fixed. A real Sites index (`783758f`) |
| 22 | Fake tabs on the site page that did nothing; thirteen flat menu entries. | Low | Fixed. Five destinations, with Monitoring, Devices, Maintenance and Analytics as tabs inside them, and Settings, Admin, Audit log and Clients under Account (`783758f`) |
| 23 | Status colours failed WCAG AA text contrast (warning 3.5:1, ok 4.1:1, captions 2.9:1) and status was colour plus an identical dot. | Medium | Fixed. All at least 5:1 on their tint; each state is a word and a different shape (`783758f`) |
| 24 | The Alerts page mixed cleared alerts into "Active", had no site and no order. | Low | Fixed. Active by priority with site and age, and a log of recently cleared ones (`783758f`) |
| 25 | The new Sites index would have collided with the per-site pages in the static export. | Low | Fixed. Folder-style URLs (`6edb18c`) |

### Documents

| # | Finding | Severity | Status |
|---|---|---|---|
| 26 | The sector guides described alerts, thresholds and automatic responses that did not exist. | Medium | Fixed in this change. Rewritten to describe only what runs today |

### Telling people, the box and the customer's data (added 2026-10-19)

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 29 | Alerts reached people only when they opened the app. For a dead pump at 2 a.m. nobody would have known (this was the first item on the open list). | High | Fixed. A short ordered list of people to tell. Act now: an email at once, a text ten minutes later if nobody has acknowledged, the next person every half hour. Check today: one email, held through quiet hours. Information is never pushed and goes in the 07:30 morning message. Every message is a row from the moment it is planned, so a restart loses no step and the log shows what was sent, what was not and why. A platform with no email or text keys says so on every screen, and a site cannot be commissioned without someone to tell and a test message a person has confirmed (`edf2a4d`, `491848f`); `plan.spec`, `notifications.service.spec`, `notifications.postgres.spec`, `channels.spec`; the smoke run and the browser journey read the email from a stand-in provider. **Not yet seen on a real network (open 1)** |
| 30 | The box had no heartbeat, a queue of about a day and a hand-written configuration; installing one needed a developer. | High | Fixed. One program that asks the platform what to read; a heartbeat every 30 seconds (every 10 for the first quarter hour); readings sent in batches in the order taken, a backlog before anything newer; a queue sized for three days at thirteen devices (thinned to a reading a minute), read and written in pieces so a small box can hold it; one pasted line installs it; updates roll back (`565832b`, `6d8a252`, `baa015e`, `9fab19a`); the edge agent's specs; `smoke-edge.mjs` reads a pretend meter over the real protocol. **Shown only in software and against the pretend meter (open 3, 13)** |
| 31 | The Reports page's "Request export" wrote an audit line and produced nothing. A customer could not take their data away, which `docs/22` treats as a day-one requirement. | High | Fixed. Real downloads: each site's readings (hourly averages for up to a year, or every reading for up to 31 days, in UTC and the site's own clock), the alerts, the audit log, and one JSON file of how the account is set up (no passwords, no box credentials). A plain spreadsheet style and a European one; a byte-order mark so "Durrës" opens right; a site named like a formula cannot run as one. Every download is written to the audit trail and every query is limited to the account asking (`347bab6`); `csv.spec`, `exports.service.spec`, `exports.postgres.spec`, `platform.isolation.spec` |
| 32 | The trend charts on the site page asked the database for the *oldest* 20,000 readings in the window, so on a real site a week's chart showed the wrong days. | Medium | Fixed. A long window is averaged into buckets that cover all of it, newest included (`347bab6`); `history.spec`, `platform.history.postgres.spec` |
| 33 | A redeploy could put the founder's own administrator login back to a password written in the repository: `db:migrate` replayed every migration on every run, and one of them set that password. | High | Fixed. A ledger of what has run (each file once, in a transaction, under a lock); a file edited after it ran stops the run; a database from before the ledger is brought under it without replaying anything; the API migrates itself at start and a failed migration stops the new version. At every start an account outside the demo that still carries a published password is shut. The first administrator's password comes from the host's settings, and only while the account has none. A production platform refuses to start with a missing, example or short signing secret (`7b8f8d8`); `migrator.spec`, `account-hygiene.spec`, `runtime-config.spec` (mutation-checked); `scripts/e2e/upgrade-from-legacy.sh` |

### Setting a customer up, and running several (added 2026-10-19)

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 34 | The Settings and Admin pages showed Greecon's own organisation (name and domain) to a customer's people. | Medium | Fixed. They read the account's own record, which the isolation tests already confine to the account (`edf2a4d`). Not covered by a browser check of its own |
| 35 | A project manager could not set a customer up: no login of their own, no way into a customer's account short of the database, a box configured by hand and no list of what was left to do. | High | Fixed. Greecon staff open a customer's account for four hours, recorded in the customer's own trail as "Greecon staff (email)" and unable to create people or reset passwords. A site starts from a template and lands on a nine-step list that marks a step done only when the platform has seen it work; a box's install command is shown once and stays on screen; addresses, registers, limits and the final checks are forms inside the steps; the handover prints as one page (`e9b80af`, `f83f95d`, `d36036b`, `2ecb627`, `baa015e`); `setup-checklist.spec`, `setup.service.spec`, `setup.postgres.spec`, `platform.setup.spec`, `auth.support.spec`; `pm-e2e.cjs` in a real browser |
| 36 | There was no way for a customer to ask to be set up, and a password that someone else chose (the project manager, an owner) stayed an ordinary password for good. | Medium | Fixed. A public "Request access" form (a hidden field that drops scripts, one request per address per day, a limit on the whole platform's flow, an answer that says nothing about what was kept) feeds an inbox on the Clients page and an email to `SALES_NOTIFY_EMAIL`. A password someone else chose is temporary: the session it opens can only choose a new one. New passwords are at least ten characters and not one this product has published (`57fd7a3`); `access-requests.service.spec`, `access-requests.postgres.spec`, `principal.guard.spec` |
| 37 | A session was a signed token good for twelve hours, so turning a person off, or a password change or reset, did not end it. | High | Fixed. The API asks, at most every fifteen seconds per person and at once after a change, whether the account is still active and whether the token was issued after the last password change or reset. A person whose session has ended lands on the sign-in page with a sentence that says so. The cut-off is written from the API's own clock, because the database's clock could differ from the one that stamps the token (`f53ef12`, `07201e2`); `active-users.spec`, `principal.guard.spec`, `platform.staff.postgres.spec`; the smoke run; `team-e2e.cjs` |
| 38 | The same email address could belong to accounts in two customers, or to two spellings of it, while sign-in looks the account up by the address alone (the schema only kept it unique within one customer). | Medium | Fixed. One account per address, however it is spelled, checked wherever an account is made (`f53ef12`); `platform.staff.postgres.spec` |
| 39 | Only the founder could sign in as Greecon staff; giving a project manager a login needed the database. | Medium | Fixed. The owner of Greecon's account adds people (a temporary password, shown once), turns them off and back on, and resets them; everyone on the team sees who is on it; only the owner changes it (`f53ef12`); `platform.staff.postgres.spec`; `team-e2e.cjs` |
| 40 | Greecon would learn of a silent box only when the customer called, which is the failure the product exists to remove. | High | Fixed. The Clients console lists every customer's sites, worst first: state and what is wrong, the box (online, late, offline, never reported, not installed), the last reading, open alerts and the day since commissioning. Greecon's own account is told the same each morning through the same "Who is told" list a customer uses. A site still being set up is mentioned and never counted as a problem (`5f9f1e1`); `platform.fleet.spec`; the smoke run; `pm-e2e.cjs`. There is still no immediate message for a silent box (open 3) |
| 41 | A customer's owner who forgot the password, with no other administrator, could get back in only by someone editing the database. | Medium | Fixed. The owner of Greecon's account resets one person after confirming by phone who is asking: a temporary password shown once, every session the person had open ended, and a line in the customer's own trail naming the staff member (`0f2f9e3`); `platform.staff.postgres.spec`; `team-e2e.cjs` |

### Smaller things found on the way (added 2026-10-19)

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 42 | A download put two readings taken in the same second in whatever order their random identifiers sorted, so the same file could differ from one day to the next. Found as a flaky test. | Low | Fixed. Name first, identifier last (`e7c8dd1`); `exports.postgres.spec` asserts which row comes first when two share a second |
| 43 | The note for one Eastron meter model gave another model's serial speed. | Low | Fixed. Notes are per model, and the SDM230's note says its speed depends on the version and sends the person to the meter's own display (`f53ef12`); `edge-catalog.spec` (mutation-checked) |

### Found by independent review (added 2026-10-20)

Three reviewers who had not written the code went over the finished platform: one for security and access, one for
reliability and data flow, one for the launch pages against the code. Each ran real code where it could, and each
finding below was checked against the code again before anything was changed. Several are in the platform's two most
trusted parts, who can sign in and whether an alert reaches a person (findings 44 to 66). A fourth reader then
looked only at the alert messaging as it was after the rework those findings led to: it ran the code against a real
PostgreSQL, cut the connection under it, and changed a copy of the code in forty-six ways to see whether a test
noticed (findings 67 to 72).

| # | Finding | Severity | Status and evidence |
|---|---|---|---|
| 44 | Any member of Greecon's team could take over the owner's account: the ordinary people routes let anyone with the right to manage users reset the owner's password, promote a colleague or turn the owner off, and every team member has that right in Greecon's own account. In a customer's account an admin could do the same to their owner. | High | Fixed. The team is managed only through the team's own routes, which are the owner's alone; in every account only an owner adds an owner, changes one or resets one's password. `platform.staff.postgres.spec` (three tests, each rule removed in turn and the test failed) |
| 45 | A role changed, or a person turned off and on again, did not end their open sessions: a session carries the role it was opened with, so a demoted admin kept the role for up to twelve hours, and an old session came back to life when someone was turned back on. | High | Fixed. The cut-off is written on a role change and on every status change; `platform.staff.postgres.spec` |
| 46 | The demo login is published, and an operator could send unlimited text and readings: with no length limit on a note, a body of a megabyte stayed in the platform's memory for each request, and 2,700 readings fitted in one. Anyone on the internet could have filled the memory and disk every customer's alerting depends on. Any customer's operator could have done the same. | High | Fixed. Every piece of text and every list in every request has a limit (a test fails for one added later without it, `dto-bounds.spec`); readings may come only from a box with its own credential; the demo login is read-only apart from acknowledging an alert and arranging its dashboard; what a person's actions can add to memory is bounded per account (5,000 maintenance tasks, the newest 1,000 audit lines, 500 commands). `principal.guard.spec` |
| 47 | A temporary password had 23,040 possibilities and never expired, and the sign-in limit counted attempts under a spelling of the address that the database disagrees with for some letters, so one account could be tried under thirty-odd spellings at once: a patient caller could have tried all of them in a couple of hours. | High | Fixed, except expiry. The password is about 59 bits; an account's address is plain ASCII in one written form (also a unique index in the database); the limit counts the account in that form. `generate-password.spec`, `email.spec`, `client-throttler.spec`, `auth.postgres.spec`. **A temporary password still does not expire (open 16)** |
| 48 | Anyone who knew an address could keep it locked for its owner with a few attempts a minute, and a flood from one visitor used up the sign-in limit of every visitor, because every sign-in reaches the API from the web service. | Medium | Fixed. Each source has its own count for an account, over all sources there is a higher ceiling, and the web service passes on the visitor's address. `client-throttler.spec` |
| 49 | Sign-in took a hundred times longer for an address with an account than for one without, so timing said which addresses had accounts. | Low | Fixed. `auth.postgres.spec` |
| 50 | A viewer could read the audit trail through the site page. | Low | Fixed |
| 51 | The audit-trail download held only what the platform keeps in memory: after a restart, the newest 500 lines of every account together. | Medium | Fixed. It is read from the database a page at a time (and the download's own line is in it). `exports.postgres.spec` (2,500 lines) |
| 52 | A box accepted a plain-http address for the platform, so anyone on the path could read its credential or hand it software. | Medium | Fixed. https unless the platform is on the same private network. `identity.spec` |
| 53 | `security.txt` redirected to the sign-in page, so a researcher who found a fault could not read where to write. | Low | Fixed; checked in the built web image |
| 54 | A deploy dropped up to thirty seconds of counted energy and water: nothing listened for the stop signal. | Medium | Fixed. The counts are saved while the database is still open, then everything closes (Nest's own hooks close the database first, so they were not used). Checked in a real process: the log says it saved, it exits with 0 |
| 55 | The box's updates stopped working after the second: the installer left the first release owned by root, and on the third update the box could not remove it, so it stayed on its old software and tried again every six hours. | High | Fixed. The installer gives the service its files, and clearing old versions cannot stop an update. `updater.spec` |
| 56 | A clock set back while the box was running could stall a loop for the length of the step, a day for a day. | Medium | Fixed. `runtime.spec` |
| 57 | One dead converter held up every other converter's readings, and each device behind it waited out its own connection attempt (thirteen meters, most of a minute). | Medium | Fixed. A converter that cannot be reached is tried once a round. `poller.spec` |
| 58 | After a long outage the box read its whole queue file into memory at every start, up to twice what it keeps: a crash on every start until someone deleted the file. | Medium | Fixed. Only what is kept is read into memory; the service may use 768 MB instead of 384. `offline-buffer.spec` |
| 59 | The first hours of a month were compared with a typical month, so night readings looked like a saving ("52 percent less") from the platform's own arithmetic. | Medium | Fixed. A comparison needs seven days. `compute-value.spec` |
| 60 | The Analytics page, and a site's trends, drew several sites' or points' readings of the same kind as one line that jumped between them. | Medium | Fixed. One line for each point; an account with several sites sees one at a time |
| 61 | The setup list, the handover sheet and the limits form said the no-flow limit was "not set, so no advice is given", while the platform raised an Act now alert at 0.2 litres a minute. A pump contact wired backwards would have paged people. | High (honesty) | Fixed. It is shown as the standard it is, and a test pins the words to what the engine does. `limits.spec`, `setup.service.spec` |
| 62 | An Act now message that hit the hourly cap was marked failed and never sent, and a customer who had left (suspended) was paged about silence their own leaving caused. | High | Fixed. Act now has its own, higher ceiling and past it is held and retried, never failed; a suspended account gets nothing. `notifications.service.spec`, `notifications.postgres.spec` |
| 63 | An alert that cleared and came back inside the window lost an escalation step for good; and one acknowledged, cleared and returned paged the next person that the first "has not answered" without having told the first. | High | Fixed. A step waits out the clear window; a return after an acknowledgement starts a fresh round; the wording says who was told only when they were |
| 64 | A provider failure (a revoked key, an empty text balance, an outage at two in the morning) lost the Act now message for good, and nothing said so. | High | Fixed. It is planned again every five minutes while the alert is open and unacknowledged, each failure stays in the log, and the status says "N alert messages could not be delivered, the last because ..." (and Greecon's morning message names the customers) |
| 65 | A round of messages was saved row by row (a database that dropped half way left a chain with its second person missing), the same alert could be planned twice by two paths, and two platforms during a deploy each worked alone. | Medium | Fixed. One statement saves a round; step keys have no timestamps; one platform at a time holds a lock. `notifications.postgres.spec` |
| 66 | The launch pages said things the platform did not do: downloads of every reading at any time (every reading for 31 days, hourly averages for a year), an "internet cut" test that could not show what it claimed, a demo script whose pages answer "not found" for the demo login, a rehearsal step the platform refuses, a privacy claim that left out what the team can see without opening an account, and a pilot goal (the owner "opens" the morning message) that nothing measures. | High (honesty) | Fixed in the pages, the order form and the privacy page; the goal is now the owner's word (`docs/27`, A1) |
| 67 | The connection that holds the round of sending was taken out of the pool for as long as the round went on, with nothing listening for it to fail. A database that restarted, failed over or dropped that connection in the middle of a round would have ended the whole API with an unhandled error. | High | Fixed. The connection has a listener that says so; the lock goes with the connection, and the next round takes it again. `notifications.postgres.spec` (the test cuts the connection, and fails on the old code) |
| 68 | A failed Act now message was written down as failed before its next try was saved. A database that dropped between the two left a message that nobody would ever try again, and nothing said so. | High | Fixed. The next try is saved first; the worst that can follow is a message sent twice. `notifications.service.spec` |
| 69 | A Check today email whose first try failed was tried again with no regard for the quiet hours, and, with tries that no longer stop while the alert stands, an outage that lasted into the night would have been followed by an email at three in the morning. | Medium | Fixed. Only Act now ignores the quiet hours; a try again of anything else waits for them to end |
| 70 | An alert that came back after someone had acknowledged it was told again from the first person only if the platform heard the announcement of its return at that moment. A restart, or a database that dropped, at that moment lost it for good: the alert stood open and unacknowledged, and nobody was told. | High | Fixed. A round also notices, from the alert itself, that it was acknowledged after its messages began and is open again, and starts the messages again. `notifications.service.spec` |
| 71 | A text or email service that is not set up on the platform at all was "tried again" every five minutes for as long as an alert stood: about a hundred lines of "failed" a day for each alert. | Low | Fixed. It is tried once an hour, so that setting it up while an alert is open still reaches the people |
| 72 | Three tests of the rework did not fail when the code they claimed to guard was taken out: that no next try is planned for an alert acknowledged as its message fails; that one alert that cannot be planned does not stop the others announced with it; and that the tries of one message stay together under one key, so that its arrival clears the failures before it from the screen. | Low (test) | Fixed. Each now fails without the code it guards. Found by changing a copy of the code in forty-six ways, one at a time: all are caught but two that do no harm (`SKIP LOCKED` only saves waiting, and the pool drops a connection that is already dead) |

## 3. Mistakes in our own first pass, caught by testing

A short list, because they are the kind a reader should expect more of:

- The first alert engine would have closed a critical tank alert the moment its reading went quiet
  (the state disappeared, so the alert looked cleared). Caught by a test written for "no news is not
  good news"; alerts now close only when their condition can actually be seen.
- A first draft checked every reading's device against the message. The edge simulator batches
  readings from several devices in one message, so that would have rejected valid data. Only tenant
  and site are enforced.
- Existing tests asserted the stop-blocking bug (a routine "off" refused under pressure). They were
  wrong, not the code under test, and were rewritten.
- A cross-tenant test first "failed" for the wrong reason (the fixture tenant did not exist). It was
  repaired until it failed for the right one, and proved with the fix removed.
- A test of the surplus rule had been written to expect "Constrained" with no limit configured, which
  encoded the invented 1.5 kW. It was the test that was dishonest, and it now expects silence.
- The whole-service isolation test was written to confirm that the Overview fix held everywhere. It
  found a second leak (finding 27) that no earlier test had looked for. Checking a fix in one place is
  not the same as checking the property everywhere.
- Two documents overstated what was built: the edge buffer as holding "a day or two" (it is about a
  day for a small site, and roughly an hour and a half at fifty devices), and the audit log as
  append-only (it is a record kept in the database, not a tamper-evident one). Both were corrected.

Added 2026-10-19, from the work since:

- The first session cut-off was written with the database's clock while the token carried the API's.
  A difference of a few seconds between the two would have ended no session after a reset, or every
  session at once. It is now written from the API's clock (`07201e2`). Found by re-reading the
  change, not by a test, and then given one.
- A test that a temporary-password session may only choose a new password began to fail one run in
  several once the cut-off existed, because it depended on which second the token was issued in. The
  test was rewritten to look at the session *before* the password changes, and to assert that the
  session ends afterwards. The behaviour was right; the test had been timed by luck.
- A download test passed or failed on the order of random identifiers (finding 42). A fix that
  makes an order depend on something nobody chose is a fix for a flaky test and for a flaky file.
- The static demo build failed twice for reasons only building found: a route file with no handler,
  and a route with no pages to build. Neither could be seen by reading.
- The first layout of the privacy page ran its paragraphs together, because of a layout rule meant
  for every other page. Found by looking at the page in a browser, not by any test.
- The first drafts of the launch pages contained statements that were invented or wrong: a web
  address that does not exist, a button that has another name, a pitch that said a text follows any
  low tank (only a critically low tank or a dry pump is texted; a tank that is only getting low is
  one email), the converter's mode named the wrong way round, advice about remote access, updates
  called "signed" when they are checked against a checksum, and a claim about how much memory the
  queue needs. Each was found by reading the page against the code, and corrected. A page that
  tells a project manager what to press has to be as true as the code.

## 4. What is still open

These are known gaps, not surprises. Priority order and proof gates are in
`docs/25-roadmap-and-proof-gates.md`; the decisions about what to leave for later, and the event that
would change each, are in `docs/27-launch-decisions.md`. The numbers are kept from the first version
of this list, so that an earlier reference still points at the same thing.

1. **Alerts are built, and have never reached a real phone or inbox.** Email and text for Act now, an
   email for Check today, the morning message, acknowledgement, escalation and the log are built and
   tested against stand-ins for the providers (findings 29 and 62 to 65). Not known until someone tries: whether
   `alerts@greecon.earth` lands outside spam once the domain is verified, and whether a sender name
   survives each Albanian network. Twilio is the only text provider tried for; none was compared.
   There is no WhatsApp, Viber or voice call.
2. **No command reaches equipment.** Every command is simulated. The conditions for the first real
   write are in `docs/23-safety-and-security-case.md` (release gate).
3. **The box is built and has only met a pretend meter.** The heartbeat, the three-day queue and the
   updates with rollback are tested in software (finding 30). They have not been shown on a real box
   with the internet cut, and there is **no immediate message for a silent box**: Greecon's own team
   hears of it in the morning check and the fleet table, and the customer by the morning message.
   Decided to wait for about fifteen sites.
4. **No asset health model.** Sites, devices and readings have computed health; assets do not.
5. **Security hardening, partly done.** Done: one demo login with its own password, staff accounts of
   Greecon's own, sessions that end the moment a person is turned off or changes password, one account
   per address, temporary passwords that only let a person choose their own, an owner who cannot be
   taken over by the team, a read-only demo login (findings 33, 36 to 41 and 44 to 50). Still open:
   **two-factor sign-in** (decided to wait until after the fifth site and before any control), **a
   tamper-evident audit log**, and a **forgot-password email** (a locked-out person is reset by the
   owner of Greecon's account after a phone call). See 16 to 19 and 26 below for the smaller gaps.
6. **Customer data export: built** (finding 31). Deleting a customer's data on their written request is
   a documented statement the founder runs by hand, not a button (`docs/launch/05-runbooks.md`, R11).
7. **Retention and deletion, processor records, a sub-processor register, an incident workflow.** The
   deletion statement and the incident runbook are written (`docs/launch/05-runbooks.md`); nothing
   deletes old readings by itself, and the registers are documents for the lawyer, not features.
   A raw-readings retention rule waits for the database to near its volume, or ten sites.
8. **Backups with a tested restore** have not been confirmed for the Railway database, and no restore
   has been tried. The plan and the drill are written (`docs/launch/01-founder-go-live.md`,
   `docs/launch/05-runbooks.md`).
9. **Single API replica, in-memory working set** (with write-through to Postgres). Fine for a pilot;
   the thresholds for changing it are in `docs/24-architecture-seams.md`.
10. **No Albanian.** The founder decided on English only; nothing Greecon sends is written in Albanian
    until a native editor has read it.
11. **Wastewater evidence** for hotels (lab-result register, operating records) is designed in
    `docs/19-domain-playbook.md` and deliberately not built until a hotel asks and a process engineer
    has reviewed it.
12. **Nothing has been tested with a customer.** The beachhead is a hypothesis with a test plan
    (`docs/25`), not a result.
13. **No real meter has been read by this software.** Every register comes from the maker's published
    tables; the real protocol is tested against a pretend meter. The SDM230's total power register and
    its serial settings vary by version, so the first install checks them on the meter's own display.
14. **Nothing is deployed.** No real Railway project, no verified Resend domain, no Twilio number, no
    DNS record for `api.greecon.earth` and `app.greecon.earth` exists yet; the steps are in
    `docs/launch/01-founder-go-live.md`.
15. **The legal and commercial papers are drafts.** The pilot order form, the data terms and the privacy
    page (`/privacy`) must be read by a lawyer, the accountant must say how to invoice, and an
    electrician must give a written price, before the first signature (`docs/27-launch-decisions.md`,
    L19). Every price in `docs/launch/03-hardware-and-wiring.md` is a planning estimate and the monthly
    fees are hypotheses.
16. **A temporary password does not expire** if nobody uses it. It is a strong one (about 59 bits) behind a
    rate limit, and is shown once; 72 hours would be right and is not built.
17. **A customer's administrator can put any international number in the list and send it test messages.**
    Limits are per account (six test sends an hour; sixty emails and twenty texts an hour for the
    non-urgent kinds); a number is not confirmed by a code first, a premium-rate number is allowed, there is
    no country restriction and no cap across the platform. Confirming each number and restricting
    countries is the fix.
18. **The "Request access" form has one flood cap for the whole platform** (forty an hour), so a spammer can
    keep real prospects out of the inbox; each visitor is limited separately (twenty an hour), and there
    is no CAPTCHA.
19. **A box takes new software on the word of the platform it reports to.** The checksum comes from the same
    platform, so whoever controls the platform controls every box; code signing is not built. A box now
    refuses a plain-http platform address except on a private network.
20. **After a restart that follows more than about four minutes of platform downtime**, every site reads
    "Readings out of date" until its box reports again, and each customer's first contact gets one Check
    today email. A grace period at start is not built.
21. **One bad sample from a level sensor opens an Act now alert.** There is deliberately no delay on a tank
    (a delay would lengthen every real alert); the alert resolves itself after fifteen minutes of clear
    readings. To decide with real sites' numbers.
22. **A person who is told by message but has no login cannot acknowledge**, so cannot stop the chain. The
    manual says everyone on the list needs their own login (Operator); an acknowledge link in the message
    is the better answer and is not built.
23. **A box whose clock is more than five minutes wrong has its readings refused**, and the box discards
    what the platform refuses. The installer warns about the clock; the platform's heartbeat reports the
    difference.
24. **The offline queue's memory grows with the readings in each message.** About three days holds for a
    site of up to about thirteen devices (a 25-device site holds about a day and a half); the service may use
    768 MB. A power cut straight after the box writes its queue or its identity file may leave an empty file
    on some disks (no fsync).
25. **The log of messages sent is in no download.** The readings, alerts, audit trail and the account's set-up
    are; a customer who asks for the message log is given it by hand (`docs/launch/05-runbooks.md`, R11).
26. **Signing out does not end the token** (twelve hours); turning a person off, a new password or a
    changed role do.
27. **The second pilot goal is the owner's word, not a measurement:** Greecon does not know whether an
    email was opened (`docs/27`, A1).
28. **A customer suspended part way through an Act now alert, and made active again while it still stands,
    is not told again from where it stood.** What fell due during the suspension was dropped ("The account
    is suspended, so nothing is sent for it"), so the people on the list hear nothing more of that alert
    until it is acknowledged, or clears and comes back. An alert that opened during the suspension is
    messaged normally from the first round after the customer is active again. The runbook says to look
    at **Alerts** when a customer is turned back on (`docs/launch/05-runbooks.md`, R4, point 8).
29. **The log of messages has no clean-up, and two of its queries read all of it** (the check for a message
    taken and never finished, once a round; the count of what went out in the last hour, for each message).
    Measured at 600,000 rows each takes about a seventh of a second; at five customers that is years away.
    Before about fifty customers: a retention rule and two partial indexes.
