import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright acceptance test configuration for First Real Learning Loop (FRLL).
 *
 * Directs browser automation through the test-only same-origin reverse proxy (port 3005),
 * bridging Next.js (port 3000) and FastAPI (port 8000) under NEXT_PUBLIC_API_BASE_URL=/api.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3005',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
