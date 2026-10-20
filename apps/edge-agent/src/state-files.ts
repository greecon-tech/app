import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Reads a JSON file, or undefined if it is missing or is not JSON (a write cut short by a power loss). */
export function readJsonFile<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** Writes beside the file and renames over it, so a power cut leaves the old file or the new one and
 * never half of either. Failing to write is not worth stopping for: the next write tries again. */
export function writeJsonFile(path: string, value: unknown, mode?: number): boolean {
  try {
    const directory = dirname(path);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, mode === undefined ? undefined : { mode });
    renameSync(temporary, path);
    return true;
  } catch {
    return false;
  }
}
