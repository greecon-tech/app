"use client";

import { ReactNode, useEffect, useState } from "react";

/** A step's disclosure. It opens when the step becomes the one to do (or needs attention) and then stays however
 * the person leaves it. A server-rendered <details open={...}> would follow the data both ways: finishing the
 * last address would close the step in the same moment, and with it the "Saved." the person was waiting for. */
export function StepDetails({ id, shouldOpen, summary, children }: { id: string; shouldOpen: boolean; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(shouldOpen);
  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);
  return (
    <details className="setup-step" id={id} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
