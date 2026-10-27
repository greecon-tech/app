import Link from "next/link";

/** On every page of the demo (the published GitHub Pages one, and the demo login on the live platform): the numbers are simulated, and
 * a person who likes what they see can ask Greecon to call. It is the demo's only call to action, and it is not in the way. */
export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="About this demo">
      <p>
        <strong>Demo.</strong> Every number here is simulated, to show how Greecon looks. Want Greecon on your own site? <Link href="/request-access">Request access</Link>
      </p>
    </aside>
  );
}
