import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html']],
  globalSetup: './e2e/global-setup.ts',
  expect: { timeout: 10000 },
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'emulator',
      testIgnore: '**/smoke/**',
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'staging-smoke',
      testDir: './e2e/smoke',
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.STAGING_URL || 'https://picklescore.web.app',
      },
    },
  ],
  webServer: [
    {
      command: 'firebase emulators:start --only auth,firestore',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npx vite --port 5199',
      url: 'http://localhost:5199',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
