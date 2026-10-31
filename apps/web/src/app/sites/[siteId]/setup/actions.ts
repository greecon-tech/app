"use server";

import { revalidatePath } from "next/cache";
import type { DiscoveryView, EnrolmentIssued, ModbusConnection, PointSource } from "@greecon/shared";
import { apiErrorMessage, apiMutate } from "../../../../lib/api";

// What the project manager does on a site's setup page. Every one of these goes to the API, which checks
// the person may do it and what they typed; the words it answers with are shown as they are, because they
// are written to be acted on ("The address must be an IP address such as 192.168.1.50").

const refresh = (siteId: string) => {
  revalidatePath(`/sites/${siteId}/setup`);
  revalidatePath(`/sites/${siteId}`);
};

export async function provisionBoxAction(siteId: string, name: string): Promise<{ error?: string; enrolment?: EnrolmentIssued; boxName?: string }> {
  if (!name.trim()) return { error: "Give the box a name, for example the room it is in." };
  try {
    const result = await apiMutate<{ gatewayId: string; enrolment: EnrolmentIssued }>("/gateways/provision", "POST", { siteId, name: name.trim() });
    refresh(siteId);
    return { enrolment: result.enrolment, boxName: name.trim() };
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not add the box.") };
  }
}

export async function issueEnrolmentAction(siteId: string, gatewayId: string): Promise<{ error?: string; enrolment?: EnrolmentIssued }> {
  try {
    const enrolment = await apiMutate<EnrolmentIssued>(`/gateways/${gatewayId}/enrolment`, "POST");
    refresh(siteId);
    return { enrolment };
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not make a new code.") };
  }
}

export async function updateDeviceConnectionAction(siteId: string, deviceId: string, connection: ModbusConnection | null): Promise<{ error?: string }> {
  try {
    await apiMutate(`/devices/${deviceId}`, "PATCH", { connection });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not save the address.") };
  }
}

export async function updatePointSourceAction(siteId: string, pointId: string, source: PointSource | null): Promise<{ error?: string }> {
  try {
    await apiMutate(`/points/${pointId}`, "PATCH", { source });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not save the register.") };
  }
}

export interface KnownEquipmentInput {
  profileKey: string;
  name?: string;
  assetId?: string;
  host?: string;
  port?: number;
  unitId?: number;
}

export async function createDeviceFromProfileAction(siteId: string, input: KnownEquipmentInput): Promise<{ error?: string }> {
  try {
    await apiMutate("/devices/from-profile", "POST", { siteId, ...input, assetId: input.assetId || undefined, name: input.name?.trim() || undefined, host: input.host?.trim() || undefined });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not add the equipment.") };
  }
}

/** "Find equipment": the box looks at the site's network, and fills in the addresses of what it finds. Asking changes nothing by itself. */
export async function findEquipmentAction(siteId: string, host?: string, port?: number): Promise<{ error?: string }> {
  try {
    await apiMutate(`/sites/${siteId}/discovery`, "POST", { ...(host?.trim() ? { host: host.trim() } : {}), ...(port !== undefined && Number.isFinite(port) ? { port } : {}) });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not ask the box to look.") };
  }
}

/** "Use these addresses": every device that was found somewhere other than where it is set is set to where it was found. */
export async function useFoundAddressesAction(siteId: string): Promise<{ error?: string; applied?: string[] }> {
  try {
    const result = await apiMutate<{ applied: string[]; discovery: DiscoveryView }>(`/sites/${siteId}/discovery/apply`, "POST");
    refresh(siteId);
    return { applied: result.applied };
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not use the addresses.") };
  }
}

export interface RangeAnswer {
  canonicalName: string;
  range?: number;
  tankHeight?: number;
  notFitted?: boolean;
}

/** The range printed on each transmitter's label: Greecon works out the register and the scale from it. */
export async function setRangesAction(siteId: string, deviceId: string, ranges: RangeAnswer[]): Promise<{ error?: string }> {
  try {
    await apiMutate(`/devices/${deviceId}/ranges`, "PUT", { ranges });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not save the ranges.") };
  }
}

export async function confirmSetupStepAction(siteId: string, key: string, note: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/sites/${siteId}/setup/steps/${key}`, "PUT", { note: note.trim() || undefined });
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not confirm this step.") };
  }
}

export async function reopenSetupStepAction(siteId: string, key: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/sites/${siteId}/setup/steps/${key}`, "DELETE");
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not reopen this step.") };
  }
}

export async function deleteDeviceFromSetupAction(siteId: string, deviceId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/devices/${deviceId}`, "DELETE");
    refresh(siteId);
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not remove the device.") };
  }
}
