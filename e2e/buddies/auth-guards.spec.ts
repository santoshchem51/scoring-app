import { test, expect } from '@playwright/test';
import { BuddiesPage } from '../pages/BuddiesPage';

test.describe('Buddies Auth Guards', () => {
  test('buddies list requires sign in', async ({ page }) => {
    await page.goto('/buddies');
    const buddies = new BuddiesPage(page);
    await buddies.expectSignInRequired();
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeVisible();
  });

  test('create group requires sign in', async ({ page }) => {
    await page.goto('/buddies/new');
    const buddies = new BuddiesPage(page);
    await buddies.expectSignInRequired();
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
