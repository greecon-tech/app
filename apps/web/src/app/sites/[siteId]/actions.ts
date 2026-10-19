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

export async function deleteGatewayAction(siteId: string, gatewayId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/gateways/${gatewayId}`, "DELETE");
    revalidatePath(`/sites/${siteId}`);
    revalidatePath(`/sites/${siteId}/setup`);
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

export interface SiteProfileInput {
  currency?: string;
  timezone?: string;
  importPricePerKwh: number | null;
  exportPricePerKwh: number | null;
  waterPricePerM3: number | null;
  baselineMonthlyImportKwh: number | null;
  baselineMonthlyWaterM3: number | null;
  baselineNote: string | null;
  zeroExport: boolean;
}

export async function updateSiteProfileAction(siteId: string, input: SiteProfileInput): Promise<{ error?: string }> {
  for (const [label, value] of [
    ["The electricity price", input.importPricePerKwh],
    ["The export price", input.exportPricePerKwh],
    ["The water price", input.waterPricePerM3],
    ["The electricity baseline", input.baselineMonthlyImportKwh],
    ["The water baseline", input.baselineMonthlyWaterM3]
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: `${label} must be a number, zero or more.` };
  }

  try {
    await apiMutate(`/sites/${siteId}/profile`, "PUT", input);
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/");
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Failed to save prices and baseline.") };
  }
}
