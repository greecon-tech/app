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
      setTimeout(() => setCopied(false), 4000);
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
      <button type="button" className="button-ghost no-print" onClick={copy} aria-label={`${label}: ${name}`}>
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
