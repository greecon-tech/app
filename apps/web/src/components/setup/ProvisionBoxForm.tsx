"use client";

import { FormEvent, useState, useTransition } from "react";
import type { EnrolmentIssued } from "@greecon/shared";
import { provisionBoxAction } from "../../app/sites/[siteId]/setup/actions";
import { InstallCommand } from "./InstallCommand";

/** Adds a box to the site and shows the one command that installs it. The command is shown once, so everything
 * here stays in one place in the page: adding the box refreshes the page behind it, and a form that moved would
 * lose the command before anyone could copy it. */
export function ProvisionBoxForm({ siteId, another = false }: { siteId: string; another?: boolean }) {
  const [name, setName] = useState("Plant room box");
  const [expanded, setExpanded] = useState(!another);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ enrolment: EnrolmentIssued; boxName: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await provisionBoxAction(siteId, name);
      if (result.error || !result.enrolment) return setError(result.error ?? "Could not add the box.");
      setIssued({ enrolment: result.enrolment, boxName: result.boxName ?? name });
    });
  }

  if (issued) {
    return (
      <div className="stack">
        <InstallCommand issued={issued.enrolment} boxName={issued.boxName} />
        <button type="button" className="button-ghost" onClick={() => setIssued(null)}>
          I have copied it
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button type="button" className="button-ghost" onClick={() => setExpanded(true)}>
        Add another box
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rule-form">
      <div className="rule-form__grid">
        <label>
          What to call the box
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Plant room box" required />
        </label>
      </div>
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add the box and get its install command"}
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
