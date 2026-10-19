"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { siteTypes } from "@greecon/shared";
import { deleteSiteAction, updateSiteAction } from "../app/admin/actions";
import { DeleteButton } from "./DeleteButton";

interface Site {
  id: string;
  name: string;
  type: string;
  locationName: string;
  status: string;
}

// A plain <tr> rather than a DataTable column — editing needs three fields (name/type/location)
// to change together behind one Save button, which doesn't fit DataTable's one-column-at-a-time
// render model. Mirrors DataTable's own markup so the table still looks identical either way.
export function EditableSiteRow({ site, canManage }: { site: Site; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(site.name);
  const [type, setType] = useState(site.type);
  const [locationName, setLocationName] = useState(site.locationName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSiteAction(site.id, name, type, locationName);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function cancel() {
    setName(site.name);
    setType(site.type);
    setLocationName(site.locationName);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr>
        <td>{site.name}</td>
        <td>{site.type}</td>
        <td>{site.locationName}</td>
        <td>{site.status}</td>
        {canManage ? (
          <td>
            <div className="rule-actions">
              <Link className="button-ghost" href={`/sites/${site.id}/setup`}>
                Set up
              </Link>
              <button type="button" className="button-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <DeleteButton action={deleteSiteAction.bind(null, site.id)} confirmMessage={`Delete site "${site.name}"? This is blocked while it still has any registered device.`} />
            </div>
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </td>
      <td>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {siteTypes
            .filter((candidate) => candidate !== "demo_site")
            .map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate.replace(/_/g, " ")}
              </option>
            ))}
        </select>
      </td>
      <td>
        <input value={locationName} onChange={(event) => setLocationName(event.target.value)} />
      </td>
      <td>{site.status}</td>
      <td>
        <div className="rule-actions">
          <button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="button-ghost" disabled={isPending} onClick={cancel}>
            Cancel
          </button>
        </div>
        {error ? <p className="rule-actions__error">{error}</p> : null}
      </td>
    </tr>
  );
}
