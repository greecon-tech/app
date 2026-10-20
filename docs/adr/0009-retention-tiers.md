# ADR 0009: Retention tiers

Status: Proposed. Date: 2026-10-18.

## Context

10,000 series at 10 seconds is about 2.6 terabytes a year raw (an estimate of 84 bytes a row); the current host's self-serve disk is 1 terabyte.

## Decision

Raw readings 30 days (60-second default, 10 seconds only for control-relevant points; 1 second stays on the box except around an incident); five-minute rollups 13 months; hourly rollups 10 years; daily rollups, events and "because" records indefinitely; evidence windows (an hour either side of an alert or command) 13 months or the legal minimum. Never average readings that are not good; keep the good count.

## Alternatives rejected

Keep all raw readings.

## Consequences

Long-range questions are answered from rollups. Legal retention minimums, once known, override these.

## Reversal or extension trigger

A contract or law needs a longer raw history.

## Evidence

`docs/research/09-architecture.md` section C; `02-water.md` B2.
