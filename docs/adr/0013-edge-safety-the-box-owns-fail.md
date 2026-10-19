# ADR 0013: Edge safety: the box owns fail states

Status: Proposed. Date: 2026-10-18.

## Context

The cloud is never on the control path within the process safety time, and the internet will drop.

## Decision

The box declares per actuator a fail state and a maximum autonomous time. Loss of the internet alone triggers nothing. Triggers are local: a stale or bad reading, a local bus fault, a command's expiry on a monotonic clock. Commands are short-lived requests that the box validates and may refuse. A watchdog restarts the agent, and three reboots in an hour start it monitor-only.

## Alternatives rejected

Cloud-side interlocks. Failing on disconnect.

## Consequences

The per-actuator values need an engineer. The check is repeated at execution time on the box.

## Reversal or extension trigger

None for the safety boundary.

## Evidence

`docs/research/09-architecture.md` section D; `04-security-safety.md` sections A and B.
