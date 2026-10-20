import { createHash } from "crypto";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BUNDLE_FILE, EdgeBundleService } from "./edge-bundle";

describe("the box's software, as the API holds it", () => {
  let dir: string;
  const saved = process.env.EDGE_BUNDLE_DIR;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "greecon-bundle-"));
    process.env.EDGE_BUNDLE_DIR = dir;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.EDGE_BUNDLE_DIR;
    else process.env.EDGE_BUNDLE_DIR = saved;
  });

  const publish = (content: string, overrides: Record<string, unknown> = {}) => {
    const bytes = Buffer.from(content);
    writeFileSync(join(dir, BUNDLE_FILE), bytes);
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ version: "0.2.0+abc12345", sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, builtAtUtc: "2026-10-19T09:00:00Z", ...overrides })
    );
  };

  it("is absent when nothing has been built", () => {
    const service = new EdgeBundleService();
    expect(service.manifest()).toBeUndefined();
    expect(service.bundle()).toBeUndefined();
  });

  it("is served with its version and checksum once built", () => {
    publish("console.log('edge');");
    const service = new EdgeBundleService();
    expect(service.manifest()).toMatchObject({ version: "0.2.0+abc12345", size: 20 });
    expect(service.bundle()?.bytes.toString()).toBe("console.log('edge');");
  });

  it("is not served when the file is not the one the manifest describes", () => {
    publish("console.log('edge');", { sha256: "0".repeat(64) });
    expect(new EdgeBundleService().manifest()).toBeUndefined();
    publish("console.log('edge');", { size: 3 });
    expect(new EdgeBundleService().manifest()).toBeUndefined();
  });

  it("is not served when the manifest is not a manifest", () => {
    publish("x");
    writeFileSync(join(dir, "manifest.json"), "not json");
    expect(new EdgeBundleService().manifest()).toBeUndefined();
    publish("x", { version: "" });
    expect(new EdgeBundleService().manifest()).toBeUndefined();
  });

  it("notices a newer build without a restart", async () => {
    publish("one");
    const service = new EdgeBundleService();
    expect(service.manifest()?.version).toBe("0.2.0+abc12345");
    await new Promise((resolve) => setTimeout(resolve, 20));
    publish("two", { version: "0.2.1+def67890" });
    expect(service.manifest()?.version).toBe("0.2.1+def67890");
    expect(service.bundle()?.bytes.toString()).toBe("two");
  });
});
