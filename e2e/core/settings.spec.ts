import { test, expect } from '@playwright/test';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Settings (Manual Plan 8.3 partial)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to /settings (Settings moved from bottom nav to TopNav menu)
    await page.goto('/settings');
  });

  test('displays all setting sections', async ({ page }) => {
    await expect(page.getByText('Display')).toBeVisible();
    await expect(page.getByText('Default Scoring')).toBeVisible();
    await expect(page.getByText('Keep Screen Awake')).toBeVisible();
  });

  test('shows sign in option in account menu', async ({ page }) => {
    // Sign-in moved from settings page to TopNav account menu
    const accountMenuBtn = page.getByRole('button', { name: 'Account menu' });
    await accountMenuBtn.click();
    await expect(page.getByRole('menuitem', { name: /Sign in/i })).toBeVisible();
  });

  test('shows version footer', async ({ page }) => {
    await expect(page.getByText('Offline-first pickleball scoring')).toBeVisible();
  });

  test('display mode can be toggled', async ({ page }) => {
    const nav = new NavigationBar(page);
    const outdoorBtn = page.getByRole('button', { name: /Outdoor/ });
    await expect(outdoorBtn).toBeVisible();

    await outdoorBtn.click();

    // Navigate away and back
    await nav.goToNew();
    await page.goto('/settings');

    // Page still renders correctly
    await expect(page.getByText('Display')).toBeVisible();
  });
});
