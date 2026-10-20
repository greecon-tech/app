import { headers } from "next/headers";

/** The address of the person whose browser made the request being served, for the API to count its limits
 * against. Every request the API gets from this web service comes from the web service, so without it one
 * visitor who floods the sign-in page, or fills in the request form again and again, would use up the
 * limit for every other visitor. The platform in front of this service adds the address it saw to the end of
 * X-Forwarded-For; whatever a visitor wrote there themselves comes before it, so the last entry is the one
 * to trust. The API trusts one proxy hop (TRUST_PROXY=1) and so reads the last entry it is given. */
export async function visitorHeaders(): Promise<Record<string, string>> {
  try {
    const chain = ((await headers()).get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
    const visitor = chain[chain.length - 1];
    return visitor ? { "x-forwarded-for": visitor } : {};
  } catch {
    // Not inside a request (a build), or no such header (a laptop): the API counts the web service itself.
    return {};
  }
}
