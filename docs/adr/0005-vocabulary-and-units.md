# ADR 0005: Vocabulary and units

Status: Proposed. Date: 2026-10-18.

## Context

The platform has sixteen canonical readings. Customers will want others (a probe depth, a laboratory value, a gas concentration). Wholesale adoption of a building vocabulary is heavy and the closed list is what lets the rules be tested.

## Decision

The sixteen names stay closed in code, each with a quantity kind, one UCUM unit, a value type, a plausible range, a maximum rate of change and a flag for whether hard rules may use it. A customer's own kind is a registry row `x.<tenant>.<slug>`, validated on insert and carrying required metadata (a probe's depth and calibration; a laboratory value's method and detection limit). Such kinds are monitored and advisory only: operating limits accept canonical names only, and promotion needs a release with test vectors. Storage stays one narrow table so a new kind never needs a schema change.

## Alternatives rejected

Free-form kinds. Adopting Haystack or Brick wholesale.

## Consequences

A small registry table and validation. Missing metadata stores the reading as uncertain, never drops it.

## Reversal or extension trigger

Three paying sites ask for a kind outside the sixteen in a quarter: build the registry screen. Three tenants use one kind and unit for 90 days: promote it.

## Evidence

`docs/research/09-architecture.md` section A; `02-water.md` F; `03-agriculture.md` B3.
