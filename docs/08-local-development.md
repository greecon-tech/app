# Local Development

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Docker Stack

```bash
docker compose up --build
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs` (off when `NODE_ENV=production` unless `ENABLE_API_DOCS=true`)
- Grafana: `http://localhost:3001`
- Postgres/TimescaleDB: `localhost:5432`
- Mosquitto: `localhost:1883`

The database initializes with the schema and demo seed data from `apps/api/src/database/migrations`.

## Demo Access Headers

The API accepts local demo headers:

- `x-tenant-id`
- `x-user-id`
- `x-user-role`
- `x-user-email`

If omitted, the API defaults to the Greecon Demo tenant and operator role.

## The real platform on a laptop

Without a database the API serves the in-memory demo (no sign-in). To run what customers will use, give it a PostgreSQL
(14 or newer) and a signing secret:

```bash
export DATABASE_URL=postgres://user:password@127.0.0.1:5432/greecon     # an empty database
export JWT_SECRET="$(openssl rand -base64 48)"
export BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='a long password of your own'
npm run build && node apps/api/dist/main.js                              # migrates the database, makes you the first administrator
GREECON_API_URL=http://localhost:4000 npm run start -w @greecon/web      # then sign in at http://localhost:3000 with "Greecon team"
```

Add `NODE_ENV=production` to see the production checks (an unsafe or incomplete configuration is reported at start).
To receive the platform's emails and texts without a real account, point it at a stand-in that records them:
`RESEND_API_KEY=x RESEND_API_URL=http://127.0.0.1:4100 TWILIO_ACCOUNT_SID=ACx TWILIO_AUTH_TOKEN=x TWILIO_FROM=+15005550006 TWILIO_API_URL=http://127.0.0.1:4100`
(`scripts/e2e/fake-provider.cjs` is one).

## A pretend meter

`node scripts/pretend-meter.mjs` answers Modbus TCP as units 1, 2 and 3 on port 5020, so that a whole installation can be
rehearsed on a desk (`docs/launch/02-project-manager-manual.md`, "Rehearsal"). `--watts -1800` pretends to export,
`--tank 12` pretends a low tank.

## The end-to-end checks

`npm run build && node scripts/run-smoke.mjs` starts the built API on a fresh database and drives it over HTTP the way the
web app and a box do (needs `TEST_DATABASE_URL` or `SMOKE_DATABASE_ADMIN_URL`). `scripts/e2e/` holds the same journeys in a
real browser (Playwright): see `scripts/e2e/README.md`.

