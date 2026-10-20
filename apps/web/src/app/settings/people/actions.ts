"use server";

import { revalidatePath } from "next/cache";
import type { NotificationContact, NotificationLogEntry, NotificationSettings } from "@greecon/shared";
import { apiErrorMessage, apiMutate } from "../../../lib/api";

// What the account's owner or administrator (or Greecon staff setting the account up) does on the Who is told
// page. Each goes to the API, which checks the person may and what they typed; its words are shown as they are.

export interface ContactDraft {
  id?: string;
  name: string;
  email: string;
  phone: string;
}

export async function saveContactsAction(contacts: ContactDraft[]): Promise<{ error?: string; contacts?: NotificationContact[] }> {
  try {
    const saved = await apiMutate<NotificationContact[]>("/notifications/contacts", "PUT", {
      contacts: contacts.map((contact) => ({ ...(contact.id ? { id: contact.id } : {}), name: contact.name, email: contact.email, phone: contact.phone }))
    });
    revalidatePath("/settings/people");
    revalidatePath("/sites", "layout");
    return { contacts: saved };
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not save the list.") };
  }
}

export async function saveSettingsAction(settings: NotificationSettings): Promise<{ error?: string }> {
  try {
    await apiMutate("/notifications/settings", "PUT", settings);
    revalidatePath("/settings/people");
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not save the settings.") };
  }
}

export async function sendTestAction(contactId: string): Promise<{ error?: string; entries?: NotificationLogEntry[] }> {
  try {
    const entries = await apiMutate<NotificationLogEntry[]>(`/notifications/contacts/${contactId}/test`, "POST");
    revalidatePath("/settings/people");
    revalidatePath("/sites", "layout");
    return { entries };
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not send the test message.") };
  }
}
