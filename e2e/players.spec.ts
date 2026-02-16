import { test, expect } from '@playwright/test';

test.describe('Players Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new');
    await page.locator('nav').getByText('Players').click();
  });

  test('shows empty state when no players', async ({ page }) => {
    await expect(page.getByText('No Players Yet')).toBeVisible();
  });

  test('adds a new player', async ({ page }) => {
    await page.getByPlaceholder('Player name').fill('Alice');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Alice', { exact: true })).toBeVisible();
    await expect(page.getByText('No Players Yet')).not.toBeVisible();
  });

  test('adds multiple players', async ({ page }) => {
    await page.getByPlaceholder('Player name').fill('Alice');
    await page.getByRole('button', { name: 'Add' }).click();
    // Wait for player to appear before adding next
    await expect(page.getByText('Alice', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Player name').fill('Bob');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Bob', { exact: true })).toBeVisible();

    await expect(page.getByText('Alice', { exact: true })).toBeVisible();
  });

  test('deletes a player via confirmation dialog', async ({ page }) => {
    await page.getByPlaceholder('Player name').fill('ToDelete');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('ToDelete', { exact: true })).toBeVisible();

    // Click the Delete button on the player card (opens confirm dialog)
    await page.getByRole('button', { name: 'Delete ToDelete' }).click();

    // Confirm in the dialog — dispatch click via JS to avoid nav overlap
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).dispatchEvent('click');

    // Player should be removed
    await expect(page.getByText('ToDelete', { exact: true })).toBeHidden({ timeout: 10000 });
  });

  test('clears input after adding player', async ({ page }) => {
    await page.getByPlaceholder('Player name').fill('Alice');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByPlaceholder('Player name')).toHaveValue('');
  });
});
