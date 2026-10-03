import { defineConfig, devices } from "@playwright/test";

const existingServer = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = existingServer || "http://127.0.0.1:5180";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  ...(existingServer
    ? {}
    : {
        webServer: {
          // CI validates the built deployment, while local runs use Next dev.
          command: `node node_modules/next/dist/bin/next ${process.env.CI ? "start" : "dev"} --hostname 127.0.0.1 --port 5180`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
