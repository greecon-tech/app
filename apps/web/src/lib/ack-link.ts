import type { AcknowledgeLinkView } from "@greecon/shared";

const API_BASE_URL = process.env.GREECON_API_URL ?? "http://localhost:4000";

/** Reads the alert behind a link. No side effect: opening a link never acknowledges anything (mail and text scanners open links). Any
 * failure is the same answer as an expired link, so a person is never shown an error they cannot act on. */
export async function lookUpAckLink(token: string, visitor: Record<string, string>): Promise<AcknowledgeLinkView> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/acknowledge/${encodeURIComponent(token)}`, { headers: visitor, cache: "no-store" });
    if (!response.ok) return { valid: false };
    return (await response.json()) as AcknowledgeLinkView;
  } catch {
    return { valid: false };
  }
}

export async function acknowledgeThroughLink(token: string, visitor: Record<string, string>): Promise<{ ok: boolean; state?: "open" | "acknowledged" | "cleared"; tooMany?: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/acknowledge/${encodeURIComponent(token)}`, { method: "POST", headers: visitor, cache: "no-store" });
    if (response.status === 429) return { ok: false, tooMany: true };
    if (!response.ok) return { ok: false };
    const body = (await response.json().catch(() => ({ valid: false }))) as AcknowledgeLinkView;
    return { ok: body.valid !== false, state: body.alert?.state };
  } catch {
    return { ok: false };
  }
}
