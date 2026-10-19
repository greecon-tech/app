# Deployment on Google Cloud

The initial pilot is deployed on Railway instead (see `docs/11-deployment-railway.md`) — far less setup for a first pilot. This remains the target for real production infrastructure once the pilot outgrows Railway; `.github/workflows/deploy.yml` is wired for it already, just switched to manual-trigger-only until it's needed.

Production infrastructure runs on Google Cloud:

- Cloud Run for the API and web services.
- Cloud SQL for PostgreSQL. TimescaleDB isn't available on Cloud SQL — the migrations enable it opportunistically and fall back to a plain, indexed `telemetry_readings` table when it isn't present.
- Secret Manager for the database URL.
- Artifact Registry for container images.
- Workload Identity Federation for GitHub Actions — deploys authenticate to Google Cloud without any long-lived service account key ever existing.

Mosquitto, the edge simulator, and Grafana are local-development-only for now (see `docker-compose.yml`). Add them to Cloud Run/Cloud SQL once a real pilot site needs live MQTT ingestion.

## Network boundary

**Boxes change this section.** Everything below was written when only the web service called the API. A box at a customer's
site reports to the API from the internet (`docs/14-edge-hardware-deployment.md`), so on Google Cloud, as on Railway
(`docs/11-deployment-railway.md`), the API must be reachable from outside. That is safe now: it rejects every request that does not carry a
verified session, a box's own credential or a one-time enrolment code, and a box's credential opens only the five routes it needs
(`docs/07-security-and-rbac.md`). So the API can be public, and the web service then does not need to attach a Cloud
Run identity token. Keep the address boxes use (`PUBLIC_API_URL`, `https://api.greecon.earth`) pointing at it through any move, because every
box has it written in.

The paragraph below describes the earlier, private arrangement and applies only if a customer's rules insist on it (then
boxes would need a private tunnel to the API).


The API Cloud Run service is **private** — only the web service's own runtime identity may invoke it (`roles/run.invoker`, scoped to that one service account). The web service is the only public endpoint. This still matters even now that real per-user login exists (`docs/07-security-and-rbac.md`): the login-less header fallback (`x-user-role`) only stays safe because a caller from the open internet can never reach the API to use it in the first place. Since the web app's Next.js server components are the only caller, and they attach a Google-signed Cloud Run identity token to every request (`apps/web/src/lib/api.ts`) alongside the real user's session token, a pilot visitor never gets the chance to set that header themselves.

Set `JWT_SECRET` as a Secret Manager entry alongside the database URL — never as a plain Cloud Run environment variable — since it signs every login session.

## One-time setup

1. Enable billing on the target GCP project.
2. From Cloud Shell (or a machine with `gcloud`/`terraform` installed and authenticated as a project owner):

   ```bash
   cd infra/terraform
   terraform init
   terraform apply -var="project_id=<your-project-id>" -var="github_repository=<owner>/<repo>"
   ```

   This provisions: required APIs, Artifact Registry, Cloud SQL (Postgres), the `DATABASE_URL` and `JWT_SECRET` secrets (the latter a Terraform-generated random value, never typed by hand), three service accounts (a CI/CD deployer plus one runtime identity per Cloud Run service), the Workload Identity Federation pool/provider trusting only the named GitHub repository, and both Cloud Run services (seeded with a public placeholder image on the very first apply, already wired to read both secrets at runtime).

3. Take the values below from `terraform output` and set them as **GitHub Actions repository variables** (Settings → Secrets and variables → Actions → Variables — these aren't secrets, so variables, not secrets):

   | Terraform output | GitHub variable |
   | --- | --- |
   | `project_id` you passed in | `GCP_PROJECT_ID` |
   | `var.region` (default `europe-west1`) | `GCP_REGION` |
   | `workload_identity_provider` | `GCP_WORKLOAD_IDENTITY_PROVIDER` |
   | `deploy_service_account_email` | `GCP_DEPLOY_SERVICE_ACCOUNT` |
   | `artifact_registry_repository` (just the repo name, `greecon`) | `GCP_ARTIFACT_REGISTRY` |

4. Push to `main`. `.github/workflows/deploy.yml` builds both Docker images, pushes them to Artifact Registry, and updates both Cloud Run services. Terraform's `lifecycle.ignore_changes` on the container image means re-running `terraform apply` afterward won't revert the image the workflow deployed.
5. Load the database schema once the Cloud SQL instance exists. From Cloud Shell (or anywhere with the Cloud SQL Auth Proxy running against the instance), with `DATABASE_URL` pointing at it:

   ```bash
   npm run build -w @greecon/api
   DATABASE_URL="postgres://greecon_app:<password from Secret Manager>@127.0.0.1:5432/greecon" \
     npm run db:migrate -w @greecon/api
   ```

   This runs every migration file in order (`apps/api/src/database/migrate.ts`). It's idempotent for schema/tenant/site/user rows (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) but re-running it does insert a fresh batch of demo telemetry readings each time, so treat it as a one-time setup step, not something to wire into the deploy workflow. For a real (non-demo) pilot, don't run `002_seed_demo.sql`'s demo accounts as-is — see the credential warning in `docs/11-deployment-railway.md`.
6. `terraform output cloud_run_web_url` is the pilot URL.

## Production Requirements

- No real secrets in source control — the database password is generated by Terraform (`random_password`) and only ever stored in Secret Manager.
- Dedicated service accounts per service (deployer, API runtime, web runtime), each with least-privilege roles.
- Private database access via the Cloud SQL unix socket (no public database IP exposure beyond what Cloud SQL's own IAM/networking enforces).
- Structured logs and health checks (`GET /health`) already exist; Cloud Logging/Monitoring alert policies for API health, database saturation, ingestion failures, MQTT bridge failures, gateway offline events, and safety blocks are not yet configured — add them once real pilot traffic exists.

## MQTT Production Note

The local MVP uses Mosquitto in Docker. Production MQTT needs a hardened broker or managed messaging bridge with TLS, gateway identity, topic authorization, and audit logging for critical channels — not yet built.
