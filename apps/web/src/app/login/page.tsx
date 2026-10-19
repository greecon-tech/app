import Link from "next/link";
import { LoginForm } from "../../components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const changed = (await searchParams).changed === "1";
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Secure access">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">Secure platform access</p>
          <h1>Greecon Platform</h1>
          <p className="muted">Operational access for authorized users of Greecon sites and infrastructure.</p>
        </div>
        {changed ? (
          <p className="form-success" role="status">
            Your new password is saved. Sign in with it.
          </p>
        ) : null}
        <LoginForm />
        <p className="muted">
          New to Greecon? <Link href="/request-access">Request access</Link>
        </p>
      </section>
    </main>
  );
}
