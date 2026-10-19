"use client";

import { useState, useTransition } from "react";
import { openForSetupAction } from "../app/platform/actions";

/** For Greecon's project manager: go into this client's account to set it up. */
export function OpenForSetupButton({ tenantId, name, disabled }: { tenantId: string; name: string; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await openForSetupAction(tenantId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="stack">
      <button type="button" className="button-ghost" onClick={open} disabled={isPending || disabled} title={`Go into ${name}'s account to set it up. Everything you do is recorded under your name in their audit trail.`}>
        {isPending ? "Opening…" : "Open for setup"}
      </button>
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
