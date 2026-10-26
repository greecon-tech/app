import { Shell } from "../../../components/Shell";

export const metadata = { title: "Team" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the team's console needs a real session.
export default function TeamPage() {
  return (
    <Shell title="Team" subtitle="The people at Greecon who can open a customer's account.">
      <div className="panel">
        <p className="muted">Greecon's own console needs a live deployment and a real team sign-in. This demo has neither.</p>
      </div>
    </Shell>
  );
}
