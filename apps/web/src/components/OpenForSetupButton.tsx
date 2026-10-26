"use client";

import { useState, useTransition } from "react";
import { openForSetupAction } from "../app/platform/actions";

/** For Greecon's project manager: go into this client's account to set it up (or to look after it). */
export function OpenForSetupButton({ tenantId, name, disabled, label = "Open for setup", primary = false }: { tenantId: string; name: string; disabled?: boolean; label?: string; primary?: boolean }) {
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
      <button type="button" className={primary ? undefined : "button-ghost"} onClick={open} disabled={isPending || disabled} title={`Go into ${name}'s account. Everything you do is recorded under your name in their audit trail.`}>
        {isPending ? "Opening…" : label}
      </button>
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
