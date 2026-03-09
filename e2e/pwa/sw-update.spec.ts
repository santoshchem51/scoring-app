import { test, expect } from '@playwright/test';

test.describe('SW Update Toast', () => {
  test('has aria-live status region for accessibility', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    const statusRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(statusRegion).toBeAttached();
  });

  test('toast is hidden by default (no SW update pending)', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    await expect(page.getByText('A new version is available')).not.toBeVisible();
  });

  test('toast is not shown on scoring page', async ({ page }) => {
    await page.goto('http://localhost:5199/score/test');
    await expect(page.getByText('A new version is available')).not.toBeVisible();
  });
});
