"use client";

import { useState } from "react";
import { EnergyFlowView } from "@greecon/shared";
import { EnergyFlow } from "./EnergyFlow";

/** The energy picture of one site, named, for the Overview. With several sites that measure energy, a row of buttons chooses
 * which one is drawn: one picture at a time is readable on a phone, and a stack of three is not. */
export function EnergyFlowSwitch({ entries }: { entries: Array<{ siteId: string; siteName: string; flow: EnergyFlowView }> }) {
  const [selected, setSelected] = useState(0);
  const entry = entries[Math.min(selected, entries.length - 1)];
  if (!entry) return null;

  return (
    <div className="panel energy-flows__item">
      {entries.length > 1 ? (
        <div className="segmented" role="group" aria-label="Which site's energy to show">
          {entries.map((candidate, index) => (
            <button key={candidate.siteId} type="button" className="button-ghost" aria-pressed={index === selected} onClick={() => setSelected(index)}>
              {candidate.siteName}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="energy-flows__site">{entry.siteName}</h3>
      )}
      <EnergyFlow flow={entry.flow} siteName={entry.siteName} />
    </div>
  );
}
