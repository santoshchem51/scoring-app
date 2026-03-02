import { test, expect } from '@playwright/test';

test.describe('Staging Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PickleScore')).toBeVisible();
  });

  test('bottom nav renders all tabs', async ({ page }) => {
    await page.goto('/new');
    const nav = page.getByRole('navigation');
    await expect(nav.getByText('New')).toBeVisible();
    await expect(nav.getByText('History')).toBeVisible();
    await expect(nav.getByText('Players')).toBeVisible();
    await expect(nav.getByText('Settings')).toBeVisible();
  });

  test('quick game: score a point and scoring works', async ({ page }) => {
    await page.goto('/new');
    await page.getByRole('button', { name: /Quick Game/ }).click();
    await expect(page.getByText('0-0-2')).toBeVisible();

    await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    await expect(page.getByText('1-0-2')).toBeVisible();
  });

  test('tournament browse page loads', async ({ page }) => {
    await page.goto('/tournaments');
    await expect(page.getByRole('heading', { name: /Tournaments/ })).toBeVisible();
  });

  test('players page loads with add form', async ({ page }) => {
    await page.goto('/players');
    await expect(page.getByPlaceholder('Player name')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Display')).toBeVisible();
    await expect(page.getByText('Default Scoring')).toBeVisible();
  });
});
