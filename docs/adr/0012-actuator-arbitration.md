# ADR 0012: Actuator arbitration

Status: Proposed. Date: 2026-10-18.

## Context

Several rules, a schedule and a person may all want the same actuator.

## Decision

One writer per actuator. Rules emit requests with a priority class to an arbiter: 1 local or manual override, 2 operating limits, 3 held trip, 4 approved schedule or command, 5 advice. Minimum on and off times belong to the actuator. Ties break by rule identifier and losers are logged.

## Alternatives rejected

Rules writing outputs directly.

## Consequences

A small arbiter component and a loser log.

## Reversal or extension trigger

An actuator that needs more than five classes.

## Evidence

`docs/research/09-architecture.md` section E.
