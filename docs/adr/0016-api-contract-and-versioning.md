# ADR 0016: API contract and versioning

Status: Proposed. Date: 2026-10-18.

## Context

Devices sold in year Y must work to year Y plus five; customers integrate with the API.

## Decision

`/v1` in the path; additive changes are non-breaking; a breaking change is `/v2` in parallel with 12 months' notice and `Deprecation` and `Sunset` headers. One OpenAPI document checked against real responses in the build. Errors as RFC 9457 problem documents. Opaque cursors, never offsets, for time series. An `Idempotency-Key` on command requests. The box protocol carries a version and never drops fields. Export as CSV (stated dialect), JSON Lines and a manifest; Parquet on demand.

## Alternatives rejected

An unversioned API. Offset paging.

## Consequences

A contract test in the build; a changelog with an "alert behaviour" flag.

## Reversal or extension trigger

The first breaking change: ship `/v2` in parallel.

## Evidence

`docs/research/09-architecture.md` section H.
