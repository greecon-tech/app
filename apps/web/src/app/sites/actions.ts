"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiErrorMessage, apiMutate } from "../../lib/api";

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
  revalidatePath("/sites");
  redirect(`/sites/${siteId}/setup`);
}

export async function updateSiteAction(siteId: string, name: string, type: string, locationName: string): Promise<{ error?: string }> {
  if (!name.trim() || !locationName.trim()) {
    return { error: "Name and location are required." };
  }

  try {
    await apiMutate(`/sites/${siteId}`, "PATCH", { name, type, locationName });
    revalidatePath("/sites");
    revalidatePath(`/sites/${siteId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update site." };
  }
}

// The API blocks this outright (403) while the site still has any registered device — deleting a
// site cascades through its assets, devices, points, and telemetry history at the database level,
// so refusing that while equipment is still attached is worth surfacing as a real error here
// rather than silently doing nothing. On success the person goes back to the list: the site's own page no longer exists.
export async function deleteSiteAction(siteId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/sites/${siteId}`, "DELETE");
  } catch (error) {
    return { error: apiErrorMessage(error, "The site could not be deleted. A site that still has equipment cannot be deleted: remove its equipment first.") };
  }
  revalidatePath("/sites");
  redirect("/sites");
}
