import Link from "next/link";
import { RequestAccessForm } from "../../components/RequestAccessForm";

export const metadata = { title: "Request access" };

// Public, like the sign-in page. Greecon is set up with each site by a project manager, who installs
// the equipment and creates the account, so this asks to be contacted rather than creating anything.
export default function RequestAccessPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Request access">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">New to Greecon</p>
          <h1>Request access</h1>
          <p className="muted">
            Greecon is set up with you: a project manager visits your site, connects the equipment and creates your account. Tell us a little about your site and we will
            contact you.
          </p>
        </div>
        <RequestAccessForm />
        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>. Or write to <a href="mailto:info@greecon.earth">info@greecon.earth</a>. What Greecon keeps about you
          is on the <Link href="/privacy">privacy page</Link>.
        </p>
      </section>
    </main>
  );
}
