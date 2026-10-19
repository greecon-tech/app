# 18. Reality audit: what we found, what we fixed, what is still open

Status: written 2026-10-18, covering the work from 2026-10-10 to 2026-10-18. This is the honest
ledger. It exists so that nobody has to guess whether a screen, a guide or a sentence in a sales
conversation matches the running platform. Where the platform fell short of what it showed, it says
so plainly.

Everything marked fixed has a commit and a test or a check you can run. Everything marked open is
listed again, in priority order, in `docs/25-roadmap-and-proof-gates.md`.

## 1. How things were checked

- `npm run typecheck` and `npm test` for every package. At the time of writing: API 159 tests,
  edge agent 24, Modbus driver 5, edge simulator 1, GAIA core 106, all passing.
- Mutation checks: for the findings that matter most, the fix was removed on purpose and the test
  was confirmed to fail (for example, the tenant-isolation test showed a client seeing the demo
  tenant's 18.6 kW before the fix).
- A black-box run of the production-mode API (rate limits, public routes, rejected callers).
- The GitHub Pages export built for all five roles against the seeded API, then served and opened
  in a real browser (no console errors).
- The live app built and opened in a real browser as a seeded client account in every state
  (critical, warning, stable, never reported, gone quiet), on a desktop and a phone width.

What was not done: nothing here was tested on real hardware, with real customers or on the
production Railway deployment, which this work cannot reach.

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

## 4. What is still open

These are known gaps, not surprises. Priority order and proof gates are in
`docs/25-roadmap-and-proof-gates.md`.

1. **Alerts reach people only when they open the app.** There is no push, SMS, WhatsApp or e-mail
   delivery and no escalation. For a dead pump at 2 a.m. this is the largest gap between the promise
   and the product. The wording, the channels and their limits are researched
   (`docs/21-communication-system.md`); delivery needs a provider account and a decision.
2. **No command reaches equipment.** Every command is simulated. The conditions for the first real
   write are in `docs/23-safety-and-security-case.md` (release gate).
3. **No gateway heartbeat, and a small buffer.** Silence is detected from the age of the data, which
   works, but gateways do not yet send a periodic "I am alive" message with buffer depth and clock
   skew. The on-disk buffer holds 50,000 messages, about a day for a small site; the target is at
   least 72 hours (`docs/24-architecture-seams.md`).
4. **No asset health model.** Sites, devices and readings have computed health; assets do not.
5. **Security hardening still to do:** mandatory two-factor sign-in for owners and admins, a
   tamper-evident audit log, self-service password reset, and distinct passwords for the demo
   accounts (they share one).
6. **Customer data export** (CSV and JSON of everything) is not built. It is a day-one requirement
   under the EU Data Act and Law 124/2024 (`docs/22-legal-and-compliance-map.md`).
7. **Retention and deletion, processor records, a sub-processor register, and an incident
   workflow** are not built; the incident clocks are in `docs/22`.
8. **Backups with a tested restore** have not been confirmed for the Railway database.
9. **Single API replica, in-memory working set** (with write-through to Postgres). Fine for a pilot;
   the thresholds for changing it are in `docs/24-architecture-seams.md`.
10. **Albanian translation** of the interface and alerts has not started; every Albanian sentence in
    the documents needs a native editor.
11. **Wastewater evidence** for hotels (lab-result register, operating records) is designed in
    `docs/19-domain-playbook.md` but not built.
12. **Nothing has been tested with a customer.** The beachhead is a hypothesis with a test plan
    (`docs/25`), not a result.
