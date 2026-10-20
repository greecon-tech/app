"use client";

/** Prints the page it is on; the print styles leave only the sheet. */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="button-ghost no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
