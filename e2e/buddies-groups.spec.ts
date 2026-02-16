import { test, expect } from '@playwright/test';
import { signInAsTestUser, clearEmulators } from './helpers/emulator-auth';

test.describe('Buddies Group Journey', () => {
  // Clear emulator data before the suite to avoid stale state
  test.beforeAll(async () => {
    await clearEmulators();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('authenticated user sees empty buddies page', async ({ page }) => {
    // Use a unique user to guarantee empty state
    await signInAsTestUser(page, { email: 'empty-groups@test.com' });
    await page.goto('/buddies');
    await expect(
      page.getByRole('heading', { name: 'Buddies' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No groups yet')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Create Your First Group')).toBeVisible();
  });

  test('create a new group and see it on buddies page', async ({ page }) => {
    await signInAsTestUser(page, { email: 'create-group@test.com' });
    await page.goto('/buddies/new');

    await expect(
      page.getByRole('button', { name: 'Create Group' }),
    ).toBeVisible({ timeout: 10000 });

    await page.locator('#group-name').fill('Sunday Picklers');
    await page.locator('#group-desc').fill('Casual weekend games');
    await page.locator('#group-location').fill('Central Park Courts');

    await page.getByRole('button', { name: 'Create Group' }).click();

    // Should redirect to group detail page
    await page.waitForURL(/\/buddies\//, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Sunday Picklers' }),
    ).toBeVisible({ timeout: 10000 });

    // Navigate back to buddies list and verify group appears
    await page.goto('/buddies');
    await expect(
      page.getByText('Sunday Picklers').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('bottom nav shows Buddies tab when signed in', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/new');
    const nav = page.locator('nav');
    await expect(nav.getByText('Buddies')).toBeVisible({ timeout: 10000 });
  });
});
