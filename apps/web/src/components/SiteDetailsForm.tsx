"use client";

import { FormEvent, useState, useTransition } from "react";
import { siteTypes } from "@greecon/shared";
import { deleteSiteAction, updateSiteAction } from "../app/sites/actions";
import { siteKindWords } from "../lib/equipment";
import { DeleteButton } from "./DeleteButton";

/** The site itself: what it is called, where it is and what kind of place it is; and, last and apart, deleting it. */
export function SiteDetailsForm({ site }: { site: { id: string; name: string; type: string; locationName: string } }) {
  const [name, setName] = useState(site.name);
  const [type, setType] = useState(site.type);
  const [locationName, setLocationName] = useState(site.locationName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSiteAction(site.id, name, type, locationName);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="stack">
      <form onSubmit={submit} className="rule-form" aria-label="This site">
        <div className="rule-form__grid">
          <label>
            Site name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Where it is
            <input value={locationName} onChange={(event) => setLocationName(event.target.value)} required />
          </label>
          <label>
            Kind of place
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {siteTypes
                .filter((candidate) => candidate !== "demo_site")
                .map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {siteKindWords(candidate) || "Several systems together"}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="rule-form__footer">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
          {saved ? (
            <p className="form-success" role="status">
              Saved.
            </p>
          ) : null}
          {error ? (
            <p className="rule-actions__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
      <div className="danger-zone">
        <p className="muted">Deleting a site removes its readings and history for good. A site that still has equipment cannot be deleted: remove the equipment first.</p>
        <DeleteButton action={deleteSiteAction.bind(null, site.id)} label="Delete this site" confirmMessage={`Delete the site "${site.name}"? Its readings and history go with it. This cannot be undone.`} />
      </div>
    </div>
  );
}
