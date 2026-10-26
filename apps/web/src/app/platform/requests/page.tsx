import Link from "next/link";
import { AccessRequest, requestedSiteTypeLabels } from "@greecon/shared";
import { Ago } from "../../../components/Ago";
import { DataTable } from "../../../components/DataTable";
import { Section } from "../../../components/Section";
import { Shell } from "../../../components/Shell";
import { StatusBadge } from "../../../components/StatusBadge";
import { requirePlatformAdmin } from "../../../lib/access";
import { apiGet } from "../../../lib/api";
import { getSession } from "../../../lib/session";
import { updateAccessRequestAction } from "../actions";

export const metadata = { title: "Requests" };

// Who has asked for Greecon (docs/28-ux-definition.md, section 4.2). Requests made on the sign-in page land here, and as a message
// to the sales address. Only for a real logged-in platform-administrator session; see requests/page.static.tsx.
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const session = await getSession();
  requirePlatformAdmin(session?.user.isPlatformAdmin ?? false);

  const requests = await apiGet<AccessRequest[]>("/platform-admin/access-requests");
  const open = requests.filter((request) => request.status === "new" || request.status === "contacted");
  const closed = requests.filter((request) => request.status === "onboarded" || request.status === "declined");

  return (
    <Shell title="Requests" subtitle="Who has asked for Greecon, and what has become of it.">
      <Section title="Waiting" aside={<span className="muted">{open.length} waiting</span>}>
        <DataTable
          rows={open}
          emptyLabel="No one is waiting. A request made on the sign-in page appears here."
          columns={[
            { key: "createdAtUtc", label: "Received", render: (request) => <Ago iso={request.createdAtUtc} /> },
            {
              key: "company",
              label: "Who",
              render: (request) => (
                <>
                  <strong>{request.company}</strong>
                  <br />
                  {request.name}
                </>
              )
            },
            {
              key: "email",
              label: "Contact",
              render: (request) => (
                <>
                  <a className="standalone-link" href={`mailto:${request.email}`}>{request.email}</a>
                  {request.phone ? (
                    <>
                      <br />
                      <a className="standalone-link" href={`tel:${request.phone.replace(/\s+/g, "")}`}>{request.phone}</a>
                    </>
                  ) : null}
                </>
              )
            },
            { key: "siteType", label: "Runs", render: (request) => requestedSiteTypeLabels[request.siteType] },
            { key: "message", label: "Said", render: (request) => request.message ?? "" },
            {
              key: "status",
              label: "Next",
              render: (request) => (
                <div className="rule-actions">
                  <Link href={`/platform?onboard=${request.id}#onboard`} className="button-primary">
                    Onboard
                  </Link>
                  {request.status === "new" ? (
                    <form action={updateAccessRequestAction.bind(null, request.id, "contacted")}>
                      <button type="submit" className="button-ghost">
                        Mark contacted
                      </button>
                    </form>
                  ) : (
                    <span className="muted">Contacted</span>
                  )}
                  <form action={updateAccessRequestAction.bind(null, request.id, "declined")}>
                    <button type="submit" className="button-ghost">
                      Decline
                    </button>
                  </form>
                </div>
              )
            }
          ]}
        />
      </Section>
      {closed.length > 0 ? (
        <details className="panel">
          <summary>Dealt with ({closed.length})</summary>
          <DataTable
            rows={closed}
            columns={[
              { key: "createdAtUtc", label: "Received", render: (request) => <Ago iso={request.createdAtUtc} /> },
              { key: "company", label: "Who", render: (request) => `${request.company}, ${request.name}` },
              { key: "status", label: "Became", render: (request) => <StatusBadge status={request.status === "onboarded" ? "Onboarded" : "Declined"} /> }
            ]}
          />
        </details>
      ) : null}
    </Shell>
  );
}
