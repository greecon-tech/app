"use client";

import { FormEvent, useState, useTransition } from "react";
import { StaffMember } from "@greecon/shared";
import { addTeamMemberAction, resetTeamMemberPasswordAction, setTeamMemberStatusAction } from "../app/platform/actions";

interface Credential {
  who: string;
  email: string;
  password: string;
  kind: "added" | "reset";
}

/** Greecon's own team: the people who may open customers' accounts. Everyone on it sees who is on it; only the
 * owner of Greecon's account adds, turns off or resets (the API enforces that; this only hides what would be refused). */
export function TeamMembers({ members, canChange }: { members: StaffMember[]; canChange: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCredential(null);
    startTransition(async () => {
      const result = await addTeamMemberAction(name, email);
      if (result.error || !result.member || !result.temporaryPassword) {
        setError(result.error ?? "The person could not be added.");
        return;
      }
      setCredential({ who: result.member.name, email: result.member.email, password: result.temporaryPassword, kind: "added" });
      setName("");
      setEmail("");
    });
  }

  function toggle(member: StaffMember) {
    setError(null);
    setCredential(null);
    startTransition(async () => {
      const result = await setTeamMemberStatusAction(member.id, member.status === "active" ? "disabled" : "active");
      if (result.error) setError(result.error);
    });
  }

  function reset(member: StaffMember) {
    setError(null);
    setCredential(null);
    startTransition(async () => {
      const result = await resetTeamMemberPasswordAction(member.id);
      if (result.error || !result.temporaryPassword) {
        setError(result.error ?? "The password could not be reset.");
        return;
      }
      setCredential({ who: member.name, email: member.email, password: result.temporaryPassword, kind: "reset" });
    });
  }

  return (
    <div className="team">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Access</th>
            {canChange ? <th scope="col">Change</th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <strong>{member.name}</strong>
                {member.isYou ? <span className="muted"> (you)</span> : null}
              </td>
              <td>{member.email}</td>
              <td>{member.status === "active" ? "Can sign in" : "Turned off"}</td>
              {canChange ? (
                <td>
                  {member.isYou ? (
                    <span className="muted">Choose your own password in Settings.</span>
                  ) : (
                    <div className="rule-actions">
                      <button type="button" className="button-ghost" onClick={() => reset(member)} disabled={isPending}>
                        Reset password
                      </button>
                      <button type="button" className="button-ghost" onClick={() => toggle(member)} disabled={isPending}>
                        {member.status === "active" ? "Turn off" : "Turn back on"}
                      </button>
                    </div>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {canChange ? (
        <form onSubmit={add} className="rule-form" aria-label="Add a team member">
          <div className="rule-form__grid">
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@greecon.earth" required />
            </label>
          </div>
          <div className="rule-form__footer">
            <button type="submit" disabled={isPending}>
              {isPending ? "Working…" : "Add to the team"}
            </button>
            <span className="muted">They can open any client&apos;s account to set it up, and everything they do shows under their name there.</span>
          </div>
        </form>
      ) : (
        <p className="muted">Only the owner of Greecon&apos;s account adds people to the team, turns them off or resets their passwords.</p>
      )}

      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
      {credential ? (
        <div className="credential-notice" role="status">
          <strong>{credential.kind === "added" ? "Added to the team" : "New password"} — save this password now</strong>
          <p>
            Shown once and never stored. Give it to <strong>{credential.who}</strong> ({credential.email}) in person or by phone, not by email. They choose &quot;Greecon team&quot; on the sign-in page, and are asked for a
            password of their own straight away.
          </p>
          <p className="credential-notice__value">{credential.password}</p>
        </div>
      ) : null}
    </div>
  );
}
