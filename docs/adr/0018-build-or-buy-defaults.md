# ADR 0018: Build-or-buy defaults

Status: Proposed. Date: 2026-10-18.

## Context

A very small team cannot run everything, and every dependency is a lock-in and a sub-processor.

## Decision

A Postgres outbox, then a Postgres-based job queue, for background work; S3-compatible object storage in the EU; an EU transactional e-mail provider; a status page and heartbeat on a different provider from the API; an error tracker with an EU data location and scrubbing; our own sessions behind an `AuthProvider` seam. Each behind a small interface.

## Alternatives rejected

Redis or Kafka at the core. Self-hosting everything.

## Consequences

Providers are listed as sub-processors. Interfaces keep a switch cheap.

## Reversal or extension trigger

The outbox is outgrown; a licence change.

## Evidence

`docs/research/09-architecture.md` section J.
