# 24. Architecture and seams

Status: written 2026-10-18 from `docs/research/09-architecture.md` and the other eight reports.
Thresholds and triggers marked "proposal" are reasoned, not measured: the open questions at the end
need a prototype, a benchmark or an expert. The decisions are recorded one page each in
`docs/adr/`.

The brief was to build only what is proven and to leave room for what might be. This document is the
second half: for each thing that might be needed, the smallest extension point that exists (or should)
and the evidence that would justify building on it. `docs/01-architecture.md` still describes the
parts; this says how they are meant to grow.

## 1. What exists today

```
equipment --Modbus (read-only)--> edge driver --> MQTT on the box (loopback only)
   --> edge agent (durable ordered buffer) --HTTPS + per-gateway secret--> API ingest
API: validate (tenant, site, time) --> latest value per point, history to Postgres
   --> GAIA core (pure): freshness, derived states, alerts, health, command checks
   --> overview, sites, alerts: health and status computed at read time
web: live pages rendered per request; the same pages as a static demo (GitHub Pages)
```

- **`packages/shared`**: contracts. The 16 canonical readings, roles and permissions, message
  formats, the four health states and their words, the limits a site can set.
- **`packages/gaia-core`**: pure functions with no clock, database or network: how old a reading is,
  which states are true, which alerts should exist, what a site's health is, whether a command is
  allowed. Everything the screens say about truth is computed here and tested here (`docs/18`). It is
  internal; the browser bundle never includes it.
- **`apps/api`** (NestJS): an in-memory working set with write-through to Postgres, hydrated at
  start-up, one replica, a once-a-minute monitor that re-derives every site against the clock, and an
  in-memory request limiter.
- **`apps/edge-agent`, `edge-simulator`**: the box's software (`edge-agent` is the whole program on a site; `edge-simulator` is for development).
- **`apps/web`** (Next.js): server-rendered pages and a static twin for the demo.

Structural rules that keep it simple: one narrow waist (the closed vocabulary); truth is computed in
one place and shown, never re-derived in the web layer; contracts live in `shared` so the API and the
web cannot drift; the box keeps working when the internet does not; storage and delivery sit behind
interfaces so an engine can change without touching what is above.

## 2. The master register of seams

A seam is a place the design leaves room: a field, an interface, a table, a naming rule. It is not a
feature. Each row names what to build on, and the evidence that would prove the need. Nothing in the
last column has happened yet. (Sources: the report named in brackets.)

| Seam | Extension point | Proof trigger |
|---|---|---|
| Customer-defined reading kinds | A registry row `x.<tenant>.<slug>` with unit, range and required metadata; monitored and advisory only, never feeding hard rules [architecture A] | Three paying sites ask for a kind outside the 16 in a quarter; promote when three tenants use one for 90 days |
| Second time-series engine (TimescaleDB, ClickHouse) | A `SeriesStore` interface (ingest, latest, range at resolution, rollup, drop, export) with one shared contract test suite [architecture C] | A scale threshold in section 4 fires |
| Database-enforced tenant isolation | Mandatory `TenantScope` on every repository method now; row-level security on low-volume tables later [architecture F, security F] | The database becomes a read path for tenant data, an audit asks for it, or an isolation test finds a leak |
| Device certificates and hardware keys | `GatewayCredential{secret or mtls}` [security E] | Customer demand, a stolen secret, hardware with a secure chip, or unguarded sites |
| Edge-evaluated operating limits | A signed, versioned policy bundle sharing the cloud guard's schema [security B] | The first request for a real write, or a loss of communications that mattered |
| First real write | A command envelope with expiry, idempotency and lease, used even while simulated; the `live` execution mode [security B] | The release gate in `docs/23` is met |
| Signed updates and image updates | An `UpdateChannel`; later whole-image A/B with automatic rollback [architecture D, security E] | The first hardware shipment, more than 20 hard-to-reach devices, or 11 December 2027 |
| Maintenance and lock-out flag | A per-asset flag, set by a person, checked before any command [energy F5] | Required before the first remote command |
| Notification channels and escalation | A channel adapter (push, SMS, messaging apps, voice) and a per-person escalation policy [design E, communication C] | Now: delivery is the largest open gap (`docs/18`) |
| Viber and voice | A further channel adapter [communication C4] | Users say it is the channel they read first |
| Sparkplug B adapter | An adapter on demand [architecture B] | A signed customer already running Sparkplug nodes or a SCADA host |
| Webhooks | Signed, at-least-once, deduplicated delivery [architecture H] | The first customer asks (otherwise they poll) |
| Parquet export | A format beside CSV and JSON [architecture H] | A customer or auditor needs more than a million rows or analytics tools |
| Single sign-on and SCIM | An `AuthProvider` with identity-provider-shaped claims [architecture J] | A utility or large customer's security review asks |
| Regional hosting | A data-location setting per tenant [legal K] | The first EU customer or tender |
| Audit anchoring and export | Daily anchoring of the audit hash head outside the database; streaming to a customer's monitoring system [security F, legal K] | A regulated customer asks |
| Richer rule language | Bounded expression subset behind the rule templates [architecture E] | One signed customer rule that templates cannot express, plus three similar requests |
| Rule shadow mode | A `shadow` flag on every ruleset version [architecture E] | Before any automatic action beyond advice |
| Lab-result register, operating records, aeration readings | Record types; three proposed readings [water H] | Built first for the hotel beachhead (`docs/25`) |
| Online water-quality probes | Registry entries [water H] | A permit or customer with a membrane plant or reuse requires them |
| Reuse-class records | A class field and plan document [water H] | Albania adopts reuse classes or a permit requires them |
| Per-zone configuration and sensor metadata | Zone profile and depth, calibration, soil [agriculture B3] | Built first for the farmer segment, after the hotel beachhead |
| ET-based irrigation advice | Derived crop water use per zone beside the sensor [agriculture H] | Farmers with few sensors, or disagreement between ET and soil trends logged over a season |
| Fertigation, per-zone valves, greenhouse climate | Read-only points first; a write adapter behind approval [agriculture H] | A pilot with an agronomist and hard interlocks |
| Energy counters and KPIs; inverter profiles | A per-device profile (scale, sign, word order, address base), protocol-neutral driver interface [energy C, H] | The first pilot site with a solar plant |
| Setpoint write path to inverters | An allow-listed register map per profile, lease, approval, vendor approval record [energy F] | Repeated customer requests, written vendor approval and operator consent |
| Peer comparison, soiling reminder, per-input diagnostics | Normalised-yield series, dry-spell counter, per-input points stored from day one [energy E] | Pilot evidence listed in `docs/19` |
| Tariff-aware dispatch, peak shaving, net-billing settlement | Tariff and settlement tables as data [energy D, G] | Real bills show a time-varying or demand charge; the regulator publishes the formula |
| Forecast layer | A provider interface with licence-aware adapters [energy D] | A decision that hinges on a forecast; settle the data licence first |
| Alert-health tooling | Rate per site per day, floods, chatter, priority mix [design B] | Alert load per site passes the budget |
| Outdoor and night modes; native shell | Theme tokens; a thin native wrapper [design E] | Field legibility or push reliability fails on real phones |
| Albanian-language interface and a third language | Locale packs and whole-sentence templates [communication B] | Built before the first Albanian customer ships |
| Two-person approvals, time-limited elevated access | Approval records on commands [design D, security B] | The first real actuator pilot |
| Certification and standards | An IEC 62443-4-1 gap assessment; ISO/IEC 27001 [security D, legal K] | A procurement requirement |
| Cyber Resilience Act pipeline | Bill of materials, reporting hook, technical file, declaration [legal K] | The first EU hardware sale (reporting is already live) |
| Integrator and multi-client hierarchy; marketplace | A tenant hierarchy [design G, market H] | Three integrators ask and pay, after 20 sites |
| Digital twin, AI optimisation, carbon accounting | None; deliberately not built [market H] | Triggers in `docs/25` |

## 3. Data: ingest, storage, retention

**Ingest (proposals, to prove at 1 to 500 sites).** Deduplicate on `(gatewayId, batchSeq)` at the
transport and on a unique `(series, time)` per row, first write wins, with a changed value for an
existing key counted and alerted. Store the measurement time, the receive time and a clock state; a
skew over 60 seconds marks a reading uncertain, and one more than five minutes ahead is rejected (done
for ahead-of-clock readings). Late data after an outage is flagged historical when it is older than
twice its limit, and no cloud rule acts on historical samples. A batch is at most 500 records or 5
seconds, compressed, with an explicit size limit. The message bus stays on the box; HTTPS crosses the
internet; Sparkplug B is not worth adopting (its data messages are best-effort by specification,
while the agent has a durable buffer and point-to-point acknowledgements).

**Storage.** Plain PostgreSQL with weekly partitions, our own rollups, behind `SeriesStore`.
TimescaleDB's advanced features sit under a licence that allows use inside Greecon's own service only
if customers are barred from changing the schema, forbids offering a database service, and needs the
vendor's consent on a sale; the vendor's own benchmark shows near-identical ingest to plain Postgres.
Do not adopt it before a threshold below fires. Keep storage a narrow table (series, time, value,
quality) so a new kind never needs a schema change.

**Size, from an estimate that must be validated.** About 84 bytes per row including its index.
10,000 series at 10 seconds is about 2.6 terabytes a year raw, against a self-serve disk of 1 terabyte
on the current host, so tiered retention is mandatory:

| Tier | Keep | Note |
|---|---|---|
| On the box | About three days for a site of up to about thirteen devices (the buffer holds 60,000 messages; a larger site keeps fewer days: size it) | Native rate while the platform answers; one reading per point per minute while it waits |
| Raw in the cloud | 30 days, at 60 seconds by default; 10 seconds only for control-relevant points | 1 second stays on the box except around an incident |
| Five-minute rollup | 13 months | min, max, average, last, count, good count |
| Hourly rollup | 10 years | |
| Daily rollup, events, "because" records | Indefinitely | |
| Evidence windows | One hour either side of an alert or command, 13 months or the legal minimum | |

Never average readings that are not good; keep the good count. Legal retention minimums for effluent
and energy records override these and are not yet known.

## 4. Growth stages

Triggers are proposals. Load model: 20 series a site, one batch per site every 10 seconds.

| Stage | What changes | Move on when |
|---|---|---|
| 1 site (today) | Nothing in the topology; do the day-one list | A restore drill has passed; start-up time and memory recorded |
| 10 sites | Weekly partitions, an in-process rollup job, an outbox table for notifications, point-in-time recovery | Start-up above 30 s, memory above 60%, a deploy gap above 60 s, or ingest p95 above 300 ms over a day |
| 100 sites | Two or more replicas; Postgres becomes the read path (the in-memory set shrinks to a latest-value cache); shared limiter and idempotency state; row-level security; pooling | Database CPU above 70% for an hour, disk above 60%, ingest p95 above 300 ms, a seven-day read above 1 s |
| 1,000 sites | Ingest split from the API; a read replica; an engine decision by the thresholds; quotas; on-call and a public status page | Out of scope |

**Do not do early:** Kafka or any stream platform; a database per tenant; Kubernetes; microservices
before 1,000 sites; active-active regions; a read replica before a measured read problem; a second
time-series engine; a rule scripting language.

## 5. The box

It runs from the last signed, known-good rule set and keeps working with the internet cut. Per
actuator a declared fail state and a maximum autonomous time (an engineer's question). Loss of the
internet alone triggers nothing; the triggers are local: a stale or bad reading, a local bus fault,
a command's expiry on a monotonic clock. A watchdog restarts the agent, and three reboots in an hour
boot it monitor-only. Updates: a signed package pinned by digest, the previous one kept, automatic
rollback after a failed health check, staged 1%, 10%, 100%, never during a command. Time from a
network time service that authenticates, with a clock state stamped on data. No inbound port: support
sessions are time-boxed, customer-approved and logged. Edge versus cloud: acquisition, quality,
GAIA, arbitration, fail states, the buffer and the watchdog on the box; storage, rollups, screens,
notifications, rule authoring and fleet orchestration in the cloud. **The cloud is never on an
actuator's control path within its process safety time.**

## 6. Rules

Today GAIA is a set of tested pure functions and simulated rule evaluation. The target, when
automatic actions are on the roadmap: a pure `evaluate(ruleset@version, snapshot, now)` returning
requests and a "because" record, with no input or output, no randomness, time as an input, fixed
order, no loops and a small bounded expression subset. Rule sets are immutable and versioned with a
hash, activation is a logged event and rollback re-activates the previous one. Every new version
starts in **shadow**: it evaluates, stores what it would have requested and never acts, until a week
and a full process cycle have been reviewed against what people did. One writer per actuator: rules
emit requests with a priority class to an arbiter (1 local or manual override, 2 operating limits, 3
held trip, 4 approved schedule or command, 5 advice). Stale, bad and unknown are explicit branches,
never zero. No user scripting, no rule writing an output directly, no silently dropped overlapping
triggers. A "because" record holds the rule set hash, the inputs with age and quality (copied in so
raw samples can expire), the result, whether it executed, what blocked it, and the approval.

## 7. Contracts

`/v1` in the path; additive changes are non-breaking; a breaking change is `/v2` in parallel with 12
months' notice and `Deprecation` and `Sunset` headers. One OpenAPI document as the source of truth,
checked against real responses in the build. Errors as RFC 9457 problem documents with stable types.
Opaque cursors for time series, never offsets; bulk reads are exports. An `Idempotency-Key` is
required on command requests, stored for the command's life plus a day, and the command id is what the
box deduplicates on. The box protocol carries a version and never drops fields: a device sold in year
Y must work to Y plus five. Export: CSV with a stated dialect (UTF-8, comma, ISO 8601 in UTC, dot
decimal, a quality column), JSON Lines with API field names, and a manifest with schema version, range,
units and a checksum; Parquet on demand.

## 8. Watching the watcher

A monitoring platform that fails silently is worse than none. Layers: the gateway heartbeat and the
server's scheduled watchdog (`docs/23`), plus an external layer: a job pings an independent
heartbeat service every minute and an outside probe checks the public health address, both alerting
through a channel the platform's own notifier does not use. Three service-level objectives to start:
**data freshness** (control-relevant series younger than twice their interval plus 30 seconds, 99% over
30 days), **alert latency** (sample to notification accepted, 95th percentile under 2 minutes, with an
hourly synthetic alert), **command round trip** (95th percentile under 10 seconds with the box online).
Page only on a burn of freshness or latency; everything else is a ticket; at most two pages a week.
Measure first: heartbeat age; accepted, duplicate, conflicting and rejected ingest counts; ingest
latency; oldest notification in the outbox; database connections, CPU, disk and autovacuum lag;
memory, event-loop lag and start-up time; rollup lag; backup age and last restore drill.

## 9. Build or buy

| Need | Default | Lock-in | Note |
|---|---|---|---|
| Identity | Own sessions and strong password hashing behind an `AuthProvider` seam | Low now | Self-host any identity provider in the EU when single sign-on is asked for |
| E-mail, push | An EU transactional provider behind an interface; web push standards | Low | List as sub-processor |
| SMS | A last-resort channel behind an interface; a two-provider delivery test to Albanian operators | Low to medium (sender id) | No personal data in the text |
| Object storage | Any S3-compatible provider in the EU (exports, backups, update bundles) | Low | Egress cost matters for exports |
| Time series | Plain PostgreSQL | None | See section 3 |
| Queue | A Postgres outbox, then pg-boss | Low | Redis is not a hard dependency (its licence changed) |
| Error tracking | A hosted service with an EU data location and PII scrubbing | Low | |
| Status page and heartbeat | Static page and a heartbeat service on a different provider from the API | Low | Must not share the API's failure domain |
| Hosting | Railway, one EU region (Amsterdam) | Low if standard only | Albania is outside the EU; hosting in the Netherlands keeps data in the EU |

## 10. The decisions

`docs/adr/` holds one page per decision. Four are in force and implemented; fourteen are proposed
from the research and wait for review.

| # | Decision | Status |
|---|---|---|
| 0001 | Status is computed from evidence, never typed | Accepted, implemented |
| 0002 | Stopping is never blocked by a process condition | Accepted, implemented |
| 0003 | Limits belong to the site; the platform has no universal constants | Accepted, implemented |
| 0004 | Every command is simulated until the release gate is met | Accepted, implemented |
| 0005 | Vocabulary and units | Proposed |
| 0006 | Ingest idempotency and time | Proposed |
| 0007 | Transport: bus on the box only, HTTPS across the internet | Proposed |
| 0008 | Storage engine and the `SeriesStore` seam | Proposed |
| 0009 | Retention tiers | Proposed |
| 0010 | Rule evaluation: versioned, pure, bounded | Proposed |
| 0011 | Shadow mode and "because" records | Proposed |
| 0012 | Actuator arbitration | Proposed |
| 0013 | Edge safety: the box owns fail states | Proposed |
| 0014 | Updates: signed with rollback now, image updates later | Proposed |
| 0015 | Tenant isolation: `TenantScope` and tests now, row-level security later | Proposed |
| 0016 | API contract and versioning | Proposed |
| 0017 | Observability: an external dead-man's switch and three objectives | Proposed |
| 0018 | Build-or-buy defaults | Proposed |

## 11. Open questions that need a prototype, a benchmark or a person

1. The ceiling of plain PostgreSQL for 1,000-row batches with the unique index and partition upkeep on
   the real host.
2. One week of real data: bytes per row, rollup sizes, compression, against the 84-byte estimate.
3. Counsel: whether Greecon meets the "value-added product" test of the Timescale licence and the
   sale-consent clause, if it is ever adopted.
4. A metrologist or water chemist: can standard unit codes express procedure-defined units (turbidity
   in NTU or FNU, colony counts), or is a method field needed?
5. SMS delivery and sender-id rules to Albanian operators with two providers.
6. The gateway board, a battery-backed clock, a watchdog timeout and storage grade for a ten-year
   horizon.
7. An engineer, per actuator: the declared fail state and the maximum autonomous time.
8. Start-up time and memory of the in-memory working set at 10, 100 and 1,000 synthetic sites.
9. A restore drill on the host's point-in-time recovery, compared with the targets in `docs/23`.
10. Legal retention minimums for effluent and energy records.
11. Whether seven days of shadow covers a full process cycle at each kind of site.
