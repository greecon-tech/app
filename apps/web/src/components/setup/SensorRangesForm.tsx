"use client";

import { FormEvent, useState, useTransition } from "react";
import { DeviceProfilePoint, LevelLabelUnit, PointSource, levelInMetres, rangeProblem, typedNumber } from "@greecon/shared";
import { RangeAnswer, setRangesAction } from "../../app/sites/[siteId]/setup/actions";

interface Entry {
  range: string;
  tankHeight: string;
  /** What the range on a level transmitter's label is in: metres, or bar (a pressure sensor at the bottom of the tank). */
  labelUnit: LevelLabelUnit;
  notFitted: boolean;
}

const EMPTY: Entry = { range: "", tankHeight: "", labelUnit: "m", notFitted: false };

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
    const taking: string[] = [];
    for (const { point } of asked) {
      const entry = entries[point.canonicalName] ?? EMPTY;
      if (entry.notFitted) {
        answers.push({ canonicalName: point.canonicalName, notFitted: true });
        taking.push(point.label.toLowerCase());
        continue;
      }
      if (entry.range.trim() === "" && entry.tankHeight.trim() === "") continue;
      // What is typed is read the way people write it ("2,5" is 2.5), and the label's unit is turned into metres here, so that the platform only ever hears metres.
      const range = typedNumber(entry.range);
      const answer = point.range?.kind === "level" ? { range: levelInMetres(range, entry.labelUnit), tankHeight: typedNumber(entry.tankHeight) } : { range };
      const problem = point.range ? rangeProblem(point.range, answer) : undefined;
      if (problem) return setError(`${point.label}: ${problem}`);
      answers.push({ canonicalName: point.canonicalName, ...answer });
    }
    if (answers.length === 0) return setError("Fill in the range of at least one transmitter, or tick “Not fitted at this site”.");
    // Taking a reading away removes its history too, and this is the one thing on the page that cannot be put back: it is asked first.
    if (taking.length > 0 && !window.confirm(`Take away ${taking.join(" and ")} from this site? The reading and its history are removed. This cannot be undone.`)) return;
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
        const level = range.kind === "level";
        const inBar = level && entry.labelUnit === "bar";
        const typed = typedNumber(entry.range);
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
                {level ? "Range on the label" : `Top of the range (${range.rangeUnit})`}
                <input
                  value={entry.range}
                  onChange={(event) => change(point.canonicalName, { range: event.target.value })}
                  inputMode="decimal"
                  size={7}
                  disabled={entry.notFitted}
                  placeholder={level ? (inBar ? "e.g. 0.5" : "e.g. 5") : "e.g. 10"}
                />
              </label>
              {level ? (
                <label>
                  Unit on the label
                  <select value={entry.labelUnit} onChange={(event) => change(point.canonicalName, { labelUnit: event.target.value as LevelLabelUnit })} disabled={entry.notFitted}>
                    <option value="m">metres (m)</option>
                    <option value="bar">bar</option>
                  </select>
                </label>
              ) : null}
              {level ? (
                <label>
                  How tall the tank is inside (metres)
                  <input value={entry.tankHeight} onChange={(event) => change(point.canonicalName, { tankHeight: event.target.value })} inputMode="decimal" size={7} disabled={entry.notFitted} placeholder="e.g. 4" />
                </label>
              ) : null}
              <label className="setup-ranges__skip">
                <input type="checkbox" checked={entry.notFitted} onChange={(event) => change(point.canonicalName, { notFitted: event.target.checked })} /> Not fitted at this site
              </label>
            </div>
            {inBar && Number.isFinite(typed) && typed > 0 ? (
              <p className="muted limits__help">
                {typed} bar holds up {levelInMetres(typed, "bar")} metres of water, so the transmitter reads up to that depth.
              </p>
            ) : null}
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
