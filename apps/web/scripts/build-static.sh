#!/bin/sh
# Builds the static GitHub Pages export (see docs/12-deployment-github-pages.md).
#
# Several files have a static-only twin that gets swapped in just for this build, then restored
# once it finishes (or fails), so local dev and live SSR deployments always see the real files.
# Next.js's static export flatly refuses to build ANY app containing a Server Action, even one
# never actually rendered in that build — and dynamic import() does not avoid this either
# (Turbopack still bundles it for code-splitting purposes), so the only reliable fix is physically
# removing the file from the source tree before the build:
#
#   automation/page.tsx     — imports RuleForm/RuleActions (rule create/approve/disable/delete).
#   sites/[siteId]/page.tsx — imports ManualControlPanel (manual command dispatch). Also needs the
#     opposite generateStaticParams situation from the SSR version — see that file's own comment.
#   login/page.tsx          — imports LoginForm, which calls the real login Server Action. The
#     static export has no server to log in against at all (see login/page.static.tsx).
#   request-access/page.tsx — imports RequestAccessForm, which calls the request-access Server Action.
#     The static demo has no server to send a request to, so its twin just says how to reach Greecon.
#   change-password/page.tsx — imports ChangePasswordForm, which calls Server Actions. The demo has no accounts.
#   components/Shell.tsx    — imports the logout Server Action and reads the real session. Shell
#     is used by every single page, so this one import would otherwise break the entire export,
#     not just the routes that obviously need it.
#   admin/page.tsx          — imports CreateUserForm/CreateSiteForm and binds the user role/status
#     Server Actions directly (see admin/actions.ts).
#   platform/page.tsx       — imports CreateTenantForm, which calls the createTenantAction Server
#     Action (see platform/actions.ts).
#   analytics/page.tsx      — reads searchParams for a real per-request time range/site query,
#     which has no meaning against a single static HTML file (see page.static.tsx).
#   settings/page.tsx       — binds the dashboard-customization Server Actions (see
#     settings/actions.ts).
#   alerts/page.tsx         — imports AcknowledgeAlertButton/IncidentStatusSelect, which call real
#     Server Actions (see alerts/actions.ts).
#   reports/page.tsx        — imports RequestExportForm, which calls the createReportExportAction
#     Server Action (see reports/actions.ts).
#   maintenance/page.tsx    — imports CreateMaintenanceTaskForm/MaintenanceTaskActions, which call
#     real Server Actions (see maintenance/actions.ts).
#   sites/[siteId]/setup/page.tsx — imports the setup forms (add a box, addresses, registers, confirm a
#     step), which call Server Actions. The twin shows the same checklist read only.
#   sites/[siteId]/handover/page.tsx — no Server Action, but a dynamic route needs generateStaticParams
#     in a static export and must not have it in the live build (same reason as sites/[siteId]/page.tsx).
set -e
# Disables pathname expansion for the rest of the script: one of the paths below literally
# contains "[siteId]", which the shell would otherwise try to glob-match as a one-character
# class (and, finding no match, may or may not leave literally depending on the shell) once it
# goes through the unquoted `for path in $SWAPPED` word-splitting below.
set -f

cd "$(dirname "$0")/.."

SWAPPED="
src/app/automation/page.tsx
src/app/sites/[siteId]/page.tsx
src/app/login/page.tsx
src/app/request-access/page.tsx
src/app/change-password/page.tsx
src/app/admin/page.tsx
src/app/platform/page.tsx
src/app/analytics/page.tsx
src/app/settings/page.tsx
src/app/alerts/page.tsx
src/app/reports/page.tsx
src/app/maintenance/page.tsx
src/app/sites/[siteId]/setup/page.tsx
src/app/sites/[siteId]/handover/page.tsx
src/components/Shell.tsx
"

restore() {
  for path in $SWAPPED; do
    mv "$path.live" "$path"
  done
}

for path in $SWAPPED; do
  cp "$path" "$path.live"
  cp "${path%.tsx}.static.tsx" "$path"
done
trap restore EXIT

NEXT_OUTPUT_EXPORT=1 npx next build
