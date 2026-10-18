"use client";

import { FormEvent, useState, useTransition } from "react";
import { CanonicalPointName, limitsFor } from "@greecon/shared";
import { updatePointLimitsAction } from "../app/sites/[siteId]/actions";

interface LimitPoint {
  id: string;
  label: string;
  canonicalName: CanonicalPointName;
  thresholdConfig?: Record<string, number>;
}

// How long a reading may go without renewal is stored in seconds and entered in minutes: nobody
// sets "300 seconds" for a probe that reports every 15 minutes.
const isAge = (key: string) => key === "max_age_seconds";
const toField = (key: string, value: number) => String(isAge(key) ? value / 60 : value);
const fromField = (key: string, text: string) => (isAge(key) ? Math.round(Number(text) * 60) : Number(text));

/** The limits a site sets on one reading: what counts as low, dry, or out of date for this tank,
 * this field, this pump. A blank field means "use the standard", or "say nothing" where the platform
 * has no standard (irrigation, solar surplus). */
export function PointLimitsForm({ siteId, point }: { siteId: string; point: LimitPoint }) {
  const definitions = limitsFor(point.canonicalName);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(definitions.map((definition) => [definition.key, point.thresholdConfig?.[definition.key] !== undefined ? toField(definition.key, point.thresholdConfig[definition.key] as number) : ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setCount = Object.keys(point.thresholdConfig ?? {}).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const limits: Record<string, number> = {};
    for (const definition of definitions) {
      const text = (values[definition.key] ?? "").trim();
      if (text !== "") limits[definition.key] = fromField(definition.key, text);
    }
    startTransition(async () => {
      const result = await updatePointLimitsAction(siteId, point.id, limits);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <details className="limits">
      <summary>{setCount > 0 ? `${setCount} set` : "Standard"}</summary>
      <form onSubmit={submit} className="limits__form">
        {definitions.map((definition) => (
          <label key={definition.key}>
            {definition.label} ({isAge(definition.key) ? "minutes" : definition.unit})
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={values[definition.key] ?? ""}
              onChange={(event) => setValues({ ...values, [definition.key]: event.target.value })}
              placeholder={definition.fallback !== null ? `Standard: ${definition.fallback}` : isAge(definition.key) ? "Standard for this kind of reading" : "Not set"}
            />
            <span className="muted limits__help">{definition.help}</span>
          </label>
        ))}
        <div className="rule-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save limits"}
          </button>
          {saved ? <span className="muted">Saved. Alerts and states now follow these limits.</span> : null}
        </div>
        {error ? <p className="rule-actions__error">{error}</p> : null}
      </form>
    </details>
  );
}
