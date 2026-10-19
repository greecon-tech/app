// Static-export twin of route.ts (see apps/web/scripts/build-static.sh). A downloaded file is made by the
// live platform for the person who asks; the GitHub Pages demo has no server to make one, so it has no
// download routes at all: generateStaticParams names none, and the handler is here only because a route
// file must have one.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ kind: string }> {
  return [];
}

export function GET(): Response {
  return new Response("Downloads are made by the live platform, not by the demo.", { status: 404 });
}
