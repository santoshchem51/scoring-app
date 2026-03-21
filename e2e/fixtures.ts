// e2e/fixtures.ts
import { test as base, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signInAsTestUser, getCurrentUserUid } from './helpers/emulator-auth';
import { randomUUID } from 'crypto';

export { expect } from '@playwright/test';

type E2EFixtures = {
  /** A unique email for this test run — prevents parallel worker collisions. */
  testUserEmail: string;
  /** A page that's already navigated to the app and signed in. */
  authenticatedPage: Page;
  /** The UID of the signed-in test user (from authenticatedPage). */
  testUserUid: string;
  /** A second authenticated page in a separate browser context (Pixel 5). */
  secondAuthenticatedPage: Page;
};

export const test = base.extend<E2EFixtures>({
  testUserEmail: async ({}, use) => {
    await use(`e2e-${randomUUID().slice(0, 8)}@test.com`);
  },

  authenticatedPage: async ({ page, testUserEmail }, use) => {
    await page.goto('/');
    await signInAsTestUser(page, { email: testUserEmail });
    await use(page);
  },

  testUserUid: async ({ authenticatedPage }, use) => {
    const uid = await getCurrentUserUid(authenticatedPage);
    await use(uid);
  },

  secondAuthenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
    });
    const page = await context.newPage();
    const email = `e2e-second-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email });
    await use(page);
    await context.close();
  },
});
