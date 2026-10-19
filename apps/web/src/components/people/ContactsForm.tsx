"use client";

import { FormEvent, useState, useTransition } from "react";
import { MAX_NOTIFICATION_CONTACTS, NotificationContact, NotificationLogEntry, checkContacts } from "@greecon/shared";
import { ContactDraft, saveContactsAction, sendTestAction } from "../../app/settings/people/actions";
import { StatusBadge } from "../StatusBadge";

interface Row extends ContactDraft {
  key: string;
}

let counter = 0;
const nextKey = () => `row-${(counter += 1)}`;
const toRows = (contacts: readonly NotificationContact[]): Row[] => contacts.map((contact) => ({ key: nextKey(), id: contact.id, name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "" }));
const snapshot = (rows: readonly Row[]) => JSON.stringify(rows.map(({ id, name, email, phone }) => ({ id, name, email, phone })));

const RESULT_WORDS: Record<string, string> = { sent: "Sent", failed: "Not sent", planned: "Waiting", skipped: "Not needed" };

/** The short, ordered list of people to tell. The first is told first; if an Act now alert is not acknowledged,
 * the next is told thirty minutes later, and so on. They need no login: the pump technician belongs here. */
export function ContactsForm({ initial }: { initial: NotificationContact[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [saved, setSaved] = useState(() => snapshot(toRows(initial)));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, NotificationLogEntry[] | string>>({});
  const [isPending, startTransition] = useTransition();
  const dirty = snapshot(rows) !== saved;

  const change = (key: string, patch: Partial<Row>) => {
    setNotice(null);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const move = (index: number, by: -1 | 1) => {
    setNotice(null);
    setRows((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target] as Row, next[index] as Row];
      return next;
    });
  };

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const { problems } = checkContacts(rows.map(({ id, name, email, phone }) => ({ id, name, email, phone })));
    if (problems.length > 0) return setError(problems.join(" "));
    startTransition(async () => {
      const result = await saveContactsAction(rows);
      if (result.error || !result.contacts) return setError(result.error ?? "Could not save the list.");
      const next = toRows(result.contacts);
      setRows(next);
      setSaved(snapshot(next));
      setResults({});
      setNotice(result.contacts.length === 0 ? "Saved. Nobody is on the list." : "Saved. Now send each person a test message.");
    });
  }

  function test(row: Row) {
    if (!row.id) return;
    const key = row.key;
    setResults((current) => ({ ...current, [key]: "Sending…" }));
    startTransition(async () => {
      const result = await sendTestAction(row.id as string);
      setResults((current) => ({ ...current, [key]: result.entries ?? result.error ?? "Could not send the test message." }));
    });
  }

  return (
    <form onSubmit={save} className="rule-form" aria-label="People to tell">
      {rows.length === 0 ? <p className="muted">Nobody is on the list. Add the people who should hear first.</p> : null}
      <ol className="people-list">
        {rows.map((row, index) => {
          const result = results[row.key];
          return (
            <li key={row.key} className="setup-device">
              <div className="setup-device__head">
                <strong>{index === 0 ? "Told first" : `Told ${index + 1}${index === 1 ? "nd" : index === 2 ? "rd" : "th"}, if nobody has answered`}</strong>
                <span className="rule-actions">
                  <button type="button" className="button-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${row.name || "this person"} up`}>
                    Up
                  </button>
                  <button type="button" className="button-ghost" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={`Move ${row.name || "this person"} down`}>
                    Down
                  </button>
                  <button type="button" className="button-ghost" onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))} aria-label={`Remove ${row.name || "this person"}`}>
                    Remove
                  </button>
                </span>
              </div>
              <div className="rule-form__grid">
                <label>
                  Name
                  <input value={row.name} onChange={(event) => change(row.key, { name: event.target.value })} placeholder="e.g. Besa Krasniqi" maxLength={80} />
                </label>
                <label>
                  Email
                  <input type="email" value={row.email} onChange={(event) => change(row.key, { email: event.target.value })} placeholder="besa@hotel.example" autoComplete="off" />
                </label>
                <label>
                  Mobile phone, with country code
                  <input type="tel" value={row.phone} onChange={(event) => change(row.key, { phone: event.target.value })} placeholder="+355 69 123 4567" autoComplete="off" />
                </label>
              </div>
              <div className="rule-actions">
                <button type="button" className="button-ghost" onClick={() => test(row)} disabled={isPending || !row.id || dirty} title={!row.id || dirty ? "Save the list first" : undefined}>
                  Send a test message
                </button>
              </div>
              {typeof result === "string" ? <p className="muted">{result}</p> : null}
              {Array.isArray(result) ? (
                <ul className="setup-items">
                  {result.map((entry) => (
                    <li key={entry.id} className="setup-item">
                      <StatusBadge status={RESULT_WORDS[entry.status] ?? entry.status} />
                      <span>
                        <strong>{entry.channel === "email" ? "Email" : "Text message"}</strong>
                        <span className="setup-item__detail">
                          {entry.status === "sent" ? `Accepted for delivery to ${entry.destination}. Ask ${row.name || "them"} whether it arrived.` : entry.error ?? ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="rule-form__footer">
        <button type="button" className="button-ghost" disabled={rows.length >= MAX_NOTIFICATION_CONTACTS} onClick={() => setRows((current) => [...current, { key: nextKey(), name: "", email: "", phone: "" }])}>
          Add a person
        </button>
        <button type="submit" disabled={isPending || !dirty}>
          {isPending ? "Saving…" : "Save the list"}
        </button>
        {dirty ? <span className="muted">Not saved yet.</span> : null}
        {notice ? (
          <span className="form-success" role="status">
            {notice}
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
