"use client";

import { useState, useTransition } from "react";
import type { EnrolmentIssued } from "@greecon/shared";
import { issueEnrolmentAction } from "../../app/sites/[siteId]/setup/actions";
import { InstallCommand } from "./InstallCommand";

/** A new code for a box that has been lost, replaced or reinstalled. The box that uses it gets a new
 * credential, and the one it had stops working, so it asks first. */
export function IssueCodeButton({ siteId, gatewayId, gatewayName }: { siteId: string; gatewayId: string; gatewayName: string }) {
  const [issued, setIssued] = useState<EnrolmentIssued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function make() {
    if (!window.confirm(`Make a new install command for "${gatewayName}"? The box that uses it replaces the one now installed, and the old one stops working.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await issueEnrolmentAction(siteId, gatewayId);
      if (result.error || !result.enrolment) return setError(result.error ?? "Could not make a new code.");
      setIssued(result.enrolment);
    });
  }

  return (
    <div className="stack">
      {issued ? (
        <InstallCommand issued={issued} boxName={gatewayName} />
      ) : (
        <button type="button" className="button-ghost" onClick={make} disabled={isPending}>
          {isPending ? "Making…" : "Install a box, or replace this one"}
        </button>
      )}
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
