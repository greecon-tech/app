"use client";

import { FormEvent, useState, useTransition } from "react";
import { DeviceProfilePoint, PointSource, rangeProblem } from "@greecon/shared";
import { RangeAnswer, setRangesAction } from "../../app/sites/[siteId]/setup/actions";

interface Entry {
  range: string;
  tankHeight: string;
  notFitted: boolean;
}

const EMPTY: Entry = { range: "", tankHeight: "", notFitted: false };

/** The range printed on each transmitter's label, in the words of the label. From it Greecon works out which register to read and the scale,
 * so nobody types a register or a conversion: a 4 to 20 mA transmitter is the same everywhere, and only its range differs. A transmitter the
 * site does not have (no flow meter) is ticked off, and its reading is taken away, so that nothing waits for it. */
export function SensorRangesForm({
  siteId,
  device,
  readings
}: {
  siteId: string;
  device: { id: string; name: string };
  readings: Array<{ point: DeviceProfilePoint; source?: PointSource }>;
}) {
  const asked = readings.filter((reading) => reading.point.range);
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      asked.map(({ point, source }) => [
        point.canonicalName,
        // A pressure or flow range can be read back from what was saved; a level cannot (its saved scale is the range over the tank's height).
        { ...EMPTY, range: point.range?.kind === "span" && source?.linear ? String(source.linear.engHigh) : "" }
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const change = (name: string, patch: Partial<Entry>) => setEntries((current) => ({ ...current, [name]: { ...(current[name] ?? EMPTY), ...patch } }));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const answers: RangeAnswer[] = [];
    for (const { point } of asked) {
      const entry = entries[point.canonicalName] ?? EMPTY;
      if (entry.notFitted) {
        answers.push({ canonicalName: point.canonicalName, notFitted: true });
        continue;
      }
      if (entry.range.trim() === "" && entry.tankHeight.trim() === "") continue;
      const answer = { range: Number(entry.range), ...(point.range?.kind === "level" ? { tankHeight: Number(entry.tankHeight) } : {}) };
      const problem = point.range ? rangeProblem(point.range, answer) : undefined;
      if (problem) return setError(`${point.label}: ${problem}`);
      answers.push({ canonicalName: point.canonicalName, ...answer });
    }
    if (answers.length === 0) return setError("Fill in the range of at least one transmitter, or tick “Not fitted at this site”.");
    startTransition(async () => {
      const result = await setRangesAction(siteId, device.id, answers);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  if (asked.length === 0) return null;
  return (
    <form onSubmit={save} className="setup-ranges" aria-label={`Transmitter ranges for ${device.name}`}>
      {asked.map(({ point, source }) => {
        const range = point.range as NonNullable<DeviceProfilePoint["range"]>;
        const entry = entries[point.canonicalName] ?? EMPTY;
        return (
          <fieldset key={point.canonicalName} className="setup-ranges__field" disabled={isPending}>
            <legend>
              {range.question}: {point.label.toLowerCase()} <span className="muted">(input {range.channel})</span>
            </legend>
            <p className="muted limits__help">{range.help}</p>
            {source?.linear ? (
              <p className="muted">
                Set now: 4 mA is {source.linear.engLow} {point.unit} and 20 mA is {source.linear.engHigh} {point.unit}.
              </p>
            ) : null}
            <div className="setup-inline-form">
              <label>
                {range.kind === "level" ? `Range on the label (${range.rangeUnit})` : `Top of the range (${range.rangeUnit})`}
                <input value={entry.range} onChange={(event) => change(point.canonicalName, { range: event.target.value })} inputMode="decimal" size={7} disabled={entry.notFitted} placeholder={range.kind === "level" ? "e.g. 5" : "e.g. 10"} />
              </label>
              {range.kind === "level" ? (
                <label>
                  How tall the tank is inside ({range.rangeUnit})
                  <input value={entry.tankHeight} onChange={(event) => change(point.canonicalName, { tankHeight: event.target.value })} inputMode="decimal" size={7} disabled={entry.notFitted} placeholder="e.g. 4" />
                </label>
              ) : null}
              <label className="setup-ranges__skip">
                <input type="checkbox" checked={entry.notFitted} onChange={(event) => change(point.canonicalName, { notFitted: event.target.checked })} /> Not fitted at this site
              </label>
            </div>
          </fieldset>
        );
      })}
      <div className="limits__actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save the ranges"}
        </button>
        {saved ? (
          <span className="form-success" role="status">
            Saved. The box picks it up within a minute.
          </span>
        ) : null}
        {error ? (
          <span className="rule-actions__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
