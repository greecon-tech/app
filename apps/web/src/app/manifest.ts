import type { MetadataRoute } from "next";

// Lets a phone put Greecon on its home screen as an app (docs/28-ux-definition.md, principle 9: the phone is the first screen). Nothing is
// cached for offline use: a reading that is hours old is worse than a page that says it cannot be reached.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_BASE_PATH ?? "";
  return {
    name: "Greecon",
    short_name: "Greecon",
    description: "Is everything all right at your site, and what needs you?",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f7f1e9",
    theme_color: "#f7f1e9",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
