/** An audit entry's code ("alert.acknowledged", "gateway_enrolled") as a short phrase a person can read ("Alert acknowledged"). */
export function auditWords(code: string): string {
  const spaced = code.replace(/[._:-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
