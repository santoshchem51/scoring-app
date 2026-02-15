import { test, expect } from '@playwright/test';

test.describe('Tournament Auth Guards', () => {
  test('tournament list requires sign in', async ({ page }) => {
    await page.goto('/tournaments');
    await expect(page.getByText('Sign in required')).toBeVisible();
    await expect(page.getByText('You need to sign in to access tournaments')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });

  test('tournament create requires sign in', async ({ page }) => {
    await page.goto('/tournaments/create');
    await expect(page.getByText('Sign in required')).toBeVisible();
  });

  test('tournament dashboard requires sign in', async ({ page }) => {
    await page.goto('/tournaments/some-tournament-id');
    await expect(page.getByText('Sign in required')).toBeVisible();
  });
});
