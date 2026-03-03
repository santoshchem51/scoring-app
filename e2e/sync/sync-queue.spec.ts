import { test, expect } from '../fixtures';

test.describe('Sync Queue', () => {
  test('Settings page shows Cloud Sync section when signed in', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');

    // Cloud Sync section should be visible for signed-in users
    await expect(authenticatedPage.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByText('Status')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /sync now/i })).toBeVisible();
  });

  test('Cloud Sync section hidden when not signed in', async ({ page }) => {
    await page.goto('/settings');

    // Cloud Sync section should NOT be visible for anonymous users
    await expect(page.getByText('Cloud Sync')).not.toBeVisible({ timeout: 5000 });
    // But other settings should still be visible
    await expect(page.getByText('Display')).toBeVisible();
  });
});
