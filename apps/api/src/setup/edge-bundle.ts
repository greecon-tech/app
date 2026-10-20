import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

// The software that runs on the box at a site, built into one file when the API is built and served
// by the API itself, so a box installed or updated gets exactly the version this platform expects and
// nobody fetches software from anywhere else. The manifest next to it says which version it is and
// its checksum.

export interface EdgeBundleManifest {
  version: string;
  sha256: string;
  size: number;
  builtAtUtc: string;
}

export const BUNDLE_FILE = "greecon-edge.mjs";
const MANIFEST_FILE = "manifest.json";

@Injectable()
export class EdgeBundleService {
  private cached?: { mtimeMs: number; manifest: EdgeBundleManifest };

  /** Where the built bundle is: EDGE_BUNDLE_DIR, else apps/api/edge-bundle next to the compiled API. */
  directory(): string {
    return process.env.EDGE_BUNDLE_DIR ? resolve(process.env.EDGE_BUNDLE_DIR) : resolve(__dirname, "..", "..", "edge-bundle");
  }

  /** The bundle's manifest, or undefined when none has been built or what is there does not check out
   * (a missing file, a checksum that does not match): a box is then told there is nothing to install
   * rather than being handed something unverified. */
  manifest(): EdgeBundleManifest | undefined {
    const manifestPath = join(this.directory(), MANIFEST_FILE);
    const bundlePath = join(this.directory(), BUNDLE_FILE);
    if (!existsSync(manifestPath) || !existsSync(bundlePath)) return undefined;

    const mtimeMs = Math.max(statSync(manifestPath).mtimeMs, statSync(bundlePath).mtimeMs);
    if (this.cached && this.cached.mtimeMs === mtimeMs) return this.cached.manifest;

    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<EdgeBundleManifest>;
      const bytes = readFileSync(bundlePath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (typeof parsed.version !== "string" || parsed.version.length === 0 || parsed.sha256 !== sha256 || parsed.size !== bytes.length) return undefined;
      const manifest: EdgeBundleManifest = { version: parsed.version, sha256, size: bytes.length, builtAtUtc: typeof parsed.builtAtUtc === "string" ? parsed.builtAtUtc : "" };
      this.cached = { mtimeMs, manifest };
      return manifest;
    } catch {
      return undefined;
    }
  }

  /** The bundle's bytes, only if they are the ones the manifest describes. */
  bundle(): { manifest: EdgeBundleManifest; bytes: Buffer } | undefined {
    const manifest = this.manifest();
    if (!manifest) return undefined;
    return { manifest, bytes: readFileSync(join(this.directory(), BUNDLE_FILE)) };
  }
}
