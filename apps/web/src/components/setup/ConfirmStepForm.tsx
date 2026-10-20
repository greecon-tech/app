"use client";

import { FormEvent, useState, useTransition } from "react";
import type { SetupStep } from "@greecon/shared";
import { confirmSetupStepAction, reopenSetupStepAction } from "../../app/sites/[siteId]/setup/actions";

/** A step only a person can see: which way the clamps point, whether the customer agreed the limits, whether
 * the numbers match the real world. Confirming records who and when; the last one is held back until the rest
 * are done. */
export function ConfirmStepForm({ siteId, step }: { siteId: string; step: SetupStep }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const commissioning = step.key === "commissioned";

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmSetupStepAction(siteId, step.key, note);
      if (result.error) setError(result.error);
      else setNote("");
    });
  }

  function reopen() {
    if (!window.confirm(commissioning ? "Take the commissioning back?" : "Reopen this step? If the site was commissioned, that is taken back too.")) return;
    setError(null);
    startTransition(async () => {
      const result = await reopenSetupStepAction(siteId, step.key);
      if (result.error) setError(result.error);
    });
  }

  if (step.status === "done") {
    return (
      <div className="setup-confirmed">
        <p>
          Confirmed by {step.confirmedBy ?? "someone"}
          {step.confirmedAtUtc ? ` on ${new Date(step.confirmedAtUtc).toLocaleString()}` : ""}.{step.note ? ` “${step.note}”` : ""}
        </p>
        <button type="button" className="button-ghost" onClick={reopen} disabled={isPending}>
          Reopen
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="setup-inline-form">
      <label className="setup-inline-form__wide">
        What you saw (optional)
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={commissioning ? "e.g. Meter display and Greecon agree within 2%" : step.key === "told" ? "e.g. Besa read the test message on her phone" : "e.g. Import rose with the kettle on"} maxLength={300} />
      </label>
      <button type="submit" disabled={isPending || step.canConfirm === false}>
        {isPending ? "Saving…" : commissioning ? "Commission this site" : "I checked this"}
      </button>
      {error ? (
        <span className="rule-actions__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
