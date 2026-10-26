"use client";

import { useState, useTransition } from "react";
import { completeMaintenanceTaskAction, reopenMaintenanceTaskAction } from "../app/maintenance/actions";

export function MaintenanceTaskActions({ taskId, status }: { taskId: string; status: "open" | "complete" }) {
  const [completionLog, setCompletionLog] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function complete() {
    setError(null);
    startTransition(async () => {
      const result = await completeMaintenanceTaskAction(taskId, completionLog);
      if (result.error) setError(result.error);
    });
  }

  function reopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenMaintenanceTaskAction(taskId);
      if (result.error) setError(result.error);
    });
  }

  if (status === "complete") {
    return (
      <div className="rule-actions">
        <button type="button" className="button-ghost" disabled={isPending} onClick={reopen}>
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
    <div className="rule-actions">
      <input value={completionLog} onChange={(event) => setCompletionLog(event.target.value)} placeholder="Completion note (optional)" aria-label="Completion note (optional)" />
      <button type="button" className="button-ghost" disabled={isPending} onClick={complete}>
        {isPending ? "Completing…" : "Mark complete"}
      </button>
      {error ? (
        <p className="rule-actions__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
