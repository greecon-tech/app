// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The static demo has no server
// to send a request to, so it says how to reach Greecon instead of showing a form that cannot work.
export const metadata = { title: "Request access" };

export default function RequestAccessPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Request access">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">New to Greecon</p>
          <h1>Request access</h1>
          <p className="muted">
            Greecon is set up with you: a project manager visits your site, connects the equipment and creates your account. Write to{" "}
            <a href="mailto:info@greecon.earth">info@greecon.earth</a> and we will contact you.
          </p>
        </div>
      </section>
    </main>
  );
}
