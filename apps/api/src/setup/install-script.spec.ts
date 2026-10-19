import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { renderInstallScript } from "./install-script";

describe("the installer a project manager pastes onto a box", () => {
  const script = renderInstallScript("https://api.greecon.example");

  it("names the platform it came from, everywhere, and leaves no placeholder behind", () => {
    expect(script).not.toContain("__GREECON_API_URL__");
    expect(script).toContain('API_URL="${GREECON_API_URL:-https://api.greecon.example}"');
    expect(script).toContain("curl -fsSL https://api.greecon.example/edge/install.sh");
  });

  it("is valid shell", () => {
    const directory = mkdtempSync(join(tmpdir(), "greecon-install-"));
    try {
      const path = join(directory, "install.sh");
      writeFileSync(path, script);
      const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does nothing at all if the download is cut short, because everything runs from the last line", () => {
    const directory = mkdtempSync(join(tmpdir(), "greecon-install-"));
    try {
      const lines = script.split("\n");
      // Everything but the last line (the one that starts it).
      const truncated = lines.slice(0, lines.lastIndexOf("main \"$@\"")).join("\n");
      const path = join(directory, "truncated.sh");
      writeFileSync(path, truncated);
      const result = spawnSync("bash", [path], { encoding: "utf8", env: { ...process.env, GREECON_ROOT: join(directory, "root") } });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(spawnSync("test", ["-e", join(directory, "root")]).status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses to run as anything but root on a real box, and says how to fix it", () => {
    if (process.getuid?.() === 0) return; // Running as root here; the check cannot be seen from this account.
    const directory = mkdtempSync(join(tmpdir(), "greecon-install-"));
    try {
      const path = join(directory, "install.sh");
      writeFileSync(path, script);
      const result = spawnSync("bash", [path, "GRC-ABCD-EFGH-JKLM"], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("This must run as root");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not run an unknown option, it explains", () => {
    const directory = mkdtempSync(join(tmpdir(), "greecon-install-"));
    try {
      const path = join(directory, "install.sh");
      writeFileSync(path, script);
      const result = spawnSync("bash", [path, "--frobnicate"], { encoding: "utf8", env: { ...process.env, GREECON_SKIP_SYSTEM: "1", GREECON_ROOT: join(directory, "root") } });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("I do not know what '--frobnicate' means");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
