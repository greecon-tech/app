import { Shell } from "../../components/Shell";

export const metadata = { title: "Today" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). Greecon's team console needs a real
// logged-in session, which the static demo does not have.
export default function TodayPage() {
  return (
    <Shell title="Today" subtitle="Is every customer all right, and what is there to do?">
      <div className="panel">
        <p className="muted">Greecon's own console needs a live deployment and a real team sign-in. This demo has neither.</p>
      </div>
    </Shell>
  );
}
