"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@greecon/shared";
import { listClientPeopleAction, resetClientPersonPasswordAction } from "../app/platform/actions";

interface Person {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled";
}

/** One client's people, for the person who answers the phone when an owner is locked out. Only the owner of Greecon's
 * account can reset a password (the API enforces it; the button is only hidden for everyone else). */
export function ClientPeople({ tenantId, clientName, canReset }: { tenantId: string; clientName: string; canReset: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ who: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    if (people !== null) return;
    startTransition(async () => {
      const result = await listClientPeopleAction(tenantId);
      if (result.error) setError(result.error);
      else setPeople(result.people ?? []);
    });
  }

  function reset(person: Person) {
    if (!window.confirm(`Reset the password of ${person.name} (${person.email}) at ${clientName}? Only do this after you have confirmed by phone that it is them. Their open sessions end.`)) return;
    setError(null);
    setCredential(null);
    startTransition(async () => {
      const result = await resetClientPersonPasswordAction(tenantId, person.id);
      if (result.error || !result.temporaryPassword) return setError(result.error ?? "The password could not be reset.");
      setCredential({ who: `${person.name} (${person.email})`, password: result.temporaryPassword });
    });
  }

  return (
    <details onToggle={(event) => event.currentTarget.open && load()}>
      <summary>People</summary>
      {isPending && people === null ? <p className="muted">Loading…</p> : null}
      {people?.length === 0 ? <p className="muted">Nobody in this account yet.</p> : null}
      {people && people.length > 0 ? (
        <ul className="setup-items">
          {people.map((person) => (
            <li key={person.id}>
              <span>
                <strong>{person.name}</strong>, {person.role}
                {person.status === "disabled" ? " (turned off)" : ""}
                <br />
                {person.email}
              </span>
              {canReset ? (
                <button type="button" className="button-ghost" onClick={() => reset(person)} disabled={isPending}>
                  Reset password
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {people && !canReset ? <p className="muted">Only the owner of Greecon&apos;s account resets passwords.</p> : null}
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
      {credential ? (
        <div className="credential-notice" role="status">
          <strong>New password for {credential.who} — save it now</strong>
          <p>Shown once. Give it to them by phone, not by email. They are asked to choose their own at first sign-in. The reset is recorded in their account&apos;s audit trail under your name.</p>
          <p className="credential-notice__value">{credential.password}</p>
        </div>
      ) : null}
    </details>
  );
}
