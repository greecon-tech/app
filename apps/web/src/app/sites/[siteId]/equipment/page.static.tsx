import Link from "next/link";
import { EdgeGateway } from "@greecon/shared";
import { Ago } from "../../../../components/Ago";
import { DataTable } from "../../../../components/DataTable";
import { Section } from "../../../../components/Section";
import { Shell } from "../../../../components/Shell";
import { StatusBadge } from "../../../../components/StatusBadge";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { equipmentKind } from "../../../../lib/equipment";
import { CONTACT_WORDS } from "../../../../lib/setup";

export const metadata = { title: "Equipment and readings" };

interface EquipmentDetail {
  site: { id: string; name: string };
  devices: Array<{ id: string; name: string; deviceType: string; health: string }>;
  points: Array<{ id: string; deviceId: string; label: string; unit: string }>;
  gateways: EdgeGateway[];
}

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the forms bind Server Actions, which a static export cannot
// contain, so the demo shows the same lists and says what is missing. A dynamic route needs generateStaticParams here and must not
// have it in the live build (same reason as sites/[siteId]/page.tsx). Gated like the live page.
export async function generateStaticParams() {
  const sites = await apiGet<Array<{ id: string }>>("/sites");
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function EquipmentPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  requirePermission(DEMO_ROLE, "device:manage");
  const detail = await apiGet<EquipmentDetail>(`/sites/${siteId}`);
  const deviceName = new Map(detail.devices.map((device) => [device.id, device.name]));

  return (
    <Shell title="Equipment and readings" subtitle={`What the box reads at ${detail.site.name}, and how.`}>
      <p>
        <Link className="standalone-link" href={`/sites/${siteId}`}>Back to {detail.site.name}</Link>
      </p>
      <Section title="Boxes">
        <DataTable
          wide={false}
          rows={detail.gateways}
          emptyLabel="No box."
          columns={[
            { key: "name", label: "Name" },
            { key: "contact", label: "Now", render: (row) => <StatusBadge status={CONTACT_WORDS[row.contact ?? "never"]} /> },
            { key: "lastSeenUtc", label: "Last heard from", render: (row) => (row.lastSeenUtc ? <Ago iso={row.lastSeenUtc} /> : "Never") }
          ]}
        />
      </Section>
      <Section title="Equipment">
        <DataTable
          wide={false}
          rows={detail.devices}
          emptyLabel="No equipment."
          columns={[
            { key: "name", label: "Name" },
            { key: "deviceType", label: "Kind", render: (row) => equipmentKind(row.deviceType) },
            { key: "health", label: "State", render: (row) => <StatusBadge status={row.health} /> }
          ]}
        />
      </Section>
      <Section title="Readings">
        <DataTable
          wide={false}
          rows={detail.points.map((point) => ({ ...point, deviceName: deviceName.get(point.deviceId) ?? point.deviceId }))}
          emptyLabel="No readings."
          columns={[
            { key: "label", label: "Reading" },
            { key: "deviceName", label: "Equipment" },
            { key: "unit", label: "Unit" }
          ]}
        />
        <p className="muted">Changing equipment, readings and limits needs the live platform; this demo only shows what is there.</p>
      </Section>
    </Shell>
  );
}
