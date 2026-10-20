"use client";

import { FormEvent, useState, useTransition } from "react";
import { deviceProtocols } from "@greecon/shared";
import { createDeviceAction } from "../app/sites/[siteId]/actions";

interface AssetOption {
  id: string;
  name: string;
}

// A client component so a real failure shows up as a message instead of silently doing nothing —
// same reasoning as CreateSiteForm.
export function CreateDeviceForm({ siteId, assets = [] }: { siteId: string; assets?: readonly AssetOption[] }) {
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [protocol, setProtocol] = useState("modbus");
  const [driverType, setDriverType] = useState("modbus-tcp");
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreated(false);
    startTransition(async () => {
      const result = await createDeviceAction(siteId, name, deviceType, protocol, driverType, assetId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCreated(true);
      setName("");
      setDeviceType("");
      setDriverType("modbus-tcp");
    });
  }

  return (
    <form onSubmit={submit} className="rule-form">
      <div className="rule-form__grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Soil Moisture Sensor Zone 1" required />
        </label>
        <label>
          Device type
          <input value={deviceType} onChange={(event) => setDeviceType(event.target.value)} placeholder="e.g. soil_moisture_sensor" required />
        </label>
        <label>
          Protocol
          <select value={protocol} onChange={(event) => setProtocol(event.target.value)}>
            {deviceProtocols.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Driver
          <input value={driverType} onChange={(event) => setDriverType(event.target.value)} placeholder="modbus-tcp" required />
        </label>
        {assets.length > 0 ? (
          <label>
            Asset
            <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
              <option value="">None</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add device"}
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {created ? (
        <p className="form-success" role="status">
          Device added.
        </p>
      ) : null}
    </form>
  );
}
