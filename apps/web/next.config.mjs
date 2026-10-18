const staticExport = process.env.NEXT_OUTPUT_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@greecon/shared"],
  agentRules: false,
  // trailingSlash writes every page as <route>/index.html. Without it /sites (the index) would be
  // sites.html next to the sites/ folder that holds each site's page, and a plain file host cannot
  // be relied on to pick the file over the folder.
  ...(staticExport ? { output: "export", trailingSlash: true, basePath, images: { unoptimized: true } } : {})
};

export default nextConfig;
