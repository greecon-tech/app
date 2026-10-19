"use server";

import { revalidatePath } from "next/cache";
import { apiMutate } from "../../lib/api";

interface CreatedTenant {
  id: string;
  name: string;
  domain: string;
  status: string;
}

interface CreatedOwner {
  id: string;
  email: string;
  name: string;
}

export async function updateTenantStatusAction(tenantId: string, nextStatus: "active" | "suspended"): Promise<void> {
  await apiMutate(`/platform-admin/tenants/${tenantId}/status`, "PATCH", { status: nextStatus });
  revalidatePath("/platform");
}

export async function createTenantAction(
  name: string,
  domain: string,
  ownerName: string,
  ownerEmail: string,
  requestId?: string
): Promise<{ error?: string; tenant?: CreatedTenant; owner?: CreatedOwner; temporaryPassword?: string }> {
  try {
    const result = await apiMutate<{ tenant: CreatedTenant; owner: CreatedOwner; temporaryPassword: string }>("/platform-admin/tenants", "POST", {
      name,
      domain: domain.trim() || undefined,
      ownerName,
      ownerEmail
    });
    // The request this account was made from is closed in the same breath, so the inbox is true.
    if (requestId) {
      await apiMutate(`/platform-admin/access-requests/${requestId}`, "PATCH", { status: "onboarded", note: `Account created for ${result.tenant.name}.` }).catch(() => undefined);
    }
    revalidatePath("/platform");
    return { tenant: result.tenant, owner: result.owner, temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to onboard client." };
  }
}

export async function updateAccessRequestAction(id: string, status: "new" | "contacted" | "onboarded" | "declined"): Promise<void> {
  await apiMutate(`/platform-admin/access-requests/${id}`, "PATCH", { status });
  revalidatePath("/platform");
}
