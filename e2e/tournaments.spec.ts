import { test, expect } from '@playwright/test';

test.describe('Tournament Auth Guards', () => {
  test('tournament browse page is publicly accessible', async ({ page }) => {
    await page.goto('/tournaments');

    // Page title "Tournaments" visible in the top nav
    await expect(page.getByText('Tournaments', { exact: true })).toBeVisible({
      timeout: 15000,
    });

    // Browse tab controls are visible without sign-in
    await expect(
      page.getByPlaceholder('Search name or location...'),
    ).toBeVisible();
    await expect(
      page.getByLabel('Filter by status'),
    ).toBeVisible();
  });

  test('tournament create requires sign in', async ({ page }) => {
    await page.goto('/tournaments/new');
    await expect(page.getByText('Sign in required')).toBeVisible({
      timeout: 10000,
    });
  });

  test('tournament dashboard requires sign in', async ({ page }) => {
    await page.goto('/tournaments/some-tournament-id');
    await expect(page.getByText('Sign in required')).toBeVisible({
      timeout: 10000,
    });
  });
});
