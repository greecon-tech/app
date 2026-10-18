"use client";

import { useEffect, useState } from "react";

/** A moment shown in the viewer's own time, 24-hour, with the date only when it is not today.
 * The server cannot know the viewer's time zone, so it first renders UTC (labelled as such) and the
 * browser then replaces it. */
export function LocalClock({ iso }: { iso: string }) {
  const ms = Date.parse(iso);
  const [text, setText] = useState(() => (Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(11, 16)} UTC` : "time unknown"));

  useEffect(() => {
    if (Number.isFinite(ms)) setText(formatLocal(ms));
  }, [ms]);

  return <time dateTime={iso}>{text}</time>;
}

function formatLocal(ms: number): string {
  const moment = new Date(ms);
  const clock = moment.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date();
  const sameDay =
    moment.getFullYear() === today.getFullYear() && moment.getMonth() === today.getMonth() && moment.getDate() === today.getDate();
  return sameDay ? clock : `${moment.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${clock}`;
}
