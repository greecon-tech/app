# Greecon Platform

This repository is the first technical foundation for the Greecon Platform: a calm operational system for renewable energy, water management, agriculture, automation, monitoring, and resource optimization.

The platform is organized as a TypeScript monorepo:

- `apps/web` - the Next.js app: Greecon's own console (Today, Clients, Requests, Team) and the clients' app (Overview, Sites, Alerts, Reports, Settings), one codebase for two audiences (`docs/28-ux-definition.md`).
- `apps/api` - NestJS API and platform services.
- `apps/edge-agent` - the program on the box at a site: reads meters and sensors over Modbus, reports to the platform, keeps readings through an outage, updates itself. Built into one file the API serves, and installed with one pasted line.
- `apps/edge-simulator` - simulated edge gateway, telemetry publisher, buffer, and command acknowledgement flow, for development.
- `packages/shared` - public-safe TypeScript contracts, canonical points, roles, message schemas, and MQTT topics.
- `packages/gaia-core` - internal safety, state, and rule primitives. Do not expose confidential GAIA internals to browser bundles or public copy.
- `infra/docker` - the API and web Dockerfiles (what Railway builds), and the local Postgres/TimescaleDB, Mosquitto, Grafana and edge simulator setup.
- `infra/terraform` - Google Cloud deployment foundation placeholders.
- `scripts` - the smoke tests that drive a running platform over HTTP, a pretend meter for rehearsals, and the box software's build.
- `docs` - architecture, data, security, edge, frontend, and deployment documentation, the product's constitution, reality audit, research and decision records. Start with `docs/README.md`.
- `docs/launch` - putting Greecon on the market with a project manager: go-live, the project manager's manual, hardware, sales kit, runbooks, and the printable PDF guides (`docs/launch/pdf`, one pack for each kind of site).

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

The API migrates the stack's database itself when it starts. The demo client login is `demo@greecon.earth` with `demo123`; to sign in as the Greecon team, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in your shell before `docker compose up`.

Without a database the API serves deterministic demo data and every command is simulated. With one (`DATABASE_URL`) it is the real platform: sign-in, clients, sites, boxes, alerts by email and text, downloads. Nothing in this platform writes to equipment. Production secrets are never in the repository: see `docs/launch/01-founder-go-live.md`.
