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
