"use client";

import { FormEvent, useState, useTransition } from "react";
import { signOutAfterPasswordChangeAction } from "../app/login/actions";
import { changePasswordAction } from "../app/settings/actions";

/** `forced`: the person signed in with a temporary password and must choose their own. Afterwards the
 * session is closed and they sign in again. */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    startTransition(async () => {
      const result = await changePasswordAction(currentPassword, newPassword);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (forced) {
        await signOutAfterPasswordChangeAction();
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <form onSubmit={submit} className="rule-form">
      <div className="rule-form__grid">
        <label>
          {forced ? "Temporary password you were given" : "Current password"}
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label>
          New password (at least 10 characters)
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} required />
        </label>
      </div>
      <div className="rule-form__footer">
        <button type="submit" disabled={isPending}>
          {isPending ? "Changing…" : "Change password"}
        </button>
        {error ? (
          <p className="rule-actions__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {success ? (
        <p className="form-success" role="status">
          Password changed.
        </p>
      ) : null}
    </form>
  );
}
