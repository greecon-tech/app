# Data Model

The database foundation targets PostgreSQL with TimescaleDB for telemetry. The schema is defined in `apps/api/src/database/migrations`.

## Core Tables

- `tenants`
- `users`
- `memberships`
- `sites`
- `assets`
- `edge_gateways`
- `devices`
- `points`
- `telemetry_readings`
- `derived_states`
- `rules`
- `rule_versions`
- `rule_approvals`
- `commands`
- `command_results`
- `alerts`
- `incidents`
- `maintenance_tasks`
- `audit_events`
- `edge_sync_batches`
- `manual_overrides`
- `report_exports`

## Telemetry

Every telemetry reading carries UTC timestamp, tenant ID, site ID, optional asset ID, device ID, point ID, canonical point name, value, unit, quality flag, source, and ingestion timestamp.

`telemetry_readings` is a TimescaleDB hypertable partitioned by `timestamp_utc` where the extension is
installed (the local Docker setup). On managed Postgres such as Railway and Cloud SQL it is an ordinary
table: the migration decides when it runs. The storage direction for growth (plain Postgres with
partitions and our own rollups behind a `SeriesStore` interface, not a time-series licence) is proposed
in `adr/0008-storage-engine-and-the-seriesstore-seam.md`, with the measurements that would trigger it in
`24-architecture-seams.md`.

## Indexing

The migration adds indexes for tenant, site, asset, device, point, timestamp, severity, status, and audit event type. These indexes support tenant isolation, site views, operational filtering, and time-series retrieval.

## Repository Decision

The API keeps its working set in memory and, when `DATABASE_URL` is set, loads it from Postgres at start-up and writes every change through. With no database it runs on the seeded demo set, which is how the tests and the static demo work. No ORM is used; the schema stays explicit. The limits of this arrangement (one replica, memory-bound) and what would change it are in `24-architecture-seams.md`.
