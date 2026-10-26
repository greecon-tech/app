"use client";

import { FormEvent, useState, useTransition } from "react";
import { loginAction } from "../app/login/actions";

type IntendedArea = "client" | "staff";

export function LoginForm() {
  const [intendedArea, setIntendedArea] = useState<IntendedArea>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(email, password, intendedArea);
      // A successful login redirects server-side and never returns here — only a failure does.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit}>
      {/* Both buttons hit the same real login — this only decides where a successful login lands.
          "Greecon team" is rejected server-side for any account without isPlatformAdmin, so it
          can't be used to guess at staff access; it exists purely so someone who already has that
          access lands straight on Today instead of clicking through the client dashboard first
          every time. */}
      <div className="login-area-toggle" role="radiogroup" aria-label="Signing in as">
        <button
          type="button"
          role="radio"
          aria-checked={intendedArea === "client"}
          className={intendedArea === "client" ? undefined : "button-ghost"}
          onClick={() => setIntendedArea("client")}
        >
          Client login
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={intendedArea === "staff"}
          className={intendedArea === "staff" ? undefined : "button-ghost"}
          onClick={() => setIntendedArea("staff")}
        >
          Greecon team
        </button>
      </div>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="username" required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Continue"}
      </button>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
