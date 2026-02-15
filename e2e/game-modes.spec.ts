import { test, expect } from '@playwright/test';

test.describe('Game Mode Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('switches to singles mode via custom game', async ({ page }) => {
    await page.getByRole('button', { name: /Singles/ }).click();
    await page.getByRole('button', { name: /start game/i }).click();

    await expect(page.getByRole('heading', { name: 'Live Score' })).toBeVisible();
  });

  test('switches to rally scoring via custom game', async ({ page }) => {
    await page.getByRole('button', { name: /Rally/ }).click();
    await page.getByRole('button', { name: /start game/i }).click();

    await expect(page.getByRole('heading', { name: 'Live Score' })).toBeVisible();
    // In rally scoring, both buttons should be enabled
    await expect(page.getByRole('button', { name: 'Score point for Team 1' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Score point for Team 2' })).toBeEnabled();
  });

  test('changes points to win to 15 via custom game', async ({ page }) => {
    await page.getByRole('button', { name: '15', exact: true }).click();
    await page.getByRole('button', { name: /start game/i }).click();

    await expect(page.getByText('to 15')).toBeVisible();
  });

  test('changes points to win to 21 via custom game', async ({ page }) => {
    await page.getByRole('button', { name: '21', exact: true }).click();
    await page.getByRole('button', { name: /start game/i }).click();

    await expect(page.getByText('to 21')).toBeVisible();
  });
});
