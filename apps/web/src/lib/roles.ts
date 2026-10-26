import { UserRole } from "@greecon/shared";

/** What a role is called on screen, and what it may do, in the words a hotel owner would use (docs/28-ux-definition.md, section 7).
 * The permissions themselves live in packages/shared; these sentences describe them and must change with them. */
export const ROLE_WORDS: Record<UserRole, { label: string; may: string }> = {
  owner: { label: "Owner", may: "Everything in the account: people, sites, equipment, who is told, downloads and the audit log." },
  admin: { label: "Administrator", may: "Adds people and sites, changes equipment and who is told, downloads data and reads the audit log." },
  operator: { label: "Operator", may: "Sees every site and its alerts, acknowledges alerts and keeps the maintenance list. Changes nothing else." },
  viewer: { label: "Viewer", may: "Sees sites, readings and alerts. Changes nothing." },
  auditor: { label: "Auditor", may: "Sees everything, and downloads the data and the audit log. Changes nothing." }
};

export function roleLabel(role: UserRole): string {
  return ROLE_WORDS[role].label;
}
