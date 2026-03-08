import { test, expect } from '../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
  signInAsTestUser,
  signOut,
} from '../helpers/emulator-auth';
import { randomUUID } from 'crypto';

/**
 * Create a unified notification document suitable for seeding into
 * `users/{uid}/notifications/{id}` via the Firestore emulator REST API.
 */
function makeUnifiedNotification(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = `notif-${randomUUID().slice(0, 8)}`;
  return {
    id,
    data: {
      id,
      userId,
      type: 'session_proposed',
      category: 'buddy',
      message: 'Alice proposed Tue Doubles',
      actionUrl: '/session/s1',
      payload: { actorId: 'a1', actorName: 'Alice' },
      read: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Bell badge shows unread count after notification created
// ---------------------------------------------------------------------------

test.describe('Notification Center', () => {
  test('bell badge shows unread count after notification created', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    const notif = makeUnifiedNotification(uid);
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    await page.goto('/new');

    const badge = page.getByTestId('bell-badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('1');
  });

  // -------------------------------------------------------------------------
  // 2. Bell badge hidden when count is zero
  // -------------------------------------------------------------------------

  test('bell badge hidden when count is zero', async ({
    authenticatedPage: page,
  }) => {
    // Navigate with no notifications seeded
    await page.goto('/new');

    // Wait for the notification listener to settle
    await page.waitForTimeout(2000);

    const badge = page.getByTestId('bell-badge');
    await expect(badge).not.toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 3. Dropdown opens and closes correctly
  // -------------------------------------------------------------------------

  test('dropdown opens and closes correctly', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/new');

    // Click the bell button to open the panel
    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    // Verify notification panel (role="dialog") appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Press Escape to close the panel
    await page.keyboard.press('Escape');

    // Verify the dialog is no longer visible
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 4. Tap row marks read and navigates
  // -------------------------------------------------------------------------

  test('tap row marks notification as read', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    const notif = makeUnifiedNotification(uid, {
      message: 'Tap-to-read session',
      actionUrl: '/session/tap-test',
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    await page.goto('/new');

    // Wait for badge to show up confirming the notification arrived
    const badge = page.getByTestId('bell-badge');
    await expect(badge).toBeVisible({ timeout: 15000 });

    // Open the notification panel
    const bellButton = page.getByLabel('Notifications');
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Click the notification row (aria-label contains message + "unread")
    const row = page.getByLabel(/Tap-to-read session.*unread/);
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    // After clicking, the notification should be marked as read.
    // The badge should disappear since it was the only unread notification.
    await expect(badge).not.toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 5. Mark all read clears badge
  // -------------------------------------------------------------------------

  test('mark all read clears badge', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed 2 unread notifications
    const notif1 = makeUnifiedNotification(uid, { message: 'Session one' });
    const notif2 = makeUnifiedNotification(uid, { message: 'Session two' });
    await Promise.all([
      seedFirestoreDocAdmin(
        `users/${uid}/notifications`,
        notif1.id,
        notif1.data,
      ),
      seedFirestoreDocAdmin(
        `users/${uid}/notifications`,
        notif2.id,
        notif2.data,
      ),
    ]);

    await page.goto('/new');

    // Wait for badge to confirm both notifications arrived
    const badge = page.getByTestId('bell-badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('2');

    // Open the notification panel
    const bellButton = page.getByLabel('Notifications');
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Click "Mark all read"
    const markAllBtn = page.getByText('Mark all read');
    await expect(markAllBtn).toBeVisible({ timeout: 5000 });
    await markAllBtn.click();

    // Badge should disappear
    await expect(badge).not.toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 6. Real-time notification arrives while dropdown is open
  // -------------------------------------------------------------------------

  test('real-time notification arrives while dropdown is open', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    await page.goto('/new');

    // Open the empty notification panel
    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Verify panel shows "No notifications yet"
    await expect(page.getByText('No notifications yet')).toBeVisible({
      timeout: 15000,
    });

    // Seed a notification via admin while the panel is open
    const notif = makeUnifiedNotification(uid, {
      message: 'Realtime arrival test',
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    // Verify it appears in the panel without a page refresh
    const row = page.getByLabel(/Realtime arrival test/);
    await expect(row).toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 7. Achievement toast fires (placeholder)
  // -------------------------------------------------------------------------

  test('achievement notification appears in panel', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    const notif = makeUnifiedNotification(uid, {
      type: 'achievement_unlocked',
      category: 'achievement',
      message: 'Achievement unlocked: First Win!',
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    await page.goto('/new');

    // Open the notification panel
    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Achievement notification should appear in the panel
    const row = page.getByLabel(/Achievement unlocked: First Win!/);
    await expect(row).toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 8. Expired notification absent after sign-in
  // -------------------------------------------------------------------------

  test('expired notification absent after sign-in', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    // Seed a notification that expired in the past
    const notif = makeUnifiedNotification(uid, {
      message: 'Expired session invite',
      expiresAt: Date.now() - 60_000, // expired 1 minute ago
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    // Navigate — useAuth calls cleanupExpiredNotifications on sign-in
    await page.goto('/new');

    // Open the notification panel
    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Wait for cleanup + snapshot to settle, then verify expired notification
    // is not present. It may briefly appear before cleanup runs, so we wait.
    await page.waitForTimeout(3000);

    const row = page.getByLabel(/Expired session invite/);
    await expect(row).not.toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 9. Preference-disabled category absent from panel
  // -------------------------------------------------------------------------

  test('preference-disabled category absent from panel', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    // Seed a buddy notification
    const notif = makeUnifiedNotification(uid, {
      category: 'buddy',
      message: 'Filtered buddy notification',
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    // Navigate to settings and disable buddy notifications
    await page.goto('/settings');

    // Find the "Buddy activity" toggle switch and turn it off
    const buddyToggle = page.getByRole('switch', { name: /buddy activity/i });
    await expect(buddyToggle).toBeVisible({ timeout: 15000 });

    // It should be checked by default; click to turn it off
    await expect(buddyToggle).toHaveAttribute('aria-checked', 'true');
    await buddyToggle.click();
    await expect(buddyToggle).toHaveAttribute('aria-checked', 'false');

    // Now navigate to a page with TopNav and open the panel
    await page.goto('/new');

    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // The buddy notification should NOT appear because the category is disabled
    const row = page.getByLabel(/Filtered buddy notification/);
    await expect(row).not.toBeVisible({ timeout: 15000 });

    // Panel should show "No notifications yet" since the only one is filtered
    await expect(page.getByText('No notifications yet')).toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // 10. Sign-out then sign-in different user shows no stale notifications
  // -------------------------------------------------------------------------

  test('sign-out then sign-in different user shows no stale notifications', async ({
    authenticatedPage: page,
    testUserEmail,
  }) => {
    const uid = await getCurrentUserUid(page);

    // Seed a notification for user A
    const notif = makeUnifiedNotification(uid, {
      message: 'User A exclusive notification',
    });
    await seedFirestoreDocAdmin(
      `users/${uid}/notifications`,
      notif.id,
      notif.data,
    );

    await page.goto('/new');

    // Verify badge shows for user A
    const badge = page.getByTestId('bell-badge');
    await expect(badge).toBeVisible({ timeout: 15000 });

    // Sign out user A
    await signOut(page);

    // Sign in as a different user (user B)
    const userBEmail = `e2e-userb-${randomUUID().slice(0, 8)}@test.com`;
    await signInAsTestUser(page, { email: userBEmail, displayName: 'User B' });

    // Navigate to a page with the TopNav
    await page.goto('/new');

    // Wait for notification listener to settle
    await page.waitForTimeout(2000);

    // Bell badge should NOT be visible (user B has no notifications)
    await expect(badge).not.toBeVisible({ timeout: 15000 });

    // Open the panel to double-check it's empty
    const bellButton = page.getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 15000 });
    await bellButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('No notifications yet')).toBeVisible({
      timeout: 15000,
    });
  });
});
