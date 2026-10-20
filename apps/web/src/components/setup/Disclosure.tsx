"use client";

import { ReactNode, useState } from "react";

/** A <details> that opens by default only the first time, and then stays however the person left it. A
 * server-rendered <details open={...}> follows the page's data: it would snap shut the moment the first device
 * is added, in the middle of adding several. */
export function Disclosure({ summary, defaultOpen = false, children }: { summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="limits" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
