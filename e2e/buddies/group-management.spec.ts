import { test, expect } from '../fixtures';
import { BuddiesPage } from '../pages/BuddiesPage';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Buddies Group Journey', () => {
  test('authenticated user sees empty buddies page', async ({
    authenticatedPage,
  }) => {
    const buddies = new BuddiesPage(authenticatedPage);
    await buddies.goto();
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Buddies' }),
    ).toBeVisible({ timeout: 10000 });
    await buddies.expectEmpty();
    await expect(
      authenticatedPage.getByText('Create Your First Group'),
    ).toBeVisible();
  });

  test('create a new group and see it on buddies page', async ({
    authenticatedPage,
  }) => {
    const buddies = new BuddiesPage(authenticatedPage);
    await buddies.gotoNewGroup();

    await expect(
      authenticatedPage.getByRole('button', { name: 'Create Group' }),
    ).toBeVisible({ timeout: 10000 });

    await buddies.createGroup('Sunday Picklers', {
      description: 'Casual weekend games',
      location: 'Central Park Courts',
    });

    // Should redirect to group detail page
    await buddies.expectOnGroupDetail();
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Sunday Picklers' }),
    ).toBeVisible({ timeout: 10000 });

    // Navigate back to buddies list and verify group appears
    await buddies.goto();
    await buddies.expectGroup('Sunday Picklers');
  });

  test('bottom nav shows Buddies tab when signed in', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/new');
    const nav = new NavigationBar(authenticatedPage);
    await nav.expectBuddiesTab();
  });
});
