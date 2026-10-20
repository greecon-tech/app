import Link from "next/link";
import type { ReactNode } from "react";
import { ALERT_LIMIT_KEYS, CanonicalPointName, EdgeGateway, ModbusConnection, PointSource, SetupStep, SetupStepItem, SetupView, SiteProfile, limitsFor, templateByKey } from "@greecon/shared";
import { Ago } from "../../../../components/Ago";
import { DeleteButton } from "../../../../components/DeleteButton";
import { LiveRefresh } from "../../../../components/LiveRefresh";
import { PointLimitsForm } from "../../../../components/PointLimitsForm";
import { Shell } from "../../../../components/Shell";
import { SiteProfileForm } from "../../../../components/SiteProfileForm";
import { StatusBadge } from "../../../../components/StatusBadge";
import { AddKnownEquipmentForm } from "../../../../components/setup/AddKnownEquipmentForm";
import { ConfirmStepForm } from "../../../../components/setup/ConfirmStepForm";
import { DeviceAddressForm } from "../../../../components/setup/DeviceAddressForm";
import { Disclosure } from "../../../../components/setup/Disclosure";
import { IssueCodeButton } from "../../../../components/setup/IssueCodeButton";
import { PointRegisterForm } from "../../../../components/setup/PointRegisterForm";
import { ProvisionBoxForm } from "../../../../components/setup/ProvisionBoxForm";
import { SetupProgress, SetupStepCard } from "../../../../components/setup/SetupStepCard";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { getSession } from "../../../../lib/session";
import { CONTACT_WORDS, nextStep } from "../../../../lib/setup";
import { deleteGatewayAction } from "../actions";
import { deleteDeviceFromSetupAction } from "./actions";

interface SiteDetail {
  site: { id: string; name: string; type: string; locationName: string };
  assets: Array<{ id: string; name: string; type: string }>;
  devices: Array<{ id: string; name: string; deviceType: string; protocol: string; connection?: ModbusConnection }>;
  points: Array<{ id: string; deviceId: string; label: string; unit: string; canonicalName: CanonicalPointName; capability: string; source?: PointSource; thresholdConfig?: Record<string, number> }>;
  gateways: EdgeGateway[];
}

// Server Actions run from this page, so it is rendered on request (the GitHub Pages export swaps in
// page.static.tsx, a read-only copy — see apps/web/scripts/build-static.sh).
export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await getSession();
  requirePermission(session?.user.role ?? DEMO_ROLE, "device:manage");

  const [setup, detail, profile] = await Promise.all([
    apiGet<SetupView>(`/sites/${siteId}/setup`),
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<SiteProfile>(`/sites/${siteId}/profile`)
  ]);
  const template = setup.templateKey ? templateByKey(setup.templateKey) : undefined;
  const next = nextStep(setup.steps);
  const panels: Record<string, ReactNode> = {
    prices: <SiteProfileForm siteId={siteId} profile={profile} />,
    box: <BoxPanel siteId={siteId} gateways={detail.gateways} items={stepOf(setup, "box").items ?? []} />,
    addresses: <AddressesPanel siteId={siteId} detail={detail} />,
    mapping: <MappingPanel siteId={siteId} detail={detail} />,
    answering: <AnsweringHelp />,
    told: <ToldPanel siteId={siteId} step={stepOf(setup, "told")} />,
    direction: <ConfirmStepForm siteId={siteId} step={stepOf(setup, "direction")} />,
    limits: <LimitsPanel siteId={siteId} detail={detail} step={stepOf(setup, "limits")} />,
    commissioned: <CommissionPanel siteId={siteId} step={stepOf(setup, "commissioned")} />
  };

  return (
    <Shell title={`Set up ${setup.siteName}`} subtitle={`${template ? template.name : "Custom site"} · ${detail.site.locationName}`}>
      <LiveRefresh everySeconds={5} />
      <SetupProgress done={setup.doneCount} total={setup.totalCount} commissioned={setup.commissioned} />
      {setup.commissioned ? (
        <div className="setup-next">
          <p>
            <strong>This site is commissioned.</strong> The handover sheet is what the customer is given.
          </p>
          <p>
            <Link className="button-primary" href={`/sites/${siteId}/handover`}>
              Open the handover sheet
            </Link>
          </p>
        </div>
      ) : null}
      {next ? (
        <div className="setup-next">
          <p>
            <strong>Do next: {next.title}</strong> <a href={`#step-${next.key}`}>Go to the step</a>
          </p>
        </div>
      ) : null}
      <p className="setup-links no-print">
        <Link className="button-ghost" href={`/sites/${siteId}`}>
          The site page
        </Link>
        <Link className="button-ghost" href={`/sites/${siteId}/handover`}>
          The handover sheet
        </Link>
      </p>
      {template && template.checklist.length > 0 ? (
        <details className="limits">
          <summary>What to bring and what to ask the customer for</summary>
          <ol>
            {template.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </details>
      ) : null}
      <ol className="setup-steps">
        {setup.steps.map((step, index) => (
          <SetupStepCard key={step.key} step={step} number={index + 1} open={step.key === next?.key || step.status === "attention"} hideItems={step.key === "box"}>
            {panels[step.key]}
          </SetupStepCard>
        ))}
      </ol>
    </Shell>
  );
}

function stepOf(setup: SetupView, key: string): SetupStep {
  const step = setup.steps.find((candidate) => candidate.key === key);
  if (!step) throw new Error(`The setup list has no step called ${key}.`);
  return step;
}

function BoxPanel({ siteId, gateways, items }: { siteId: string; gateways: EdgeGateway[]; items: SetupStepItem[] }) {
  const anyOnline = gateways.some((gateway) => gateway.contact === "online");
  return (
    <div className="setup-panel">
      {gateways.map((gateway, index) => {
        // The platform's own sentence about this box: waiting for the command, offline, clock wrong, online.
        const said = items[index]?.label === gateway.name ? items[index]?.detail : undefined;
        return (
        <div key={gateway.id} className="setup-device">
          <div className="setup-device__head">
            <strong>{gateway.name}</strong>
            <StatusBadge status={CONTACT_WORDS[gateway.contact ?? "never"]} />
          </div>
          <p className="muted">
            {said ?? (gateway.lastSeenUtc ? <>Heard from <Ago iso={gateway.lastSeenUtc} />.</> : "Never heard from.")}
            {gateway.bufferDepth ? ` ${gateway.bufferDepth} readings are waiting on the box because the platform could not be reached.` : ""}
          </p>
          <div className="rule-actions">
            <IssueCodeButton siteId={siteId} gatewayId={gateway.id} gatewayName={gateway.name} />
            <DeleteButton
              action={deleteGatewayAction.bind(null, siteId, gateway.id)}
              label="Remove this box"
              confirmMessage={`Remove the box "${gateway.name}"? It stops working at once, and a box already installed has to be installed again with a new command.`}
            />
          </div>
        </div>
        );
      })}
      {anyOnline ? null : (
        <div className="setup-guidance">
          <p>
            <strong>At the site</strong>
          </p>
          <ol>
            <li>Put the box where it has power and a network cable to the site&apos;s router or switch.</li>
            <li>Open a terminal on it: a screen and keyboard, or SSH from a laptop on the same network.</li>
            <li>Paste the install command and press Enter. It takes about two minutes and needs the internet.</li>
            <li>This page shows the box as Online within a minute of it finishing.</li>
          </ol>
        </div>
      )}
      <ProvisionBoxForm siteId={siteId} another={gateways.length > 0} />
    </div>
  );
}

function AddressesPanel({ siteId, detail }: { siteId: string; detail: SiteDetail }) {
  const modbusDevices = detail.devices.filter((device) => device.protocol === "modbus");
  return (
    <div className="setup-panel">
      {modbusDevices.map((device) => (
        <div key={device.id} className="setup-device">
          <div className="setup-device__head">
            <strong>{device.name}</strong>
            <span className="muted">{device.deviceType.replace(/_/g, " ")}</span>
          </div>
          <DeviceAddressForm siteId={siteId} device={{ id: device.id, name: device.name, connection: device.connection }} />
          <DeleteButton
            action={deleteDeviceFromSetupAction.bind(null, siteId, device.id)}
            label="Remove this device"
            confirmMessage={`Remove "${device.name}"? Its readings and their history are removed too. This cannot be undone.`}
          />
        </div>
      ))}
      <Disclosure summary="Add equipment Greecon already knows" defaultOpen={modbusDevices.length === 0}>
        <AddKnownEquipmentForm siteId={siteId} assets={detail.assets} />
      </Disclosure>
      <p className="muted">
        Equipment Greecon does not know yet is added from its datasheet on <Link href={`/sites/${siteId}#equipment`}>the site page</Link>; its registers are entered in the next step.
      </p>
    </div>
  );
}

function MappingPanel({ siteId, detail }: { siteId: string; detail: SiteDetail }) {
  const modbusIds = new Set(detail.devices.filter((device) => device.protocol === "modbus").map((device) => device.id));
  return (
    <div className="setup-panel">
      {detail.devices
        .filter((device) => modbusIds.has(device.id))
        .map((device) => {
          const readings = detail.points.filter((point) => point.deviceId === device.id && point.capability !== "write");
          if (readings.length === 0) return null;
          return (
            <div key={device.id} className="setup-device">
              <div className="setup-device__head">
                <strong>{device.name}</strong>
              </div>
              {readings.map((point) => (
                <div key={point.id} className="setup-point">
                  <span>
                    {point.label} <span className="muted">({point.unit})</span>
                  </span>
                  <PointRegisterForm siteId={siteId} point={{ id: point.id, label: point.label, source: point.source }} />
                </div>
              ))}
            </div>
          );
        })}
      <p className="muted">Meters Greecon knows have their registers filled in. For anything else, use the device&apos;s datasheet.</p>
    </div>
  );
}

function ToldPanel({ siteId, step }: { siteId: string; step: SetupStep }) {
  return (
    <div className="setup-panel">
      <p>
        Alerts reach people by email and, for Act now, by text message. The list is the account&apos;s own and is kept under Who is told; it is the same
        list for every site of this customer.
      </p>
      <p className="no-print">
        <Link className="button-primary" href="/settings/people">
          Open Who is told
        </Link>
      </p>
      <ConfirmStepForm siteId={siteId} step={step} />
    </div>
  );
}

function AnsweringHelp() {
  return (
    <details className="limits">
      <summary>If a device does not answer</summary>
      <ul>
        <li>Nothing answers at all: the IP address or port is wrong, or the converter is off, or it is on another network than the box.</li>
        <li>The converter answers but the meter does not: the unit number is wrong, the RS-485 wires A and B are swapped, or the meter&apos;s speed and parity differ from the converter&apos;s.</li>
        <li>Some readings work and others do not: a register address is wrong for that meter.</li>
      </ul>
    </details>
  );
}

function LimitsPanel({ siteId, detail, step }: { siteId: string; detail: SiteDetail; step: SetupStep }) {
  const points = detail.points.filter((point) => limitsFor(point.canonicalName).some((definition) => ALERT_LIMIT_KEYS.includes(definition.key)));
  return (
    <div className="setup-panel">
      {points.map((point) => (
        <div key={point.id} className="setup-point">
          <span>{point.label}</span>
          <PointLimitsForm siteId={siteId} point={point} />
        </div>
      ))}
      <ConfirmStepForm siteId={siteId} step={step} />
    </div>
  );
}

function CommissionPanel({ siteId, step }: { siteId: string; step: SetupStep }) {
  return (
    <div className="setup-panel">
      <ConfirmStepForm siteId={siteId} step={step} />
      {step.status === "done" ? (
        <p>
          <Link className="button-primary" href={`/sites/${siteId}/handover`}>
            Open the handover sheet
          </Link>
        </p>
      ) : null}
    </div>
  );
}
