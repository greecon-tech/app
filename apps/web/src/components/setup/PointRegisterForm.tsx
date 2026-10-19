"use client";

import { FormEvent, useState, useTransition } from "react";
import { describeSource, modbusDataTypes, ModbusDataType, ModbusRegisterType, ModbusWordOrder, PointSource, SignPart, validatePointSource } from "@greecon/shared";
import { updatePointSourceAction } from "../../app/sites/[siteId]/setup/actions";

const toField = (value: number | undefined, fallback = "") => (value === undefined ? fallback : String(value));

type Conversion = "scale" | "linear";

/** Which register holds one reading, and how what the device says becomes a number. For a meter Greecon
 * knows, this is filled in already. For anything else it comes from the device's datasheet; the datasheet's
 * own words (a register called 30053, a 4-20 mA transmitter that covers 0 to 10 bar) are what this asks for. */
export function PointRegisterForm({ siteId, point }: { siteId: string; point: { id: string; label: string; source?: PointSource } }) {
  const source = point.source;
  const [registerType, setRegisterType] = useState<ModbusRegisterType>(source?.registerType ?? "holding");
  const [address, setAddress] = useState(toField(source?.address));
  const [dataType, setDataType] = useState<ModbusDataType>(source?.dataType ?? "uint16");
  const [wordOrder, setWordOrder] = useState<ModbusWordOrder>(source?.wordOrder ?? "big");
  const [conversion, setConversion] = useState<Conversion>(source?.linear ? "linear" : "scale");
  const [scale, setScale] = useState(toField(source?.scale, "1"));
  const [offset, setOffset] = useState(toField(source?.offset, "0"));
  const [rawLow, setRawLow] = useState(toField(source?.linear?.rawLow, "4"));
  const [rawHigh, setRawHigh] = useState(toField(source?.linear?.rawHigh, "20"));
  const [engLow, setEngLow] = useState(toField(source?.linear?.engLow, "0"));
  const [engHigh, setEngHigh] = useState(toField(source?.linear?.engHigh));
  const [part, setPart] = useState<SignPart | "">(source?.part ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const twoRegisters = dataType === "uint32" || dataType === "int32" || dataType === "float32";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const next: PointSource = {
      kind: "modbus",
      registerType,
      address: Number(address),
      dataType,
      ...(twoRegisters ? { wordOrder } : {}),
      ...(conversion === "linear"
        ? { linear: { rawLow: Number(rawLow), rawHigh: Number(rawHigh), engLow: Number(engLow), engHigh: Number(engHigh) } }
        : { scale: Number(scale), offset: Number(offset) }),
      ...(part ? { part } : {})
    };
    const problems = validatePointSource(next);
    if (address.trim() === "") problems.unshift("Enter the register address.");
    if (conversion === "linear" && engHigh.trim() === "") problems.push("Enter what the top of the signal means, for example 10 for 10 bar.");
    if (problems.length > 0) return setError(problems.join(" "));
    startTransition(async () => {
      const result = await updatePointSourceAction(siteId, point.id, next);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  function clear() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePointSourceAction(siteId, point.id, null);
      if (result.error) setError(result.error);
    });
  }

  return (
    <details className="limits">
      <summary>{source ? describeSource(source) : "Choose the register"}</summary>
      <form onSubmit={save} className="limits__form" aria-label={`Register for ${point.label}`}>
        <label>
          Register kind
          <select value={registerType} onChange={(event) => setRegisterType(event.target.value as ModbusRegisterType)}>
            <option value="holding">Holding (a manual's 4xxxx)</option>
            <option value="input">Input (a manual's 3xxxx)</option>
          </select>
        </label>
        <label>
          Address
          <input value={address} onChange={(event) => setAddress(event.target.value)} inputMode="numeric" placeholder="e.g. 52" />
        </label>
        <p className="muted limits__help">Counted from zero: a manual's 30053 is address 52, and 40001 is address 0.</p>
        <label>
          Kind of number
          <select value={dataType} onChange={(event) => setDataType(event.target.value as ModbusDataType)}>
            {modbusDataTypes.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
        {twoRegisters ? (
          <label>
            Which half comes first
            <select value={wordOrder} onChange={(event) => setWordOrder(event.target.value as ModbusWordOrder)}>
              <option value="big">The high half first (usual)</option>
              <option value="little">The low half first</option>
            </select>
          </label>
        ) : null}
        <label>
          How it becomes the reading
          <select value={conversion} onChange={(event) => setConversion(event.target.value as Conversion)}>
            <option value="scale">Multiply and add</option>
            <option value="linear">A straight line, such as 4-20 mA</option>
          </select>
        </label>
        {conversion === "scale" ? (
          <>
            <label>
              Multiply by
              <input value={scale} onChange={(event) => setScale(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Then add
              <input value={offset} onChange={(event) => setOffset(event.target.value)} inputMode="decimal" />
            </label>
            <p className="muted limits__help">A meter that reports watts for a reading in kW: multiply by 0.001.</p>
          </>
        ) : (
          <>
            <label>
              Signal at the bottom
              <input value={rawLow} onChange={(event) => setRawLow(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Signal at the top
              <input value={rawHigh} onChange={(event) => setRawHigh(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Reading at the bottom
              <input value={engLow} onChange={(event) => setEngLow(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Reading at the top
              <input value={engHigh} onChange={(event) => setEngHigh(event.target.value)} inputMode="decimal" placeholder="e.g. 10" />
            </label>
            <p className="muted limits__help">A transmitter that covers 0 to 10 bar on 4 to 20 mA: 4, 20, 0, 10.</p>
          </>
        )}
        <label>
          Which part of the value
          <select value={part} onChange={(event) => setPart(event.target.value as SignPart | "")}>
            <option value="">The value as it is</option>
            <option value="positive">Only when positive</option>
            <option value="negative">Only when negative, as a positive number</option>
            <option value="absolute">The size of the value, either way</option>
          </select>
        </label>
        <div className="limits__actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save the register"}
          </button>
          {source ? (
            <button type="button" className="button-ghost" onClick={clear} disabled={isPending}>
              Clear
            </button>
          ) : null}
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
    </details>
  );
}
