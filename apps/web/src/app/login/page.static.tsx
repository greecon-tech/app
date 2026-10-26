// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The static GitHub Pages
// export has no server, so there is nothing to log in against — each of the five role builds is
// simply "logged in" as that build's role already (GREECON_DEMO_ROLE). This page exists there
// purely as a preview of what the real login screen looks like, not a functioning form.
export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Secure access">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">Secure platform access</p>
          <h1>Greecon Platform</h1>
          <p className="muted">Operational access for authorized users of Greecon sites and infrastructure.</p>
        </div>
        <form>
          <label>
            Email
            <input type="email" placeholder="name@company.com" disabled />
          </label>
          <label>
            Password
            <input type="password" placeholder="Password" disabled />
          </label>
          <button type="button" disabled>
            Continue
          </button>
          <p className="muted">This static preview build has no server to log in against — see docs/12-deployment-github-pages.md.</p>
        </form>
        <p className="muted">
          New to Greecon? <a href={`${process.env.NEXT_BASE_PATH ?? ""}/request-access/`}>Request access</a>
        </p>
      </section>
    </main>
  );
}
