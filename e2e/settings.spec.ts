import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').getByText('Settings').click();
  });

  test('displays all setting sections', async ({ page }) => {
    await expect(page.getByText('ACCOUNT')).toBeVisible();
    await expect(page.getByText('DEFAULT SCORING')).toBeVisible();
    await expect(page.getByText('DISPLAY')).toBeVisible();
    await expect(page.getByText('Keep Screen Awake')).toBeVisible();
  });

  test('shows sign in with Google button', async ({ page }) => {
    await expect(page.getByText('Sign in with Google')).toBeVisible();
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
    await expect(page.getByText('DISPLAY')).toBeVisible();
  });
});
