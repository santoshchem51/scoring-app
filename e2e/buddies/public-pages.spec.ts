import { test, expect } from '@playwright/test';
import {
  signInAsTestUser,
  seedFirestoreDocAdmin,
} from '../helpers/emulator-auth';
import { makeGameSession, makeBuddyGroup } from '../helpers/factories';
import { randomUUID } from 'crypto';

test.describe('Public Session Page', () => {
  const testEmail = () => `public-${randomUUID().slice(0, 8)}@test.com`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { email: testEmail() });
  });

  test('invalid share code shows not found', async ({ page }) => {
    await page.goto('/s/INVALID999');
    await expect(page.getByText('Session Not Found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('valid share code shows session details', async ({ page }) => {
    const sessionId = `e2e-pub-${randomUUID().slice(0, 8)}`;
    const shareCode = `PUB${randomUUID().slice(0, 5).toUpperCase()}`;
    await seedFirestoreDocAdmin('gameSessions', sessionId, makeGameSession({
      id: sessionId,
      createdBy: 'other-user',
      title: 'Saturday Pickup',
      location: 'Riverside Courts',
      spotsTotal: 8,
      spotsConfirmed: 3,
      visibility: 'open',
      shareCode,
    }));

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
  const testEmail = () => `invite-${randomUUID().slice(0, 8)}@test.com`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { email: testEmail() });
  });

  test('invalid share code shows not found', async ({ page }) => {
    await page.goto('/g/INVALID999');
    await expect(page.getByText('Group Not Found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('valid share code shows group invite', async ({ page }) => {
    const groupId = `e2e-grp-${randomUUID().slice(0, 8)}`;
    const shareCode = `GRP${randomUUID().slice(0, 5).toUpperCase()}`;
    await seedFirestoreDocAdmin('buddyGroups', groupId, makeBuddyGroup({
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
    }));

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
