"use client";

import { FormEvent, useState, useTransition } from "react";
import { ModbusConnection, validateConnection } from "@greecon/shared";
import { updateDeviceConnectionAction } from "../../app/sites/[siteId]/setup/actions";

/** Where the box reaches one device on the site's network: the converter's (or the device's own) IP address,
 * the port, and the device's number on the bus. Meters behind one converter share its address and differ only
 * by number. */
export function DeviceAddressForm({ siteId, device }: { siteId: string; device: { id: string; name: string; connection?: ModbusConnection } }) {
  const [host, setHost] = useState(device.connection?.host ?? "");
  const [port, setPort] = useState(String(device.connection?.port ?? 502));
  const [unit, setUnit] = useState(String(device.connection?.unitId ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const connection: ModbusConnection = { kind: "modbus_tcp", host: host.trim(), port: Number(port), unitId: Number(unit) };
    const problems = validateConnection(connection);
    if (problems.length > 0) return setError(problems.join(" "));
    startTransition(async () => {
      const result = await updateDeviceConnectionAction(siteId, device.id, connection);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  function clear() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDeviceConnectionAction(siteId, device.id, null);
      if (result.error) return setError(result.error);
      setHost("");
    });
  }

  return (
    <form onSubmit={save} className="setup-inline-form" aria-label={`Address of ${device.name}`}>
      <label>
        IP address
        <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.1.50" inputMode="decimal" required />
      </label>
      <label>
        Port
        <input value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" size={5} />
      </label>
      <label>
        Unit number
        <input value={unit} onChange={(event) => setUnit(event.target.value)} inputMode="numeric" size={4} />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : device.connection ? "Change" : "Save"}
      </button>
      {device.connection ? (
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
    </form>
  );
}
