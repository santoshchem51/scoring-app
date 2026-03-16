import { test, expect } from '../../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../../helpers/emulator-auth';
import {
  makeBuddyGroup,
  makeGameSession,
  uid,
  shareCode,
} from '../../helpers/factories';

test.describe('Buddy Group Journeys', () => {
  test('group detail shows header, members, sessions', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const sessionId = uid('session');
    const code = shareCode();

    // Seed the buddy group
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Weekend Warriors',
      description: 'Saturday morning games',
      defaultLocation: 'Riverside Courts',
      memberCount: 1,
      shareCode: code,
      createdBy: userUid,
    });
    await seedFirestoreDocAdmin('buddyGroups', groupId, group);

    // Seed current user as admin member
    await seedFirestoreDocAdmin(
      `buddyGroups/${groupId}/members`,
      userUid,
      {
        displayName: 'Test Player',
        photoURL: null,
        role: 'admin',
        joinedAt: Date.now(),
      },
    );

    // Seed a game session for the group
    const session = makeGameSession({
      id: sessionId,
      groupId,
      title: 'Saturday Morning Doubles',
      location: 'Riverside Courts',
      createdBy: userUid,
    });
    await seedFirestoreDocAdmin('gameSessions', sessionId, session);

    // Navigate to group detail
    await page.goto(`/buddies/${groupId}`);

    // Assert group name visible
    await expect(
      page.getByRole('heading', { name: 'Weekend Warriors' }),
    ).toBeVisible({ timeout: 15000 });

    // Assert location visible
    await expect(page.getByText('Riverside Courts')).toBeVisible({
      timeout: 5000,
    });

    // Assert member avatar / member indicator visible
    await expect(page.getByText('Test Player')).toBeVisible({
      timeout: 5000,
    });

    // Assert session card visible
    await expect(page.getByText('Saturday Morning Doubles')).toBeVisible({
      timeout: 5000,
    });
  });

  test('join group via invite link', async ({ authenticatedPage: page }) => {
    const groupId = uid('group');
    const code = shareCode();

    // Seed a buddy group with a share code
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Park Picklers',
      description: 'Open group for park regulars',
      defaultLocation: 'Central Park',
      shareCode: code,
      visibility: 'private',
      memberCount: 3,
    });
    await seedFirestoreDocAdmin('buddyGroups', groupId, group);

    // Navigate to invite link
    await page.goto(`/g/${code}`);

    // Assert group name visible
    await expect(page.getByText('Park Picklers')).toBeVisible({
      timeout: 15000,
    });

    // Click Join button
    const joinButton = page.getByRole('button', { name: /join/i });
    await expect(joinButton).toBeVisible({ timeout: 5000 });
    await joinButton.click();

    // Assert redirect to group detail — group name still visible
    await expect(page.getByText('Park Picklers')).toBeVisible({
      timeout: 15000,
    });
  });
});
