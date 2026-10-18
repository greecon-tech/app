"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps a page that shows live status from going quietly out of date: re-fetches it on a timer,
 * and straight away when the tab comes back to the front. A static snapshot has nothing to
 * re-fetch, so the page passes `enabled={false}` there. */
export function LiveRefresh({ everySeconds = 60, enabled = true }: { everySeconds?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everySeconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everySeconds, enabled]);

  return null;
}
