"use client";

import { useState, useTransition } from "react";

// Suspending is the one button in the console that stops a customer's whole account at once: everyone in it is signed out, its box is turned
// away, and nobody is messaged about an alert until it is turned back on. It asks once and says so (docs/29, S10: a consequential action names
// what it will do and asks once). Turning it back on is safe and asks nothing.
export function ClientStatusButton({ action, suspend, clientName }: { action: () => Promise<{ error?: string }>; suspend: boolean; clientName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (suspend && !window.confirm(`Suspend ${clientName}? Everyone in it is signed out at once and cannot sign in, its box is turned away, and nobody is messaged about its alerts until you reactivate it. Nothing is deleted.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <button type="button" className="button-ghost" disabled={isPending} onClick={handleClick}>
        {isPending ? (suspend ? "Suspending…" : "Reactivating…") : suspend ? "Suspend this client" : "Reactivate this client"}
      </button>
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
