# ADR 0008: Storage engine and the SeriesStore seam

Status: Proposed. Date: 2026-10-18.

## Context

Readings need time-range storage. TimescaleDB's advanced features are under a licence that bars offering a database service and needs the vendor's consent when the company is sold; the vendor's own benchmark shows near-identical ingest to plain Postgres.

## Decision

Plain PostgreSQL with weekly partitions and our own rollups, behind one `SeriesStore` interface (ingest, latest, range at resolution, rollup, drop, export) with a shared contract test suite, so a second engine can be proven before any migration.

## Alternatives rejected

TimescaleDB or ClickHouse now.

## Consequences

Rollups and retention are ours to run. The disk limit of the current host makes retention mandatory (ADR 0009).

## Reversal or extension trigger

Any of: disk above 60%; a seven-day read of one series above 1 second at the 95th percentile; batch commit above 500 ms or autovacuum not recovering within an hour; more than about three engineer-hours a month on partition and rollup jobs. Then TimescaleDB Community in place after the licence check, or ClickHouse as a second system for scans beyond a terabyte.

## Evidence

`docs/research/09-architecture.md` section C; `05-legal.md` section H.
