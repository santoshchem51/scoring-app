import { test, expect } from '@playwright/test';
import {
  signInAsTestUser,
  clearEmulators,
  seedFirestoreDocAdmin,
} from './helpers/emulator-auth';

test.describe('Public Session Page', () => {
  test.beforeAll(async () => {
    await clearEmulators();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await signInAsTestUser(page, { email: 'public-test@test.com' });
  });

  test('invalid share code shows not found', async ({ page }) => {
    await page.goto('/s/INVALID999');
    await expect(page.getByText('Session Not Found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('valid share code shows session details', async ({ page }) => {
    // Seed a game session via admin API (bypasses security rules)
    const sessionId = 'e2e-public-session';
    const shareCode = 'PUBTEST1';
    await seedFirestoreDocAdmin('gameSessions', sessionId, {
      id: sessionId,
      createdBy: 'other-user',
      groupId: null,
      title: 'Saturday Pickup',
      scheduledDate: Date.now() + 86400000,
      location: 'Riverside Courts',
      courtsAvailable: 2,
      spotsTotal: 8,
      spotsConfirmed: 3,
      minPlayers: 4,
      status: 'proposed',
      visibility: 'open',
      shareCode,
      rsvpDeadline: null,
      confirmedSlot: null,
      timeSlots: [],
      votingDeadline: null,
      schedulingMode: 'fixed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await page.goto(`/s/${shareCode}`);

    await expect(page.getByText('Saturday Pickup')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('Riverside Courts')).toBeVisible();
    await expect(page.getByText('3 of 8 confirmed')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Join on PickleScore' }),
    ).toBeVisible();
  });
});

test.describe('Group Invite Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await signInAsTestUser(page, { email: 'invite-test@test.com' });
  });

  test('invalid share code shows not found', async ({ page }) => {
    await page.goto('/g/INVALID999');
    await expect(page.getByText('Group Not Found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('valid share code shows group invite', async ({ page }) => {
    // Seed a buddy group via admin API (bypasses security rules)
    const groupId = 'e2e-public-group';
    const shareCode = 'GRPTEST1';
    await seedFirestoreDocAdmin('buddyGroups', groupId, {
      id: groupId,
      name: 'Weekend Warriors',
      description: 'Competitive weekend play',
      createdBy: 'some-other-user',
      defaultLocation: 'Downtown Courts',
      defaultDay: 'Saturday',
      defaultTime: '09:00',
      memberCount: 5,
      visibility: 'private',
      shareCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await page.goto(`/g/${shareCode}`);

    await expect(page.getByText('Weekend Warriors')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('Competitive weekend play')).toBeVisible();
    await expect(page.getByText('5 members')).toBeVisible();
    await expect(page.getByText('Downtown Courts')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Join Group' }),
    ).toBeVisible();
  });
});
