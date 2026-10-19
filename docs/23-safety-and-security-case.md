# 23. Safety and security case

Status: written 2026-10-18 from `docs/research/04-security-safety.md`. No functional-safety
engineer, security architect or lawyer has reviewed it. The standards it leans on (IEC 61511, IEC
61508, IEC 62443, EEMUA 191, ISA-18.2) are paywalled and were not read; numbers come through public
guidance and secondary sources, and the research report says which. This is a design case, not a
safety certification, and Greecon claims none.

## 1. The boundary, stated honestly

Greecon is a monitoring, advisory and (only when proven) supervised-operation platform. It is not a
safety function, takes no safety integrity level or performance level credit, and says so in the
product, the contract and every sentence about safety.

**Why a cloud platform must not be, or look like, a safety function.** A protective function must
reach the safe state within the process safety time, independent of every other control system, built
under a lifecycle that treats change as a hazard. A multi-tenant cloud platform has none of that: no
bounded latency or availability (the internet, name servers, certificates, deployments), no
independence (one codebase and credential set both reads and commands), and continuous delivery is the
opposite of a safety lifecycle. Real pump dry-run protection lives in the motor starter: a standard
motor-protection device implements it, with a fixed start-up override, an adjustable bridging time and
a trip delay, and its vendor's own paper says the operator must prove the correct interaction of
sensors with the required integrity level for their plant.

| Level | What | Owner | Greecon's part |
|---|---|---|---|
| L0 | Hard-wired protection: emergency stop, overload and thermal trips, pressure switches, high-high level, dry-run relay | The integrator or equipment maker | None. Greecon reads status, never writes or bypasses |
| L1 | Local controller and hand-off-auto selector | The integrator | None, except reading |
| L2 | Greecon's edge box: planned local guard | Greecon | Operating limits; still not a safety function |
| L3 | The cloud: monitoring, advice, supervised remote commands | Greecon | Everything else |

Any hazard that can injure someone or destroy equipment inside the process safety time is handled at
L0 or L1 with no dependency on L2 or L3. Local control always wins: when the selector or a lock-out
says local, remote commands are refused.

**Four classes of feature,** shown as badges: Advisory (tells), Supervisory (sets a mode or a setpoint
on a controller that has its own protection), Direct actuation, and Safety function (never offered).
Every command carries an execution mode. Today it is always **simulated**, and a spec fails if it is
ever anything else (`platform.service.spec.ts`).

**Wording.** Say "operating limits", never "safety interlocks", for what the platform checks. GAIA's top
tier is an "operational safety priority (non-SIL)". Never "protects", "prevents damage", "fail-safe" or
"SIL" in any product, contract or marketing text.

## 2. Safe command design

The rules, and where each stands. "Built" means in the code with a test.

| Rule | Status |
|---|---|
| **Direction rule.** Stopping, closing, disabling and reducing are never blocked by a process condition (pressure, flow, rest time, data quality); starting, opening, enabling and increasing are gated by every interlock. A value the engine does not recognise counts as the hazardous direction. Stops still need authorisation, a stated reason, and an audit entry. Authority: stop priority over start (Machinery Directive, IEC 60204-1) and the fail-to-a-known-state principle. A stop can have consequences (water hammer, lost aeration or disinfection), so the answer is a consequence warning, never a block | **Built** (`packages/gaia-core`, `safety.spec.ts`; two earlier tests that asserted the opposite were corrected) |
| **Start gating on fresh, good data.** Each required reading must be good and no older than its limit at the moment of the decision; unknown means deny, with the reason | **Built** for bad, stale and unknown-timestamp readings. Re-checking at the edge at execution time is **not built** (no edge guard yet) |
| **Dry-run in practice.** "Low flow" means nothing until the pump is confirmed running and a start-up bridge time has passed; flow of zero is the normal state of a stopped pump. A start permissive is on the suction side (level above the minimum submergence margin, suction valve open, primed), never discharge flow, which would deadlock every start | Dry-run alert **built** (needs pump status; 30 second on-delay). The suction-side permissive is **not built** (needs per-asset configuration) |
| **Command envelope and lifecycle.** An identifier, an idempotency key, the target, the action, an expiry, the issuer, approvals, the expected prior state, a snapshot of the readings used, the execution mode, and a signature the edge verifies. Set-state semantics ("desired = run"), never toggle. States: created, approved, sent, received, executed, confirmed by a field signal, failed, expired, cancelled, or unknown. Never queue physical commands offline; never retain them on the message bus | **Partly.** Identifier, issuer, reason, readings and evaluation are recorded; expiry, signature, idempotency, approvals and the full lifecycle are **not built** |
| **Confirmation by consequence.** One tap for a stop; a confirmation listing preconditions for a reversible start; a reason, a second approver and an expiry for anything that overrides a limit; no remote start of people-exposed hazards (mixers, conveyors, confined-space valves) | **Not built** (`docs/20`, section 4) |
| **Rate limits** (minimum off-time, starts per hour, per-user rate), enforced at the edge too, on hazardous-direction commands only; stops are de-duplicated, never limited | **Partly:** pump rest time and irrigation run length are checked for starts |
| **Lease and dead-man.** A hazardous-direction state is a lease ("run until T" or "while the heartbeat is alive"); on expiry or lost communications the edge applies the asset's declared policy (stop, close, hold, or local schedule), chosen per asset because stopping can harm | **Not built** |
| **Local precedence.** A hand-off-auto or lock-out signal makes the platform refuse and cancel remote commands and show "local control". The emergency stop stays hard-wired: no software emergency-stop button. A manual override is a consequential action with an expiry and a persistent banner | **Not built** (needs the status signal from the equipment) |
| **Audit every attempt,** allowed or denied: who, tenant, reason, guard result, input snapshot with ages, approvals, outcome, simulated or live | **Built** (`command.simulated_dispatch`, `command.blocked`, override requests) |

## 3. Data validity and alarms

- A bad, stale or unknown reading never displays as OK or as a number. Quality is a first-class idea
  (good, uncertain, bad, plus out of date, never received, overridden, simulated), computed when it is
  read. Aggregates exclude what is not good and show coverage. An alarm on a bad or stale point becomes
  "unknown": it cannot clear because the data vanished.
- **Built:** freshness per reading with a limit per point, out-of-date shown on every list, alerts that
  stay open when readings go quiet, and a monitor that re-derives every site's state every minute so a
  gateway that says nothing is noticed (`docs/18`).
- **Not built:** the gateway heartbeat (every 15 to 30 seconds with a counter, version, uptime, buffer
  depth and last good poll per device; liveness judged from the server's receive time, not the
  gateway's clock; online, late after two missed, offline after three), and tagging backlog data that
  arrives after reconnection as late so it is never used for real-time decisions.

## 4. The release gate for the first real write

No command reaches equipment until every item is true and written down:

1. The direction-rule tests are green (they are).
2. Staleness and the heartbeat are live, and the operating limit is evaluated at the edge, with the
   check repeated at execution time.
3. Commands are signed, carry an expiry and an idempotency key, and the edge verifies and refuses an
   expired or repeated one.
4. Consequence tiers exist in the interface, and the lifecycle shows "running" only after a field
   signal confirms it.
5. The local-control state of the equipment is read, and a lock-out blocks remote commands.
6. The integrator's commissioning checklist, factory and site acceptance evidence exist, and the
   independent hard-wired protection (L0) is confirmed on site.
7. The control addendum is signed, the insurer has re-underwritten with the platform able to actuate,
   and counsel has reviewed the wording (`docs/22`).
8. A first deployment is read-only for 90 days at 98% current data, and the same action has been
   requested by three owners (`docs/25`).

## 5. Security

### Identity, tenancy and the edge

| Area | Today | Next, in order |
|---|---|---|
| People | Per-user accounts, signed session tokens, hashed passwords, roles with permissions, login throttled per account, header-asserted roles refused in production | Mandatory two-factor sign-in for owners and admins; access tokens of at most 15 minutes with rotating refresh and reuse detection; distinct demo passwords |
| Tenancy | Every lookup is tenant-scoped; the whole-service isolation spec (reads, writes, a guard for new methods) found and fixed a latent bug (`docs/18`) | A tenant-scope type that makes an unscoped read unrepresentable; the same canary checks per route in CI; PostgreSQL row-level security when the database becomes a read path (it cannot protect today's in-memory reads) |
| Gateways | One secret per gateway, hashed, shown once, ingest-only; deleting a gateway revokes it | Rotation with overlap, last-used time and address, per-gateway rate limit; later device certificates with the key in a TPM (`GatewayCredential{secret or mtls}` seam; proof: customer demand, a stolen secret, or hardware with a TPM) |
| Transport | TLS to the platform; the message bus on the box listens on loopback only; the edge agent only makes outbound calls | Authenticated bus with per-client access lists if it ever listens beyond loopback; no retained commands, ever |
| Time | Server receive time exists on readings | Authenticated network time on the box, skew reported in the heartbeat, monotonic clocks for expiries |
| Supply chain and releases | Locked dependencies, type check, tests and build on every push, vulnerable dependencies patched | A bill of materials per release, secret scanning, signed and staged releases with automatic rollback, an update channel that never updates during a command |
| Audit | The code only ever adds events, each with who, what, when, and before and after; nothing in the database stops an administrator from changing them | Tamper evidence: a hash chain anchored daily outside the database's trust domain |
| Resilience | A bounded, ordered buffer on the box's disk (50,000 messages by default: about a day for three devices polled every 5 seconds, about an hour and a half for fifty) | Size the buffer for at least 72 hours (batching, or a larger limit; the disk is cheap); backups with a tested restore (config and audit within 15 minutes of loss, within 4 hours to recover; telemetry within 1 to 24 hours); a quarterly restore drill; a "pull the network cable" test: a platform failure must mean loss of visibility, never loss of control |
| Incidents | Clocks documented (`docs/22`) | A one-page runbook: severity table, on-call, evidence preservation, notice templates, contact registry, a yearly tabletop |
| Disclosure | None | `security.txt`, a vulnerability policy, a monitored mailbox; patch commitments (acknowledge in 3 working days; actively exploited: warn in 24 hours, advise in 72, fix in 14 days; critical in 14 days, high 30, medium 90) |

### Ten realistic threats, best value first

| # | Threat | First mitigations | Day one |
|---|---|---|---|
| 1 | Customer account takeover | Mandatory two-factor for owners and admins; login limits (built); step-up for consequential commands | Yes |
| 2 | Cross-tenant exposure (happened once) | Isolation spec (built); tenant-scope type; row-level security later | Yes |
| 3 | A wrong or malicious command reaches equipment | Keep "no real write" until the gate; direction rule (built); signed commands with expiry; edge guard; approvals | Gate and rule |
| 4 | Stale or false data drives decisions or reports | Freshness and quality (built); heartbeat; plausibility checks; coverage in reports | Yes |
| 5 | A stolen gateway secret or a compromised edge PC | Per-gateway secret (built); rotation; outbound only; disk encryption; certificates later | Basic |
| 6 | Supply-chain compromise | Locked dependencies; scanning; signed releases; least-privilege build tokens | Basic |
| 7 | A rogue device on the site network (Modbus has no authentication) | Read-only driver (built); address and function-code allow-list; a deployment guide: own zone, no inbound ports | Document |
| 8 | Ransomware or destructive attack | Immutable backups in a separate account; tested restore; edge autonomy; no path from the cloud into the plant network | Backup and restore test |
| 9 | Loss of availability | Edge store-and-forward (built); local operation independent of the platform; certificate and secret expiry monitoring; an honest status page | Yes |
| 10 | Misconfiguration, insecure defaults, leaked secrets | Infrastructure as code; secret scanning; secure defaults; quarterly access review | Scan |

## 6. Day one, seams, avoid

**Day one:** the boundary text, badges and wording; the direction rule with tests (done); the signal model
with quality, time and limit and fail-closed start gating (done except the edge check); state-aware
no-flow detection (done) and the suction-side permissive; a gateway heartbeat, a server watchdog and
minimal live alerts (alerts done, heartbeat open); the tenant-isolation guard (done); two-factor
sign-in, rate limits, append-only audit, secret scanning, rotatable gateway secrets; `security.txt`,
vulnerability policy, a bill of materials and dependency scanning in the build, an incident runbook with
the real clocks; backups with a tested restore, an edge buffer sized for at least 72 hours, and the
network-cable test; the release gate on the roadmap.

**Seams:** gateway credential types; an edge guard fed by a signed, versioned policy sharing the cloud
guard's schema (proof: the first request for a real write, or a loss of communications that
mattered); the command lifecycle and lease used even while simulated (proof: the first pilot with a
real actuator); a signed update channel (proof: the first hardware shipment, many remote sites, or 11
December 2027); row-level security and a per-tenant isolation tier (proof: any isolation test
failure, a demand for database-level isolation, or a utility needing a dedicated database or region);
external audit anchoring and export to a customer's monitoring system (proof: a regulated customer
asks); read-only ingestion of a safety system's status, as data and never control (proof: demand for
one pane of glass); an IEC 62443-4-1 gap assessment (proof: a procurement requirement).

**Avoid:** any safety integrity claim; "safety interlock" wording for cloud checks; a software emergency
stop; a guard that blocks stop, close or disable; automatic restart after a trip or power return
without checks; toggle commands; retained bus commands; commands without an expiry; unbounded queues;
missing data as zero or OK or "last value forever"; cloud-only protection; building your own
cryptography, certificate authority or update mechanism; chasing certificates before a customer asks;
shared gateway secrets; secrets in the repository or images; inbound ports at a site; global caches
without a tenant key; alerts for everything; presenting simulated results as executed; claiming
compliance or certification without evidence; an unanchored hash chain sold as tamper-proof.

## 7. Questions only a person can answer

A functional-safety engineer: validate the command taxonomy, the per-asset start permissives, the
comms-loss policies and the consequences of stopping (water hammer, aeration, disinfection); confirm the
exact wording of the stop-priority rule in the machinery rules and IEC 60204-1; explosive-atmosphere
rules for biogas or wastewater pumps; whether any Greecon deliverable could become a "safety
component". A security architect: the enrolment and certificate design, hardware keys, the update stack
for a containerised agent, row-level security with the time-series database. Counsel: whether Greecon is
a Cyber Resilience Act "manufacturer" for pilots and free trials; whether the reporting duty already
binds deployed edge software; the reporting endpoint with no EU establishment; the reach of the product
liability directive for an Albanian maker; insurance sizing. Management: a support-period policy (five
years minimum under the Act) against ten-year thinking, and a plan for ceasing operations (for example
code escrow). Items recalled from memory and to be confirmed before relying on them are listed at the end
of `docs/research/04-security-safety.md`.
