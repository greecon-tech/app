# ADR 0017: Observability: an external dead-man's switch and three objectives

Status: Proposed. Date: 2026-10-18.

## Context

A monitoring platform that fails silently is worse than none.

## Decision

Layered liveness: the gateway heartbeat and a scheduled server watchdog, plus an external heartbeat service and an outside probe that alert through a channel the platform's own notifier does not use. Three starting objectives: data freshness (99% over 30 days), alert latency (95th percentile under 2 minutes, with an hourly synthetic alert), command round trip (95th percentile under 10 seconds). Page only on a burn of freshness or alert latency.

## Alternatives rejected

Dashboards without objectives.

## Consequences

An external dependency for the heartbeat; a runbook per page.

## Reversal or extension trigger

A contractual service level, or a team above three people: formal on-call.

## Evidence

`docs/research/09-architecture.md` section I.
