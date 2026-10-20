#!/usr/bin/env node
import { main } from "./cli";

// The one file a box runs. `greecon-edge run` is what the service does; the other commands are for the
// person installing the box.
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exit(1);
  }
);
