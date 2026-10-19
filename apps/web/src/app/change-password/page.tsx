import { redirect } from "next/navigation";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

// Where someone lands when they sign in with the temporary password they were handed. Everything else
// is closed to that session until they choose their own.
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Choose a new password">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">Welcome, {session.user.name}</p>
          <h1>Choose your own password</h1>
          <p className="muted">
            The password you were given is only for the first sign-in. Choose one that only you know. You will then sign in again with it.
          </p>
        </div>
        <ChangePasswordForm forced />
      </section>
    </main>
  );
}
