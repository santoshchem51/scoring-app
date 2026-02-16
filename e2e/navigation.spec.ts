import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('bottom nav has all four tabs', async ({ page }) => {
    await page.goto('/new');
    const nav = page.locator('nav');
    await expect(nav.getByText('New')).toBeVisible();
    await expect(nav.getByText('History')).toBeVisible();
    await expect(nav.getByText('Players')).toBeVisible();
    await expect(nav.getByText('Settings')).toBeVisible();
  });

  test('navigating to History tab', async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('History').click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Match History' })).toBeVisible();
  });

  test('navigating to Players tab shows input', async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('Players').click();
    await expect(page.getByPlaceholder('Player name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('navigating to Settings tab', async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('Settings').click();
    await expect(page.getByText('Display')).toBeVisible();
    await expect(page.getByText('Default Scoring')).toBeVisible();
  });

  test('navigating back to New tab', async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('Settings').click();
    await expect(page.getByText('Display')).toBeVisible();
    await page.locator('nav').getByText('New').click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'New Game' })).toBeVisible();
  });
});
