"use server";

import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiMutate } from "../../../lib/api";

export async function createAssetAction(siteId: string, name: string, type: string): Promise<{ error?: string; created?: boolean }> {
  if (!name.trim()) {
    return { error: "Name is required." };
  }

  try {
    await apiMutate("/assets", "POST", { siteId, name, type });
    revalidatePath(`/sites/${siteId}`);
    return { created: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add asset." };
  }
}

export async function deleteAssetAction(siteId: string, assetId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/assets/${assetId}`, "DELETE");
    revalidatePath(`/sites/${siteId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete asset." };
  }
}

export async function createDeviceAction(
  siteId: string,
  name: string,
  deviceType: string,
  protocol: string,
  driverType: string,
  assetId: string
): Promise<{ error?: string; created?: boolean }> {
  if (!name.trim() || !deviceType.trim() || !driverType.trim()) {
    return { error: "Name, device type, and driver are required." };
  }

  try {
    await apiMutate("/devices", "POST", { siteId, name, deviceType, protocol, driverType, assetId: assetId || undefined });
    revalidatePath(`/sites/${siteId}`);
    return { created: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add device." };
  }
}

export async function deleteDeviceAction(siteId: string, deviceId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/devices/${deviceId}`, "DELETE");
    revalidatePath(`/sites/${siteId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete device." };
  }
}

interface CreatedGateway {
  id: string;
  name: string;
}

export async function createGatewayAction(siteId: string, name: string): Promise<{ error?: string; gateway?: CreatedGateway; secret?: string }> {
  if (!name.trim()) {
    return { error: "Name is required." };
  }

  try {
    const result = await apiMutate<{ gateway: CreatedGateway; secret: string }>("/gateways", "POST", { siteId, name });
    revalidatePath(`/sites/${siteId}`);
    return { gateway: result.gateway, secret: result.secret };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add gateway." };
  }
}

export async function deleteGatewayAction(siteId: string, gatewayId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/gateways/${gatewayId}`, "DELETE");
    revalidatePath(`/sites/${siteId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete gateway." };
  }
}

export async function createPointAction(
  siteId: string,
  deviceId: string,
  canonicalName: string,
  label: string,
  unit: string,
  capability: string
): Promise<{ error?: string; created?: boolean }> {
  if (!deviceId || !label.trim() || !unit.trim()) {
    return { error: "Device, label, and unit are required." };
  }

  try {
    await apiMutate("/points", "POST", { siteId, deviceId, canonicalName, label, unit, capability });
    revalidatePath(`/sites/${siteId}`);
    return { created: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add point." };
  }
}

export async function deletePointAction(siteId: string, pointId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/points/${pointId}`, "DELETE");
    revalidatePath(`/sites/${siteId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete point." };
  }
}

/** Saves the limits for one reading point (an empty set clears them). The API refuses a limit that
 * does not exist for that reading or is out of range, and says why. */
export async function updatePointLimitsAction(siteId: string, pointId: string, limits: Record<string, number>): Promise<{ error?: string; saved?: boolean }> {
  try {
    await apiMutate(`/points/${pointId}`, "PATCH", { thresholdConfig: limits });
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/");
    return { saved: true };
  } catch (error) {
    return { error: apiErrorMessage(error, "Failed to save limits.") };
  }
}
