import { test, expect } from '../fixtures';
import { signInAsTestUser, signOut } from '../helpers/emulator-auth';
import { randomUUID } from 'crypto';

test.describe('Auth Sign-In / Sign-Out (Manual Plan 6.1)', () => {
  test('sign-in via emulator auth shows user name', async ({ page }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Alice Test' });

    // Open the account menu by clicking the avatar button
    await page.getByRole('button', { name: 'Account menu' }).click();

    // Verify the user's display name appears in the dropdown
    const menu = page.getByRole('menu', { name: 'Account options' });
    await expect(menu.getByText('Alice Test')).toBeVisible({ timeout: 10000 });
  });

  test('auth state persists across page refresh', async ({ page }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Bob Persist' });

    // Verify signed in
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menu = page.getByRole('menu', { name: 'Account options' });
    await expect(menu.getByText('Bob Persist')).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();

    // Wait for Firebase auth globals to settle after reload
    await page.waitForFunction(
      () =>
        (window as any).__TEST_FIREBASE__ &&
        (window as any).__TEST_FIREBASE_AUTH__ &&
        (window as any).__TEST_FIREBASE__?.auth?.currentUser !== null,
      { timeout: 15000 },
    );

    // Open the account menu again and verify name still visible
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menuAfter = page.getByRole('menu', { name: 'Account options' });
    await expect(menuAfter.getByText('Bob Persist')).toBeVisible({ timeout: 10000 });
  });

  test('sign-out clears auth state', async ({ page }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Charlie Out' });

    // Open account menu
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menu = page.getByRole('menu', { name: 'Account options' });
    await expect(menu.getByText('Charlie Out')).toBeVisible({ timeout: 10000 });

    // Click "Sign out" button in the menu
    await menu.getByRole('menuitem', { name: 'Sign out' }).click();

    // Wait for auth state to clear
    await page.waitForFunction(
      () => (window as any).__TEST_FIREBASE__?.auth?.currentUser === null,
      { timeout: 10000 },
    );

    // Open the account menu again — should now show signed-out state
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menuAfter = page.getByRole('menu', { name: 'Account options' });

    // Signed-out menu shows "Sign in with Google" instead of a user name
    await expect(
      menuAfter.getByRole('menuitem', { name: 'Sign in with Google' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(menuAfter.getByText('Charlie Out')).not.toBeVisible();
  });

  test('protected routes show sign-in prompt when not authenticated', async ({ page }) => {
    // Navigate to a protected route WITHOUT signing in
    await page.goto('/buddies');

    // Verify the RequireAuth gating UI
    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText('You need to sign in to access tournaments.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeVisible();
  });
});
