import { test, expect } from '@playwright/test';

test.describe('Buddies Auth Guards', () => {
  test('buddies list requires sign in', async ({ page }) => {
    await page.goto('/buddies');
    await expect(page.getByText('Sign in required')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeVisible();
  });

  test('create group requires sign in', async ({ page }) => {
    await page.goto('/buddies/new');
    await expect(page.getByText('Sign in required')).toBeVisible();
  });

  test('session detail requires sign in', async ({ page }) => {
    await page.goto('/session/some-id');
    await expect(page.getByText('Sign in required')).toBeVisible();
  });

  test('open play requires sign in', async ({ page }) => {
    await page.goto('/play');
    await expect(page.getByText('Sign in required')).toBeVisible();
  });
});
