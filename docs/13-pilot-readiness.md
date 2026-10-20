# Pilot Readiness — Gaps and How-To Fixes

> **Status (2026-10-18): history.** This is the log of the earlier pilot-readiness passes and stays as
> the record of how each piece was verified. The current ledger of what is true of the platform, what
> was fixed since and what is still open is `18-reality-audit.md`. Where this file says a command was
> "dispatched" or "real", it means accepted by the API and simulated: no command has ever been written
> to equipment (`23-safety-and-security-case.md`).
> The how-to parts of this log for setting up a site, connecting a box and deploying are replaced by `docs/launch/` and `docs/14`, `docs/11`, `docs/16`, which describe what runs now (there is no `edge-driver-modbus`, `edge.env`, `EDGE_TOKEN` or "Add gateway" form any more).

This is a running audit of the platform against what a real pilot deployment needs, in the
"what's the gap, and how do we close it" format. Items are grouped by status: fixed this pass,
and still open with a concrete next step. Update this file as gaps are closed or new ones are
found — it is meant to stay current, not be a one-time snapshot.

## Fixed in this pass

### No real field protocol drivers existed

**Gap:** `apps/edge-simulator` publishes synthetic sine-wave readings. Nothing in the repo
actually read a Modbus, OPC-UA, or analog field device — the `protocol` field on `Device` modeled
these as first-class concepts, but no driver implemented any of them. Without this, nothing a
pilot site actually plugs in could ever reach the platform.

**Fix:** `apps/edge-driver-modbus` — a real Modbus TCP client that polls configured holding/input
registers, decodes `uint16`/`int16`/`float32` values (with an optional scale factor for raw counts
→ engineering units), and publishes the exact same `TelemetryMessage` JSON shape/topic
`apps/edge-simulator` uses. `apps/edge-agent` bridges it to the cloud unchanged — no code needed
to change there, exactly as promised when the bridge was built. See `docs/16-modbus-driver.md` for
the config format and current limitations (no write support yet, no stale-data detection, fixed
big-endian byte order, TCP only — no RTU/serial).

**Verified against a real Modbus TCP server** (not a mock) — `modbus-serial`'s own `ServerTCP`
backing a simulated pump station PLC with a scaled `uint16` pressure register and a `float32` flow
register spanning two registers, both drifting over time. Confirmed the driver correctly decoded
both and, through the existing edge-agent bridge and a real running API, watched the actual
decoded values land in `telemetry_readings` in Postgres, changing on every poll cycle in step with
the simulated device's registers — a genuine protocol conversation end to end, not synthetic data.

### Irrigation and pump safety limits were not admin-configurable per site

**Gap:** `defaultSafetyLimits` in `packages/gaia-core` (max pressure, dry-run flow threshold, pump
runtime/rest, irrigation run cap) was one fixed object applied to every site and tenant. A real
pilot with sites that have genuinely different physical limits (different pipe ratings, different
crop/irrigation zone sizes) would either have automation falsely blocked by a limit too tight for
its equipment, or — worse — a limit too loose to actually protect it.

**Fix:** `sites.safety_limits` (jsonb, `004_site_safety_limits.sql`) holds a per-site partial
override of any subset of the five `SafetyLimits` fields, set via `PATCH /sites/:id`. A site with
no override, or one that only overrides some fields, still gets `defaultSafetyLimits` for
everything else — `evaluateCommandSafety` is called with `{...defaultSafetyLimits,
...site.safetyLimits}`, not the site's override alone. `Site.safetyLimits` (in `packages/shared`)
deliberately duplicates gaia-core's `SafetyLimits` shape field-for-field rather than importing it,
since `shared` shouldn't depend on `gaia-core`.

**Verified against real Postgres**: tightened a site's `maxPressureBar` down to 1 bar against its
seeded 2.8 bar pressure reading and confirmed a pump command that would otherwise dispatch is now
correctly blocked with `"Water pressure 2.70 bar exceeds limit 1.00 bar"`; reset it and confirmed
the command dispatches again; confirmed the override (and its later reset back to no override)
both survive an API restart.

### Maintenance tasks had no mutation endpoints

**Gap:** `maintenanceTasks` was deliberately `readonly` in `PlatformService` — there was a `GET`
but no way to create, update, or close a maintenance task.

**Fix:** `POST /maintenance` and `PATCH /maintenance/:id`, gated on `maintenance:manage`
(owner/admin/operator), following the same dual-write/hydration pattern as everything else.
Setting `status: "complete"` stamps `completedAtUtc` server-side automatically; moving a task back
to `"open"` clears it. Verified live: created a task, marked it complete with a completion log,
and confirmed both the status and the timestamp survive an API restart.

### Site/device/point provisioning had no CRUD

**Gap:** Sites, assets, devices, and points were fixed, hardcoded seed arrays regardless of
whether a database was configured — there were no create/update/delete endpoints for any of them.
Rules, telemetry, commands, alerts, incidents, audit events, edge-sync batches, and report exports
were all fully persisted (see `docs/11-deployment-railway.md`); this layer wasn't. Onboarding a
real pilot site meant editing seed data in source, not an actual provisioning flow.

**Fix:** full `POST/PATCH/DELETE` for `sites`, `assets`, `devices`, and `points`, following the
exact pattern already proven for rules — DTOs with `class-validator` decorators,
`site:manage`/`asset:manage`/`device:manage` permission guards (points fall under `device:manage`;
there's no separate `point:manage` permission), dual-write to the in-memory arrays and (when
`DatabaseService.isConfigured()`) to Postgres, and hydration in `onModuleInit()` — all four now
survive a restart exactly like rules do. Deleting a site is blocked outright while it still has
any registered devices, since the schema cascades a site delete through assets, devices, points,
and telemetry history — that much silent data loss as a side effect of one call is worth refusing
rather than just documenting. Device create/update also accept the `positionX`/`positionY`/
`placementNote` fields added for the sensor map (see that entry below), storing them in the
existing `devices.metadata` jsonb column — closing the "positions don't survive a restart" gap
that fix had explicitly flagged as a follow-up.

**Found and fixed a real bug while verifying this against real Postgres** (not caught by the unit
tests, which run against an unconfigured database and never touch a real foreign key):
`deleteSite` recorded its own `site.deleted` audit event *after* issuing `DELETE FROM sites` —
but `audit_events.site_id` has a foreign key to `sites`, so inserting an audit row that references
the very site that had just been deleted failed with a constraint violation. Worse, because each
query auto-commits independently (there's no transaction wrapping the two statements), the site
was already gone from the database by the time that error surfaced — the API reported a 500 for
an operation that had, in fact, already succeeded, leaving in-memory and database state
inconsistent until the next restart re-hydrated and the site simply vanished. Fixed by recording
the audit event *before* the delete, so the foreign key is satisfied at insert time and
`ON DELETE SET NULL` does what it's actually for: the historical record survives with `site_id`
nulled out, exactly as it does for a rule, asset, device, or point deletion (none of which had
this problem, since none of them reference their own row as the audit event's site).

**Update:** the Admin page (`/admin`) now has a real "Create site" form wired to this API — see
"There was no way to create a real user or site without a console command" below. Device/asset/
point provisioning still has no dedicated form yet (only the API); site creation was prioritized
first since it's the one every new pilot onboarding needs immediately.

### There was no real authentication at all

**Gap:** `apps/web/src/app/login/page.tsx` was a static form with no submit handler at all — the
"Continue" button did nothing. Every request's identity came from a self-asserted `x-user-role`
header, or a single build-time `GREECON_DEMO_ROLE` for the whole deployment. There was no concept
of "this specific person did this specific thing," even though every command, rule change, and
alert acknowledgement already records a `requestedBy`/`userId` — from an identity no one had
actually logged in as.

**Fix:** real login (`docs/07-security-and-rbac.md` has the full design). `POST /auth/login`
checks a bcrypt password hash and issues a signed JWT; the web app stores it in an httpOnly
session cookie and forwards it as `x-greecon-session` on every API call; the API's
`PrincipalGuard` verifies it on every single request and only falls back to the old header-based
identity when no token is presented at all (the static export, which has no server to log in
against, and local dev). A bad or expired token is rejected outright, never silently downgraded to
the header path. Middleware redirects an unauthenticated visitor to `/login`. Five demo
accounts — one per role — were seeded (`003_auth.sql`) so every role can actually log in and be
verified, not just asserted.

This also surfaced a real bug: several pages (`automation`, `alerts`, `admin`, `audit`, `reports`)
used to pin their API calls to a specific role string (e.g. always fetch `/audit` "as auditor")
purely as a workaround for the old single-role-per-build model. Under real per-user sessions that
workaround is actively wrong — a real operator's session can't be waved through as "auditor" for
one call. Fixed by using the real session's role everywhere live, gating the few sections that
need a permission the page itself doesn't require (Automation History needs `audit:read`,
Alerts' Incidents needs `incident:manage`) with the same `hasPermission` pattern already used for
Manual Control, and adding actual server-side enforcement (`lib/access.ts`'s `requirePermission`,
a 404 rather than just hiding the nav link) to the four pages gated by a page-level permission —
previously a role that couldn't see a link in the sidebar could still reach that page's data by
typing the URL directly.

**How to extend further:** there is no password reset flow and no rate limiting on
`POST /auth/login` yet (`docs/15-master-roadmap.md`, Phase 0) — both are real gaps for anything
beyond a demo/pilot. Every seeded demo account also shares one password; see the warning in
`docs/11-deployment-railway.md` about changing this before any real deployment.

### Nothing bridged the edge MQTT broker to the cloud API

**Gap:** `docs/04-edge-runtime.md` describes telemetry flowing over MQTT topics
(`greecon/{tenantId}/{siteId}/telemetry/{deviceId}`), and `apps/edge-simulator` really does
publish there — but nothing in the stack subscribed to that broker. The API only exposes
`POST /telemetry/ingest` over HTTP. A gateway publishing telemetry on-site had no path to the
dashboard at all; this was only found while preparing an actual industrial-PC deployment.

**Fix:** added `apps/edge-agent`, a small bridge that subscribes to the site's telemetry topic on
the local broker and forwards each message to `POST /telemetry/ingest`, buffering in memory and
retrying if the API is briefly unreachable. Verified live end-to-end: Mosquitto + the simulator + the new
agent + the real API against real Postgres, confirmed fresh readings landing in
`telemetry_readings` on a ~5-second cadence. See `docs/14-edge-hardware-deployment.md` for the
full install.

**Update (2026-10-13):** the buffer is now durable and bounded: an append-only JSON-lines file
(`BUFFER_PATH`, default `/var/lib/greecon-edge/buffer.jsonl` under systemd) that survives restarts
and power cuts, capped at `BUFFER_MAX_ITEMS` (oldest discarded first, and reported), flushed
one-at-a-time in order, with a request timeout, and a permanently refused reading is dropped with a
logged reason instead of being retried forever. See `docs/18-reality-audit.md`.

### Energy metering was solar/battery-only

**Gap:** `overview()` only ever reported `solarPowerKw`, `batterySocPercent`, and a derived
surplus flag. There was no concept of grid import, grid export, or total consumption anywhere in
the API or seed data, and canonical points for them (`energy.grid.import.kw`,
`energy.grid.export.kw`, `energy.consumption.kw`) existed in `packages/shared` but were never
attached to a device or point. A site with no battery had nothing meaningful to show at all.

**Fix:** `PlatformService.overview()` now reports every `energy.*` field independently
(`packages/api/src/platform/platform.service.ts`), each `undefined` when a tenant's sites don't
meter it rather than assuming a fixed set of equipment. A "Grid Meter" device and its three grid
points were added to Integrated Farm Site — deliberately the one site with **no battery** — to
prove grid metrics are wired up independently of battery presence. The Overview page
(`apps/web/src/app/page.tsx`) only renders a metric card for fields that are actually present, so
customizing per-deployment equipment (solar-only, grid-only, battery-only, or any mix) just works
without code changes on the frontend.

**How to extend further:** to add metering for a new site, add a device + point(s) using the
existing `energy.*` canonical names (or a new one added to `canonicalPoints` in
`packages/shared/src/index.ts`) and seed a telemetry reading. No API or UI code needs to change —
`overview()` and the site detail page both already read generically off whatever points exist.

### Sensor map showed a computed layout, not real placement

**Gap:** `SensorMap.tsx` arranged devices in an auto-generated grid with no relationship to where
sensors actually sit on the land — useful as a diagram, but not a real site map.

**Fix:** `Device` gained optional `positionX`/`positionY` (percentage coordinates within the map
area) and `placementNote` fields (`packages/shared/src/index.ts`). Every demo device now carries
a real surveyed-style position (e.g. the Irrigation Controller sits at the Irrigation Zone 1 valve
manifold, the Grid Meter at the site's utility interconnection point). `SensorMap.tsx` uses these
coordinates when present and only falls back to the generated grid for a device that has no
recorded position, so a newly-added, not-yet-surveyed device still shows up rather than being
dropped.

**Update:** this is now durable — see "Site/device/point provisioning had no CRUD" above, which
added device persistence (including `positionX`/`positionY`/`placementNote` in the
`devices.metadata` jsonb column) and hydration on boot. In production this data would still come
from a site commissioning/survey step (GPS or as-built drawing coordinates converted to
percentages of the site boundary) rather than being hand-typed, but it now at least survives a
restart once entered.

### Farm irrigation had no manual control at all

**Gap:** Two separate problems compounded here. First, `agri.irrigation.command` was referenced
by name in a seeded automation rule but had **no backing point** anywhere — the rule targeted a
canonical name that didn't exist on any device, so it could never actually run even if promoted
out of simulation. Second, `ManualOverridePanel.tsx` was entirely cosmetic: it had no `fetch` or
API call of any kind, just local React state that always claimed success.

**Fix:**
- Added the missing `agri.irrigation.command` point (capability `write`) to the Irrigation
  Controller device on Integrated Farm Site, so the existing "Irrigate when soil moisture is low"
  rule has a real target.
- Replaced the fake panel with `ManualControlPanel.tsx`, which dispatches a real command through
  `POST /commands` (`apps/web/src/lib/actions/commands.ts`, a Server Action) — the exact same
  endpoint and GAIA safety evaluation an automated rule action uses. It is available in two
  places: on each site's detail page, scoped to that site's write-capable points (irrigation,
  pump, etc.), and on the Automation page, listing every write-capable point tenant-wide. Both are
  gated behind the `command:create` permission (owner/admin/operator, not viewer/auditor).
  Automatic (rule/AI) execution stays the default mode; manual dispatch is the explicit,
  confirmation-gated path — the UI states this directly ("Automatic (rules/AI) is the default
  mode").
- Found and fixed a live safety-evaluation bug while testing this end-to-end:
  `requiredSensorPointsForCommand` in `packages/gaia-core/src/index.ts` required a
  `water.pressure.bar` reading before allowing *any* irrigation command — copied from the pump
  station's requirements, but irrigation zones aren't on the same pressurized main and the farm
  site has no pressure sensor at all, so every irrigation command was unconditionally blocked.
  Removed that requirement (soil moisture is still required and quality-gated) and added a
  dedicated single-run duration cap (`maxIrrigationRunMinutes`, default 120) so a manual override
  can't request an unreasonably long run.

**How to extend further:** the duration cap only bounds a single dispatch. It does not yet track
"starts per day" or cumulative daily runtime the way the pump station's rest-time check does for
pumps — that needs a small amount of state (recent command history per point) that
`evaluateCommandSafety` doesn't currently have access to. The straightforward way to add it:
extend `SafetyContext` with a `recentCommands` list (mirroring how `lastPumpStoppedAtUtc` is
threaded through today) and add a check parallel to the pump's rest-time logic.

### There was no way to create a real user or site without a console command

**Gap:** the only way to onboard a real pilot user or a real site was a direct database console
command (bcrypt-hashing a password by hand, inserting rows) — not something the platform's owner
could do themselves. `listUsers()` in `PlatformService` also never read from Postgres at all; it
returned a hardcoded five-user demo array regardless of what was actually in the `users` table, so
even a user created by hand in the database wouldn't show up in the Admin page.

**Fix:**
- `PlatformService` now hydrates `users` from Postgres on boot (joined with `memberships` for
  role), the same dual-write pattern as sites/assets/devices/points.
- `POST /users` (`user:manage`) creates a real user: generates a random temporary password,
  bcrypt-hashes it, inserts the `users` + `memberships` rows, and returns the plaintext password
  exactly once in the response — it is never stored or logged anywhere else, matching the same
  one-time-disclosure handling used for every temporary password issued by hand so far.
- `PATCH /users/:userId` (`user:manage`) changes a user's role or active/disabled status. An owner
  or admin cannot disable their own account or change their own role through this endpoint — both
  throw `ForbiddenException` — so a tenant can't accidentally lock itself out.
- The Admin page (`/admin`) now has a "Create user" form (shows the generated password once, in a
  clearly-labeled one-time notice) and a "Create site" form, plus an inline role selector and
  enable/disable button per row in the Users table. All of it uses real Server Actions against the
  live API — no more console commands for routine onboarding.
- The static GitHub Pages export gets a `page.static.tsx` twin (read-only, no forms) since Server
  Actions can't exist in that build at all — same swap mechanism `build-static.sh` already used for
  the login page, Shell, and manual control.

**Verified:** 4 new `PlatformService` unit tests (viewer blocked from creating a user, full
create → promote-role → disable lifecycle, duplicate-email rejected, self-disable blocked) plus a
full `next build` of both the SSR and static-export paths.

**How to extend further:** device/asset/point provisioning still has no dedicated form (API only,
per the entry above). There is still no password reset flow (`docs/15-master-roadmap.md`, Phase
0) — a disabled-then-re-enabled user keeps their old password, and a user who forgets their
password has no self-service way to get a new one; an admin currently has to create a fresh
temporary password for them by hand through a future "reset password" action on this same page
(not yet built).

### There was no way to onboard a second client — only one hardcoded tenant existed

**Gap:** the entire platform ran against a single hardcoded demo tenant (`DEMO_TENANT_ID`). The
`Admin` page and everything in it (users, sites) is correctly scoped to the caller's own tenant —
that isolation was already real — but there was no way to create a *second*, separate client
account at all, hardcoded or otherwise. `tenants.controller.ts` only ever listed the caller's own
tenant. This mattered the moment "the platform" stopped meaning "our one pilot farm" and started
meaning "a product other clients will also run on."

**Fix:** a new `isPlatformAdmin` flag on `users` (migration `005_platform_admin.sql`), deliberately
kept separate from the tenant-scoped `role`/`Permission` system everything else in
`docs/07-security-and-rbac.md` uses — a client's own owner role must never imply access to another
client's data, so this is a second, orthogonal axis, checked by its own `PlatformAdminGuard`
rather than folded into `hasPermission`. It rides in the same signed JWT as everything else
(`isPlatformAdmin` claim), so it's tamper-proof the same way the rest of a session is. Only
`eridon.manuka@greecon.earth` has it set, by the migration itself.

- `POST /platform-admin/tenants` creates a brand new tenant plus its first owner user in one step
  — same one-time-password handling as `POST /users` — fully isolated from every other tenant's
  data (separate `tenant_id` on every row from the start).
- `GET /platform-admin/tenants` lists every client with live user/site counts, for a platform
  admin only.
- `/platform` in the web app is the real screen for this: an "Onboard a new client" form and a
  table of every client. It only appears in the sidebar (and only actually renders instead of a
  404) for a session with `isPlatformAdmin: true` — everyone else, including a client's own owner,
  never sees it exists.

**Verified:** 3 new `PlatformService` unit tests (non-platform-admin owner blocked from both
listing and creating tenants; a platform admin can onboard a new client whose data stays
completely invisible to `listUsers()` called with the original demo tenant's own principal;
duplicate domain rejected) — 32 tests passing total — plus a full `next build` of both the SSR and
static-export paths.

**How to extend further:** there's no billing/plan status per client yet (`status` is just
`active`/`suspended` with nothing wired to actually suspend one), and no way to remove/deactivate
platform-admin status from the UI — both would need a "danger zone" section on `/platform` once
there's a second real client to actually manage.

### A pass through what "for real, not a demo" was still missing

Requested explicitly once real clients started being onboardable: an expert audit of what a
production system needs that a demo doesn't, focused on what's concretely buildable without a new
external account/integration.

**Gap 1 — nothing rate-limited `/auth/login`.** Anyone (or anything relaying through the public
web app's login form) could attempt unlimited password guesses against any known email.

**Fix:** `@nestjs/throttler`, wired globally (120 requests/minute/caller as a sane default across
the whole API) and tightened hard on `POST /auth/login` specifically (8/minute/caller). In-memory
storage — correct for the current single-instance deployment; would need a Redis-backed storage
adapter (`@nestjs/throttler` supports one) the moment there's more than one API replica, since each
replica would otherwise count independently.

**Gap 2 — suspending a client did nothing.** The `/platform` "Suspend" button and
`tenants.status` column existed (see the entry above) but nothing anywhere actually checked the
value. A suspended client's users could keep working right up until their JWT's own 12h expiry,
and even then could just log in again since login never checked tenant status either.

**Fix:** `POST /auth/login`'s query now joins `tenants` and refuses a fresh token for anything but
an `active` tenant; a new `TenantStatusGuard` (global, running after `PrincipalGuard`) rejects every
other request from an already-issued token the moment its tenant is suspended, not just new logins.
Platform admins are exempt from both checks — their own account lives in Greecon's internal tenant,
which suspension is never aimed at.

**Gap 3 — no way to recover a forgotten password.** There's still no self-service "forgot
password" — that needs a real email-sending integration (a provider account, a verified sending
domain) this deployment doesn't have, and standing one up wasn't something to do silently without
asking. The concrete, buildable stopgap: `POST /users/:userId/reset-password` (Admin page only,
`user:manage`) generates a fresh temporary password on the spot, shown once, same handling as
creating a new user — an admin can now unblock a locked-out teammate in seconds instead of a
console command.

**Gap 4 — a misconfigured production deploy would fail silently.** If `DATABASE_URL` was set (a
real deployment) but `JWT_SECRET` wasn't, the API would start up looking completely healthy and
only reveal the problem the moment someone actually tried to log in — which, for a fresh
deployment right before a demo or a pilot's first real day, is a bad time to discover it.

**Fix:** a startup warning in `main.ts` logs loudly (not a hard crash — a real database with no
`JWT_SECRET` yet is still a valid state mid-setup) the moment that specific combination is
detected, so it shows up in Railway/GCP deploy logs immediately.

**Verified:** 6 new tests (`TenantStatusGuard` unit tests for active/suspended/platform-admin-exempt;
`PlatformService` tests for suspend → reactivate lifecycle and the non-platform-admin block;
password-reset generates a real usable temporary password and is blocked for a viewer) — 37 tests
passing total — plus full `tsc`/`next build` passes for both apps.

**What this pass deliberately did NOT do, and why — these need a decision, not just code:**
- **Real email delivery** (invite emails, password reset emails, alert notifications). Requires
  picking and paying for a transactional email provider (Resend, Postmark, SES) and verifying a
  sending domain — a real account/cost decision, not something to wire up unasked.
- **Error monitoring / uptime alerting** (e.g. Sentry, a status-page ping). Same reasoning: needs a
  third-party account. Worth doing before real client traffic depends on this running unattended —
  see Phase 2's "SLA-grade observability" in `docs/15-master-roadmap.md`.
- **Database backups.** Depends entirely on the Railway/GCP plan and settings, not application
  code — confirm automatic backups are actually enabled on whichever Postgres is in production use
  today, since this can't be verified or fixed from inside the repo.
- **Terms of Service / Privacy Policy / a data-processing agreement for clients.** Once this
  platform holds other companies' operational data, a real legal document (reviewed by an actual
  lawyer, not drafted here) covering data ownership, retention, and liability is worth having before
  onboarding a paying client. Flagged, not drafted — this isn't an engineering gap to close in code.
- `npm audit` currently reports 10 known vulnerabilities across transitive dependencies (vitest's
  dev-only mocker, `body-parser`/`qs`/`js-yaml` pulled in by Express/Swagger, `multer` pulled in by
  `@nestjs/platform-express` despite no file-upload endpoint existing anywhere in this API). None
  are in a code path this app actually exercises (no YAML parsing of untrusted input, no file
  uploads), so none were patched blind this pass — `npm audit fix` hit an unrelated npm workspace
  bug when attempted; worth a dedicated look with a working npm version rather than a rushed
  workaround.

### There was no real visibility into any resource over time, and Analytics was 100% fake

**Gap:** the Overview and Monitoring pages only ever showed the single latest reading per point —
no way to see whether solar production was trending up, how much energy was actually going to the
grid versus being consumed on-site, or whether a tank was draining faster than usual. Worse,
`/analytics` didn't even try: every number on it (`"Energy self-use: 82%"`, `"Water efficiency:
74%"`) was a hardcoded literal, unconnected to any real reading, and the "24 hours / 7 days / 30
days / Quarter" tabs were plain `<span>`s that did nothing.

**Fix:** `GET /telemetry/history?siteId=&hours=` (`PlatformService.telemetryHistory`) queries
`telemetry_readings` directly from Postgres for a real time window, instead of the in-memory
snapshot every other telemetry read uses (which only ever holds the latest value per point by
design). `/analytics` is rebuilt around it: a real chart per metric — solar production,
consumption, grid import, grid export, and battery state of charge for Energy; tank level, flow,
and pressure for Water; soil moisture, temperature, and humidity for Agriculture — so "how much is
being produced vs. how much is going to the grid" is finally an actual answer, not a guess from
two separate numbers. The time-range and site tabs are now real links that change what's queried.
Charts are a small hand-rolled SVG line component (`TimeSeriesChart`), not a new charting library
dependency — consistent with `SensorMap`'s existing hand-rolled approach.

**Verified:** 2 new `PlatformService` tests (no-database fallback returns the latest snapshot;
cross-tenant site history blocked) plus full `tsc`/`next build` passes, including the static
export's own fixed-window twin (`analytics/page.static.tsx`).

**How to extend further:** with only one site per tenant in practice today, tenant-wide history
works fine; a tenant running multiple sites that share a canonical name (e.g., two farms both
metering `energy.grid.import.kw`) would see both sites' readings plotted as one series — a
per-metric site breakdown is the natural next step once that's a real scenario, not a demo one.

### The Overview dashboard was fixed for everyone — no way to prioritize, hide, or resize a card

**Gap:** every Overview metric card showed in the same fixed order, at the same size, for every
user — an operator who only cares about irrigation had to scroll past energy/water cards to reach
it, with no way to change that.

**Fix:** `dashboard_preferences` (one row per user, `007_dashboard_preferences.sql`) stores an
ordered list of `{key, visible, size}` per widget. `/settings` has a real "Dashboard" section:
Up/Down buttons reorder a card (priority), a Visible/Hidden toggle hides one, and a Small/Medium/
Large button cycles its display size (`.metric-card--small`/`--large` in `globals.css`) — all
plain Server Action forms, no client JavaScript. The Overview page applies whatever's saved
(`lib/dashboard-preferences.ts`) on top of whatever metrics the tenant actually has; a card the
tenant doesn't meter still just doesn't appear, same as before this existed.

**Verified:** 1 new `PlatformService` test (no-database fallback + save round-trip) plus full
`tsc`/`next build` passes for both SSR and static-export paths.

**How to extend further:** this is deliberately not drag-and-drop — up/down buttons were enough to
ship a real, working priority control without a new client-side library. A true drag-to-reorder
UI is a pure frontend enhancement on top of the same API whenever it's worth the added complexity.

### The seeded demo tenant and Eridon's real working account were the same tenant

**Gap:** `eridon.manuka@greecon.earth` — the real account meant to run Greecon's own real pilot —
was seeded as the owner of the same tenant that also held every fake demo site (solar/battery/
water/farm) and their simulated telemetry. Harmless while nothing real existed yet; actively
dangerous the moment a real farm gets provisioned into it, since real and fake data would then
share one dashboard with no way to tell them apart. There was also no single clean login to hand a
sales prospect — five different demo accounts existed, sharing one password.

**Fix (`006_split_demo_and_real_tenant.sql`):** Eridon's account moves to a brand new, completely
empty real tenant — his existing real password is untouched, only which tenant he belongs to
changes. The old demo tenant keeps every seeded fake site/telemetry/rule (exactly what makes it
useful for a demo) but is reduced to one login: **`demo@greecon.earth` / `demo123`** — safe to
hand to a prospect, since it lives in a tenant that only ever contains fake data and has no real
permissions over anything real by construction. See the credential rundown in
`docs/11-deployment-railway.md`.

**Action required on the live deployment:** migrations only run when explicitly triggered (see
"One-time setup" in `docs/11-deployment-railway.md`) — this migration will not take effect until
`npm run db:migrate -w @greecon/api` is run again against the real database. Until then, the live
site keeps running on the pre-split data. After it runs, **log out and log back in** if already
signed in as `eridon.manuka@greecon.earth` — an already-issued session token still carries the old
tenant ID until it's refreshed by a fresh login.

**Found and fixed a real bug while actually re-running this on production:** `001_schema.sql`'s
`commands_audit_event_id_fkey` foreign key used a plain `ALTER TABLE ... ADD CONSTRAINT` with no
guard — fine the very first time `db:migrate` ever runs against a fresh database, but a hard
failure on every run after that, since Postgres refuses to add a constraint that already exists.
`migrate.ts` runs every `.sql` file in one loop with no per-file recovery, so this didn't just skip
one line — it aborted the entire migration run before file `002` even started, silently blocking
every migration after it (including this one) from ever reaching a database that already had the
schema loaded. Wrapped it in `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) ... END
$$;`, the standard idempotent pattern for a constraint Postgres has no native `IF NOT EXISTS` for.
Every other `ALTER TABLE` across every migration already used `ADD COLUMN IF NOT EXISTS`, so this
was the only one exposed to it.

**Second bug, found the same way once `001` was fixed and `006` actually got to run for the first
time:** it failed partway through with `duplicate key value violates unique constraint
"users_tenant_id_email_key"`. The original version keyed its upserts on `id` (`ON CONFLICT (id) DO
NOTHING`) and matched Eridon's tenant move by comparing against a hardcoded old-tenant-id constant
— safe only if a previous attempt either fully committed or fully rolled back, never true here in
practice. Rewrote it to resolve the real tenant/user ids from `tenants.domain` and `users.email` at
each step (never trusting a hardcoded UUID actually matched) and to upsert the demo user by its
real natural key, `(tenant_id, email)` — the constraint that was actually firing — rather than only
guarding against a re-used `id`. Converges to the same end state regardless of exactly how much of
a previous attempt already applied.

**Third bug, found live once the site was actually reachable again:** every single user hitting
the Overview page saw a raw server error. `GET /dashboard-preferences` (added in this same pass)
returned `null` for "never customized yet" — true for literally everyone right after this feature
shipped — and NestJS's Express adapter treats a `null`/`undefined` controller return value as "send
no body at all," not the JSON literal `null`. The client's `response.json()` then choked on a
genuinely empty body with an opaque `Unexpected end of JSON input`, with nothing in any log naming
which request caused it. Fixed two ways: `getDashboardPreferences` now returns `[]` instead of
`null` (an empty list already meant the same thing to `applyDashboardPreferences`, so this cost
nothing), and — the more durable fix — `apiGet`/`apiMutate`/the login action now read the response
body as text first and report the request, status, and a snippet of the raw body on a parse
failure, instead of a bare crash. That second part is what actually let this get diagnosed from a
screenshot instead of guessing blind against a live production server with no direct access to it.

### The first chart pass was readable but bare — no axis values, no per-site detail

**Gap:** the very first version of `TimeSeriesChart` was a plain line with no y-axis, no gridlines,
and no way to read an exact value or timestamp off it — it showed the *shape* of a trend but not
"how much." It also only ever existed on the tenant-wide `/analytics` page; a single site's own
page had no trend charts at all, only the latest instantaneous reading per point (`MetricGrid`),
same limitation the whole "no history anywhere" gap above was about.

**Fix, following the platform's dataviz method (form → color → validated palette → marks →
interaction → accessibility, applied to a single-series line card, one hue, no legend needed):**
- A recessive hairline grid with "nice number" tick labels (0 / 25 / 50 / 75, never raw decimals)
  on the y-axis — the values a reader actually needs are on the chart now, not just in the header.
- A 10%-opacity area wash under the line, a marker at the line's end (the mark spec's "value at
  the line's end," reinforcing the header's latest-value figure), and start/end date labels on the
  x-axis.
- A real hover layer: a crosshair that snaps to the nearest point and a tooltip showing its exact
  value and timestamp — every chart is interactive now, not just a static image, per the method's
  "the hover layer is part of the deliverable, not an upgrade."
- Every site's own page (`/sites/:siteId`) now has its own **Trends** section: one chart per
  readable point that site actually has (derived from its own provisioned points, not a fixed
  catalog), so a single-site operator sees their own history without going through the tenant-wide
  Analytics page at all — with a link across to full Analytics, filtered to that site, for more.
- `groupByCanonicalName` (turning a `/telemetry/history` response into per-metric chart series)
  was duplicated three times (Analytics, its static twin, and now the site page) — pulled into
  `lib/telemetry-history.ts` once.

**Verified:** rendered the chart with sample data through a headless browser and inspected the
screenshot directly (axis values, gridlines, area fill, and end-marker all present and legible)
rather than trusting the code alone, plus full `tsc`/`next build` passes for SSR and the static
export.

**How to extend further:** the site page's Trends section is a fixed 7-day window with no range
tabs (unlike the tenant-wide Analytics page) — a reasonable v1 given a single-site operator mostly
wants "how's this been lately," but the same range-tab pattern from Analytics would extend cleanly
if that's ever needed there too.

### The cloud API had no way to be reached from a real remote edge site, and provisioning still needed raw commands

**Gap:** the API was deliberately never exposed on the public internet, because its RBAC used to
trust a self-asserted role header on any request with no session token — a publicly reachable API
would have let anyone impersonate any role with zero credentials. That was the right call while
nothing needed the API to be public, but it meant a real edge box at an actual remote farm site had
no public URL to send telemetry to at all, and — separately — creating the Device/Point records
that box would need still required raw API calls, since Admin only had forms for users and sites.

**Fix, two parts:**
- **Production header-fallback lockout.** `PrincipalGuard` now rejects an unauthenticated request
  outright (`401`) whenever `NODE_ENV=production` (set by both Dockerfiles) — the old
  `x-user-role`/`x-tenant-id` fallback only still works outside production (local dev, and the
  static GitHub Pages export's local build step). This had to land *before* the API could safely
  get a public domain at all.
- **A narrow, scoped exception for real telemetry.** `POST /telemetry/ingest` additionally accepts
  a shared device secret (`x-edge-device-token` against `EDGE_INGEST_TOKEN`), granting a synthetic
  principal for exactly that route and one fixed tenant (`EDGE_INGEST_TENANT_ID`) — the route match
  happens inside `PrincipalGuard` itself, so the same header on any other route falls straight into
  the lockout above. `apps/edge-agent` sends this instead of the old role header when `EDGE_TOKEN`
  is set. See `docs/07-security-and-rbac.md` and `docs/14-edge-hardware-deployment.md` for the full
  picture, including the private-tunnel alternative for a client that can't have any public
  endpoint at all.
- **Device/Point creation forms**, on each site's own page (`/sites/:siteId`, gated on
  `device:manage`) — provisioning the exact hardware records a real sensor needs no longer requires
  a raw API call, closing the last piece of "there's no site/device/point provisioning UI" from the
  provisioning-CRUD entry earlier in this doc.
- **Found in the same pass:** the site page's Manual Control gate (`canControl`) was computed from
  `DEMO_ROLE` — the *build-time* fallback role, meant only for the static export — instead of the
  real logged-in session's role. On the live SSR deployment this meant every visitor saw the same
  fixed gate regardless of who they actually were logged in as (not a security hole — the API still
  enforced the real role independently — but a real user-facing bug: a viewer could see a Manual
  Control panel that would then fail on submit). Fixed to read the real session, matching every
  other page.

**Verified:** 4 new `PrincipalGuard` unit tests (production rejects an unauthenticated request;
edge token grants access only on the exact route; wrong token rejected; the path/token pair does
nothing when `EDGE_INGEST_TOKEN` isn't configured) — 46 tests passing total — plus full
`tsc`/`next build` passes for both apps and the static export.

**How to extend further:** the device secret is a single shared value across the whole tenant, not
per-gateway — a real fleet (`docs/15-master-roadmap.md`, Phase 2, "Real device identity for machine
traffic") needs a signed credential or mTLS cert per gateway, checked against a table of registered
devices, so compromising one site's edge box doesn't affect any other site. That's a materially
bigger change than this pilot needed and should wait until there's more than a handful of real
sites to justify it.

### The production lockout above broke login for every real user, not just unauthorized callers

**Gap:** `PrincipalGuard`'s production lockout (added in the same pass as the entry above) rejects
any request with no session token outright once `NODE_ENV=production`. `POST /auth/login` is
exactly that kind of request — there is no token yet, that's the whole point of calling it — so
every single login attempt, for every account (not just `demo@greecon.earth`), started failing
with a 401 before it ever reached `AuthController`. `GET /health` had the same problem. This
surfaced as the demo account's password looking broken even though the database had the right
password hash the whole time — the real failure (`"Authentication required."`) never reached the
screen because `apps/web/src/app/login/actions.ts` maps any non-2xx response to a generic
`"Invalid email or password."`, masking the actual cause. Found by reading `auth.controller.ts`
against the guard chain after confirming directly against the live database that the demo
account's credentials were already correct — the bug was upstream of the password check entirely.

**Fix:** `PrincipalGuard` now recognizes `POST /auth/login` and `GET /health` as public routes and
lets them through before the production-lockout check, assigning a harmless sentinel principal
(`publicRoutePrincipal()` in `principal.ts`, `isPlatformAdmin: true` so it also clears
`TenantStatusGuard`'s check with no code change needed there) — neither controller actually reads
`request.principal`, so this exists purely to keep the guard chain from crashing on it, not to
grant any real authorization.

**Verified:** 3 new `PrincipalGuard` tests (login and health both let through unauthenticated in
production; a lookalike route like `/auth/session` is not accidentally included in the same pass)
— 49 tests passing total — plus full `tsc` passes for both apps.

**How to extend further:** any future route that must genuinely work with no session (a public
status page, a webhook receiver) needs the same explicit allowlist entry in `PrincipalGuard` — this
is deliberately not a broad "skip auth for GET requests" rule, since that would be exactly the kind
of accidental exposure the production lockout exists to prevent.

### Greecon staff had to click through the client dashboard to reach admin tools

**Gap:** `/login` was one plain form for every account. A Greecon platform admin (like Eridon) and
an ordinary client account both landed on the same tenant Overview page after signing in — a
platform admin then had to navigate to the "Clients" link in the sidebar every time they actually
wanted to onboard a client or check on one, rather than landing there directly.

**Fix:** the login page now shows two buttons, **"Client login"** and **"Greecon team"** —
`LoginForm.tsx` sends the same email/password either way (there is no separate credential system;
`isPlatformAdmin` is still the one real flag that means anything), but which button was clicked
decides where a successful login lands: `/` for a client, `/platform` for the team option. Picking
"Greecon team" with an account that isn't actually a platform admin is rejected outright
(`loginAction` in `apps/web/src/app/login/actions.ts`) with a message pointing back to the other
button, rather than silently logging them into the client view. This is a landing-page convenience
only — it changes nothing about what either account can actually do; the "Admin" and "Clients" nav
links (`Nav.tsx`) are gated by `user:manage`/`isPlatformAdmin` exactly as before, for either path.

**Verified:** full `tsc`/`next build` passes, plus a rendered screenshot of both toggle states
confirming the selected option is visually distinct and the unselected one fades to the ghost
button style.

**How to extend further:** a platform admin still can't manage a *different* client's own users
from inside their own account — `/admin` only ever operates on the caller's own tenant. Doing that
for real (rather than asking a client to make the change themselves) needs a deliberate
"impersonate/act as this client" flow, which is a bigger, more sensitive feature than this pass —
worth building once there's a second real client whose admin actually needs Greecon's help this way.

### A brand new tenant's Overview page was a wall of meaningless empty cards, and create-forms failed silently

**Gap:** two related first-impression problems, both found by actually looking at what Eridon's own
real tenant sees today with zero sites provisioned yet (the exact state every future client starts
in too):

- `buildMetrics()` on the Overview page (`apps/web/src/app/page.tsx`) pushed a "Tank level," "Line
  pressure," "Soil moisture," and "Edge connectivity" card unconditionally, even when the tenant has
  no water/agriculture equipment or sites at all — unlike the energy cards just above them, which
  were already correctly skipped when not applicable. A brand new tenant saw four cards reading "—"
  with no indication anything was simply not set up yet, rather than broken.
- `createSiteAction`, `createDeviceAction`, and `createPointAction` were plain server actions
  returning `void` — a real failure (a duplicate name, the API being briefly unreachable) either
  crashed to Next.js's generic error page or, for a bad form value, silently did nothing at all.
  Only `createUserAction` (and its `CreateUserForm`) had ever gotten the proper error-handling
  treatment.

**Fix:**
- The four metric cards above are now gated on the underlying value actually being defined, exactly
  like the energy cards — a tenant with no water/agriculture telemetry simply doesn't get those
  cards, the same "customizable per deployment" rule already documented for energy metering.
- When a tenant has zero sites, the Overview page now shows a **"Getting started"** guide instead of
  an empty metrics/sites/alerts layout: three numbered steps (create a site, add its devices and
  points, connect real hardware), linking straight to `/admin` when the caller has `site:manage`, or
  a plain note to ask a Greecon admin when they don't.
- `createSiteAction`/`createDeviceAction`/`createPointAction` now return `{ error?, created? }`
  instead of `void`, and `CreateSiteForm`/`CreateDeviceForm`/`CreatePointForm` became client
  components (matching `CreateUserForm`'s existing pattern) that show a real error message on
  failure and a plain-text confirmation ("Site created.", "Device added.", "Point added.") on
  success — nothing about submitting one of these forms was ever silent or uninformative again.

**Verified:** full `tsc`/`next build` passes for the SSR path, plus a rendered screenshot of the new
"Getting started" panel (numbered steps, muted explanatory copy, and a real call-to-action button)
confirming it reads clearly rather than just compiling.

**How to extend further:** `updateUserRoleAction` and `updateUserStatusAction` (the inline role
selector and enable/disable button in the Users table) still return `void` with no error surfaced —
lower risk than create (a role change against an existing row rarely fails), but the same treatment
would close the gap completely if it's ever worth it. A per-site "0 devices yet" callout on the site
detail page itself (beyond the existing empty `SensorMap` message) is a natural next increment once
there's a second real client actually hitting that state.

### Connecting a second real client's edge device, and resetting your own password, both still needed a console

**Gap:** two genuine "still needs the backend" gaps remained even after Admin Center and the
Device/Point forms shipped:

- **Only one client could ever have a real edge device at all.** `EDGE_INGEST_TOKEN`/
  `EDGE_INGEST_TENANT_ID` (`docs/07-security-and-rbac.md`) is a single Railway environment variable
  pair, hardcoded to one fixed tenant. A second real client's farm PC had no way to authenticate at
  all without Greecon manually reconfiguring Railway — and even then, only one client's device could
  be live at a time, since the tenant ID is a single value.
- **There was no way to set your own chosen password.** The only two ways a `password_hash` ever
  changed were a migration-seeded value or `POST /users/:userId/reset-password` (Admin page), which
  always generates a random one-time password, never a password the user picks. Setting Eridon's
  real account to a specific password required a one-off script run directly against the database.

**Fix, two parts:**
- **Real per-gateway credentials.** `edge_gateways` (already existed as a placeholder table with no
  API) gains a `secret_hash` column (`008_gateway_credentials.sql`) and a real `POST /gateways`
  endpoint (`device:manage`, same permission as devices/points) — a new **"Add gateway"** form on
  each site's own page generates a real random secret, shown exactly once (same one-time-disclosure
  handling as a new user's temporary password), and stores only its SHA-256 hash. `PrincipalGuard`
  now checks `POST /telemetry/ingest`'s device token against every registered gateway's hash first
  (one indexed query, not a bcrypt-compare loop — a high-entropy random token doesn't need bcrypt's
  deliberate slowness the way a human password does) before falling back to the legacy shared
  `EDGE_INGEST_TOKEN` path, which still works unchanged for any deployment that configured it
  before this existed. Any number of clients, any number of gateways per client, zero Railway
  configuration per client from here on.
- **Self-service password change.** `POST /auth/change-password` (any logged-in role, operating only
  on the caller's own `userId`) verifies the current password before accepting a new one — the same
  page a user already visits for dashboard preferences (`/settings`) now has a real "Account
  Security" section for this, replacing two stale placeholder panels ("API Keys", "Edge Gateway")
  that never did anything.

**Verified against a real, running Postgres** (not just unit tests): ran all 8 migrations fresh,
created a gateway via the API and confirmed its secret authenticates `POST /telemetry/ingest` in
production mode with **no `EDGE_INGEST_TOKEN` env var set at all**, confirmed the resulting reading
actually lands in `telemetry_readings`, and confirmed the production header-fallback lockout still
rejects an unauthenticated request the same run. Separately logged in as the demo account, changed
its password through the new endpoint, confirmed the old password then fails and the new one
succeeds, and confirmed a wrong current password is rejected without changing anything. Plus 8 new
`PrincipalGuard`/`PlatformService` tests (57 total) and full `tsc`/`next build` passes for both apps.

**How to extend further:** a gateway's secret is still all-or-nothing — reading it again means
generating a new one (there's no "reveal" after the creation screen closes, by design, same as a
user's temporary password). Deleting and re-adding a gateway (see the next entry) is how you'd
rotate a compromised or lost credential today; a dedicated "Rotate" action that keeps the same
gateway row and only replaces `secret_hash` would be a small refinement once that's worth it.

### There was no way to remove a device, point, or gateway once added

**Gap:** `POST /devices`, `POST /points`, and `POST /gateways` all shipped with real `DELETE`
endpoints on the API from the start (`device:manage`) — but nothing in the UI ever called them. A
device added by mistake, an old sensor that got physically removed from a site, or a gateway that
needs its credential revoked all had no way to go away again except a raw API call.

**Fix:** each site's own page now lists its devices, reading points, and gateways as real tables
(previously devices/points only ever appeared inside `SensorMap`'s visual layout, with no
per-item actions available), each row with a **Delete** button. `DeleteButton.tsx` is a small
shared client component — a `window.confirm` prompt naming exactly what's being deleted, then the
same error-surfacing pattern as every other form in this pass — reused for all three rather than
writing the same confirm/error boilerplate three times (matches the existing pattern in
`RuleActions.tsx`'s rule delete button). Deleting a device cascades to its own points and telemetry
history (the expected, unsurprising consequence of decommissioning it); deleting a gateway does
not cascade at all — a device that referenced it just loses that association (`ON DELETE SET NULL`
in the schema) and keeps working, since the gateway is only a grouping/credential concept, not
something a device depends on to function.

**Verified against a real Postgres**: created a gateway, a device, and a point through the live
API, deleted all three, and confirmed each is gone both from a fresh `GET` and directly in the
database (not just removed from in-memory state) — 2 new `PlatformService` tests (a gateway
deletes cleanly and a viewer is blocked from deleting one) — 59 tests passing total — plus full
`tsc`/`next build` passes for both apps.

**How to extend further:** deleting a device or point currently has no confirmation of what
depends on it beyond the browser's `window.confirm` text — if a write-capable point is currently
referenced by an active automation rule, deleting it doesn't warn about that rule before it does
(the rule would just stop finding a target). Worth a check-and-warn step once a tenant has enough
rules for that to be a real risk rather than a theoretical one.

### An audit of every "the API can do this but the page has no button for it" gap

**Gap:** asked, after closing the device/point/gateway delete gap above, whether anything similar
remained elsewhere — a real endpoint that already existed with no way to trigger it from the UI at
all. A full pass over every controller against every page turned up four:

- **Acknowledging an alert** — `POST /alerts/:id/acknowledge` existed; the Alerts page only ever
  displayed alerts read-only, with no way to actually acknowledge one.
- **Changing an incident's status** — `PATCH /incidents/:id/status` existed; the Incidents table
  showed status as plain text, not a control.
- **Deleting a site** — `DELETE /sites/:id` existed (and already correctly blocks deletion while
  any device is still registered); the Admin page's Sites table had no delete action at all.
- **Requesting a report export** — worse than merely missing: `reports/page.tsx` had a literal
  `<button type="button">Queue Export Placeholder</button>` with no `onClick`, no server action,
  nothing — a real user clicking it would see precisely nothing happen, with no error and no
  explanation. `POST /reports/exports` (which records a real audit event, though no actual file
  generation exists yet — the name was honest about that) had been sitting unused since it shipped.

**Fix:** each gap closed with the same pattern already established for devices/points/gateways —
a small client component per action, calling a real Server Action, showing a real success or error
outcome. `AcknowledgeAlertButton`, `IncidentStatusSelect` (a plain `<select>` over the five real
`incidentStatuses`), the `DeleteButton` component reused a third time for sites, and
`RequestExportForm` replacing the dead placeholder button — its confirmation is honest that the
request is logged, not that a file is coming, rather than implying more than the system does.
`alerts/page.tsx` and `reports/page.tsx` gained real Server Actions for the first time, so both
needed the same static-export twin + `build-static.sh` swap-list treatment every other interactive
page in this app already has (`docs/12-deployment-github-pages.md`'s static build has no server to
send a mutation to at all).

**Verified against a real Postgres**: acknowledged a seeded alert and confirmed its status and
`acknowledged_at` timestamp actually changed in the `alerts` table; moved a seeded incident to
`resolved` and confirmed it in the `incidents` table; requested a report export and got back a real
`queued_placeholder` record; attempted to delete a site that still has four devices and got the
existing 403 back correctly, then created a fresh empty site and deleted it successfully. Also ran
the full static-export build end-to-end against a real local API (not just to the point this
sandbox's usual "no live API" wall) and confirmed all 17 pages, including the two newly-swapped
ones, generate cleanly. Full `tsc`/`next build` passes for both apps; no API changes were needed
here since every endpoint already existed correctly — this pass was pure UI wiring.

**How to extend further, in rough priority order (at the time):** assets had zero UI anywhere,
there was no maintenance page at all, rules couldn't be edited in place, and sites couldn't be
edited — all four closed in the next pass below.

### Assets, Maintenance, Rule editing, and Site editing — the last four "no UI at all" gaps

**Gap:** four more real endpoints with nothing to trigger them, found by the same audit as the
entry above:

- **Assets had zero UI anywhere.** `GET/POST/PATCH/DELETE /assets` was fully built and
  `SiteDetail.assets` was already fetched by the site page — but nothing ever rendered it, and
  there was no way to create one. Devices can optionally reference an `assetId`, but with no way to
  create an asset at all, that field was effectively dead.
- **No page existed for maintenance tasks at all.** `GET/POST/PATCH /maintenance` was fully built
  and tested; there was no `/maintenance` route in the web app whatsoever.
- **Rules couldn't be edited in place.** Automation had create, approve, disable, and delete, but
  changing an existing rule meant deleting and recreating it, even though `PATCH /rules/:id`
  already supported a real update.
- **Sites couldn't be edited.** Only created and deleted; fixing a typo in a site's name or
  location had no form, even though `PATCH /sites/:id` already existed.

**Fix:**
- **Assets**: a real "Assets" table + create form on each site's page (`CreateAssetForm.tsx`),
  gated on `asset:manage`, with delete via the same shared `DeleteButton`. `CreateDeviceForm` also
  gained an optional "Asset" selector — the `assetId` field on a device finally has a way to
  actually get set.
- **Maintenance**: a new `/maintenance` page — open tasks, a create-task form, and completed tasks,
  each open task with a "Mark complete" control (with an optional completion note) and each
  completed one with "Reopen." Gated on `maintenance:manage` (the same permission the API requires
  for both reading and writing this domain — there's no separate read-only view). Added to the
  sidebar nav and, since this is the first page with real Server Actions in this exact spot, to
  `build-static.sh`'s swap list with its own read-only twin.
- **Rule editing**: `RuleForm` now accepts an optional `editingRule` prop — when set, it pre-fills
  from the existing rule and calls a new `updateRuleAction` (`PATCH /rules/:id`) instead of create.
  A new `extractSingleConditionFormValues` (the exact reverse of the existing
  `buildSingleConditionRule`) only succeeds for a rule the simple form can actually represent — one
  condition, one action, no constraints, keyed off a point reading. A rule outside that shape
  (hand-authored via the API, or genuinely multi-condition) shows "Not editable here" instead of
  silently mangling it into something it wasn't. `RulesSection.tsx` is the new coordinating client
  component that owns which rule (if any) is being edited, since one shared `RuleForm` instance
  sits below the table rather than one per row. One real gotcha caught by verifying against the
  live API rather than trusting the types: `UpdateRuleDto` doesn't accept `siteId` or `triggerType`
  at all (unlike create), and the API's `ValidationPipe` rejects any request carrying a property its
  DTO doesn't declare — `updateRuleAction` has to leave both out explicitly rather than forwarding
  the same shape `createRuleAction` sends.
- **Site editing**: `EditableSiteRow.tsx` replaces the plain `DataTable` row for Sites on the Admin
  page with an inline edit toggle (three fields need to change together behind one Save button,
  which doesn't fit `DataTable`'s one-column-at-a-time render model) — click Edit, the row becomes
  editable, Save calls a new `updateSiteAction`, Cancel discards.

**Verified against a real Postgres**: created and deleted a real asset; created a maintenance task
and marked it complete with a note, confirming both landed in `maintenance_tasks`; renamed a site
and confirmed the new name persisted; and — the one that actually needed this level of rigor —
sent the exact stripped-down payload `updateRuleAction` produces straight at `PATCH /rules/:id` and
confirmed a real seeded rule's name and condition value both changed and persisted, at `version` 2.
Also re-ran the full static-export build end-to-end against a real local API and confirmed all 18
pages, including the newly-swapped maintenance page, generate cleanly. Full `tsc`/`next build`
passes for both apps; no further API changes were needed beyond what this pass's own verification
required getting right in the web layer.

**How to extend further:** assets have no edit form of their own (only create/delete) — a real
gap once a pilot needs to rename one or move it between sites. The "not editable here" rules are
still fully manageable via approve/disable/delete, just not through this simple form — a real
multi-condition editor is a substantially bigger UI than anything built so far, worth its own pass
once a tenant actually has rules that need it.

## Still open

### Manual command targets are not filtered by role/site scope beyond permission

**Gap:** `ManualControlPanel` on the Automation page currently lists every write-capable point
across the whole tenant to anyone with `command:create`. For a single-tenant pilot this is fine;
for a multi-site deployment with per-site operators, an operator assigned to one site can
currently see (and command) every other site's actuators too.

**How to fix:** once user-to-site scoping exists (it doesn't yet — `Principal` only carries
`tenantId`, not a site list), filter the tenant-wide points list in
`apps/web/src/app/automation/page.tsx` to the caller's assigned sites before passing them to
`ManualControlPanel`.

## Verification notes

Everything marked "Fixed" above was verified against a real, running stack, not just read through:
`npm run typecheck`, `npm test` (all packages), a live local Postgres 16 instance with both
migrations applied, the compiled API and the Next.js app running together, and direct `curl`
checks against `/overview`, `/sites/:id`, and `POST /commands` (including confirming the
irrigation command was blocked before the safety fix, and dispatches successfully after it). The
static GitHub Pages export (`apps/web/scripts/build-static.sh`) was also rebuilt end-to-end to
confirm the new Manual Control UI degrades to a clear "requires a live deployment" message rather
than breaking the static build.

The MQTT bridge (`apps/edge-agent`) was verified the same way: a real local Mosquitto broker, the
existing simulator publishing to it, the new agent bridging to a real running API against real
Postgres, and confirmed fresh readings (not stale ones) landing in `telemetry_readings` on the
expected ~5-second cadence over several cycles.

Real authentication was verified with an actual headless browser (Playwright) driving the live
SSR app end-to-end: unauthenticated visit redirects to `/login`; a wrong password shows a real
error and does not log in; a correct password logs in, sets the session, and shows the real
logged-in user's name and role (not a hardcoded demo label); the Overview page renders real data
through the new session's bearer token; logging out clears the session and revisiting `/` redirects
back to `/login`. A second run confirmed a `viewer` account sees no Admin/Audit nav links and gets
a real 404 navigating to `/admin` directly by URL, not just a hidden link. The static export was
rebuilt end-to-end afterward to confirm the login/session code paths (which import a Server
Action, like the rule-management and manual-control work before it) don't break that build.

Provisioning CRUD was verified directly against real Postgres end-to-end: created a site, an
asset on it, a device on that asset (with position data), and a point on that device via the live
API; confirmed each landed correctly via `GET /sites/:id` and direct `psql` queries (including the
device's position inside `devices.metadata`); restarted the API process and confirmed the entire
chain survived; confirmed deleting a site with a device still attached is blocked (403); deleted
the point, device, and site in order and confirmed each delete actually took effect. That sequence
is what surfaced the `deleteSite` audit-ordering bug described above — it never showed up against
the unconfigured-database unit tests, only against a real foreign key.
