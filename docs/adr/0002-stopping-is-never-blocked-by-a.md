# ADR 0002: Stopping is never blocked by a process condition

Status: Accepted, implemented (commit 743d32a). Date: 2026-10-18.

## Context

The command checks refused "off" while pressure was over its limit and after a manual override had expired. A guard that cannot be stopped is a hazard. Tests had been written that asserted this behaviour.

## Decision

Commands are classified by direction. Stop, close, disable, de-energise and "off" are safe-direction; start, open, enable, "on" and any value the rules do not recognise are hazardous-direction. Process conditions (pressure, flow, rest time, data quality and age, dry-run state) gate only the hazardous direction. A safe-direction command still needs authorisation, a stated reason and an audit entry. Because a stop can have consequences (water hammer, lost aeration or disinfection), the check returns a note, never a block.

## Alternatives rejected

The same interlocks on every command. Treating an unfamiliar value as the safe direction.

## Consequences

Two earlier tests that asserted the bug were rewritten to assert the opposite. A new safe-direction word needs a decision recorded here.

## Reversal or extension trigger

None for blocking a stop.

## Evidence

`packages/gaia-core/src/index.ts` (`evaluateCommandSafety`, `isSafeDirectionCommand`); `safety.spec.ts`; `platform.service.spec.ts`; `docs/research/04-security-safety.md` section B1.
