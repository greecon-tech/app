import Link from "next/link";
import type { ReactNode } from "react";
import { ALERT_LIMIT_KEYS, CanonicalPointName, DiscoveryView, EdgeGateway, ModbusConnection, PointSource, SetupStep, SetupStepItem, SetupView, SiteProfile, describeConnection, limitsFor, profileByKey, templateByKey } from "@greecon/shared";
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
import { FindEquipmentPanel } from "../../../../components/setup/FindEquipmentPanel";
import { IssueCodeButton } from "../../../../components/setup/IssueCodeButton";
import { PointRegisterForm } from "../../../../components/setup/PointRegisterForm";
import { ProvisionBoxForm } from "../../../../components/setup/ProvisionBoxForm";
import { SensorRangesForm } from "../../../../components/setup/SensorRangesForm";
import { SetupProgress, SetupStepCard } from "../../../../components/setup/SetupStepCard";
import { requirePermission } from "../../../../lib/access";
import { apiGet, DEMO_ROLE } from "../../../../lib/api";
import { getSession } from "../../../../lib/session";
import { CONTACT_WORDS, nextStep } from "../../../../lib/setup";
import { deleteGatewayAction } from "../actions";
import { deleteDeviceFromSetupAction } from "./actions";

export const metadata = { title: "Setup list" };

interface SiteDetail {
  site: { id: string; name: string; type: string; locationName: string };
  assets: Array<{ id: string; name: string; type: string }>;
  devices: Array<{ id: string; name: string; deviceType: string; protocol: string; connection?: ModbusConnection; profileKey?: string }>;
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

  const [setup, detail, profile, discovery] = await Promise.all([
    apiGet<SetupView>(`/sites/${siteId}/setup`),
    apiGet<SiteDetail>(`/sites/${siteId}`),
    apiGet<SiteProfile>(`/sites/${siteId}/profile`),
    apiGet<DiscoveryView>(`/sites/${siteId}/discovery`)
  ]);
  // The box that looks at the network has to be one the platform can hear: online, or late after a restart.
  const boxOnline = detail.gateways.some((gateway) => gateway.contact === "online" || gateway.contact === "late");
  const template = setup.templateKey ? templateByKey(setup.templateKey) : undefined;
  const next = nextStep(setup.steps);
  // Which steps a site has depends on what it is: a grid meter's direction is checked only where there is one, alert limits only where a
  // reading has some, prices only where there is energy or water to value. A panel is made for the steps the list has, never for one it has
  // not (asking for a step that is not there made the page fail for every farm, water station and blank site).
  const panelFor = (step: SetupStep): ReactNode => {
    switch (step.key) {
      case "paperwork":
        return <PaperworkPanel siteId={siteId} step={step} />;
      case "electrician":
        return <ElectricianPanel siteId={siteId} step={step} />;
      case "prices":
        return <SiteProfileForm siteId={siteId} profile={profile} />;
      case "box":
        return <BoxPanel siteId={siteId} gateways={detail.gateways} items={step.items ?? []} />;
      case "addresses":
        return <AddressesPanel siteId={siteId} detail={detail} discovery={discovery} boxOnline={boxOnline} />;
      case "mapping":
        return <MappingPanel siteId={siteId} detail={detail} />;
      case "answering":
        return <AnsweringHelp />;
      case "told":
        return <ToldPanel siteId={siteId} step={step} />;
      case "direction":
        return <ConfirmStepForm siteId={siteId} step={step} />;
      case "limits":
        return <LimitsPanel siteId={siteId} detail={detail} step={step} />;
      case "commissioned":
        return <CommissionPanel siteId={siteId} step={step} />;
      default:
        return null;
    }
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
            <strong>Do next: {next.title}</strong> <a href={`#step-${next.key}`} className="standalone-link">Go to the step</a>
          </p>
        </div>
      ) : null}
      <p className="setup-links no-print">
        <Link className="button-ghost" href={`/sites/${siteId}`}>
          The site page
        </Link>
        <Link className="button-ghost" href={`/sites/${siteId}/install-card`}>
          The install card
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
          <SetupStepCard key={step.key} step={step} number={index + 1} open={step.key === next?.key || step.status === "attention"} hideItems={step.key === "box" || step.key === "addresses"}>
            {panelFor(step)}
          </SetupStepCard>
        ))}
      </ol>
    </Shell>
  );
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
            <strong>At the site</strong> (the <Link href={`/sites/${siteId}/install-card`}>install card</Link> has the whole visit, and what to bring, on one page)
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

function AddressesPanel({ siteId, detail, discovery, boxOnline }: { siteId: string; detail: SiteDetail; discovery: DiscoveryView; boxOnline: boolean }) {
  const modbusDevices = detail.devices.filter((device) => device.protocol === "modbus");
  return (
    <div className="setup-panel">
      <FindEquipmentPanel siteId={siteId} view={discovery} boxOnline={boxOnline} hasDevices={modbusDevices.length > 0} />
      {modbusDevices.map((device) => (
        <div key={device.id} className="setup-device">
          <div className="setup-device__head">
            <strong>{device.name}</strong>
            <span className="muted">{device.connection ? `Reached at ${describeConnection(device.connection)}` : "No address yet"}</span>
          </div>
          <Disclosure summary={device.connection ? "Change the address by hand" : "Enter the address by hand"}>
            <DeviceAddressForm siteId={siteId} device={{ id: device.id, name: device.name, connection: device.connection }} />
          </Disclosure>
          <DeleteButton
            action={deleteDeviceFromSetupAction.bind(null, siteId, device.id)}
            label={/\(optional\)/i.test(device.name) ? "The site does not have this: remove it" : "Remove this device"}
            confirmMessage={`Remove "${device.name}"? Its readings and their history are removed too. This cannot be undone.`}
          />
        </div>
      ))}
      <Disclosure summary="Add equipment Greecon already knows" defaultOpen={modbusDevices.length === 0}>
        <AddKnownEquipmentForm siteId={siteId} assets={detail.assets} />
      </Disclosure>
      <p className="muted">
        Equipment Greecon does not know yet is added from its datasheet on <Link href={`/sites/${siteId}#equipment`}>the site page</Link>; its address is entered here by hand and its registers in the next step.
      </p>
    </div>
  );
}

function MappingPanel({ siteId, detail }: { siteId: string; detail: SiteDetail }) {
  const modbusDevices = detail.devices.filter((device) => device.protocol === "modbus");
  return (
    <div className="setup-panel">
      {modbusDevices.map((device) => {
        const readings = detail.points.filter((point) => point.deviceId === device.id && point.capability !== "write");
        if (readings.length === 0) return null;
        const profile = device.profileKey ? profileByKey(device.profileKey) : undefined;
        // Equipment Greecon knows: a reading that waits for the range on a transmitter's label is asked for in the label's own words, and the
        // rest are filled in already. Anything else is mapped from its datasheet.
        const ranged = (profile?.points ?? []).filter((candidate) => candidate.range !== undefined && readings.some((point) => point.canonicalName === candidate.canonicalName));
        const others = readings.filter((point) => !ranged.some((candidate) => candidate.canonicalName === point.canonicalName));
        const known = profile !== undefined && others.every((point) => point.source !== undefined);
        const forms = others.map((point) => (
          <div key={point.id} className="setup-point">
            <span>
              {point.label} <span className="muted">({point.unit})</span>
            </span>
            <PointRegisterForm siteId={siteId} point={{ id: point.id, label: point.label, source: point.source }} />
          </div>
        ));
        return (
          <div key={device.id} className="setup-device">
            <div className="setup-device__head">
              <strong>{device.name}</strong>
              {profile ? <span className="muted">{profile.model}</span> : null}
            </div>
            {ranged.length > 0 ? (
              <SensorRangesForm
                siteId={siteId}
                device={{ id: device.id, name: device.name }}
                readings={ranged.map((candidate) => ({ point: candidate, source: readings.find((point) => point.canonicalName === candidate.canonicalName)?.source }))}
              />
            ) : null}
            {others.length === 0 ? null : known ? (
              <Disclosure summary={`Greecon knows this equipment: ${others.length === 1 ? "its register is" : "its registers are"} filled in`}>{forms}</Disclosure>
            ) : (
              forms
            )}
          </div>
        );
      })}
      <p className="muted">Equipment Greecon knows needs nothing typed. For anything else, use the device&apos;s datasheet.</p>
    </div>
  );
}

function PaperworkPanel({ siteId, step }: { siteId: string; step: SetupStep }) {
  return (
    <div className="setup-panel">
      <p>
        Nothing goes into a customer&apos;s building without two papers: the <strong>signed order form</strong> and the <strong>agreed data terms</strong> (what Greecon reads, who sees it and how long it is kept). Greecon keeps them. Here you write down that they
        exist, and who signed.
      </p>
      <ConfirmStepForm siteId={siteId} step={step} />
    </div>
  );
}

function ElectricianPanel({ siteId, step }: { siteId: string; step: SetupStep }) {
  return (
    <div className="setup-panel">
      <p>
        Fitting meters in a board and wiring transmitters and contacts is the <strong>licensed electrician&apos;s</strong> work, under the customer&apos;s lock-out. It is not the project manager&apos;s. Ask the electrician for their name and licence number,
        photograph the wiring, the labels and the displays, and check that the lock-out has been removed.
      </p>
      <ConfirmStepForm siteId={siteId} step={step} />
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
        <li>It worked and then stopped: the router may have given the converter a new address. Press Find equipment again: the box looks for it and the address is filled in.</li>
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
