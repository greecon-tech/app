import { Shell } from "../../components/Shell";

export const metadata = { title: "Clients" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Platform-admin status
// only ever comes from a real logged-in session (apps/api/src/common/principal.ts) — the static
// export has neither a server to log in against nor any session at all, so there is nothing real
// to show here regardless of which of the five demo-role builds this is.
export default function ClientsPage() {
  return (
    <Shell title="Clients" subtitle="Every customer account. Open one to set it up or to look after it.">
      <div className="panel">
        <p className="muted">
          Client onboarding requires a live deployment (Railway or Google Cloud) with a real logged-in platform-administrator session — this static
          build has no server and no session at all. See docs/12-deployment-github-pages.md.
        </p>
      </div>
    </Shell>
  );
}
