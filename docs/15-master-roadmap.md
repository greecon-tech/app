# Master Roadmap — Toward Production-Grade

This is the "what would it actually take" plan across everything the platform needs to stop being
a pilot demo and become a genuinely best-in-class operational platform: reliability, enterprise
readiness, AI-driven optimization, and product polish. It supersedes the narrower scope of
`docs/13-pilot-readiness.md` (which stays as the detailed gap/how-to log for day-to-day work) by
giving that work a sequence and a destination.

**Sequencing principle:** each phase is a real prerequisite for the one after it, not just a
priority label. Security/auth has to exist before "enterprise-grade" means anything. Reliability
has to exist before AI optimization has trustworthy data to learn from. Polish is worth investing
in once the thing underneath it is stable, not before.

## Phase 0 — Foundational security (do this first, everything else depends on it)

The single biggest structural gap in the platform today: **there is no real authentication.**
`apps/web/src/app/login/page.tsx` is a static form with no submit handler. Every request's role
comes from a header (`x-user-role`) that any caller can set to anything, or from a single
build-time `GREECON_DEMO_ROLE` env var for the whole deployment. This was an acceptable MVP
shortcut while the API stayed off the public internet — but it means there is currently no concept
of "this specific person did this specific thing," which undermines the audit trail the platform
already goes to real effort to maintain everywhere else (every command, rule change, and alert
acknowledgement records `requestedBy`/`userId` — from a header no one actually authenticated with).

This phase has landed — see `docs/07-security-and-rbac.md` for the resulting design, and the "Real
authentication" entry in `docs/13-pilot-readiness.md` for status.

Also in this phase, now done:
- **Per-user audit identity** — every audit event, command, and rule change traces to a real
  logged-in user (`requestedBy`/`userId` come from the verified JWT, never an asserted header).
- **Invite / reset flow** — `POST /users` (Admin page) creates a new account with a real generated
  temporary password; `POST /users/:userId/reset-password` resets an existing one the same way.
  Still not *self-service* — that needs a real email-sending integration this deployment doesn't
  have, so an admin does it on the user's behalf for now.
- **Rate limiting on `/auth/login`** — 8 attempts/minute per caller via `@nestjs/throttler`
  (in-memory; revisit with Redis only once there's more than one API replica).

What's still open from this phase: every seeded *demo* account still shares one password
(`003_auth.sql`) — fine for the demo tenant, not something to carry into a real client's account.

## Phase 1 — Pilot reliability

Everything already tracked in `docs/13-pilot-readiness.md`'s "Still open" section belongs here.
Done so far: site/device/point provisioning CRUD, a real Modbus TCP driver
(`apps/edge-driver-modbus`), per-site safety limits, maintenance task mutation endpoints, and a
real Admin Center (create/manage users with real temporary passwords, create sites) — all
API-level changes verified against real Postgres/MQTT; see `docs/13-pilot-readiness.md` for
details. There's still no admin UI for device/asset/point provisioning or safety-limit
configuration specifically. What's left:

- OPC-UA, Modbus RTU (serial), and analog (4-20mA via a Modbus I/O module) drivers — only Modbus
  TCP exists so far.
- Edge-to-cloud network reachability for a genuinely remote site (WireGuard/Tailscale tunnel,
  documented in `docs/14-edge-hardware-deployment.md`) — this is an operational/infra step, not
  code, but still needs doing per site before it's actually reachable.
- ~~Durable edge-side buffering~~ — done 2026-10-13: an on-disk, bounded, ordered buffer in
  `apps/edge-agent` (`docs/14-edge-hardware-deployment.md`). Batching many readings per request is
  the next step if a site outgrows one request per device per poll.
- Manual command targets aren't filtered by role/site scope beyond permission — fine for a
  single-site pilot, matters once there are multiple sites with different assigned operators.

A platform is not "reliable" until a real site can run unattended for weeks without an engineer
watching logs. That's the bar for calling this phase done, not "the demo works."

## Phase 2 — Enterprise readiness

What separates "runs your own pilot" from "a utility or agribusiness enterprise can actually buy
and deploy this":

- **Real device identity for machine traffic.** Once Phase 0's user auth exists, the same problem
  remains for gateways: `apps/edge-agent` currently authenticates to the API with the same
  role-header trust model. A provisioned device should carry its own credential (a per-gateway
  signed token or mTLS client certificate, checked against a table of registered gateways) so
  compromising one site's edge box doesn't grant broader access than that site.
- **Tenant-level administration — onboarding done, billing still open.** There was one hardcoded
  demo tenant and no way to create another; now `POST /platform-admin/tenants` (gated on a new
  cross-tenant `isPlatformAdmin` flag, separate from any tenant-scoped role — see
  `docs/07-security-and-rbac.md`) onboards a real client with its own isolated owner account in
  one step, and `/platform` in the web app is a real screen for it, only visible to Greecon's own
  platform administrators. A client can also be suspended/reactivated from that same screen, and
  suspension is actually enforced — blocked at login and on every request from an
  already-issued token (`TenantStatusGuard`), not just a status label with nothing behind it. See
  `docs/13-pilot-readiness.md` for the full writeup. Billing status/plan per client is still not
  modeled at all — that's the remaining piece here.
- **Formal audit/compliance posture.** The audit log itself is solid (immutable event trail,
  already dual-written to Postgres). What's missing for a compliance-conscious buyer: retention
  policy, log export in a standard format, and a documented data-handling policy (where telemetry
  lives, how long, who can see it) — mostly a documentation and configuration exercise once the
  underlying audit mechanism (already built) is trustworthy.
- **Secrets management for production.** `docs/07-security-and-rbac.md` already establishes
  secrets belong in Google Secret Manager, not source control — Phase 0 adds `JWT_SECRET` to that
  same discipline. Verify this is actually wired into the GCP/Railway deployment paths, not just
  documented.
- **SLA-grade observability.** Structured logging and metrics/alerting on the API and edge-agent
  themselves (not just the domain data they carry) — right now, if the API process crashes at 3am,
  nothing pages anyone. This is infrastructure work (e.g. a hosted metrics/alerting service), not
  application code, and should be scoped once there's a real pilot to protect.

## Phase 3 — AI-driven optimization

The GAIA rules engine today is threshold-based: a condition crosses a fixed value, an action
fires, evaluated in strict priority order (Safety > Asset Protection > Compliance > Optimization >
Efficiency > Advisory). That hierarchy is the right foundation to build on — it should not change.
What's missing is the "AI" layer on top of that foundation:

- **Forecasting inputs.** Weather/irrigation-demand forecasting feeding the `optimization`/
  `efficiency` tier rules (the "Advisory: reduce irrigation if rain forecast placeholder is true"
  seed rule is exactly this, waiting for a real forecast source). This is the lowest-risk, highest
  near-term-value AI addition: it only ever influences advisory/optimization-tier decisions, never
  safety, so it can be introduced without touching the hard-interlock logic in `packages/gaia-core`
  at all.
- **Adaptive thresholds.** Instead of one fixed `irrigate_below: 28` for every site, learn a
  site-specific baseline from its own historical telemetry (now that `telemetry_readings` actually
  persists full history — see the persistence work already done). This is a model that *proposes*
  a threshold for a human to approve through the existing rule-approval workflow, not one that
  silently changes safety-relevant behavior — keep the human-in-the-loop approval gate that
  `rule_approvals` already provides.
- **Anomaly detection on derived states**, surfaced as alerts rather than automated actions
  initially — lower risk than closed-loop automation, and it directly improves the "advisory" tier
  the priority hierarchy already reserves for exactly this kind of recommendation.

Every item here should land as an **advisory or optimization-tier** contribution first, go through
the same rule-approval and audit pipeline every other rule does, and only be considered for a
higher priority tier after a real pilot has built confidence in it. This is not a place to move
fast — a bad automated irrigation decision costs a farmer a real season.

## Phase 4 — Product polish

Once the phases above are real, the UI is worth investing real design effort in — not before,
since polish on top of fake data and no real login would be polish in the wrong place:

- **Onboarding.** A first-run flow for a new tenant/site, not just seed data.
- **Mobile-first operator views.** A farmer standing at a valve manifold needs Manual Control to
  work well on a phone, not just a desktop dashboard.
- **Real-time updates without a page refresh.** Every page today re-fetches on navigation; a
  WebSocket or SSE channel for live telemetry/alert updates would match what an operator actually
  expects from a monitoring product.
- **Design system depth.** The current brand system (`docs/06-frontend-design-system.md`) is solid
  and should be kept exactly as-is — Greecon's visual identity is not part of what needs rebuilding
  here. What's worth adding is breadth: empty states, loading states, and error states that are
  currently minimal-to-absent across most pages.

## What "keep the brand" means in this plan

None of the above touches Greecon's visual identity, name, or positioning — the IBM Plex Serif
type system, the brand palette, and the Greecon/GAIA naming stay exactly as documented in
`docs/06-frontend-design-system.md` and the GAIA architecture docs. "Rebuild it clean" here means
the engineering underneath gets hardened to match the ambition already implied by the brand — not
that the brand itself changes.
