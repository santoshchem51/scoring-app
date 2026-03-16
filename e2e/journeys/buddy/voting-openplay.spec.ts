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

test.describe('Voting & Open Play Journeys', () => {
  test('create voting session (Find a Time)', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');

    // Seed buddy group
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Voting Test Group',
      createdBy: userUid,
      memberCount: 1,
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

    // Navigate to new session page for the group
    await page.goto(`/buddies/${groupId}/session/new`);

    // Switch to "Find a Time" / voting mode
    const findATimeButton = page.getByRole('button', { name: /find a time/i });
    await expect(findATimeButton).toBeVisible({ timeout: 10000 });
    await findATimeButton.click();

    // Fill title
    await page.locator('#session-title').fill('Weekend Poll');

    // Add 2 time slots
    const addSlotButton = page.getByRole('button', { name: /add.*slot/i });
    await expect(addSlotButton).toBeVisible({ timeout: 5000 });
    await addSlotButton.click();
    await addSlotButton.click();

    // Submit the voting session
    const submitButton = page.getByRole('button', { name: /create/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // Verify redirect to session detail or success indication
    await expect(page.getByText('Weekend Poll')).toBeVisible({
      timeout: 15000,
    });
  });

  test('Open Play lists open sessions', async ({
    authenticatedPage: page,
  }) => {
    const sessionId = uid('session');

    // Seed a game session with open visibility and proposed status
    const session = makeGameSession({
      id: sessionId,
      title: 'Sunset Open Play',
      location: 'Beach Courts',
      visibility: 'open',
      status: 'proposed',
      spotsTotal: 8,
      spotsConfirmed: 2,
      shareCode: shareCode(),
    });
    await seedFirestoreDocAdmin('gameSessions', sessionId, session);

    // Navigate to open play page
    await page.goto('/play');

    // Verify session card appears with title
    await expect(page.getByText('Sunset Open Play')).toBeVisible({
      timeout: 15000,
    });
  });
});
