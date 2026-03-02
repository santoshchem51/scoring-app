import { test, expect } from '@playwright/test';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Display Modes (Manual Plan 8.3)', () => {
  // Scope display-mode buttons to the Display fieldset to avoid ambiguity
  // with other OptionCards on the Settings page.
  const displayFieldset = (page: import('@playwright/test').Page) =>
    page.locator('fieldset', {
      has: page.locator('legend', { hasText: 'Display' }),
    });

  test.beforeEach(async ({ page }) => {
    // Clear any persisted settings so each test starts from defaults (dark mode)
    await page.addInitScript(() => {
      localStorage.removeItem('pickle-score-settings');
    });
    await page.goto('/settings', { timeout: 15000 });
  });

  test('dark mode is the default', async ({ page }) => {
    const fieldset = displayFieldset(page);
    const darkBtn = fieldset.getByRole('button', { name: /Dark/ });
    const outdoorBtn = fieldset.getByRole('button', { name: /Outdoor/ });

    // Dark button should be selected
    await expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    // Outdoor button should NOT be selected
    await expect(outdoorBtn).toHaveAttribute('aria-pressed', 'false');

    // <html> should NOT have the "outdoor" class
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/outdoor/);

    // <meta name="theme-color"> should have dark theme value
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBe('#1e1e2e');
  });

  test('outdoor mode: high contrast', async ({ page }) => {
    const fieldset = displayFieldset(page);
    const outdoorBtn = fieldset.getByRole('button', { name: /Outdoor/ });

    // Switch to outdoor mode
    await outdoorBtn.click();

    // <html> should have the "outdoor" class
    const html = page.locator('html');
    await expect(html).toHaveClass(/outdoor/);

    // <meta name="theme-color"> should update to outdoor value
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBe('#ffffff');

    // CSS variable --color-surface should be #ffffff in outdoor mode
    const surfaceColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
    );
    expect(surfaceColor).toBe('#ffffff');
  });

  test('mode switch applies immediately without reload', async ({ page }) => {
    const fieldset = displayFieldset(page);
    const darkBtn = fieldset.getByRole('button', { name: /Dark/ });
    const outdoorBtn = fieldset.getByRole('button', { name: /Outdoor/ });
    const html = page.locator('html');

    // Start in dark mode (default)
    await expect(html).not.toHaveClass(/outdoor/);

    // Track whether a full page reload happens
    const navigationPromise = page.waitForNavigation({ timeout: 2000 }).catch(() => 'no-navigation');

    // Switch to outdoor
    await outdoorBtn.click();

    // Class should appear immediately
    await expect(html).toHaveClass(/outdoor/);

    // Verify no full page navigation occurred
    const navigationResult = await navigationPromise;
    expect(navigationResult).toBe('no-navigation');

    // Switch back to dark
    await darkBtn.click();

    // Class should be removed immediately
    await expect(html).not.toHaveClass(/outdoor/);
  });

  test('display mode persists across navigation', async ({ page }) => {
    const fieldset = displayFieldset(page);
    const outdoorBtn = fieldset.getByRole('button', { name: /Outdoor/ });
    const nav = new NavigationBar(page);

    // Switch to outdoor mode
    await outdoorBtn.click();
    await expect(outdoorBtn).toHaveAttribute('aria-pressed', 'true');

    // Navigate away to /new via BottomNav (client-side navigation)
    await nav.goToNew();
    await expect(page).toHaveURL(/\/new/);

    // Navigate back to settings via the Account menu (client-side <A> link,
    // avoids full page reload which would re-trigger addInitScript and clear localStorage)
    const accountMenuBtn = page.getByRole('button', { name: 'Account menu' });
    await accountMenuBtn.click();
    await page.getByRole('menuitem', { name: /Settings/ }).click();
    await expect(page.getByText('Display')).toBeVisible();

    // Outdoor should still be selected
    const fieldsetAfter = displayFieldset(page);
    const outdoorBtnAfter = fieldsetAfter.getByRole('button', { name: /Outdoor/ });
    await expect(outdoorBtnAfter).toHaveAttribute('aria-pressed', 'true');

    // <html> should still have outdoor class
    const html = page.locator('html');
    await expect(html).toHaveClass(/outdoor/);
  });
});
