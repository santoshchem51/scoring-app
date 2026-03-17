import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 4,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html']],
  globalSetup: './e2e/global-setup.ts',
  expect: { timeout: 10000 },
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'emulator',
      testIgnore: ['**/smoke/**', '**/visual-qa/**'],
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'visual-qa',
      testDir: './e2e/journeys/visual-qa',
      outputDir: './test-results/visual-qa',
      timeout: 60_000,
      retries: 0,
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5199',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-first-retry',
        actionTimeout: 15_000,
      },
    },
    {
      name: 'visual-qa-desktop',
      testDir: './e2e/journeys/visual-qa',
      testMatch: '**/chrome-visual.spec.ts',
      outputDir: './test-results/visual-qa-desktop',
      timeout: 60_000,
      retries: 0,
      use: {
        baseURL: 'http://localhost:5199',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-first-retry',
        actionTimeout: 15_000,
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
