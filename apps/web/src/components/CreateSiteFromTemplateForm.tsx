"use client";

import { FormEvent, useState, useTransition } from "react";
import { currencyCodes, siteTemplates } from "@greecon/shared";
import { createSiteFromTemplateAction } from "../app/admin/actions";

// A new site starts from the kind of place it is: the template brings the assets, the equipment (with its
// readings already tied to registers where Greecon knows the meter) and the list of what to bring and ask.
// The action goes straight to the site's setup list, so it only comes back here when something is wrong.
export function CreateSiteFromTemplateForm() {
  const [templateKey, setTemplateKey] = useState(siteTemplates[0]?.key ?? "");
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [currency, setCurrency] = useState("ALL");
  const [timezone, setTimezone] = useState("Europe/Tirane");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const template = siteTemplates.find((candidate) => candidate.key === templateKey);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSiteFromTemplateAction({ templateKey, name, locationName, currency, timezone });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="rule-form" aria-label="New site from a template">
      <div className="rule-form__grid">
        <label>
          What kind of site
          <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
            {siteTemplates.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Site name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Hotel Adriatik" required />
        </label>
        <label>
          Where it is
          <input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="e.g. Durrës, Albania" required />
        </label>
        <label>
          Currency of the bills
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          The site&apos;s own clock
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/Tirane" />
        </label>
      </div>
      {template ? (
        <div className="template-choice">
          <p>{template.summary}</p>
          {template.devices.length > 0 ? (
            <ul>
              {template.devices.map((device) => (
                <li key={device.ref}>{device.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create the site and start setting it up"}
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
