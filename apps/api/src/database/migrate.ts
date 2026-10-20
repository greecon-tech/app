import "reflect-metadata";
import { prepareDatabase } from "./startup";

// The same step the API runs when it starts. Kept as a command for a database that should be
// brought up to date without starting the API, or to see what a deploy will do.
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  await prepareDatabase({ ...process.env, AUTO_MIGRATE: "true" }, (message) => process.stdout.write(`${message}\n`));
}

main().catch((error: unknown) => {
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
