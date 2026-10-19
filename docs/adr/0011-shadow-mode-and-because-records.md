# ADR 0011: Shadow mode and "because" records

Status: Proposed. Date: 2026-10-18.

## Context

A new rule that acts on deploy can surprise people. Trust comes from seeing purpose, process and performance.

## Decision

Every new rule version starts in shadow: it evaluates, stores the request it would have made with `executed=false`, and never acts, until a week and one full process cycle have been reviewed against what people did. Every decision records the rule set hash, the inputs with age and quality (copied in so raw samples may expire), the result, whether it executed, what blocked it and the approval.

## Alternatives rejected

Enforce on deploy.

## Consequences

A diff view between would-be requests and operator actions. A hotfix may shorten shadow with two-person approval.

## Reversal or extension trigger

None.

## Evidence

`docs/research/09-architecture.md` section E; `06-design.md` section D.
