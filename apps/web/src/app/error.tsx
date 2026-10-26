"use client";

import Link from "next/link";
import { useEffect } from "react";

// What is shown when a page could not be made (docs/28-ux-definition.md, section 5): what it means for the person, a way to try again, and
// where to write. Never a stack trace or a code; the details are in the platform's log.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The server has the full error; the browser keeps a trace for whoever opens its console.
    console.error(error);
  }, [error]);

  return (
    <main className="state-page">
      <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
      <h1>This page could not be loaded</h1>
      <p>
        Nothing you did caused it, and nothing was changed. Try again; if it still fails in a minute or two, write to <a href="mailto:info@greecon.earth">info@greecon.earth</a>
        {error.digest ? ` and quote ${error.digest}` : ""}.
      </p>
      <p className="state-page__actions">
        <button type="button" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="button-ghost">
          Go to the start
        </Link>
      </p>
    </main>
  );
}
