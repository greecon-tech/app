"use client";

import { FormEvent, useState, useTransition } from "react";
import type { SetupStep } from "@greecon/shared";
import { confirmSetupStepAction, reopenSetupStepAction } from "../../app/sites/[siteId]/setup/actions";

/** What each step asks of the person, in its own words. The papers and the electrician must say who and when: the paper behind them is
 * somewhere else, and what is written here is the only record of it. */
const WORDS: Record<string, { label: string; placeholder: string; button: string; required: boolean }> = {
  paperwork: { label: "Who signed for the customer, and on what date", placeholder: "e.g. Signed for the hotel by Besa Krasniqi on 19 October", button: "The papers are signed", required: true },
  electrician: { label: "The electrician's name and licence number, or that no electrical work was needed", placeholder: "e.g. Arben Hoxha, licence E-1234", button: "The electrical work is done", required: true },
  commissioned: { label: "What you saw (optional)", placeholder: "e.g. Meter display and Greecon agree within 2%", button: "Commission this site", required: false },
  told: { label: "What you saw (optional)", placeholder: "e.g. Besa read the test message on her phone", button: "I checked this", required: false }
};
const DEFAULT_WORDS = { label: "What you saw (optional)", placeholder: "e.g. Import rose with the kettle on", button: "I checked this", required: false };

/** A step only a person can see: which way the clamps point, whether the customer agreed the limits, whether
 * the numbers match the real world. Confirming records who and when; the last one is held back until the rest
 * are done. */
export function ConfirmStepForm({ siteId, step }: { siteId: string; step: SetupStep }) {
  const words = WORDS[step.key] ?? DEFAULT_WORDS;
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
        {words.label}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={words.placeholder} maxLength={300} required={words.required} />
      </label>
      <button type="submit" disabled={isPending || step.canConfirm === false}>
        {isPending ? "Saving…" : words.button}
      </button>
      {error ? (
        <span className="rule-actions__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
