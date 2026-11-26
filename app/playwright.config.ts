import { defineConfig, devices } from "@playwright/test";

// ADR-001 Step 8. Three real instances of the same production build:
// - 3000 primary: real `.env.local`
// - 3001 failure: invalid OpenRouter key -> real authentication error (AC-13 failure specs only)
// - 3002 timeout: real key + test-only 1 s budget (ADR-003 A-05, AC-13 timeout spec only)
// `npm run test:e2e` builds once before Playwright starts, so the instances never race on `.next/`.
// Nothing here intercepts requests: E2E runs against the real stack (plan §6a).

export const PRIMARY_URL = "http://localhost:3000";
export const FAILURE_URL = "http://localhost:3001";
export const TIMEOUT_URL = "http://localhost:3002";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: PRIMARY_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: [
    {
      command: "npx next start -p 3000",
      url: PRIMARY_URL,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: "npx next start -p 3001",
      url: FAILURE_URL,
      reuseExistingServer,
      timeout: 120_000,
      env: { OPENROUTER_API_KEY: "invalid-e2e-key" },
    },
    {
      command: "npx next start -p 3002",
      url: TIMEOUT_URL,
      reuseExistingServer,
      timeout: 120_000,
      env: { ALLOW_TEST_BUDGET: "true", CASE_BUDGET_MS: "1000" },
    },
  ],
});
