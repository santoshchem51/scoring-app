import { test, expect } from '@playwright/test';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new');
  });

  test('bottom nav has all four tabs', async ({ page }) => {
    const nav = new NavigationBar(page);
    await nav.expectAllTabs();
  });

  test('navigating to History tab', async ({ page }) => {
    const nav = new NavigationBar(page);
    await nav.goToHistory();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Match History' })).toBeVisible();
  });

  test('navigating to Players tab shows input', async ({ page }) => {
    const nav = new NavigationBar(page);
    await nav.goToPlayers();
    await expect(page.getByPlaceholder('Player name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('navigating to Settings tab', async ({ page }) => {
    const nav = new NavigationBar(page);
    await nav.goToSettings();
    await expect(page.getByText('Display')).toBeVisible();
    await expect(page.getByText('Default Scoring')).toBeVisible();
  });

  test('navigating back to New tab', async ({ page }) => {
    const nav = new NavigationBar(page);
    await nav.goToSettings();
    await expect(page.getByText('Display')).toBeVisible();
    await nav.goToNew();
    await expect(page.getByRole('banner').getByRole('link', { name: 'New Game' })).toBeVisible();
  });
});
