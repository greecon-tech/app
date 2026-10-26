import { Shell } from "../../../components/Shell";

export const metadata = { title: "Requests" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the team's console needs a real session.
export default function RequestsPage() {
  return (
    <Shell title="Requests" subtitle="Who has asked for Greecon, and what has become of it.">
      <div className="panel">
        <p className="muted">Greecon's own console needs a live deployment and a real team sign-in. This demo has neither.</p>
      </div>
    </Shell>
  );
}
