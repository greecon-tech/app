"use client";

import { useRef, useState } from "react";
import type { EnrolmentIssued } from "@greecon/shared";

/** The one line to paste onto a box. It is shown here once and never again (only a fingerprint of the code is
 * kept), so the way to copy it is right beside it. */
export function InstallCommand({ issued, boxName }: { issued: EnrolmentIssued; boxName: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.installCommand);
      setCopied(true);
    } catch {
      // No clipboard permission: select the text so Ctrl+C works.
      const selection = window.getSelection();
      if (ref.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  const until = new Date(issued.expiresAtUtc);
  return (
    <div className="credential-notice install-command" role="status">
      <strong>Install command for &quot;{boxName}&quot;. Copy it now.</strong>
      <p>
        Paste this on the box, in its terminal. The code works once and lasts until {until.toLocaleDateString()}. It is not shown again; if it is lost, make a new
        one.
      </p>
      <pre className="install-command__line">
        <code ref={ref}>{issued.installCommand}</code>
      </pre>
      <button type="button" className="button-ghost" onClick={copy}>
        {copied ? "Copied" : "Copy the command"}
      </button>
    </div>
  );
}
