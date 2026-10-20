"use client";

import { FormEvent, useState, useTransition } from "react";
import { deviceProfiles, validateConnection } from "@greecon/shared";
import { createDeviceFromProfileAction } from "../../app/sites/[siteId]/setup/actions";

/** Equipment Greecon already knows the registers of: pick it, say where it is on the network, and its readings
 * are in place. Anything else is added on the site page and mapped from its datasheet. */
export function AddKnownEquipmentForm({ siteId, assets }: { siteId: string; assets: Array<{ id: string; name: string }> }) {
  const [profileKey, setProfileKey] = useState(deviceProfiles[0]?.key ?? "");
  const profile = deviceProfiles.find((candidate) => candidate.key === profileKey);
  const [name, setName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(String(deviceProfiles[0]?.defaultPort ?? 502));
  const [unit, setUnit] = useState(String(deviceProfiles[0]?.defaultUnitId ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function choose(key: string) {
    setProfileKey(key);
    const next = deviceProfiles.find((candidate) => candidate.key === key);
    if (next) {
      setPort(String(next.defaultPort));
      setUnit(String(next.defaultUnitId));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAdded(false);
    if (host.trim() !== "") {
      const problems = validateConnection({ kind: "modbus_tcp", host: host.trim(), port: Number(port), unitId: Number(unit) });
      if (problems.length > 0) return setError(problems.join(" "));
    }
    startTransition(async () => {
      const result = await createDeviceFromProfileAction(siteId, { profileKey, name, assetId, host, port: Number(port), unitId: Number(unit) });
      if (result.error) return setError(result.error);
      setAdded(true);
      setName("");
      setHost("");
    });
  }

  return (
    <form onSubmit={submit} className="rule-form" aria-label="Add equipment Greecon knows">
      <div className="rule-form__grid">
        <label>
          Equipment
          <select value={profileKey} onChange={(event) => choose(event.target.value)}>
            {deviceProfiles.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name on screen (optional)
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={profile?.name} />
        </label>
        <label>
          Belongs to (optional)
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">Nothing in particular</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          IP address (can be added later)
          <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.1.50" inputMode="decimal" />
        </label>
        <label>
          Port
          <input value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          Unit number
          <input value={unit} onChange={(event) => setUnit(event.target.value)} inputMode="numeric" />
        </label>
      </div>
      {profile ? (
        <div className="setup-guidance">
          <p>{profile.description}</p>
          <ul>
            {profile.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add this equipment"}
        </button>
        {added ? (
          <p className="form-success" role="status">
            Added, with its readings.
          </p>
        ) : null}
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
