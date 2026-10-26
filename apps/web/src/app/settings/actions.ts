"use server";

import { apiErrorMessage, apiMutate } from "../../lib/api";

// The self-service counterpart to the reset on the People page: anyone who knows their own
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
