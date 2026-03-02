import { test, expect } from '@playwright/test';
import { TournamentBrowsePage } from '../pages/TournamentBrowsePage';

test.describe('Tournament Auth Guards', () => {
  test('tournament browse page is publicly accessible', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();
    await browse.expectPageLoaded();
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
