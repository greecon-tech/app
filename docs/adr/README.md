# Architecture decision records

One page per decision that touches safety, security, data, or what we may claim. Each states the
context, the decision, what was rejected, the consequences and, for anything not yet proven, the
trigger that would reverse or extend it. A decision is changed by a new record that supersedes it,
never by editing history.

Status words: **Accepted, implemented** means the decision is in force and has a test; **Proposed**
means it comes from the October 2026 research, has not been reviewed by an engineer, and is not
built unless it says so. The register of extension points is `docs/24-architecture-seams.md`.

| # | Decision | Status |
|---|---|---|
| [0001](0001-status-is-computed-from-evidence-never.md) | Status is computed from evidence, never typed | Accepted, implemented |
| [0002](0002-stopping-is-never-blocked-by-a.md) | Stopping is never blocked by a process condition | Accepted, implemented |
| [0003](0003-limits-belong-to-the-site-the.md) | Limits belong to the site; the platform has no universal constants | Accepted, implemented |
| [0004](0004-every-command-is-simulated-until-the.md) | Every command is simulated until the release gate is met | Accepted, implemented |
| [0005](0005-vocabulary-and-units.md) | Vocabulary and units | Proposed |
| [0006](0006-ingest-idempotency-and-time.md) | Ingest idempotency and time | Proposed |
| [0007](0007-transport-the-message-bus-stays-on.md) | Transport: the message bus stays on the box, HTTPS crosses the internet | Proposed |
| [0008](0008-storage-engine-and-the-seriesstore-seam.md) | Storage engine and the SeriesStore seam | Proposed |
| [0009](0009-retention-tiers.md) | Retention tiers | Proposed |
| [0010](0010-rule-evaluation-versioned-pure-bounded.md) | Rule evaluation: versioned, pure, bounded | Proposed |
| [0011](0011-shadow-mode-and-because-records.md) | Shadow mode and "because" records | Proposed |
| [0012](0012-actuator-arbitration.md) | Actuator arbitration | Proposed |
| [0013](0013-edge-safety-the-box-owns-fail.md) | Edge safety: the box owns fail states | Proposed |
| [0014](0014-updates-signed-with-rollback-now-whole.md) | Updates: signed with rollback now, whole-image updates later | Proposed |
| [0015](0015-tenant-isolation-tenantscope-and-tests-now.md) | Tenant isolation: TenantScope and tests now, row-level security later | Proposed |
| [0016](0016-api-contract-and-versioning.md) | API contract and versioning | Proposed |
| [0017](0017-observability-an-external-dead-man-s.md) | Observability: an external dead-man's switch and three objectives | Proposed |
| [0018](0018-build-or-buy-defaults.md) | Build-or-buy defaults | Proposed |
