import Link from "next/link";
import { CanonicalPointName, EdgeGateway, hasPermission } from "@greecon/shared";
import { Ago } from "../../../../components/Ago";
import { CreateAssetForm } from "../../../../components/CreateAssetForm";
import { CreateDeviceForm } from "../../../../components/CreateDeviceForm";
import { CreatePointForm } from "../../../../components/CreatePointForm";
import { DataTable } from "../../../../components/DataTable";
import { DeleteButton } from "../../../../components/DeleteButton";
import { PointLimitsForm } from "../../../../components/PointLimitsForm";
import { Section } from "../../../../components/Section";
import { SensorMap } from "../../../../components/SensorMap";
import { Shell } from "../../../../components/Shell";
import { SiteDetailsForm } from "../../../../components/SiteDetailsForm";
import { StatusBadge } from "../../../../components/StatusBadge";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { equipmentKind } from "../../../../lib/equipment";
import { ReadingView } from "../../../../lib/readings";
import { getSession } from "../../../../lib/session";
import { CONTACT_WORDS } from "../../../../lib/setup";
import { deleteAssetAction, deleteDeviceAction, deletePointAction } from "../actions";

export const metadata = { title: "Equipment and readings" };

interface EquipmentDetail {
  site: { id: string; name: string; type: string; locationName: string };
  assets: Array<{ id: string; name: string; type: string; status: string }>;
  devices: Array<{ id: string; name: string; deviceType: string; protocol: string; health: string; lastSeenUtc?: string; positionX?: number; positionY?: number; placementNote?: string }>;
  points: Array<{ id: string; deviceId: string; label: string; unit: string; canonicalName: CanonicalPointName; capability: string; thresholdConfig?: Record<string, number> }>;
  gateways: EdgeGateway[];
  latestTelemetry: Array<ReadingView & { pointId: string }>;
}

// The machinery of one site, one step away from its everyday page (docs/28-ux-definition.md, section 4.3): the boxes, the equipment
// they read, each reading with its limits, and the site itself. For those who may change equipment (an owner, an administrator, Greecon's
// team in a setup session); everyone else is told there is no such page. The forms are Server Actions, so this page is rendered on
// request: see page.static.tsx for the GitHub Pages twin (and for why it, too, needs generateStaticParams).
export const dynamic = "force-dynamic";

export default async function EquipmentPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await getSession();
  const role = session?.user.role ?? DEMO_ROLE;
  requirePermission(role, "device:manage");
  const canManageAssets = hasPermission(role, "asset:manage");
  const canManageSite = hasPermission(role, "site:manage");
  const canMaintain = hasPermission(role, "maintenance:manage");

  const detail = await apiGet<EquipmentDetail>(`/sites/${siteId}`);
  const { site } = detail;
  const deviceName = new Map(detail.devices.map((device) => [device.id, device.name]));

  return (
    <Shell title="Equipment and readings" subtitle={`What the box reads at ${site.name}, and how.`}>
      <p>
        <Link className="standalone-link" href={`/sites/${site.id}`}>Back to {site.name}</Link>
      </p>
      <Section title="Boxes" id="boxes">
        <p className="muted">
          A box is the small computer at the site that reads the equipment and sends the readings here. Boxes are installed and replaced on the setup list, which gives the command to run on each one.
        </p>
        {detail.gateways.length > 0 ? (
          <DataTable
            wide={false}
            rows={detail.gateways}
            columns={[
              { key: "name", label: "Name" },
              { key: "contact", label: "Now", render: (row) => <StatusBadge status={CONTACT_WORDS[row.contact ?? "never"]} /> },
              { key: "lastSeenUtc", label: "Last heard from", render: (row) => (row.lastSeenUtc ? <Ago iso={row.lastSeenUtc} /> : "Never") },
              { key: "softwareVersion", label: "Version", render: (row) => row.softwareVersion ?? "—" }
            ]}
          />
        ) : (
          <div className="empty-state">No box yet. Add one on the setup list.</div>
        )}
        <p>
          <Link className="button-primary" href={`/sites/${site.id}/setup`}>
            Open the setup list
          </Link>
        </p>
      </Section>

      <Section title="Equipment" id="devices">
        <DataTable
          wide={false}
          rows={detail.devices}
          emptyLabel="No equipment yet. The setup list adds it from the kind of meter or sensor it is."
          columns={[
            { key: "name", label: "Name" },
            { key: "deviceType", label: "Kind", render: (row) => equipmentKind(row.deviceType) },
            { key: "health", label: "State", render: (row) => <StatusBadge status={row.health} /> },
            {
              key: "id",
              label: "",
              render: (row) => (
                <DeleteButton
                  action={deleteDeviceAction.bind(null, site.id, row.id)}
                  label="Remove"
                  confirmMessage={`Remove "${row.name}"? Its readings and their history go with it. This cannot be undone.`}
                />
              )
            }
          ]}
        />
      </Section>

      <Section title="Readings" id="readings">
        <p className="muted">One reading is one measured number: solar power, a tank&apos;s level. Its limits say when Greecon calls a value a warning or critical.</p>
        <DataTable
          wide={false}
          rows={detail.points.map((point) => ({ ...point, deviceName: deviceName.get(point.deviceId) ?? point.deviceId }))}
          emptyLabel="No readings yet."
          columns={[
            { key: "label", label: "Reading" },
            { key: "deviceName", label: "Equipment" },
            { key: "thresholdConfig", label: "Limits", render: (row) => <PointLimitsForm siteId={site.id} point={row} /> },
            {
              key: "id",
              label: "",
              render: (row) => (
                <DeleteButton action={deletePointAction.bind(null, site.id, row.id)} label="Remove" confirmMessage={`Remove the reading "${row.label}"? Its history goes with it. This cannot be undone.`} />
              )
            }
          ]}
        />
      </Section>

      {detail.devices.length > 0 ? (
        <Section title="Where things are">
          <SensorMap devices={detail.devices} points={detail.points} readings={detail.latestTelemetry} />
        </Section>
      ) : null}

      <details className="panel advanced">
        <summary>Add equipment or a reading by hand (advanced)</summary>
        <div className="stack">
          <p className="muted">
            Normally the setup list does this, from the kind of meter or sensor. By hand is for a device Greecon has no profile for: you give its kind, its driver and each reading yourself.
          </p>
          <h3>Equipment</h3>
          <CreateDeviceForm siteId={site.id} assets={detail.assets} />
          {detail.devices.length > 0 ? (
            <>
              <h3>A reading</h3>
              <CreatePointForm siteId={site.id} devices={detail.devices} />
            </>
          ) : null}
          {canManageAssets ? (
            <>
              <h3>Parts of the site (optional)</h3>
              <p className="muted">A part groups related equipment: a pump station, a battery bank, an irrigation zone. Equipment works fine with none.</p>
              {detail.assets.length > 0 ? (
                <DataTable
                  wide={false}
                  rows={detail.assets}
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "type", label: "Kind" },
                    {
                      key: "id",
                      label: "",
                      render: (row) => (
                        <DeleteButton action={deleteAssetAction.bind(null, site.id, row.id)} label="Remove" confirmMessage={`Remove "${row.name}"? The equipment in it stays. This cannot be undone.`} />
                      )
                    }
                  ]}
                />
              ) : null}
              <CreateAssetForm siteId={site.id} />
            </>
          ) : null}
        </div>
      </details>

      {canMaintain ? (
        <Section title="Maintenance">
          <p className="muted">Upkeep that is due: cleaning panels, servicing the pump. Tasks have a due date and a note when they are done.</p>
          <p>
            <Link href="/maintenance" className="button-ghost">
              Open the maintenance list
            </Link>
          </p>
        </Section>
      ) : null}

      {canManageSite ? (
        <Section title="The site itself" id="site">
          <SiteDetailsForm site={site} />
        </Section>
      ) : null}
    </Shell>
  );
}
