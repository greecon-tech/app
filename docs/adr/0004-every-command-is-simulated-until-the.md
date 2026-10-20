# ADR 0004: Every command is simulated until the release gate is met

Status: Accepted, implemented (commit a81330f). Date: 2026-10-18.

## Context

No path from the platform to equipment exists, but the manual control panel reported "Dispatched", which an operator reads as "the pump was started". Greecon's liability moves from reporting to causing at the first real write.

## Decision

Every command record carries `executionMode: "simulated"`; the interface says "Simulated only. Nothing is sent to equipment yet"; a specification fails if any command is anything else. A `live` mode is added only when every item of the release gate in `docs/23-safety-and-security-case.md` is true and written down.

## Alternatives rejected

A feature flag that dispatches to the box. Leaving the wording ambiguous.

## Consequences

No pilot with a real actuator until the gate is met: signed commands with expiry, an edge check, a lock-out signal, commissioning evidence, a control addendum, the insurer's agreement, and 90 days of read-only operation.

## Reversal or extension trigger

The release gate itself is the path to reversal.

## Evidence

`apps/api/src/platform/platform.service.ts` (`CommandRecord`); `platform.service.spec.ts`; `docs/research/04-security-safety.md` B10; `docs/research/05-legal.md` F3 and F4.
