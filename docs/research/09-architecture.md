# 09 - Architecture and Data: seams, thresholds and proof triggers (Greecon)

> **Desk research, October 2026. Not reviewed by a licensed expert, and not legal, engineering, agronomic or safety advice.**
> Written from public sources on the dates inside. Facts are separated from inferences in the text, and
> anything marked UNVERIFIED, recalled or "search summary" was not confirmed from a primary source. File
> names such as `src/law124.txt` refer to the researcher's working folder, not to this repository. The
> decision-ready summary of all nine reports is `docs/17-constitution.md` to `docs/26-research-register.md`.

Researcher: ARCHITECTURE and DATA | Sources accessed 2026-10-18 | 60 sources (section N)

Conventions: FACT = cited [n]; INFERENCE = my reasoning; OPEN = needs a prototype, benchmark or expert; [UNVERIFIED] = recalled, not read. 01 to 05 are the sibling reports [60].

## A. Semantic model and vocabulary

| Model | FACT | For Greecon |
|---|---|---|
| Project Haystack | Tags for "the entire value chain of building systems"; defs "bind a symbolic name to a formal definition", ship "as a library" with a `lib` tag; unit database; AFL 3.0 [2] | TAKE the mechanism: a definition is data, a library namespaces it. LEAVE the HVAC taxonomy |
| Brick | "an extensible dictionary of terms" for buildings; BSD-style licence [3]; RDF graph [UNVERIFIED] | LEAVE: building-centric, heavy tooling |
| SAREF | 15 SAREF4* extensions incl. AGRI, ENER, ENVI, WATR [4] | Export mapping only |
| OGC SensorThings 1.1 | `unitOfMeasurement` = name, symbol, URI that "SHOULD follow ... UCUM"; Observation has `phenomenonTime` and `resultTime`; clockless devices "may omit phenomenonTime" [1] | TAKE the observation field model (02 F2) |
| OPC UA | Part 8 maps UN/CEFACT and IEC 62720 units [5] | Southbound adapter only |
| UCUM | "a code system intended to include all units of measures being contemporarily used in international science, engineering, and business" [6] | TAKE as the unit code |

SunSpec stays inside the Modbus driver (01 C2).

**Design (INFERENCE, with 02 F3 and 03 B3)**
1. Core closed, in code: 16 names, each with quantity kind, one canonical UCUM unit, value type, plausible range, maximum rate of change, `safetyEligible`. Names and units never change; additions only.
2. Extensions are rows, not releases: key `x.<tenant>.<slug>` (a namespace like a Haystack `lib`), validated at insert for quantity kind (small closed list), UCUM unit, range and a `requiredMetadata` schema, e.g. `depth_cm` plus calibration {date, method, curve} for soil probes (03 B3), method and detection limit for lab values (02 F1); NTU versus FNU keeps the method beside the unit (02 F3). Missing metadata stores UNCERTAIN, never drops.
3. Safety firewall: extension kinds are monitor and advisory only; GAIA hard limits and interlocks accept canonical names only; promotion needs a release with test vectors. Storage stays one narrow table (series, ts, value, quality), so a new kind never needs DDL (this keeps TimescaleDB licence-clean, section C).

**Proof trigger (proposal):** build the registry UI when 3 paying sites ask for a kind outside the 16 within a quarter or one signed commissioning is blocked; promote when 3 tenants use the same kind and unit for 90 days. OPEN: method inside the unit code or beside it?

## B. Ingestion pipeline

**FACT**
- MQTT 5.0: QoS 0 "At most once", 1 "At least once", 2 "Exactly once"; "By default, a Server MUST treat every Topic as an Ordered Topic" [7]. Sparkplug 3.0: NBIRTH, NDATA, NCMD "MUST be published with MQTT QoS equal to 0 and retain equal to false"; `is_historical=false` metrics stay chronological (history is a flagged exception); edge nodes "MUST be able to respond to 'rebirth requests'" [8].
- A unique key on a partitioned table must include the partition key because indexes "can only directly enforce uniqueness within their own partitions" [9]; COPY and fewer indexes are the bulk-load levers [13]. Idempotency-Key can make "POST or PATCH fault-tolerant" but is a draft (-07, expiry date 18 Apr 2026) [10].
- Defaults: Express JSON '100kb', Fastify 1048576 bytes [11]; Railway 10,000 concurrent connections, "11,000~ RPS" per domain [12].

**Design (INFERENCE)**

| Concern | Proposal |
|---|---|
| Dedupe | Transport: `(gatewayId, batchSeq)`; the server keeps `lastAppliedSeq`: at or below it returns 200 "duplicate", last+1 applies, higher returns 409 and the agent resends from last+1. Row: unique `(series_id, ts)` with `ON CONFLICT DO NOTHING` (legal, ts is the partition key [9]); a different value for an existing key is counted and alerts, first write wins |
| Identity, order | `series_id` resolved server-side; the payload never carries a tenant ID (04 E). FIFO per gateway by `batchSeq` (advisory lock), parallel across gateways; readers order by `ts`, since MQTT order holds only per topic and QoS [7] |
| Clock, late data | Store `ts`, `received_at`, `clockState`; skew over 60 s marks UNCERTAIN; reject ts beyond now + 5 min; liveness uses server time (04 C). `historical=true` when received_at minus ts exceeds 2 x maxAge; cloud rules never act on historical samples [8]; rollups recompute dirty buckets |
| Backfill, batching | One ordered lane, up to 10 batches/s of at most 500 records: 24 h at 1 s x 20 series = 1.7 M records (168 MB) = about 3 min; add a live lane only if catch-up exceeds 10 min. Batch at most 500 records or 5 s, gzip, explicit 256 KB limit (1,000 x 97-byte records = 97 KB, just under the Express default [11]); multi-row insert, or COPY to a temp table then insert-select (COPY has no ON CONFLICT) [13] |
| MQTT, Sparkplug B | MQTT on the LAN only (loopback broker, 04 E), HTTPS over the WAN; commands and acks QoS 1 with idempotent IDs, since duplicates are normal at QoS 1 [7]. Sparkplug is not worth adopting for ingest: data is QoS 0 by rule and gap repair needs rebirth requests [8], while the agent has a durable buffer and point-to-point acks. Adapter on demand; trigger: a signed customer already running Sparkplug nodes or a SCADA host |

**Scale.** 500 sites x 1 batch per 10 s = 50 requests/s, 0.5% of Railway's per-domain figure [12]; 1,000 rows/s at 10,000 series x 10 s (section C). No verified plain-PostgreSQL ceiling was found; the vendor's own PG 14 versus TimescaleDB 2.7.2 test shows near-identical ingest [19]. OPEN: benchmark 1,000-row batches with the unique index on the target instance (M).

## C. Time-series storage

**Options (FACT)**

| Option | Licence and features | Verdict |
|---|---|---|
| PostgreSQL 18 | PostgreSQL License, "a liberal Open Source license" [14]. "Dropping an individual partition ... is far faster than a bulk operation" and avoids "the VACUUM overhead caused by a bulk DELETE" [9]; BRIN suits "very large tables" whose columns correlate with physical location [14] | DEFAULT |
| TimescaleDB | Apache 2.0 outside the `tsl` directory, Timescale License (TSL) inside [15]. Apache edition: hypertables, `create_hypertable`, `drop_chunks`; Community only: continuous aggregates, `add_retention_policy`, jobs, columnstore [17]. TSL bars database-as-a-service and any service in which its software "is offered or made available to third parties to provide time-series database functions or operations", except inside "Value Added Products or Services" that are not "primarily database storage", add "substantial value of a different nature" and bar users "contractually or technically" from DDL; assignment "in connection with a merger or acquisition" needs Timescale's consent in its "sole and absolute discretion" (7.6) [15]. Vendor: "as long as you are not offering TimescaleDB as a hosted Database-as-a-Service, you can use all Community features for free" [16] | Allowed inside Greecon's own SaaS if the DDL bar holds; not for customer SQL or schema access; M&A consent is a diligence item (05 H). Not needed yet |
| ClickHouse, QuestDB, InfluxDB 3 Core, VictoriaMetrics | Apache 2.0; Apache 2.0; MIT OR Apache-2.0; Apache 2.0 [23]. ClickHouse: "batches of at least 1,000 rows, and ideally between 10,000-100,000 rows" [21]. QuestDB: `DEDUP UPSERT KEYS` keeps one row per key [22] | Second system, later, analytics only |

**Benchmarks (vendor unless stated).** PG 14.4 versus TimescaleDB 2.7.2: ingest "nearly identical", Timescale "3,000 to 4,000 rows/second higher" [19]. About 1 billion rows versus Amazon RDS: "up to 44% higher ingest rates, queries running up to 350x faster, and a 95% smaller data footprint" (159 GB to 8.6 GB) [18]. Independent SciTS compares ingestion "as they grow larger in size" (abstract read only) [20]. The one vendor-neutral threshold: partitioning pays when "the size of the table should exceed the physical memory of the database server" [9].

**Size estimate.** Heap row: 23-byte header [14] padded to 24 + 22 data bytes (ts 8, value 8, series_id 4, quality 2) aligned to 48, + 4-byte line pointer [14] = 52 B (157 rows per page). Unique btree (series_id, ts): 24-byte entry + 4-byte pointer at default fillfactor 90 [14] = 31 B (entry layout recalled, UNVERIFIED). Total about 84 B/row; heap-only 53 B. No WAL, backups or bloat.

| Series | Interval | Rows/s | Rows/day | GB/day | GB/year at 84 B | at 53 B |
|---|---|---|---|---|---|---|
| 1,000 | 1 s | 1,000 | 86.4 M | 7.3 | 2,649 | 1,671 |
| 1,000 | 10 s | 100 | 8.6 M | 0.73 | 265 | 167 |
| 1,000 | 60 s | 17 | 1.4 M | 0.12 | 44 | 28 |
| 10,000 (500 sites x 20) | 1 s | 10,000 | 864 M | 72.6 | 26,490 | 16,714 |
| 10,000 | 10 s | 1,000 | 86.4 M | 7.3 | 2,649 | 1,671 |
| 10,000 | 60 s | 167 | 14.4 M | 1.2 | 442 | 279 |

**Thresholds where plain PostgreSQL stops being enough (INFERENCE; validate in M).** (1) Disk: Railway Pro volumes self-serve to 1 TB [24]; 10,000 series at 10 s raw is 2.6 TB/year, so the retention policy is mandatory. (2) p95 above 1 s for a 7-day, 5-minute read of one series after pruning and rollups. (3) p95 batch commit above 500 ms at steady load, or autovacuum and WAL not recovering within 1 h. (4) More than about 3 engineer-hours a month on partition and rollup jobs. If (2) or (4) fires: TimescaleDB Community in place after the licence check; ClickHouse only for scans beyond 1 TB, as a second system.

**Retention (INFERENCE; legal minimums in 02 B2 override)**

| Tier | Content | Keep | Size at 10,000 series |
|---|---|---|---|
| Edge ring buffer | native 1-10 s | at least 72 h (04 F) | 50 MB (10 s) to 503 MB (1 s) per 20-series site |
| Raw | 60 s default; 10 s only for control-relevant points; 1 s stays at the edge except incident windows | 30 days | 36 GB at 60 s, +18 GB if 1,000 series run at 10 s |
| 5-minute rollup | min, max, avg, last, count, good_count | 13 months | about 114 GB at 100 B/row |
| Hourly rollup | same | 10 years | 8.8 GB/year |
| Daily rollup, events, because-records | same | indefinitely | 0.4 GB/year |
| Evidence windows | raw 1 h either side of an alarm or command | 13 months or legal minimum | small |

Roll up closed windows with a watermark, recompute buckets touched by late rows, never average non-GOOD samples, keep `good_count` (04 C); retire raw by detaching weekly partitions. **Seam:** one `SeriesStore` interface (ingest, latest, range at resolution, rollup, dropBefore, export) with a shared contract-test suite, so a second engine is proven before any migration.

## D. Edge autonomy

**FACT**
- OT "typically employ fail-to-a-known-state design"; lost communications can trigger fail-safe actions, so degraded-operation thresholds must be defined (NIST SP 800-82r3 via 04 A).
- RAUC: "Fail-Safe & Atomic: An update may be interrupted at any point without breaking the running system" [25]; SWUpdate: signed and encrypted images [26]; Mender: "a dual redundant scheme (also known as A/B scheme)" [27]; TUF protects "even against attackers that compromise the repository or signing keys", Uptane is for vehicles [28].
- `RuntimeWatchdogSec=off`: "no watchdog device is opened, configured, or pinged"; timesyncd makes time "roughly monotonic" but "does not delay other units until synchronization ... has been reached" [29]. WireGuard: a 25 s `PersistentKeepalive` "works with a wide variety of firewalls" [30]. CRA (05 C): Art 14 reporting since 11 Sep 2026, application 11 Dec 2027, 5-year support (Art 13(8)), automatic updates by default (04 E).

**Design (INFERENCE)**

| Topic | Proposal |
|---|---|
| Store-and-forward | Append-only JSONL, fsync per batch; size = max(72 h, 2 x longest outage). When full, drop oldest raw non-alarm samples first, never events, commands or because-records, and report the drop count. At 97 B per record, 20 series: 503 MB per 72 h at 1 s, 50 MB at 10 s, 8 MB at 60 s |
| Rules, config | GAIA runs from the last known good signed ruleset; changes apply at a cycle boundary with N-1 kept; the ruleset hash goes into every because-record. Config is a signed declarative document `{schemaVersion, configVersion, sha256}`: pull over HTTPS, validate, stage, switch, health-check 60 s, commit or roll back; heartbeat reports `appliedConfigVersion` |
| Safe state | Per actuator a declared `failState` and `maxAutonomousSeconds`. WAN loss alone triggers nothing (05 K); triggers are local: sensor STALE or BAD, local bus loss, command TTL expiry on the monotonic clock (04 E) |
| Watchdog | Set `RuntimeWatchdogSec` explicitly [29] plus `WatchdogSec` on the agent; 3 reboots in 1 h boots monitor-only |
| Updates | Now: signed package or container pinned by digest, previous kept, auto-rollback on a failed health check, staged 1, 10, 100%, never during a command (04 E). Next: full-image A/B with RAUC, Mender or SWUpdate [25][26][27]; TUF roles only with untrusted mirrors or several signers [28]. CRA needs signed updates with rollback, SBOM and 5-year support before the first EU hardware sale, not before |
| Time | NTS-capable NTP (04 E). Many single-board computers lack a battery RTC unless fitted [UNVERIFIED: the Raspberry Pi RTC page returned 403]. timesyncd only makes time roughly monotonic [29], so the agent stamps `clockState` (B) and uses the monotonic clock for TTLs |
| Remote access | Outbound HTTPS pull by default, no inbound port. Support: the gateway starts WireGuard to a Greecon relay only in a time-boxed, customer-approved, logged session [30]. No standing SSH; permanent mesh above 1 support session a month per 10 sites |

**Edge versus cloud.** Edge (works with the WAN cut): acquisition, quality stamping, GAIA, arbitration, fail states, buffer, watchdog, monitor-only mode, clock state. Cloud: storage, rollups, dashboards, notifications, rule authoring and shadow evaluation, fleet, config and update orchestration, tenancy. The cloud is never on an actuator's control path within its process safety time (04 A).

## E. Rules engine

**FACT**
- PLC scan: "Read inputs, Execute the program, Write outputs" (secondary source); IEC 61499 is the distributed alternative (Eclipse 4diac); ISA-88 separates "recipe management, scheduling, sequential control, regulatory control, and safety interlock systems" [37].
- Home Assistant `single` (default) "Doesn't start a new run while the automation is running, and logs a warning" [31]. Node-RED: "By default, context is stored in memory only" and is "cleared whenever Node-RED restarts" [32].
- OPA decision logs carry "the policy that was queried, the input to the query, bundle metadata": `decision_id`, `revision`, `input`, `result`, `timestamp` [33]. Kubernetes `validationActions` Deny, Warn or Audit let a policy run without enforcing [34]. CEL "evaluates in linear time, is mutation free, and not Turing-complete" [35].
- BACnet outputs carry `Priority_Array`, `Relinquish_Default`, and `Minimum_On_Time` and `Minimum_Off_Time` [36]; 16 levels, level 1 (Manual Life Safety) highest, highest occupied slot wins (search summary of Chipkin [36]; page not opened).

**Design (INFERENCE)**

| Topic | Proposal |
|---|---|
| Deterministic, versioned | Pure `evaluate(ruleset@version, snapshot, now) -> {requests, because}`: no I/O or randomness, time is an input, fixed order, no loops, a CEL-like bounded expression subset [35]; one scan per cycle so triggers cannot overlap [37][31]. Rulesets are immutable `{id, version, sha256, author, approver}`; activation is a logged event; rollback re-activates the previous; state lives in the database or edge store, never memory only [32]. CI replays recorded days through each new ruleset and diffs |
| Shadow | Every new rule version starts `shadow`: evaluate, store the would-be request with `executed=false`, never act, like Warn and Audit before Deny [34]; promote after 7 days and one full process cycle with the diff against operator actions reviewed (my thresholds) |
| Because-record | `{decisionId, actuator, rulesetHash, ruleId, mode, evaluatedAt, inputs[{series, value, sourceTs, ageMs, effectiveQuality, historical}], configVersion, result, executed, blockedBy, approvalId}` after the OPA pattern [33]; inputs are copied in so raw samples can expire |
| Conflicts | One writer per actuator: rules emit requests with a priority class to an arbiter, BACnet-style [36]: 1 local or manual override, 2 operating guards, 3 held trip, 4 approved schedule or command, 5 advisory. Minimum on and off times belong to the actuator [36]. Ties break by rule id; losers are logged |
| Do, do not | Do treat STALE, BAD, UNKNOWN as explicit branches, never 0 (04 C); keep rule templates apart from equipment addresses, the ISA-88 idea [37] (recalled, UNVERIFIED). Do not offer user scripting, drop overlapping triggers silently [31], let a rule write an output directly, or adopt IEC 61499 networks for 16 point kinds |

**Proof trigger for a richer rule language (proposal):** one signed customer rule that templates cannot express plus 3 similar requests.

## F. Multi-tenancy and isolation

Layering, `FORCE`, `SET LOCAL`, BYPASSRLS and CI contract tests are in 04 F; law and export duties in 05 B, E, K.

**FACT**
- A policy expression "will be evaluated for each row prior to any conditions or functions coming from the user's query"; sub-SELECTs risk "heavy concurrent use of row share locks" [38]. AWS: the pooled model "is commonly implemented by hoping the correct WHERE clause is implemented in every SQL statement" [39].
- Vendor-measured (Supabase, 100K rows, policy before versus after its own fix): 171 ms to under 0.1 ms; 179 to 9 ms; 11,000 to 7 ms with a join [40]. Policy wording, not RLS itself, drives most of the cost.
- Cryptographic erase leaves "only the ciphertext remaining on the media ... Without the encryption key ... the data is unrecoverable" [41]; `statement_timeout` default 0 disables it [42].

**Findings (INFERENCE)**
- Reads come from the in-memory repository, so RLS cannot protect them; the real boundary is the repository API. Seam: every method takes a non-optional `TenantScope` from the verified token; stores are keyed by tenant.
- Use RLS on low-volume tables (users, sites, gateways, commands, audit, rules). Samples carry only `series_id`; a per-sample `tenant_id` adds 16 B as UUID (+19% on 84 B) or 4 B as integer (+5%).
- Cost of RLS: a tenant-leading index on every policy column; `SET LOCAL` per transaction; plain equality policies; the suite run as the non-owner role; sub-SELECT policies checked for lock contention [38].
- **Proof trigger for RLS**, any one: (1) Postgres becomes a read path for tenant data (hydration retired, or BI, a support console or another service reads it); (2) a customer review or ISO 27001 scope asks for database-enforced isolation; (3) the contract tests catch one real leak.
- Per-tenant keys: wrap per-tenant data keys with a KMS key for credentials, webhook secrets, exports and backups only; telemetry stays unencrypted per tenant. Crypto-erase [41] covers those objects; samples are deleted per series (a 20-series tenant holds about 0.9 M raw rows in 30 days, so no per-tenant partitions). Backups keep deleted data until expiry: state it in the DPA (05 K). Export: a low-priority job on its own DB role streams CSV, JSON or Parquet to object storage with an expiring link (H).
- Noisy neighbours: per-gateway token bucket and batch cap (429 with Retry-After); per-tenant caps on concurrent heavy reads and points per request; `statement_timeout` per DB role with separate pools for export and rollups; per-tenant job concurrency. The in-memory throttler counts per replica, so limits multiply with replicas: externalise counters at the second replica.

## G. Scale triggers

**FACT (Railway):** maxima per service "include replica multiplication": Hobby 6 replicas, 48 GB RAM, 5 GB volume; Pro 42 replicas, 1 TB RAM, volume to 1 TB self-serve [43][24]. 10,000 concurrent connections, "11,000~ RPS" per domain [12]. One EU region, "EU West Metal Amsterdam, Netherlands"; point-in-time recovery for Postgres, single-node and HA [43].

**Load model (INFERENCE):** 20 series per site, one batch per site per 10 s, 84 B/row.

| Stage | Load | Changes | Move on when |
|---|---|---|---|
| 1 site (today) | 20 series; 0.3 to 2 rows/s; 0.1 req/s; 0.9 GB/yr | None to topology; do the day-one list (L); edge buffers hide API restarts | Restore drill passed; hydration time and RSS recorded |
| 10 sites | 200 series; 3.3 to 20 rows/s; 1 req/s; 8.8 GB/yr | Weekly partitions, idempotent in-process rollup job, outbox table drained with `FOR UPDATE SKIP LOCKED`, PITR [43] | Hydration above 30 s, RSS above 60% of RAM, a deploy gap above 60 s burning the freshness budget (I), or ingest handler p95 above 300 ms over 24 h |
| 100 sites | 2,000 series; 33 to 200 rows/s; 10 req/s; 2.9 M rows/day; 88 GB/yr | 2+ replicas; Postgres as read path (hydration shrinks to a latest-value cache); shared throttler and idempotency state; pg-boss (MIT) [56] only if the outbox is outgrown; RLS per F; pooling | DB CPU above 70% for 1 h, disk above 60%, ingest p95 above 300 ms at under 70% CPU, 7-day range read p95 above 1 s |
| 1,000 sites | 20,000 series; 333 to 2,000 rows/s; 100 req/s; 28.8 M rows/day; 883 GB/yr raw (73 GB at 30-day raw) | Ingest service split from API and UI; read replica; engine decision by the C triggers; per-tenant quotas; on-call, public status page | Out of scope |

At 1,000 sites the request rate is about 1% of Railway's per-domain figure [12]; the binding limits are volume size [24], RAM and unbounded raw history, hence mandatory retention. Thresholds are my proposals, not published figures.

**Do not do early:** Kafka, NATS or any stream platform; per-tenant databases; Kubernetes; microservices before stage 1,000; active-active multi-region (one EU region on this host [43]); a read replica before a measured read problem; a second time-series engine before the C triggers; a rule scripting language.

## H. API and contracts

**FACT**
- `Deprecation` (RFC 9745, Mar 2025) signals a resource "will be or has been deprecated" [44]; `Sunset` (RFC 8594, informational) marks a URI "likely to become unresponsive at a specified point in the future" [45]; RFC 9457 "problem detail" bodies avoid "new error response formats" [46].
- GitHub: "the previous API version will be supported for at least 24 more months"; additive changes (operation, optional parameter, response field, enum value) are non-breaking [48]. Stripe: keys up to 255 characters, removable "after they're at least 24 hours old", mismatched parameters error [49].
- Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 (24 to 64 byte secret) or ed25519; the id "is often used as an idempotency key"; the timestamp is "meant to prevent replay attacks" [50]. OpenAPI latest is v3.2.1 (10 Sep 2026) [51]; Parquet is "an open source, column-oriented data file format" [52]; RFC 4180 CSV is informational only [47].

**Proposal (INFERENCE)**

| Topic | Decision |
|---|---|
| Versioning, deprecation | `/v1` path; additive changes non-breaking [48]; breaking means `/v2` in parallel. Public API: 12 months notice (GitHub gives 24) with `Deprecation` and `Sunset` headers [44][45], changelog, email, per-tenant usage counts. The agent protocol carries `protocolVersion` and never drops fields: devices sold in year Y must work to Y+5 (CRA support period, 05 C) |
| OpenAPI, errors, paging | One spec as source of truth at `/v1/openapi.json`, validated against real responses in CI with a breaking-change diff [51]; RFC 9457 `application/problem+json` with stable `type` URIs [46]; opaque cursors ordered by (ts, series_id), `limit` at most 1,000, no offsets on time series; bulk reads are exports |
| Command idempotency | Required `Idempotency-Key` on command POSTs; store key, fingerprint (incl. `executionMode`) and response for command TTL + 24 h [49][10]; same key with another body returns 422; the command ID travels to the edge, which dedupes on it (QoS 1 duplicates are normal [7]) |
| Webhooks | Only on first customer request (else they poll): Standard Webhooks signing [50], at-least-once with backoff, dedupe on `webhook-id`, 5-minute timestamp window, secrets rotated with overlap |
| Export | CSV with a stated dialect (UTF-8, comma, ISO 8601 UTC, dot decimal, quality column) since RFC 4180 is not a standard [47]; JSON Lines with API field names; a `manifest.json` per export (schema version, range, series with UCUM units, kind registry snapshot, checksum). Parquet [52] when a customer or auditor needs over 1 M rows or pandas, DuckDB or BI access (05 E) |

## I. Observability of a monitoring platform

**FACT**
- Watchdog is "an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing"; if it stops "it should alert external systems that this alerting system is no longer working" [54]. "Pipeline Freshness: The proportion of the data that was updated more recently than some time threshold"; burn rates for a 30-day SLO: 2% of budget in 1 h = 14.4 (page), 5% in 6 h = 6 (page), 10% in 3 days = 1 (ticket) [53]. Healthchecks.io notifies when "scheduled tasks don't run on time" [55].

**Proposal (INFERENCE)**
- Dead-man's switch in layers: gateway heartbeat plus a scheduled server watchdog (04 C), and an external layer: a platform job pings an independent heartbeat service every minute and an outside probe checks the public health endpoint, both alerting through a provider and channel the platform's own notifier does not use [54][55].

| SLO | Definition | Starting target |
|---|---|---|
| Data freshness | Share of control-relevant series whose newest sample is younger than 2 x its interval + 30 s, by server receive time; gateways OFFLINE for site reasons counted apart | 99% over 30 days (7.2 h budget) |
| Alert latency | Sample time of the triggering condition to notification accepted by the provider; hourly synthetic canary alert | p95 under 2 min, p99 under 5 min |
| Command round trip | API accept to edge ack, gateway ONLINE | p95 under 10 s; 99% acked or expired within TTL |

- Measure first, in order: gateway heartbeat age; ingest accepted, duplicate, conflict, rejected counts; ingest handler p95; outbox oldest age; DB connections, CPU, disk, autovacuum lag; RSS, event-loop lag, boot hydration time; rollup watermark lag; backup age and last restore drill.
- Tiny-team budget: page only on burn of freshness or alert latency (14.4x over 1 h or 6x over 6 h [53]); all else is a ticket; at most 2 pages a week, each with a runbook, else fix the cause or relax the SLO. A single-gateway outage goes to the tenant, not the founder.

## J. Build vs buy

Licence facts come from the cited files; other cells are INFERENCE or [UNVERIFIED].

| Need | Default | Alternatives and facts | Lock-in | EU or Albania note |
|---|---|---|---|---|
| Identity and auth | Own JWT sessions plus argon2id (04 F) behind an `AuthProvider` seam with OIDC-shaped claims | Keycloak Apache-2.0, Zitadel AGPL-3.0 (check 05 H) [56]; trigger: customer SSO or SCIM (05 K) | Low now; medium with an IdP unless hashes export | Self-host in the EU |
| Email, push | EU-region transactional provider behind `EmailSender` [UNVERIFIED which]; Web Push (RFC 8030, VAPID RFC 8292) [58] | Any SMTP provider; FCM or APNs later | Low | List the email provider as sub-processor (05 K) |
| SMS | Last-resort channel behind `SmsSender`; two-provider delivery test to Albanian operators (OPEN) | Twilio's Albania page has alphanumeric and pre-registration rows; values not extracted [59] | Low to medium (sender ID) | No personal data in alert text |
| Object storage | Any S3-API provider in the EU behind `ObjectStore` (exports, backups, update bundles) | | Low; egress cost matters for exports (05 E) | EU region |
| Time-series DB | Plain PostgreSQL (C) | TimescaleDB Community (TSL [15]) | None, or medium with TSL | Same host |
| Queue | Postgres outbox, then pg-boss (MIT) [56] | Redis Open Source from version 8 offers RSALv2, SSPLv1 or AGPLv3 [56]; NATS | Low with the outbox | None |
| Error tracking | Sentry SaaS, EU data location [57], PII scrubbing | Sentry self-host is FSL-1.1-Apache-2.0, Apache 2.0 "on the second anniversary" [56]; GlitchTip MIT [56] | Low (SDK) | Choose EU at signup |
| Status page, heartbeat | Static page on a different provider from the API: Upptime on GitHub Pages (MIT) [56]; Healthchecks.io or self-hosted (BSD-style) [55][56] | Uptime Kuma (MIT) [56] | Low | Must not share the API's failure domain [54] |
| Hosting | Railway today, one EU region, Amsterdam [43] | Any Docker plus Postgres host | Low if standard only | Albania is outside the EU; hosting in the Netherlands keeps data in the EU; duties in 05 B |

## K. Architecture decision records to write now

| ADR | Decision | Alternative rejected | Reversal trigger |
|---|---|---|---|
| 1 Vocabulary and units | 16 canonical names closed in code with UCUM units; customer kinds are namespaced registry rows, monitor-only | Free-form kinds; adopting Haystack or Brick wholesale | 3 sites ask in a quarter: ship the registry UI; 3 tenants for 90 days: promote |
| 2 Ingest idempotency and time | `(gatewayId, batchSeq)` plus unique `(series_id, ts)`, first write wins; store `ts`, `received_at`, `clockState`; no cloud rule acts on historical samples | Per-sample UUIDs; trusting device or arrival time alone | Unique index limits inserts (p95 above 500 ms): batch-seq plus BRIN only |
| 3 Transport | MQTT on the LAN only, HTTPS over the WAN; no Sparkplug B | Cloud broker with Sparkplug | Signed customer with Sparkplug nodes or a SCADA host: add an adapter |
| 4 Storage engine | Plain PostgreSQL, weekly partitions, own rollups, behind `SeriesStore` | TimescaleDB or ClickHouse now | Any section C threshold fires |
| 5 Retention | Raw 30 d, 5-min 13 months, hourly 10 years, daily kept; 1 s stays at the edge | Keep all raw | Contract or law needs longer raw |
| 6 Rule evaluation | Immutable versioned rulesets, pure function, fixed cycle, bounded expressions | User scripting; event-graph engines | 1 signed need plus 3 similar that templates cannot express |
| 7 Shadow and because-records | Every rule version starts in shadow; every decision logs inputs, age, quality, ruleset hash | Enforce on deploy | None; a hotfix may shorten shadow with two-person approval |
| 8 Actuator arbitration | One writer per actuator, five priority classes | Rules writing outputs directly | An actuator needing more than five classes |
| 9 Edge safety | Edge owns fail states; WAN loss triggers nothing; commands are TTL requests the edge validates | Cloud-side interlocks; fail on disconnect | None for the safety boundary (04 A) |
| 10 Updates | Signed package with rollback now; A/B image (RAUC or Mender) later | Manual SSH updates | OS-level update needed, over 20 hard-to-reach devices, or first EU hardware sale |
| 11 Tenant isolation | Mandatory `TenantScope` plus cross-tenant tests now; RLS on low-volume tables later | RLS only; database per tenant | Postgres becomes a read path, an audit asks, or a test finds a leak |
| 12 API contract | `/v1`, OpenAPI, RFC 9457, cursors, `Idempotency-Key` on commands, Deprecation and Sunset headers, 12 months notice; edge protocol kept for the support period | Unversioned API; offset paging | First breaking change: `/v2` in parallel |
| 13 Observability | External dead-man's switch plus three SLOs | Dashboards without SLOs | Contractual SLA or team above 3: formal on-call |
| 14 Build-vs-buy defaults | Postgres outbox queue, S3-API storage, EU email, status page on another provider, Sentry SDK | Redis or Kafka core; self-host everything | Outbox outgrown (G); a licence change |

## L. Implications

**Must exist from day one (proven need)**
- Idempotent ingest, dual timestamps, `clockState`, `historical` flag [B; 7, 9].
- Weekly partitions, detach retention, rollups with `good_count`, `SeriesStore` contract tests [C; 9].
- Registry of the 16 kinds with UCUM unit, range, `safetyEligible` [A; 1, 6].
- Mandatory `TenantScope` plus cross-tenant tests [F; 39; 04 F].
- Immutable rulesets, because-records, shadow flag, arbiter [E; 33, 34, 36].
- Per-actuator fail state, TTL on the monotonic clock, explicit watchdog, 72 h buffer [D; 29].
- External dead-man's switch, three SLOs, restore drill [I; 54, 55].
- Body limit, batch cap, per-gateway rate limit [B; 11, 12]; notification outbox [G].
- `/v1`, RFC 9457, `Idempotency-Key` on commands, tenant export with manifest [H; 46, 49; 05 E].

**Seams for later (extension point, proof trigger)**
- Customer point kinds: 3 sites in a quarter [A].
- TimescaleDB or ClickHouse behind `SeriesStore`: section C thresholds [C; 15, 17].
- RLS: Postgres read path, audit request, or one real leak [F; 38].
- pg-boss queue: outbox outgrown; ingest split and read replica: stage 1,000 [G; 56].
- A/B image updates: OS updates, over 20 hard-to-reach devices, first EU sale [D; 25, 27]; VPN mesh: over 1 support session a month per 10 sites [D; 30].
- Sparkplug adapter: a customer with Sparkplug nodes [B; 8].
- Webhooks, Parquet: first customer request, export over 1 M rows [H; 50, 52].
- IdP or SSO: customer SSO or SCIM demand [J; 56; 05 K].
- Rule expression subset: 1 signed need plus 3 similar [E; 35]; second backfill lane: catch-up over 10 min [B].

**Things to avoid**
- Customer-reachable DDL or per-tenant tables if TimescaleDB is used [C; 15].
- Offset paging on time series [H].
- Memory-only rule or throttle state; silent dropping of overlapping triggers [E, F; 31, 32].
- Sparkplug B as the ingest path [B; 8].
- Per-kind columns, per-sample tenant UUIDs, 1 s raw in the cloud [A, F, C].
- Kafka, Kubernetes, microservices before stage 1,000 [G; 12].
- Actions triggered by WAN loss [D; 05 K]; user scripting in rules [E; 35].
- Redis as a hard dependency [J; 56].

## M. Open questions

1. PROTOTYPE: ceiling of plain PostgreSQL for 1,000-row batches with the unique index and partition maintenance on the target Railway instance, against the section G stage needs.
2. PROTOTYPE: one week of real data: bytes per row, rollup sizes, TimescaleDB Community compression, versus my 84 B model.
3. LAWYER: whether Greecon meets the TSL "Value Added Products" test and the M&A consent clause if TimescaleDB is adopted (05 L); whether a third-party Postgres host may carry the Community edition; Tiger Cloud's own terms were not read.
4. EXPERT (metrologist, water chemist): can UCUM express procedure-defined units (NTU, FNU, cfu), or is a method field needed?
5. TEST: SMS delivery and sender-ID rules to Albanian operators with two providers [59].
6. HARDWARE: gateway board, battery RTC, watchdog timeout and storage grade for a 10-year horizon [UNVERIFIED].
7. ENGINEER (01 I, 02 I): per-actuator `failState` and `maxAutonomousSeconds`.
8. PROTOTYPE: hydration time and RSS of the in-memory repository at 10, 100 and 1,000 synthetic sites.
9. OPS: restore drill on Railway PITR; compare achieved RPO with the 04 F targets [43].
10. LAWYER OR REGULATOR: legal retention minimums for effluent and energy records (02 B2); they override section C.
11. PILOT: whether 7 days of shadow covers a full process cycle at each site type.
12. WATCH: the Idempotency-Key draft passed its 18 Apr 2026 expiry date; the design does not depend on it [10].

## N. Source list

All accessed 2026-10-18. Where only an abstract, contents page or search summary was read, it says so.

1. OGC, SensorThings API Part 1 Sensing 1.1 (18-088), https://docs.ogc.org/is/18-088/18-088.html, observation and unit fields, 2026-10-18.
2. Project Haystack, https://project-haystack.org/ , /doc/docHaystack/Defs , /doc/docHaystack/Units, tags, defs, licence, 2026-10-18.
3. Brick Consortium, https://brickschema.org/ and https://raw.githubusercontent.com/BrickSchema/Brick/master/LICENSE, scope, licence, 2026-10-18.
4. ETSI, SAREF portal, https://saref.etsi.org/, extension list, 2026-10-18.
5. OPC Foundation, OPC UA Part 8 v1.05 (contents page), https://reference.opcfoundation.org/Core/Part8/v105/docs/5.6.3, units model, 2026-10-18.
6. UCUM Organization, https://ucum.org/ucum, unit codes, 2026-10-18.
7. OASIS, MQTT 5.0, https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html, QoS, ordering, 2026-10-18.
8. Eclipse Foundation, Sparkplug 3.0 spec source, https://github.com/eclipse-sparkplug/sparkplug/tree/master/specification/src/main/asciidoc, QoS, sequence, history, 2026-10-18.
9. PostgreSQL, docs 18 Table Partitioning, https://www.postgresql.org/docs/current/ddl-partitioning.html, partition rules, 2026-10-18.
10. IETF, draft-ietf-httpapi-idempotency-key-header-07, https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.txt, idempotency header, 2026-10-18.
11. Express body-parser, https://expressjs.com/en/resources/middleware/body-parser.html ; Fastify Server, https://fastify.dev/docs/latest/Reference/Server/, body limits, 2026-10-18.
12. Railway, Specs and limits, https://docs.railway.com/networking/public-networking/specs-and-limits, rate limits, 2026-10-18.
13. PostgreSQL, Populating a Database, https://www.postgresql.org/docs/current/populate.html, bulk load, 2026-10-18.
14. PostgreSQL, https://www.postgresql.org/docs/current/storage-page-layout.html , /brin.html , /sql-createindex.html and https://www.postgresql.org/about/licence/, row size, fillfactor, licence, 2026-10-18.
15. Timescale, https://raw.githubusercontent.com/timescale/timescaledb/main/tsl/LICENSE-TIMESCALE and .../main/LICENSE, licence terms, 2026-10-18.
16. Tiger Data, https://www.tigerdata.com/legal/licenses, vendor licence summary, 2026-10-18.
17. Tiger Data docs, https://docs.tigerdata.com/about/latest/timescaledb-editions/, edition feature split, 2026-10-18.
18. Tiger Data blog, https://www.tigerdata.com/blog/timescale-cloud-vs-amazon-rds-postgresql-up-to-350-times-faster-queries-44-faster-ingest-95-storage-savings-for-time-series-data, vendor benchmark, 2026-10-18.
19. Tiger Data blog, https://www.tigerdata.com/blog/timescaledb-vs-6a696248104e, vendor benchmark, 2026-10-18.
20. Mostafa et al., SciTS, https://arxiv.org/abs/2204.09795 (abstract), independent benchmark, 2026-10-18.
21. ClickHouse, https://clickhouse.com/docs/best-practices/selecting-an-insert-strategy, batch size, 2026-10-18.
22. QuestDB, https://questdb.com/docs/concept/deduplication/, dedup keys, 2026-10-18.
23. Licence files on raw.githubusercontent.com: influxdata/influxdb/main/README.md, questdb/questdb/master/LICENSE.txt, ClickHouse/ClickHouse/master/LICENSE, VictoriaMetrics/VictoriaMetrics/master/LICENSE, licences, 2026-10-18.
24. Railway, https://docs.railway.com/reference/volumes, volume limits, 2026-10-18.
25. RAUC, https://rauc.readthedocs.io/en/latest/, atomic updates, 2026-10-18.
26. SWUpdate, https://sbabic.github.io/swupdate/, signed images, 2026-10-18.
27. Mender, https://docs.mender.io/overview/introduction, A/B scheme, 2026-10-18.
28. Uptane, https://uptane.org/ ; TUF, https://theupdateframework.io/, update-framework scope, 2026-10-18.
29. systemd, https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html and /systemd-timesyncd.service.html, watchdog, time, 2026-10-18.
30. WireGuard, https://www.wireguard.com/quickstart/, keepalive, 2026-10-18.
31. Home Assistant, https://www.home-assistant.io/docs/automation/modes/, overlap policy, 2026-10-18.
32. Node-RED, https://nodered.org/docs/user-guide/context, memory-only default, 2026-10-18.
33. Open Policy Agent, https://www.openpolicyagent.org/docs/management-decision-logs, decision record, 2026-10-18.
34. Kubernetes, https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/, Warn, Audit, Deny, 2026-10-18.
35. Google, https://raw.githubusercontent.com/google/cel-spec/master/README.md, bounded rule language, 2026-10-18.
36. OPC Foundation, OPC 30030 BACnet (contents), https://reference.opcfoundation.org/specs/OPC-30030/3.2.1 ; Chipkin (search summary only), https://store.chipkin.com/articles/bacnet-what-is-a-bacnet-priority-array, arbitration, 2026-10-18.
37. Wikipedia (secondary), https://en.wikipedia.org/wiki/Programmable_logic_controller ; Eclipse 4diac, https://eclipse.dev/4diac/ ; ISA, https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa88, industrial background, 2026-10-18.
38. PostgreSQL, https://www.postgresql.org/docs/current/ddl-rowsecurity.html, RLS evaluation, 2026-10-18.
39. AWS Database Blog, https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/, pooled model, 2026-10-18.
40. Supabase, https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv, vendor timings, 2026-10-18.
41. NIST, SP 800-88 Rev. 1, https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r1.pdf, cryptographic erase, 2026-10-18.
42. PostgreSQL, https://www.postgresql.org/docs/current/runtime-config-client.html, statement_timeout, 2026-10-18.
43. Railway, https://docs.railway.com/reference/pricing/plans , /reference/deployment-regions , /volumes/point-in-time-recovery, plans, regions, PITR, 2026-10-18.
44. IETF, RFC 9745, https://www.rfc-editor.org/rfc/rfc9745, Deprecation header, 2026-10-18.
45. IETF, RFC 8594, https://www.rfc-editor.org/rfc/rfc8594, Sunset header, 2026-10-18.
46. IETF, RFC 9457, https://www.rfc-editor.org/rfc/rfc9457, problem details, 2026-10-18.
47. IETF, RFC 4180, https://www.rfc-editor.org/rfc/rfc4180, CSV status, 2026-10-18.
48. GitHub, https://docs.github.com/en/rest/about-the-rest-api/api-versions, support window, 2026-10-18.
49. Stripe, https://docs.stripe.com/api/idempotent_requests, key retention, 2026-10-18.
50. Standard Webhooks, https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md, signing, 2026-10-18.
51. OpenAPI Initiative, https://spec.openapis.org/oas/latest.html, current version, 2026-10-18.
52. Apache Parquet, https://parquet.apache.org/, export format, 2026-10-18.
53. Google, SRE Workbook, https://sre.google/workbook/alerting-on-slos/ and /implementing-slos/, burn rates, freshness, 2026-10-18.
54. Prometheus Operator, https://runbooks.prometheus-operator.dev/runbooks/general/watchdog/, dead-man's switch, 2026-10-18.
55. Healthchecks.io, https://healthchecks.io/, heartbeat monitoring, 2026-10-18.
56. Licence files on raw.githubusercontent.com: getsentry/sentry/master/LICENSE.md, zitadel/zitadel/main/LICENSE, keycloak/keycloak/main/LICENSE.txt, timgit/pg-boss/master/LICENSE, redis/redis/unstable/LICENSE.txt, louislam/uptime-kuma/master/LICENSE, upptime/upptime/master/LICENSE, healthchecks/healthchecks/master/LICENSE; https://gitlab.com/glitchtip/glitchtip-backend/-/raw/master/LICENSE, licences, 2026-10-18.
57. Sentry, https://docs.sentry.io/organization/data-storage-location/ (page title only), EU option, 2026-10-18.
58. IETF, RFC 8030 and RFC 8292, https://www.rfc-editor.org/rfc/rfc8030 and /rfc8292, Web Push, 2026-10-18.
59. Twilio, https://www.twilio.com/en-us/guidelines/al/sms, sender-ID rows (values not extracted), 2026-10-18.
60. Sibling reports 01-energy.md to 05-legal.md (local files, this folder), reused facts, 2026-10-18.

Not read: Raspberry Pi RTC page (HTTP 403), InfluxDB 3 Core limits, Kafka idempotent-producer docs, Tiger Data chunk-sizing guidance.
