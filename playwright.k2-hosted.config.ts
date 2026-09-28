import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: ['k2_hosted_acceptance.spec.ts', 'k2_playwright_network.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 12 * 60_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  outputDir: 'test-results-k2-hosted',
  use: {
    headless: true,
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
});
