# API Design

The API is a NestJS service with explicit modules:

- `auth`
- `tenants`
- `users`
- `sites`
- `assets`
- `devices`
- `points`
- `telemetry`
- `derived-states`
- `rules`
- `commands`
- `alerts`
- `incidents`
- `maintenance`
- `reports`
- `audit`
- `edge-sync`
- `health`

## Behavior

- TypeScript strict mode.
- DTO validation with `class-validator`.
- RBAC enforced by backend guards.
- Tenant scope enforced in service methods.
- State-changing actions create audit events.
- Secrets are read from environment variables.
- Swagger is available at `/docs` (and the raw spec at `/docs-json` / `/docs-yaml`) everywhere except a production deployment, where it is off unless `ENABLE_API_DOCS=true`. A public API should not publish its own route map to anonymous visitors.

## Core Endpoints

- `GET /auth/session`
- `GET /overview`
- `GET /sites`
- `GET /sites/:siteId`
- `GET /assets`
- `GET /devices`
- `GET /points`
- `POST /telemetry/ingest`
- `GET /telemetry/latest`
- `GET /derived-states`
- `GET /rules`
- `POST /rules/simulate`
- `POST /commands`
- `POST /commands/manual-override`
- `POST /commands/:commandId/ack`
- `GET /alerts`
- `POST /alerts/:alertId/acknowledge`
- `GET /incidents`
- `PATCH /incidents/:incidentId/status`
- `GET /maintenance`
- `GET /reports/templates`
- `POST /reports/exports`
- `GET /audit`
- `POST /edge-sync/batches`
- `GET /health`
