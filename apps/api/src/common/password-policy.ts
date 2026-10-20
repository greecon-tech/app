/** What a password must be, said in words the person choosing it can act on. One rule set for every
 * way a password is chosen, so a weak one cannot get in by a different door. */
export const MINIMUM_PASSWORD_LENGTH = 10;

// Not a dictionary: only the words this product and its documents have ever published or suggested,
// and the passwords nobody should have in the first place.
const NEVER_ALLOWED = new Set(["password", "passw0rd", "1234567890", "qwertyuiop", "greecon", "greecon123", "demo123", "greecon-demo-2026", "administrator", "changeme123"]);

export function problemWithNewPassword(newPassword: string, currentPassword?: string): string | undefined {
  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) return `Choose a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  if (currentPassword !== undefined && newPassword === currentPassword) return "Choose a password different from the current one.";
  if (NEVER_ALLOWED.has(newPassword.toLowerCase())) return "That password is too easy to guess. Choose another.";
  if (/^(.)\1+$/.test(newPassword)) return "A password of one repeated character is too easy to guess. Choose another.";
  return undefined;
}
