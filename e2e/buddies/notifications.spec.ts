import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../helpers/emulator-auth';
import { randomUUID } from 'crypto';

// TODO: "Mark as read clears badge" test cannot be implemented through the UI.
// There is no notifications page/inbox UI — only a badge count on the Buddies nav item.
// When a notification inbox is added, write a test that marks notifications as read
// and verifies the badge count decrements or disappears.

function makeNotification(userId: string, overrides: Record<string, unknown> = {}) {
  const id = `notif-${randomUUID().slice(0, 8)}`;
  return {
    id,
    userId,
    type: 'session_proposed',
    sessionId: `session-${randomUUID().slice(0, 8)}`,
    groupId: null,
    actorName: 'Buddy Player',
    message: 'proposed a new session',
    read: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

test.describe('Notification Badge', () => {
  test('shows unread count for a single notification', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed one unread notification
    const notif = makeNotification(uid);
    await seedFirestoreDocAdmin(`users/${uid}/buddyNotifications`, notif.id, notif);

    // Navigate to a non-root page where the bottom nav is visible
    // (BottomNav is hidden on "/" — the landing page route)
    await page.goto('/new');

    // Verify badge shows count of 1 on the Buddies nav link
    const badge = page.getByLabel(/1 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('1');
  });

  test('multiple notifications increment badge count', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed 3 unread notifications
    await Promise.all(
      Array.from({ length: 3 }, (_, i) => {
        const notif = makeNotification(uid, { message: `Notification ${i + 1}` });
        return seedFirestoreDocAdmin(`users/${uid}/buddyNotifications`, notif.id, notif);
      })
    );

    // Navigate to a non-root page where the bottom nav is visible
    await page.goto('/new');

    // Verify badge shows count of 3
    const badge = page.getByLabel(/3 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('3');
  });

  test('badge shows 9+ for more than 9 notifications', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed 12 unread notifications
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const notif = makeNotification(uid, { message: `Notification ${i + 1}` });
        return seedFirestoreDocAdmin(`users/${uid}/buddyNotifications`, notif.id, notif);
      })
    );

    // Navigate to a non-root page where the bottom nav is visible
    await page.goto('/new');

    // Verify badge shows "9+" (capped display)
    const badge = page.getByLabel(/12 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('9+');
  });
});
