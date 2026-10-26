"use server";

import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiMutate } from "../../lib/api";

export async function acknowledgeAlertAction(alertId: string): Promise<{ error?: string }> {
  try {
    await apiMutate(`/alerts/${alertId}/acknowledge`, "POST");
    revalidatePath("/alerts");
    revalidatePath("/");
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "The alert could not be acknowledged. Try again, and if it still fails, write to Greecon.") };
  }
}
