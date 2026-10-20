# ADR 0007: Transport: the message bus stays on the box, HTTPS crosses the internet

Status: Proposed. Date: 2026-10-18.

## Context

The box uses a local message bus between drivers and the agent. Sparkplug B is common in industrial plants.

## Decision

The bus listens on loopback only. The agent sends over HTTPS with the per-gateway credential. Commands and acknowledgements are at-least-once with idempotent identifiers. Sparkplug B is not adopted: its data messages are best-effort by specification and its gap repair needs rebirth requests, while the agent has a durable buffer and point-to-point acknowledgements.

## Alternatives rejected

A cloud broker with Sparkplug.

## Consequences

Fewer protocols to secure and document. An adapter remains possible.

## Reversal or extension trigger

A signed customer already running Sparkplug nodes or a SCADA host: write an adapter.

## Evidence

`docs/research/09-architecture.md` section B.
