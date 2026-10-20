"use client";

import { FormEvent, useState, useTransition } from "react";
import { requestedSiteTypeLabels, requestedSiteTypes } from "@greecon/shared";
import { requestAccessAction } from "../app/request-access/actions";

/** Asking Greecon to set you up. There is no self-service account: Greecon installs the hardware
 * with you, so a request goes to a person who calls back. */
export function RequestAccessForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [siteType, setSiteType] = useState<string>("hotel");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestAccessAction({ name, company, email, phone, siteType, message, website });
      if (result.error) setError(result.error);
      else setReceived(true);
    });
  }

  if (received) {
    return (
      <div className="credential-notice" role="status">
        <strong>Thank you. We have your request.</strong>
        <p>Someone from Greecon will contact you, usually within one working day, to talk about your site and arrange a visit.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>
        Your name
        <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} />
      </label>
      <label>
        Company or property
        <input value={company} onChange={(event) => setCompany(event.target.value)} autoComplete="organization" required maxLength={160} />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
      </label>
      <label>
        Phone (optional)
        <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={40} />
      </label>
      <label>
        What do you run?
        <select value={siteType} onChange={(event) => setSiteType(event.target.value)}>
          {requestedSiteTypes.map((type) => (
            <option key={type} value={type}>
              {requestedSiteTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Anything we should know (optional)
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={1500} placeholder="For example: a hotel with a wastewater plant and a solar roof" />
      </label>
      {/* A field a person never sees. A script that fills in every field fills this one too. */}
      <div className="hp-field" aria-hidden="true">
        <label>
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send request"}
      </button>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
