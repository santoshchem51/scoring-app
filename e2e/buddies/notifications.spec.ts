import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../helpers/emulator-auth';
import { randomUUID } from 'crypto';

function makeNotification(userId: string, overrides: Record<string, unknown> = {}) {
  const id = `notif-${randomUUID().slice(0, 8)}`;
  return {
    id,
    data: {
      id,
      userId,
      type: 'session_proposed',
      category: 'buddy',
      message: 'Buddy Player proposed a new session',
      actionUrl: `/session/session-${randomUUID().slice(0, 8)}`,
      payload: { actorId: 'actor-1', actorName: 'Buddy Player' },
      read: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      ...overrides,
    },
  };
}

test.describe('Notification Badge', () => {
  test('shows unread count for a single notification', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed one unread buddy notification into unified collection
    const notif = makeNotification(uid);
    await seedFirestoreDocAdmin(`users/${uid}/notifications`, notif.id, notif.data);

    // Navigate to a non-root page where the bottom nav is visible
    await page.goto('/new');

    // Verify badge shows count of 1 on the Buddies nav link
    const badge = page.getByLabel(/1 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('1');
  });

  test('multiple notifications increment badge count', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed 3 unread buddy notifications into unified collection
    await Promise.all(
      Array.from({ length: 3 }, (_, i) => {
        const notif = makeNotification(uid, { message: `Notification ${i + 1}` });
        return seedFirestoreDocAdmin(`users/${uid}/notifications`, notif.id, notif.data);
      })
    );

    await page.goto('/new');

    // Verify badge shows count of 3
    const badge = page.getByLabel(/3 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('3');
  });

  test('badge shows 9+ for more than 9 notifications', async ({ authenticatedPage: page }) => {
    const uid = await getCurrentUserUid(page);

    // Seed 12 unread buddy notifications into unified collection
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const notif = makeNotification(uid, { message: `Notification ${i + 1}` });
        return seedFirestoreDocAdmin(`users/${uid}/notifications`, notif.id, notif.data);
      })
    );

    await page.goto('/new');

    // Verify badge shows "9+" (capped display)
    const badge = page.getByLabel(/12 unread notification/);
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText('9+');
  });
});
