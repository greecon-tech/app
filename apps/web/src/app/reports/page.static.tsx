import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { DEMO_ROLE } from "../../lib/api";

export const metadata = { title: "Reports" };

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). A downloaded file is made by the live
// platform for the person who asks; the demo has no server to make one.
export default function ReportsPage() {
  requirePermission(DEMO_ROLE, "report:export");
  return (
    <Shell title="Reports" subtitle="Your data, as files you can keep.">
      <Section title="Download your data">
        <div className="stack">
          <p className="muted">
            Your data is yours. On the live platform this page downloads each site&apos;s readings (hourly averages for up to a year, or every reading for up to 31 days), the alerts,
            the audit log and the account&apos;s whole setup as files you can open in a spreadsheet or hand to your accountant. The demo makes no files.
          </p>
        </div>
      </Section>
    </Shell>
  );
}
