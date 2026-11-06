import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Match the environment used by the production build, including local Clerk keys.
loadEnvConfig(process.cwd(), false);

const PORT = 3100;
// NextURL normalizes loopback IPs to localhost; match Clerk's internal rewrites.
const baseURL = `http://localhost:${PORT}`;
const buildCommand = process.env.PLAYWRIGHT_WEBPACK === "1" ? "yarn build --webpack" : "yarn build";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // ADR-021: end-to-end tests run against a production build, never the
    // development server.
    command: `${buildCommand} && yarn start -H localhost -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    env: { NODE_ENV: "production" },
    timeout: 180_000,
  },
});
