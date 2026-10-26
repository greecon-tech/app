import { defineConfig } from "vitest/config";

// The specs that start a database, or the whole platform, take seconds on a busy machine (a shared CI runner, a laptop that is also
// building). The default of five seconds turned a slow minute into a failed test that passes when run alone.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});
