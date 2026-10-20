# Publishing a demo snapshot to GitHub Pages

This is the fastest path to a link you can put in front of a prospect — not a real deployment. `.github/workflows/pages.yml` builds the API, starts it locally inside the GitHub Actions runner on its built-in seeded demo data (no database, no secrets), then builds a **static export** of the web app: every page is fetched once at build time and baked into plain HTML. Once published, nothing is running — it's a snapshot, not a live system. Nobody can log in, submit a command, or see data change; it's exactly what the seeded demo data looked like at publish time.

For an actual pilot with a live backend, use Railway (`docs/11-deployment-railway.md`, step by step in `docs/launch/01-founder-go-live.md`) or, later, Google Cloud (`docs/10-deployment-gcp.md`). The live platform has its own demo, on the real software with simulated data: `demo@greecon.earth` (`docs/launch/04-sales-kit.md`).

The snapshot cannot do what needs a server, so some pages are replaced by a twin in this build (`apps/web/scripts/build-static.sh` lists them): sign-in, requesting access, the setup list, Who is told, the Clients console and the download links say that the demo makes no files and sends nobody a message.

## One-time setup

In the repo on GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**. That's the only manual step.

## Publishing

Push to `main`, or run the workflow manually from the **Actions** tab → "Publish demo to GitHub Pages" → "Run workflow". The workflow builds five static snapshots from the same seeded data — one per user role — and publishes them side by side:

| Role     | URL                                                 |
| -------- | ---------------------------------------------------- |
| Operator | `https://greecon-tech.github.io/app/`                |
| Owner    | `https://greecon-tech.github.io/app/owner/`          |
| Admin    | `https://greecon-tech.github.io/app/admin/`          |
| Viewer   | `https://greecon-tech.github.io/app/viewer/`         |
| Auditor  | `https://greecon-tech.github.io/app/auditor/`        |

Operator stays at the site root so the URL already shared with prospects keeps working. Each page's "Viewing as" chip in the top bar opens a menu linking to the same role's sibling builds. The sidebar navigation itself changes per role — e.g. Admin and Settings are hidden for anyone without `user:manage` — so switching roles shows genuinely different access, not just a different label. The underlying seeded data is identical across all five; only the RBAC-driven navigation differs, since this is a fully static, read-only snapshot.

## Updating it

Every push to `main` republishes automatically with whatever the seeded demo data looks like at that point — there's nothing to re-run manually.
