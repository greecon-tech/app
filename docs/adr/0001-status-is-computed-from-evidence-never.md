# ADR 0001: Status is computed from evidence, never typed

Status: Accepted, implemented (commits 743d32a, 783758f). Date: 2026-10-18.

## Context

A site's status and a device's health were typed once, at registration, and never recomputed. Readings never expired, so a three-day-old value looked current. A brand new site read "OK". A monitoring system that says all is well when it does not know is worse than none, because people stop walking round.

## Decision

Health is computed on every read from the readings a site holds, their age against a limit per reading, and the alerts standing against it. Four states, each a distinct word and shape: Stable, Attention needed, Action required, Unknown. Unknown is first-class: a site with no readings, or readings that are out of date, is Unknown, never Stable. The roll-up takes the most urgent: Action required, then Unknown, then Attention needed, then Stable, so one site that cannot be checked makes the account Unknown. The stored status, edge status and device health columns are placeholders that are overwritten when read.

## Alternatives rejected

Stored status refreshed by a job (drifts between runs and hides a dead job). Averaging across sites (hides a failure). Showing the last value (false reassurance).

## Consequences

Every list and card carries the age of its data. "OK" is never shown without positive evidence. The web layer must not re-derive truth; it shows what the API computed. A change to the thresholds is a configuration change, not a code change.

## Reversal or extension trigger

None for the principle. The default limits are configuration.

## Evidence

`packages/gaia-core/src/health.ts`, `freshness.ts`; `apps/api/src/platform/platform.status.spec.ts`; `docs/research/06-design.md` section C; `docs/research/04-security-safety.md` section C; `docs/18-reality-audit.md`.
