# ADR 0014: Updates: signed with rollback now, whole-image updates later

Status: Proposed. Date: 2026-10-18.

## Context

The Cyber Resilience Act expects signed updates with rollback, a bill of materials and support for at least five years.

## Decision

Now: a signed package or container pinned by digest, the previous version kept, automatic rollback after a failed health check, a staged rollout (1%, 10%, 100%), never during a command. Later: full-image A/B updates with an established tool.

## Alternatives rejected

Manual updates over a remote shell.

## Consequences

A key held offline for signing; a health check that decides rollback.

## Reversal or extension trigger

An operating-system level update is needed, more than 20 hard-to-reach devices exist, or the first EU hardware sale approaches.

## Evidence

`docs/research/09-architecture.md` section D; `04-security-safety.md` section E.
