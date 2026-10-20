"use client";

import { FormEvent, useState, useTransition } from "react";
import { CurrencyCode, currencyCodes, SiteProfile } from "@greecon/shared";
import { updateSiteProfileAction } from "../app/sites/[siteId]/actions";

const toField = (value: number | undefined) => (value === undefined ? "" : String(value));
const toNumberOrNull = (text: string): number | null => (text.trim() === "" ? null : Number(text));

/** What this site pays and what it used before, in the site's own words. Nothing has a default: the
 * prices come from the latest bill and the baseline from last year's. Blank means "not set", and the
 * platform then shows the quantities and says what is needed for money. */
export function SiteProfileForm({ siteId, profile }: { siteId: string; profile: SiteProfile }) {
  const [currency, setCurrency] = useState<CurrencyCode>(profile.currency);
  const [importPrice, setImportPrice] = useState(toField(profile.importPricePerKwh));
  const [exportPrice, setExportPrice] = useState(toField(profile.exportPricePerKwh));
  const [waterPrice, setWaterPrice] = useState(toField(profile.waterPricePerM3));
  const [baselineEnergy, setBaselineEnergy] = useState(toField(profile.baselineMonthlyImportKwh));
  const [baselineWater, setBaselineWater] = useState(toField(profile.baselineMonthlyWaterM3));
  const [note, setNote] = useState(profile.baselineNote ?? "");
  const [zeroExport, setZeroExport] = useState(profile.zeroExport);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const anySet = [profile.importPricePerKwh, profile.exportPricePerKwh, profile.waterPricePerM3, profile.baselineMonthlyImportKwh, profile.baselineMonthlyWaterM3].some((value) => value !== undefined);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSiteProfileAction(siteId, {
        currency,
        timezone: timezone.trim() || undefined,
        importPricePerKwh: toNumberOrNull(importPrice),
        exportPricePerKwh: toNumberOrNull(exportPrice),
        waterPricePerM3: toNumberOrNull(waterPrice),
        baselineMonthlyImportKwh: toNumberOrNull(baselineEnergy),
        baselineMonthlyWaterM3: toNumberOrNull(baselineWater),
        baselineNote: note.trim() === "" ? null : note.trim(),
        zeroExport
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <details className="limits" open={!anySet}>
      <summary>{anySet ? "Prices and baseline" : "Enter prices and baseline"}</summary>
      <form onSubmit={submit} className="limits__form">
        <label>
          Currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
            {currencyCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Electricity price you pay ({currency} per kWh)
          <input type="number" step="any" min="0" inputMode="decimal" value={importPrice} onChange={(event) => setImportPrice(event.target.value)} placeholder="From the latest bill" />
          <span className="muted limits__help">The price of one kWh bought from the grid. Used to value the electricity your solar kept on site.</span>
        </label>
        <label>
          Price paid for energy you send to the grid ({currency} per kWh)
          <input type="number" step="any" min="0" inputMode="decimal" value={exportPrice} onChange={(event) => setExportPrice(event.target.value)} placeholder="Leave blank if nothing is paid" />
        </label>
        <label>
          Water price ({currency} per m³)
          <input type="number" step="any" min="0" inputMode="decimal" value={waterPrice} onChange={(event) => setWaterPrice(event.target.value)} placeholder="Optional" />
        </label>
        <label>
          A typical month before: electricity bought (kWh)
          <input type="number" step="any" min="0" inputMode="decimal" value={baselineEnergy} onChange={(event) => setBaselineEnergy(event.target.value)} placeholder="From last year's bills" />
          <span className="muted limits__help">Lets the platform compare what you buy now with what you bought before. Without it, no comparison is shown.</span>
        </label>
        <label>
          A typical month before: water (m³)
          <input type="number" step="any" min="0" inputMode="decimal" value={baselineWater} onChange={(event) => setBaselineWater(event.target.value)} placeholder="Optional" />
        </label>
        <label>
          Note on where the baseline comes from
          <input type="text" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: average of the 2025 bills" />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={zeroExport} onChange={(event) => setZeroExport(event.target.checked)} />
          This site cannot send energy to the grid
        </label>
        <label>
          Time zone
          <input type="text" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/Tirane" />
          <span className="muted limits__help">Decides where &quot;today&quot; and &quot;this month&quot; begin.</span>
        </label>
        <div className="rule-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
          {saved ? <span className="muted">Saved. Figures above now use these.</span> : null}
        </div>
        {error ? <p className="rule-actions__error">{error}</p> : null}
      </form>
    </details>
  );
}
