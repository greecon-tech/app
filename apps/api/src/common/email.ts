// Accounts are found by email address alone, and the address is compared in two places that do not agree
// about every letter: in JavaScript (the check that an address is free, the key a sign-in limit counts
// against) and in the database (lower()). They differ for some letters outside plain ASCII ("İ" becomes
// "i" in the database and "i" followed by an accent in JavaScript), so one account could be signed in to
// under many spellings of its address, each counted by the rate limit as a different caller. An account's
// address is therefore plain ASCII, written in one way only, and this is that way.

/** The address as an account is stored, found and counted, or null when it cannot be an account's address. */
export function canonicalEmail(address: unknown): string | null {
  if (typeof address !== "string") return null;
  const lowered = address.trim().toLowerCase();
  if (lowered.length < 3 || lowered.length > 254) return null;
  return /^[\x21-\x7e]+$/.test(lowered) && lowered.includes("@") ? lowered : null;
}
