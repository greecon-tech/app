"use client";

import { useState, useTransition } from "react";
import { acknowledgeByLinkAction } from "../app/ack/actions";

/** The one button on the page a message's link opens. Pressing it is the only thing that acknowledges: opening the link does not. */
export function AcknowledgeByLinkForm({ token }: { token: string }) {
  const [done, setDone] = useState<"acknowledged" | "cleared" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeByLinkAction(token);
      if (result.error) setError(result.error);
      else setDone(result.state === "cleared" ? "cleared" : "acknowledged");
    });
  }

  if (done) {
    return (
      <div className="credential-notice" role="status">
        <strong>{done === "cleared" ? "Nothing more to do." : "Thank you. Greecon has your answer."}</strong>
        <p>
          {done === "cleared"
            ? "This alert has cleared by itself."
            : "Nobody else will be reminded about this alert. It stays open until its cause is gone, and you will be told if it comes back."}
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <button type="button" onClick={acknowledge} disabled={isPending}>
        {isPending ? "Saving…" : "Yes, I have seen it"}
      </button>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
