import { DownloadForms } from "../../components/DownloadForms";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { requirePermission } from "../../lib/access";
import { apiGet, DEMO_ROLE } from "../../lib/api";
import { getSession } from "../../lib/session";

export const metadata = { title: "Reports" };

// Rendered on request: the download routes read the person's session.
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "report:export");

  const [sites, { problem }] = await Promise.all([apiGet<Array<{ id: string; name: string }>>("/sites"), searchParams]);

  return (
    <Shell title="Reports" subtitle="Your data, as files you can keep.">
      {problem ? (
        <div className="setup-guidance" role="alert">
          <p>
            <strong>That download could not be made.</strong> {problem}
          </p>
        </div>
      ) : null}
      <Section title="Download your data">
        <DownloadForms sites={sites} role={role} />
      </Section>
    </Shell>
  );
}
