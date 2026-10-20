"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@greecon/shared";
import { apiErrorMessage, apiMutate } from "../../lib/api";

interface CreatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
}

export async function createUserAction(
  name: string,
  email: string,
  role: UserRole
): Promise<{ error?: string; user?: CreatedUser; temporaryPassword?: string }> {
  try {
    const result = await apiMutate<{ user: CreatedUser; temporaryPassword: string }>("/users", "POST", { name, email, role });
    revalidatePath("/admin");
    return { user: result.user, temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create user." };
  }
}

// Bound to a specific userId per row (see admin/page.tsx) — the role <select> submits this
// directly with no client-side JavaScript required, same progressive-enhancement pattern as the
// logout form in components/Shell.tsx.
export async function updateUserRoleAction(userId: string, formData: FormData): Promise<void> {
  const role = formData.get("role");
  if (typeof role !== "string") return;
  await apiMutate(`/users/${userId}`, "PATCH", { role });
  revalidatePath("/admin");
}

export async function updateUserStatusAction(userId: string, nextStatus: "active" | "disabled"): Promise<void> {
  await apiMutate(`/users/${userId}`, "PATCH", { status: nextStatus });
  revalidatePath("/admin");
}

export async function resetUserPasswordAction(userId: string): Promise<{ error?: string; temporaryPassword?: string }> {
  try {
    const result = await apiMutate<{ temporaryPassword: string }>(`/users/${userId}/reset-password`, "POST");
    revalidatePath("/admin");
    return { temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reset password." };
  }
}

export interface NewSiteFromTemplate {
  templateKey: string;
  name: string;
  locationName: string;
  currency: string;
  timezone: string;
}

/** Makes the site from a template and goes straight to its setup list. Only returns when something is wrong. */
export async function createSiteFromTemplateAction(input: NewSiteFromTemplate): Promise<{ error: string }> {
  if (!input.name.trim() || !input.locationName.trim()) {
    return { error: "Give the site a name and say where it is." };
  }

  let siteId: string;
  try {
    const result = await apiMutate<{ site: { id: string } }>("/sites/from-template", "POST", {
      templateKey: input.templateKey,
      name: input.name.trim(),
      locationName: input.locationName.trim(),
      currency: input.currency || undefined,
      timezone: input.timezone.trim() || undefined
    });
    siteId = result.site.id;
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not create the site.") };
  }
  revalidatePath("/admin");
  revalidatePath("/sites");
  redirect(`/sites/${siteId}/setup`);
}

export async function updateSiteAction(siteId: string, name: string, type: string, locationName: string): Promise<{ error?: string }> {
  if (!name.trim() || !locationName.trim()) {
    return { error: "Name and location are required." };
  }

  try {
    await apiMutate(`/sites/${siteId}`, "PATCH", { name, type, locationName });
    revalidatePath("/admin");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update site." };
  }
}

// The API blocks this outright (403) while the site still has any registered device — deleting a
// site cascades through its assets, devices, points, and telemetry history at the database level,
// so refusing that while equipment is still attached is worth surfacing as a real error here
// rather than silently doing nothing.
export async function deleteSiteAction(siteId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/sites/${siteId}`, "DELETE");
    revalidatePath("/admin");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete site." };
  }
}
