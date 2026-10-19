# Greecon Platform

This repository is the first technical foundation for the Greecon Platform: a calm operational system for renewable energy, water management, agriculture, automation, monitoring, and resource optimization.

The platform is organized as a TypeScript monorepo:

- `apps/web` - Next.js operator interface.
- `apps/api` - NestJS API and platform services.
- `apps/edge-simulator` - simulated edge gateway, telemetry publisher, buffer, and command acknowledgement flow.
- `packages/shared` - public-safe TypeScript contracts, canonical points, roles, message schemas, and MQTT topics.
- `packages/gaia-core` - internal safety, state, and rule primitives. Do not expose confidential GAIA internals to browser bundles or public copy.
- `infra/docker` - local Postgres/TimescaleDB, Mosquitto, Grafana, API, web, and edge simulator setup.
- `infra/terraform` - Google Cloud deployment foundation placeholders.
- `docs` - architecture, data, security, edge, frontend, and deployment documentation, the product's constitution, reality audit, research and decision records. Start with `docs/README.md`.

## Local Development

Install dependencies:

```bash
npm install
```

Build packages and run tests:

```bash
npm run build:packages
npm test
```

Run the full local stack:

```bash
docker compose up --build
```

Local services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`
- Postgres/TimescaleDB: `localhost:5432`
- Mosquitto MQTT: `localhost:1883`
- Grafana: `http://localhost:3001`

The MVP uses deterministic demo data and simulated commands by default. Real device credentials, gateway certificates, Stripe billing, and production secrets are intentionally excluded.
