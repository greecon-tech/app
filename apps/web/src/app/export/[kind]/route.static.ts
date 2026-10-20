// Static-export twin of route.ts (see apps/web/scripts/build-static.sh). A downloaded file is made by the
// live platform for the person who asks; the GitHub Pages demo has no server to make one. A static export
// must build at least one page for a route like this, so each kind gets a short note saying so.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ kind: string }> {
  return ["readings", "alerts", "audit", "account"].map((kind) => ({ kind }));
}

export function GET(): Response {
  return new Response("Downloads are made by the live Greecon platform for the person who signs in. The demo makes no files.\n", {
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
