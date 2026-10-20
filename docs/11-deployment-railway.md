# Deployment on Railway

Railway hosts the first customers: it builds from GitHub with the Dockerfiles in `infra/docker/`, with no Terraform
and no separate tooling. Google Cloud ([10](10-deployment-gcp.md)) is the target when this is outgrown. **The
click-by-click version for the founder is [launch/01 Founder go-live](launch/01-founder-go-live.md); this page is the
reference it rests on.**

## Shape

```
 box at a site ──HTTPS──►  api.greecon.earth ──┐
 browser ──HTTPS──► app.greecon.earth (web) ───┼──►  api service ──► Postgres
                       private network ────────┘      (NestJS)
```

Three Railway services in one project: **Postgres**, **api** (`infra/docker/api.Dockerfile`) and **web**
(`infra/docker/web.Dockerfile`). The web service reaches the API over Railway's private network
(`GREECON_API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000`); a browser never calls the API directly. The **API has a public
domain** because a box at a customer's site reports to it. Both have custom domains:

| | Address | Why |
|---|---|---|
| Web | `https://app.greecon.earth` | What people type |
| API | `https://api.greecon.earth` | **Written into every box when it is enrolled.** If this ever has to change, every box needs a visit. Choose it once. |

The API builds the box's software into itself (`npm run build:edge-bundle` in the Dockerfile) and serves it, so a
box is installed from, and updated by, the platform it reports to (`14-edge-hardware-deployment.md`).

## The API's settings

All are Railway variables on the **api** service. The API refuses to start with an unsafe production configuration
(`apps/api/src/common/runtime-config.ts`) and names the setting; it warns about the rest at every start.

| Variable | Needed | Meaning |
|---|---|---|
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}`. PostgreSQL 14 or newer (the history charts use `date_bin`) |
| `JWT_SECRET` | Yes | At least 32 characters; signs sessions. Missing or short: boot stops. Changing it signs everyone out |
| `PORT` | Yes | `4000` (the web service's private address uses it) |
| `TRUST_PROXY` | Yes | `1`: the number of proxy hops to trust for the caller's address (rate limits count each site separately) |
| `PUBLIC_API_URL` | Yes | `https://api.greecon.earth`; the address in every install command. Warns if missing or not https |
| `PUBLIC_WEB_URL` | Yes | `https://app.greecon.earth`; the link in each message. Warns if missing |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First start | Creates (or sets the password of) the first Greecon administrator, at least 12 characters. They only fill a gap: an account with a password keeps it. Remove them after |
| `SALES_NOTIFY_EMAIL` | Recommended | Emailed on each request for access. Warns if missing |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_FROM_NAME`, `ALERT_REPLY_TO` | Recommended | Email. The sender defaults to `Greecon <alerts@greecon.earth>`, replies to `info@greecon.earth`. The sending domain must be verified at Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` | Recommended | Text messages (Act now only). `TWILIO_FROM` is a number in international form, or a sender name such as `Greecon` where the destination country allows it. All three of the first group, or none: a partial set is reported and left off |
| `EDGE_AUTO_UPDATE` | No | `false` holds every box on the software it has (a platform-side hold, for when an update must wait) |
| `DEMO_FEED` | No | `false` stops the simulated feed of the demo account |
| `ENABLE_API_DOCS` | No | Leave unset: it would publish the API's route list |
| `AUTO_MIGRATE` | No | Leave unset: the database is brought to the current version at start (`false` skips it) |
| `RESEND_API_URL`, `TWILIO_API_URL` | Rehearsal only | Point the two providers at a stand-in that records what would be sent |
| `EDGE_INGEST_TOKEN`, `EDGE_INGEST_TENANT_ID` | Do not set | A legacy shared token for readings only; per-box credentials replace it |

The **web** service has one variable, `GREECON_API_URL`.

## Releasing

Both services redeploy on every push to the connected branch (`main`). The API stops a bad release before it serves:
a failed migration or an unsafe setting ends start-up, and Railway keeps the previous deployment running. With a
healthcheck path of `/health` Railway switches only when the new one answers. **Going back:** the service,
**Deployments**, the earlier one, **Redeploy**. New versions only ever add to the database, so the previous one runs
on it. GitHub Pages republishes the demo from the same push (`12-deployment-github-pages.md`).

## The database

Migrations (`apps/api/src/database/migrations/`) run at start, once each, recorded in `schema_migrations` with a
checksum; a migration that was changed after it ran stops the start, and an older database made before the ledger is
brought under it without replaying anything. The first start also closes any account that still carries a password this
repository ever published (except the demo account) and creates the first administrator from `BOOTSTRAP_ADMIN_*`.

The demo account `demo@greecon.earth` (password `demo123`, **operator**, in the demo tenant, which holds only simulated
data and which a visitor can look at and try but cannot send a message from) is public by design. It is the only shared
login that exists.

Backups: the Postgres service's scheduled backups (what the plan allows), plus a weekly `pg_dump` copy kept off Railway,
plus a monthly restore drill into a scratch service (`launch/05-runbooks.md`, R13).

## Watching it

An outside check on `/health` (it shows `"database":"connected"`), the platform's own morning message to Greecon's team
and the fleet table on the Clients page (`launch/05-runbooks.md`). Railway's **Usage** page shows what each service costs; expect
about EUR 20 to 40 a month at the start.

## Moving on

Nothing here ties the services to Railway: they are two containers and a Postgres. When a customer's rules name a hosting
country or provider, or the sites number in the dozens, move to Google Cloud following `10-deployment-gcp.md`: the
settings above are the same, `PUBLIC_API_URL` must keep its value so that boxes keep reporting, and the move is a
change of where the DNS names point.
