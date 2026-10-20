"use server";

import { revalidatePath } from "next/cache";
import { DashboardWidgetPreference, DashboardWidgetSize, dashboardWidgetCatalog, dashboardWidgetSizes } from "@greecon/shared";
import { apiErrorMessage, apiGet, apiMutate } from "../../lib/api";

/** The saved list, extended with any catalog entry it's missing (a widget added to the product
 * after someone last customized their dashboard) so every known widget always has a row to
 * control, and falls back to "everyone visible, medium, catalog order" the first time anyone
 * customizes anything at all. */
export async function loadWidgetPreferences(): Promise<DashboardWidgetPreference[]> {
  const saved = await apiGet<DashboardWidgetPreference[]>("/dashboard-preferences");
  const seen = new Set(saved.map((widget) => widget.key));
  const missing: DashboardWidgetPreference[] = dashboardWidgetCatalog.filter((key) => !seen.has(key)).map((key) => ({ key, visible: true, size: "medium" }));
  return [...saved, ...missing];
}

async function persist(widgets: DashboardWidgetPreference[]): Promise<void> {
  await apiMutate("/dashboard-preferences", "PUT", { widgets });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function moveWidgetAction(key: string, direction: "up" | "down"): Promise<void> {
  const widgets = await loadWidgetPreferences();
  const index = widgets.findIndex((widget) => widget.key === key);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= widgets.length) return;

  const reordered = [...widgets];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith] as DashboardWidgetPreference, reordered[index] as DashboardWidgetPreference];
  await persist(reordered);
}

export async function toggleWidgetVisibilityAction(key: string): Promise<void> {
  const widgets = await loadWidgetPreferences();
  const next = widgets.map((widget) => (widget.key === key ? { ...widget, visible: !widget.visible } : widget));
  await persist(next);
}

export async function cycleWidgetSizeAction(key: string): Promise<void> {
  const widgets = await loadWidgetPreferences();
  const next = widgets.map((widget) => {
    if (widget.key !== key) return widget;
    const nextSize = dashboardWidgetSizes[(dashboardWidgetSizes.indexOf(widget.size) + 1) % dashboardWidgetSizes.length] as DashboardWidgetSize;
    return { ...widget, size: nextSize };
  });
  await persist(next);
}

// The self-service counterpart to the admin-driven reset on /admin: anyone who knows their own
// current password can set a new one themselves, no console command or admin needed — see
// docs/13-pilot-readiness.md, "the whole setup should be possible from app.greecon.earth."
export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<{ error?: string; success?: boolean }> {
  try {
    await apiMutate("/auth/change-password", "POST", { currentPassword, newPassword });
    return { success: true };
  } catch (error) {
    return { error: apiErrorMessage(error, "Failed to change password.") };
  }
}
