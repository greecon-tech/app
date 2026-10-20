# ADR 0010: Rule evaluation: versioned, pure, bounded

Status: Proposed. Date: 2026-10-18.

## Context

Automatic actions will need rules that are explainable, testable and replayable. Home-automation tools that keep state in memory or drop overlapping triggers silently are not.

## Decision

A pure `evaluate(ruleset@version, snapshot, now)` that returns requests and a "because" record, with no input or output, time as an input, a fixed order, no loops and a small bounded expression subset, one scan per cycle. Rule sets are immutable with an identifier, version, hash, author and approver; activation is a logged event; rollback re-activates the previous version. Stale, bad and unknown readings are explicit branches, never zero. Recorded days are replayed against each new rule set in the build.

## Alternatives rejected

User scripting. Event-graph engines.

## Consequences

Rules are written from templates; equipment addresses are kept apart from rule templates.

## Reversal or extension trigger

One signed customer rule that templates cannot express, plus three similar requests.

## Evidence

`docs/research/09-architecture.md` section E.
