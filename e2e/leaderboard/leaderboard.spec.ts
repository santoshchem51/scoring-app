import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers/emulator-auth';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/players');
  });

  test('shows Players and Leaderboard tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Leaderboard' })).toBeVisible();
  });

  test('Players tab is selected by default', async ({ page }) => {
    const playersTab = page.getByRole('tab', { name: 'Players' });
    await expect(playersTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switches to Leaderboard tab and shows empty state', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    await expect(page.getByText('No rankings yet')).toBeVisible();
  });

  test('Leaderboard tab shows scope and timeframe toggles', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();

    // Scope toggle group with Global and Friends radio buttons
    await expect(page.getByRole('radio', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Friends' })).toBeVisible();

    // Timeframe toggle group with All Time and Last 30 Days radio buttons
    await expect(page.getByRole('radio', { name: 'All Time' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Last 30 Days' })).toBeVisible();
  });

  test('Friends button is disabled when not signed in', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    const friendsBtn = page.getByRole('radio', { name: 'Friends' });
    await expect(friendsBtn).toBeDisabled();
  });

  test('Friends button is enabled after sign-in', async ({ page }) => {
    // signInAsTestUser requires Firebase SDK to be loaded, so navigate first
    const email = `e2e-lb-${Date.now()}@test.com`;
    await signInAsTestUser(page, { email, displayName: 'LB Tester' });

    // Re-navigate to /players after sign-in to ensure clean state
    await page.goto('/players');
    await page.getByRole('tab', { name: 'Leaderboard' }).click();

    const friendsBtn = page.getByRole('radio', { name: 'Friends' });
    await expect(friendsBtn).toBeEnabled();
  });
});
