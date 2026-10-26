import Link from "next/link";
import { ReactNode } from "react";

/** "Eridon Manuka" becomes "EM". A name with one word, or none, still gets a mark. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  const first = words[0] ?? "G";
  const last = words.length > 1 ? (words[words.length - 1] ?? first) : undefined;
  return [first, last]
    .filter((word): word is string => word !== undefined)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * The person's menu: a small mark with their initials (and, with room, their name and role), opening to Account, Help and Log out.
 * It is a disclosure, so it works before the page's script has loaded and with the keyboard alone.
 */
export function UserMenu({ name, role, email, logout }: { name: string; role: string; email?: string; logout?: ReactNode }) {
  return (
    <details className="user-menu">
      <summary aria-label={`${name}, ${role}. Account menu`}>
        <span className="user-menu__mark" aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className="user-menu__who">
          <strong>{name}</strong>
          <span>{role}</span>
        </span>
      </summary>
      <div className="user-menu__panel">
        <p className="user-menu__id">
          <strong>{name}</strong>
          <span>{email ?? role}</span>
          {email ? <span>{role}</span> : null}
        </p>
        <Link href="/settings">Account</Link>
        <Link href="/help">Help</Link>
        {logout}
      </div>
    </details>
  );
}
