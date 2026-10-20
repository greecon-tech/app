#!/usr/bin/env node
// Builds the software that runs on a box at a site into one file, and writes a manifest beside it.
// The platform serves both (GET /edge/bundle and /edge/bundle.json): a box is installed and updated
// from the platform it reports to, so it always runs the version that platform expects.
//
//   node scripts/build-edge-bundle.mjs [outDir]        (default: apps/api/edge-bundle)
//
// The version is the package version and a short hash of the source the file is built from, so it
// changes when, and only when, what the box runs changes.

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] ?? join(root, "apps", "api", "edge-bundle"));

/** Every source file the bundle is built from, in a fixed order: the agent, and the shared contracts it speaks. */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === "testing" ? [] : sourceFiles(path);
      return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [path] : [];
    })
    .sort();
}

const hash = createHash("sha256");
for (const directory of [join(root, "apps", "edge-agent", "src"), join(root, "packages", "shared", "src")]) {
  for (const file of sourceFiles(directory)) hash.update(relative(root, file)).update("\0").update(readFileSync(file)).update("\0");
}
const packageVersion = JSON.parse(readFileSync(join(root, "apps", "edge-agent", "package.json"), "utf8")).version;
const version = `${packageVersion}+${hash.digest("hex").slice(0, 8)}`;

mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, "greecon-edge.mjs");

await build({
  entryPoints: [join(root, "apps", "edge-agent", "src", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  minify: false,
  legalComments: "none",
  define: { __AGENT_VERSION__: JSON.stringify(version) },
  // Only the TCP side of the Modbus library is used. Its serial support and the web-socket speed-ups are
  // optional and are not shipped.
  external: ["serialport", "@serialport/*", "bufferutil", "utf-8-validate"],
  // Libraries written for CommonJS ask for node's own modules with require(); this lets them.
  banner: { js: 'import { createRequire as __greeconCreateRequire } from "node:module"; const require = __greeconCreateRequire(import.meta.url);' },
  logLevel: "warning"
});

const bytes = readFileSync(outfile);
const manifest = { version, sha256: createHash("sha256").update(bytes).digest("hex"), size: statSync(outfile).size, builtAtUtc: new Date().toISOString() };
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${relative(root, outfile)} ${manifest.version} (${(manifest.size / 1024).toFixed(0)} kB, sha256 ${manifest.sha256.slice(0, 12)}...)`);
