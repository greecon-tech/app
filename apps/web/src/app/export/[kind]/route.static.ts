// Static-export twin of route.ts (see apps/web/scripts/build-static.sh). A downloaded file is made by the
// live platform for the person who asks; the GitHub Pages demo has no server to make one, so it has no
// download routes at all.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ kind: string }> {
  return [];
}
