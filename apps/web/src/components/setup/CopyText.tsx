"use client";

import { useRef, useState } from "react";

/** A piece of text that is meant to be copied somewhere else (a message to a customer): shown as it will be sent, with one button that copies it.
 * Where the browser will not let a page use the clipboard, the text is selected instead, so Ctrl+C works. */
export function CopyText({ text, label, name }: { text: string; label: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const selection = window.getSelection();
      if (ref.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  return (
    <div className="copy-text">
      <pre ref={ref} className="copy-text__body" aria-label={name}>
        {text}
      </pre>
      <div className="copy-text__actions no-print">
        <button type="button" className="button-ghost" onClick={copy} aria-label={`${label}: ${name}`}>
          {label}
        </button>
        {/* Said once and left standing: nothing here is closed by a timer. */}
        {copied ? (
          <span role="status" className="form-success">
            Copied.
          </span>
        ) : null}
      </div>
    </div>
  );
}
