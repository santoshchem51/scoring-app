import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('Settings').click();
  });

  test('displays all setting sections', async ({ page }) => {
    await expect(page.getByText('Display')).toBeVisible();
    await expect(page.getByText('Default Scoring')).toBeVisible();
    await expect(page.getByText('Keep Screen Awake')).toBeVisible();
  });

  test('shows sign in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows version footer', async ({ page }) => {
    await expect(page.getByText('Offline-first pickleball scoring')).toBeVisible();
  });

  test('display mode can be toggled', async ({ page }) => {
    const outdoorBtn = page.getByRole('button', { name: /Outdoor/ });
    await expect(outdoorBtn).toBeVisible();

    await outdoorBtn.click();

    // Navigate away and back
    await page.locator('nav').getByText('New').click();
    await page.locator('nav').getByText('Settings').click();

    // Page still renders correctly
    await expect(page.getByText('Display')).toBeVisible();
  });
});
