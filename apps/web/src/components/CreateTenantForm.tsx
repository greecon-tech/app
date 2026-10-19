"use client";

import { FormEvent, useState, useTransition } from "react";
import { createTenantAction } from "../app/platform/actions";

// Onboards a brand new client (tenant) with its own first owner account, isolated from every
// other client's data — see apps/api/src/platform/platform.service.ts's createTenant. The owner's
// temporary password is shown exactly once, same handling as CreateUserForm.
export function CreateTenantForm({ prefill }: { prefill?: { requestId: string; name: string; ownerName: string; ownerEmail: string } }) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [domain, setDomain] = useState("");
  const [ownerName, setOwnerName] = useState(prefill?.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(prefill?.ownerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ clientName: string; ownerEmail: string; temporaryPassword: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTenantAction(name, domain, ownerName, ownerEmail, prefill?.requestId);
      if (result.error || !result.tenant || !result.owner || !result.temporaryPassword) {
        setError(result.error ?? "Failed to onboard client.");
        return;
      }
      setCreated({ clientName: result.tenant.name, ownerEmail: result.owner.email, temporaryPassword: result.temporaryPassword });
      setName("");
      setDomain("");
      setOwnerName("");
      setOwnerEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="rule-form">
      <div className="rule-form__grid">
        <label>
          Client / company name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Vjosa Agro Sh.p.k" required />
        </label>
        <label>
          Owner name
          <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Full name" required />
        </label>
        <label>
          Owner email
          <input
            type="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
            placeholder="owner@theircompany.example"
            required
          />
        </label>
      </div>
      <details className="limits">
        <summary>Advanced</summary>
        <label>
          Identifier (optional)
          <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Made from the company name when left empty" />
          <span className="muted limits__help">Only has to be unique across clients. Nobody types it.</span>
        </label>
      </details>
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Onboarding…" : "Onboard client"}
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {created ? (
        <div className="credential-notice" role="status">
          <strong>Client onboarded — save this password now</strong>
          <p>
            Shown once and never stored in plaintext. Send it to <strong>{created.ownerEmail}</strong> ({created.clientName}'s owner account)
            directly, not by email.
          </p>
          <p className="credential-notice__value">{created.temporaryPassword}</p>
        </div>
      ) : null}
    </form>
  );
}
