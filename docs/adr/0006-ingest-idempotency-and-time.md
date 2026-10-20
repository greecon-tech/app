# ADR 0006: Ingest idempotency and time

Status: Proposed. Date: 2026-10-18.

## Context

A gateway resends after a failure, so duplicates are normal; clocks drift; data arrives late after an outage.

## Decision

Deduplicate on `(gatewayId, batchSeq)` at the transport (a repeat returns "duplicate", the next applies, a gap returns a conflict and the agent resends from the last applied) and on a unique `(series, time)` per row, first write wins, with a different value for an existing key counted and alerted. Store the measurement time, the receive time and a clock state; a skew over 60 seconds marks a reading uncertain; readings more than five minutes ahead are refused. Data older than twice its limit when it arrives is flagged historical and no cloud rule acts on it.

## Alternatives rejected

Per-sample identifiers. Trusting device time or arrival time alone.

## Consequences

A sequence number in the box protocol and a unique index in the store.

## Reversal or extension trigger

The unique index limits inserts (batch commit p95 above 500 ms): fall back to the batch sequence plus a block-range index.

## Evidence

`docs/research/09-architecture.md` section B; `04-security-safety.md` C.
