// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signInAsTestUser } from './helpers/emulator-auth';
import { randomUUID } from 'crypto';

export { expect } from '@playwright/test';

type E2EFixtures = {
  /** A unique email for this test run — prevents parallel worker collisions. */
  testUserEmail: string;
  /** A page that's already navigated to the app and signed in. */
  authenticatedPage: Page;
};

export const test = base.extend<E2EFixtures>({
  testUserEmail: async ({}, use) => {
    await use(`e2e-${randomUUID().slice(0, 8)}@test.com`);
  },

  authenticatedPage: async ({ page, testUserEmail }, use) => {
    await page.goto('/');
    await page.waitForFunction(
      () => (window as any).__TEST_FIREBASE__,
      { timeout: 10000 },
    );
    await signInAsTestUser(page, { email: testUserEmail });
    await use(page);
  },
});
