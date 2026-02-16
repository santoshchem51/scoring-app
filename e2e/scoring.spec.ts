import { test, expect } from '@playwright/test';

test.describe('Scoring Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new');
  });

  test('home page shows New Game setup', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'New Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Quick Game/ })).toBeVisible();
    await expect(page.getByText('Game Type')).toBeVisible();
    await expect(page.getByText('Scoring')).toBeVisible();
    await expect(page.getByText('Points to Win')).toBeVisible();
  });

  test('quick game starts scoring screen', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();
    await expect(page.getByRole('link', { name: 'Live Score' })).toBeVisible();
    await expect(page.getByText('0-0-2')).toBeVisible();
    await expect(page.getByRole('button', { name: /Side out/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Undo/i })).toBeVisible();
  });

  test('scoring a point increments score for serving team', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();
    await expect(page.getByText('0-0-2')).toBeVisible();

    await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    await expect(page.getByText('1-0-2')).toBeVisible();
  });

  test('side out changes serving team', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    await expect(page.getByText('2-0-2')).toBeVisible();

    await page.getByRole('button', { name: /Side out/i }).click();
    await expect(page.getByText('0-2-1')).toBeVisible();
  });

  test('undo reverts the last action', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    await expect(page.getByText('1-0-2')).toBeVisible();

    await page.getByRole('button', { name: /Undo/i }).click();
    await expect(page.getByText('0-0-2')).toBeVisible();
  });

  test('non-serving team score button is disabled in side-out scoring', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    await expect(page.getByRole('button', { name: 'Score point for Team 2' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Score point for Team 1' })).toBeEnabled();
  });

  test('game completes at 11 points with match over screen', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    for (let i = 0; i < 11; i++) {
      await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    }

    await expect(page.getByText('Match Over!')).toBeVisible();
    await expect(page.getByText('Team 1 wins!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & Finish' })).toBeVisible();
  });

  test('game point indicator shows at 10 points', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    }

    await expect(page.getByText('GAME POINT')).toBeVisible();
  });

  test('save & finish navigates to match history', async ({ page }) => {
    await page.getByRole('button', { name: /Quick Game/ }).click();

    for (let i = 0; i < 11; i++) {
      await page.getByRole('button', { name: 'Score point for Team 1' }).click();
    }

    await page.getByRole('button', { name: 'Save & Finish' }).click();

    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible();
    await expect(page.getByText('11').first()).toBeVisible();
  });
});
