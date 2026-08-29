import { defineConfig, devices } from '@playwright/test';

// E2E tests for the shared checkout flow. Integration-level: they drive the real
// pages against a running `next dev`, so they need DATABASE_URL (loaded from
// .env.local by Next) and the auth env below. Auth/tier and the order endpoints
// are mocked per-test (see tests/checkout.spec.js) so no real order is placed.
//
// Run:   npx playwright test           (starts its own dev server on :3939)
//        BASE_URL=https://… npx playwright test   (test an already-running URL)
const PORT = 3939;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Only manage a server when testing locally (no external BASE_URL given).
  webServer: process.env.BASE_URL ? undefined : {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE_URL}/api/artworks?limit=1`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-e2e-secret',
    },
  },
});
