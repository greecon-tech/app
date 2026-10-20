// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh): the demo has no accounts.
export default function ChangePasswordPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Choose a new password">
        <div>
          <h1>Choose your own password</h1>
          <p className="muted">The static demo has no accounts, so there is no password to choose.</p>
        </div>
      </section>
    </main>
  );
}
