# Deployment on Railway (pilot)

Railway hosts the initial pilot: it deploys straight from GitHub using the existing Dockerfiles, with no Terraform, no Workload Identity Federation, and no separate CLI setup. Google Cloud (`docs/10-deployment-gcp.md`) remains the target for later, once the pilot outgrows this.

## Network boundary

By default, keep the API service **without** a public domain — only reachable over Railway's private network, called only by the web service. This is still the right default: nothing needs the API to be public until a real edge device (an industrial PC at a farm site) needs to reach it directly.

**If you do need that** (see "Connecting a real edge device" below), it's now safe to give the API a public domain too: `docs/07-security-and-rbac.md`'s old self-asserted `x-user-role` header trust is disabled outright on a production deployment (`NODE_ENV=production`, set by the Dockerfile) — an unauthenticated request gets rejected, not a free role. The one narrow exception is `POST /telemetry/ingest` with a real device secret, scoped to exactly that one route and one gateway's own tenant — see below.

## Connecting a real edge device

Once a real sensor's industrial PC needs to send readings from outside Railway's network, this is entirely a one-time step on the `api` service plus a couple of clicks in the app — no per-client Railway configuration:

1. On the `api` service's Settings → Networking, click **Generate Domain** (the same step the `web` service already has) — needed once, ever, not per client or per gateway.
2. Log into the app as that client (or as a Greecon team member), open the site's own page, and use the **"Add gateway"** form. It generates a real secret for this specific gateway and shows it exactly once.
3. On the edge box itself, set `EDGE_TOKEN` in `/etc/greecon/edge.env` to that secret, and `API_URL` to the api service's public URL — see `docs/14-edge-hardware-deployment.md` for the rest of that setup.

Every gateway gets its own secret this way, scoped to its own tenant only — onboarding a second, third, or hundredth client's device needs nothing beyond step 2 above, repeated on their own site.

**Before you generate that domain, two settings on the `api` service:**

- `TRUST_PROXY=1` — Railway's edge proxy sits in front of a public domain, so without this the API sees
  the proxy's address for every caller and counts all edge boxes (and everyone else) as one source for
  rate limiting. It is the number of trusted proxy hops, not "true": trusting more hops than exist lets a
  caller choose their own address by forging `X-Forwarded-For`. Confirm Railway's hop count for your
  setup before relying on it (check the `x-forwarded-for` header a request actually arrives with).
- Leave `ENABLE_API_DOCS` unset. Swagger (`/docs`, `/docs-json`, `/docs-yaml`) is off in production by
  default; setting it to `true` would publish the API's complete route list to anyone who finds the domain.

**Legacy path, still supported:** a single `EDGE_INGEST_TOKEN`/`EDGE_INGEST_TENANT_ID` variable pair on the `api` service, shared by every gateway in one fixed tenant, was the only option before per-gateway credentials existed. Still works if already configured — both must be set together, either one missing disables it entirely — but a new deployment should use the "Add gateway" form above instead, since this pair can't support more than one client's tenant at all.

## One-time setup, in the Railway dashboard

1. Sign in to [railway.app](https://railway.app) with GitHub, then **New Project → Deploy from GitHub repo** → select `greecon-tech/demo` and the branch to deploy.
2. Add Postgres: in the project, **+ New → Database → Add PostgreSQL**. Railway provisions it and exposes `DATABASE_URL` automatically as a variable on that service — TimescaleDB isn't available here either, and the migrations already handle that (see `docs/10-deployment-gcp.md`).
3. Configure the service Railway created from the repo to be the **API**:
   - Settings → Build → Dockerfile Path: `infra/docker/api.Dockerfile`
   - Settings → Networking → do **not** enable a public domain.
   - Variables: add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Railway's variable-reference syntax — type it literally, it resolves the other service's value).
   - Variables: add `JWT_SECRET` = a real random secret (e.g. `openssl rand -base64 32`) — this signs and verifies login sessions (`docs/07-security-and-rbac.md`). Do not reuse the `.env.example` placeholder.
4. Add a second service for the **web app**: **+ New → GitHub Repo**, same repo/branch.
   - Settings → Build → Dockerfile Path: `infra/docker/web.Dockerfile`
   - Settings → Networking → **enable** a public domain (this is the pilot URL).
   - Variables: add `GREECON_API_URL` = `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000` — replace `api` with whatever you named the API service if you renamed it.
5. Both services redeploy automatically on every push to the connected branch from here on.

There is now real per-user login (`docs/07-security-and-rbac.md`) — visitors land on `/login` and
need a real account to get in. `GREECON_DEMO_ROLE` is no longer needed on this deployment (it only
still matters for the static GitHub Pages export, which has no login at all). Create real accounts
by inserting into `users`/`memberships` with a bcrypt-hashed `password_hash`, the same way
`003_auth.sql` seeds the demo ones — there is no admin UI for this yet
(`docs/15-master-roadmap.md`, Phase 0).

## Load the database schema (one time)

Install the Railway CLI and link it to this project from a terminal (Cloud Shell works fine for this too):

```bash
npm install -g @railway/cli
railway login
railway link            # pick this project when prompted
npm install
npm run build -w @greecon/api
railway run --service api npm run db:migrate -w @greecon/api
```

`railway run` injects that service's real environment (including `DATABASE_URL`) into the command without ever exposing the database publicly.

**Demo vs. real accounts — read this before handing out any login.** `002_seed_demo.sql`,
`003_auth.sql`, and `006_split_demo_and_real_tenant.sql` together produce exactly one demo login
and Eridon's own real account, kept in two completely separate tenants (`docs/13-pilot-readiness.md`,
"There was no way to onboard a second client"):

- **`demo@greecon.earth` / `demo123`** — sales/marketing only. Sees the seeded fake demo tenant
  (solar/battery/water/farm sites with simulated telemetry) and nothing real. Safe to hand to a
  prospect: it holds no real permissions over anything real, by construction (it lives in a tenant
  that only ever contains fake data), and its role is deliberately **operator**, not owner — full
  read access and Manual Control to show off the product, but no `/admin` or `/platform`, so it
  can't create other users, change anyone's role, or reset any password (including its own — that
  needs the `user:manage` permission "operator" doesn't have). Re-running `db:migrate` always puts
  this account back to `demo123`/operator, even if someone changed either by hand in the meantime.
  Never reuse this simple password for a real client account.
- **`eridon.manuka@greecon.earth`** — the real working account, in its own real tenant that starts
  with zero sites/devices until they're actually provisioned via the Admin page. Its password is
  set by hand (not shipped in any migration) — see the password-reset step under "One-time setup"
  below if it's ever forgotten.
- Every **new real client** gets onboarded through `/platform` (Greecon platform administrators
  only) — see `docs/13-pilot-readiness.md` — which creates its own isolated tenant the same way,
  never by editing seed SQL.

Do not add more demo-style shared-password accounts by hand later; use `/admin`'s "Create user" or
`/platform`'s "Onboard a new client" instead, both of which generate a real one-time password.

## Getting the pilot URL

Settings → Networking on the web service shows the generated `*.up.railway.app` domain (or attach a custom domain there, e.g. a `greecon.earth` subdomain).

## Managing rules

The Automation page's rule editor (create, approve, disable, delete) only works here — the static GitHub Pages demo has no server to save changes to. Rules persist in Postgres once `DATABASE_URL` is set and the migration above has run; without it, the API falls back to the same in-memory seed data as the static demo, and edits are lost on restart.
