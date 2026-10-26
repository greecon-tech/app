const staticExport = process.env.NEXT_OUTPUT_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@greecon/shared"],
  agentRules: false,
  // trailingSlash writes every page as <route>/index.html. Without it /sites (the index) would be
  // sites.html next to the sites/ folder that holds each site's page, and a plain file host cannot
  // be relied on to pick the file over the folder.
  ...(staticExport
    ? { output: "export", trailingSlash: true, basePath, images: { unoptimized: true } }
    : {
        // Pages that no longer exist (docs/28-ux-definition.md, section 3.3). Someone's bookmark, or a link in an old
        // email, lands where the same thing is now. A static export cannot redirect, and has no links to them.
        async redirects() {
          return [
            { source: "/monitoring", destination: "/", permanent: false },
            { source: "/automation", destination: "/", permanent: false },
            { source: "/devices", destination: "/sites", permanent: false }
          ];
        },
        // Nothing here is meant to sit inside someone else's page (a framed "Acknowledge" button is a trap), to be guessed at by content type,
        // or to tell another site which page a person came from. (A static export is a file host's to configure, and cannot set headers.)
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
                ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : [])
              ]
            }
          ];
        }
      })
};

export default nextConfig;
