# ADR 0003: Limits belong to the site; the platform has no universal constants

Status: Accepted, implemented (commits 6edb18c, a7d78a9, 3072825). Date: 2026-10-18.

## Context

Irrigation advice came from a built-in 28% and solar "surplus" from a built-in 1.5 kW. The same 28% is above field capacity in a loamy sand and leaves a silty clay 58% depleted; 1.5 kW is 30% of a 5 kW plant and 0.3% of a 500 kW one. Thresholds were stored on each point but never read.

## Decision

A limit is stored on the reading's point, defined once in `packages/shared` (key, label, plain meaning, unit, range, and the standard the platform uses when it is not set), validated on write (an unknown, misplaced, non-numeric or out-of-range limit is refused), applied at once, and audited with the old and new values. The platform has a standard only where one is safe and honest (a tank's 15% and 35%, a battery's 25%); for irrigation and solar surplus it has none and says nothing until the site sets one.

## Alternatives rejected

Global defaults. Free-form per-site settings without validation.

## Consequences

A site must set an irrigation limit before it gets irrigation advice. A spec ties the stated standards to what the engine does. The reading-points table on a site's page carries the editor.

## Reversal or extension trigger

A standard may be added for a limit when pilot evidence shows a safe default.

## Evidence

`packages/shared/src/index.ts` (`pointLimitDefinitions`); `packages/gaia-core/src/limits.spec.ts`; `apps/api/src/platform/platform.limits.spec.ts`; `docs/research/03-agriculture.md` section B4; `docs/research/01-energy.md` section D3.
