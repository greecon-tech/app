import { readFileSync } from "fs";
import { join } from "path";

const PLACEHOLDER = "__GREECON_API_URL__";
let template: string | undefined;

/** The installer a project manager pastes onto a box, with this platform's address in it. The address
 * has been checked by the caller (publicApiUrl): it is put into a script a person runs as root. */
export function renderInstallScript(apiUrl: string): string {
  // Next to the compiled code (the build copies it there), and next to the source when tests run.
  template ??= readFileSync(join(__dirname, "edge-install.sh"), "utf8");
  return template.split(PLACEHOLDER).join(apiUrl);
}
