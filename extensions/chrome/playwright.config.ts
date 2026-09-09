import { defineConfig } from "@playwright/test";

// Side panels are CDP "other" targets. Attach them for assertions, without
// replacing the real toolbar action or granting any host permissions.
process.env.PW_CHROMIUM_ATTACH_TO_OTHER = "1";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "line",
});
