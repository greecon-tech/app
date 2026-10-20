"use client";

import { FormEvent, useState, useTransition } from "react";
import { NotificationSettings, checkNotificationSettings } from "@greecon/shared";
import { saveSettingsAction } from "../../app/settings/people/actions";

/** Quiet hours, the clock they are on, and the morning message. */
export function SettingsForm({ initial }: { initial: NotificationSettings }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<NotificationSettings>) => {
    setSaved(false);
    setSettings((current) => ({ ...current, ...patch }));
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const { problems } = checkNotificationSettings(settings);
    if (problems.length > 0) return setError(problems.join(" "));
    startTransition(async () => {
      const result = await saveSettingsAction(settings);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="rule-form" aria-label="Quiet hours and the morning message">
      <div className="rule-form__grid">
        <label>
          Quiet hours start
          <input type="time" value={settings.quietFrom} onChange={(event) => set({ quietFrom: event.target.value })} required />
        </label>
        <label>
          Quiet hours end
          <input type="time" value={settings.quietTo} onChange={(event) => set({ quietTo: event.target.value })} required />
        </label>
        <label>
          The clock these are on
          <input value={settings.timezone} onChange={(event) => set({ timezone: event.target.value })} placeholder="Europe/Tirane" />
        </label>
      </div>
      <p className="muted">In quiet hours only Act now is sent. Check today waits until they end. If the two times are the same there are no quiet hours.</p>
      <div className="rule-form__grid">
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.digestEnabled} onChange={(event) => set({ digestEnabled: event.target.checked })} />
          Send the morning message
        </label>
        <label>
          Morning message time
          <input type="time" value={settings.digestAt} onChange={(event) => set({ digestAt: event.target.value })} disabled={!settings.digestEnabled} required />
        </label>
      </div>
      <p className="muted">One email a day to each person with an email address: whether every site is reporting and what, if anything, needs a look.</p>
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved ? (
          <span className="form-success" role="status">
            Saved.
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
