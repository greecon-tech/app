"use client";

import { useEffect, useState } from "react";
import { describeAge } from "@greecon/shared";

/** How long ago something was measured, kept true in the browser. The page is rendered once and may
 * then sit open; "2 minutes ago" must keep counting, or it quietly becomes a false reassurance.
 *
 * Before the browser takes over it shows the clock time in UTC, which is the same on the server and
 * the first client render, so there is no mismatch to repair. */
export function Ago({ iso }: { iso: string }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const takenMs = Date.parse(iso);
  if (!Number.isFinite(takenMs)) return <span>time unknown</span>;

  const ageSeconds = nowMs === null ? null : Math.max(0, Math.round((nowMs - takenMs) / 1000));
  const label = ageSeconds === null ? `${clockUtc(takenMs)} UTC` : ageSeconds < 15 ? "just now" : `${describeAge(ageSeconds)} ago`;
  return (
    <time dateTime={iso} title={nowMs === null ? undefined : new Date(takenMs).toLocaleString()}>
      {label}
    </time>
  );
}

function clockUtc(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}
