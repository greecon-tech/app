"use server";

const API_BASE_URL = process.env.GREECON_API_URL ?? "http://localhost:4000";

export interface AccessRequestInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  siteType: string;
  message: string;
  /** The hidden field: empty for a person. */
  website: string;
}

// The form is public: no session, so this talks to the API directly rather than through apiMutate,
// which sends the signed-in person's identity.
export async function requestAccessAction(input: AccessRequestInput): Promise<{ error?: string; received?: boolean }> {
  if (!input.name.trim() || !input.company.trim() || !input.email.trim()) {
    return { error: "Please give your name, your company and an email address." };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/public/access-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        company: input.company,
        email: input.email,
        phone: input.phone.trim() || undefined,
        siteType: input.siteType,
        message: input.message.trim() || undefined,
        website: input.website || undefined
      })
    });
  } catch {
    return { error: "We could not reach the server. Please try again, or write to info@greecon.earth." };
  }

  if (response.status === 429) return { error: "Too many requests right now. Please try again later, or write to info@greecon.earth." };
  if (response.status === 400) return { error: "Something in the form is not valid. Please check the email address and try again." };
  if (!response.ok) return { error: "Something went wrong on our side. Please try again, or write to info@greecon.earth." };
  return { received: true };
}
