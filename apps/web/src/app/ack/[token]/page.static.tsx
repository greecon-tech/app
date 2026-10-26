import Link from "next/link";

// Static-export twin of page.tsx (see apps/web/scripts/build-static.sh). The page reads a live alert through a signed link and answers it
// through a Server Action, and the demo has no server; a dynamic route also needs generateStaticParams in a static export only.
export function generateStaticParams() {
  return [{ token: "example" }];
}

export default function AcknowledgePage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Alert">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <p className="eyebrow">Alert link</p>
          <h1>Alert links need the live platform</h1>
        </div>
        <p>In the live platform, an alert message holds a link that opens a page like this one, with a single button: &ldquo;Yes, I have seen it&rdquo;. The demo sends no messages.</p>
        <p>
          <Link className="standalone-link" href="/">Back to the demo</Link>
        </p>
      </section>
    </main>
  );
}
