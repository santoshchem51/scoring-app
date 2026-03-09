import { test, expect } from '@playwright/test';

test.describe('Install Prompt', () => {
  test('install banner is hidden on first visit (no trigger condition met)', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5199/');
    await expect(page.getByRole('button', { name: /install/i })).not.toBeVisible();
  });

  test('LandingPage footer exists', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('SettingsPage has App Installation section when navigated', async ({ page }) => {
    await page.goto('http://localhost:5199/settings');
    const installSection = page.getByText('App Installation');
    // Section exists in DOM (may need auth for full visibility)
    await expect(installSection).toBeAttached();
  });
});
