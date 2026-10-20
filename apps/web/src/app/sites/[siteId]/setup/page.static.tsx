import Link from "next/link";
import type { SetupView } from "@greecon/shared";
import { templateByKey } from "@greecon/shared";
import { LiveRefresh } from "../../../../components/LiveRefresh";
import { Shell } from "../../../../components/Shell";
import { SetupProgress, SetupStepCard } from "../../../../components/setup/SetupStepCard";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { nextStep } from "../../../../lib/setup";

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the same checklist, read only.
// Adding a box, entering addresses and confirming steps are Server Actions that need the live platform.
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function SetupPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  requirePermission(DEMO_ROLE, "device:manage");
  const setup = await apiGet<SetupView>(`/sites/${siteId}/setup`);
  const template = setup.templateKey ? templateByKey(setup.templateKey) : undefined;
  const next = nextStep(setup.steps);

  return (
    <Shell title={`Set up ${setup.siteName}`} subtitle={template ? template.name : "Custom site"}>
      <LiveRefresh enabled={false} />
      <SetupProgress done={setup.doneCount} total={setup.totalCount} commissioned={setup.commissioned} />
      {next ? (
        <div className="setup-next">
          <p>
            <strong>Do next: {next.title}</strong> <a href={`#step-${next.key}`}>Go to the step</a>
          </p>
        </div>
      ) : null}
      <p className="muted">This is a read-only copy. On the live platform each step has its form beside it.</p>
      <p className="setup-links">
        <Link className="button-ghost" href={`/sites/${siteId}`}>
          The site page
        </Link>
        <Link className="button-ghost" href={`/sites/${siteId}/handover`}>
          The handover sheet
        </Link>
      </p>
      <ol className="setup-steps">
        {setup.steps.map((step, index) => (
          <SetupStepCard key={step.key} step={step} number={index + 1} open={step.key === next?.key || step.status === "attention"} />
        ))}
      </ol>
    </Shell>
  );
}
