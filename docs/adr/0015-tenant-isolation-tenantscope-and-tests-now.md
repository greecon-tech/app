# ADR 0015: Tenant isolation: TenantScope and tests now, row-level security later

Status: Proposed. Date: 2026-10-18.

## Context

The Overview once summed every tenant. Database row-level security cannot protect reads served from the in-memory working set.

## Decision

Every repository method takes a non-optional tenant scope derived from the verified session, and stores are keyed by tenant. A whole-service isolation specification tests reads, writes and a guard for new methods (in force). Row-level security is added on the low-volume tables when the database becomes a read path.

## Alternatives rejected

Row-level security alone. A database per tenant.

## Consequences

The tenant-scope type makes an unscoped read unrepresentable. A tenant-leading index on every policy column when row-level security arrives.

## Reversal or extension trigger

The database becomes a read path for tenant data, an audit asks for database-enforced isolation, or a test finds a leak.

## Evidence

`apps/api/src/platform/platform.isolation.spec.ts`; `docs/research/09-architecture.md` section F; `04-security-safety.md` section F.
