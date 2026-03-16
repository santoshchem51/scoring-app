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

test.describe('RSVP Journeys', () => {
  test('RSVP Out to In increments spots (reverse delta)', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const sessionId = uid('session');

    // Seed buddy group
    const group = makeBuddyGroup({
      id: groupId,
      name: 'RSVP Test Group',
      createdBy: userUid,
      memberCount: 1,
    });
    await seedFirestoreDocAdmin('buddyGroups', groupId, group);

    // Seed current user as member
    await seedFirestoreDocAdmin(
      `buddyGroups/${groupId}/members`,
      userUid,
      {
        displayName: 'Test Player',
        photoURL: null,
        role: 'member',
        joinedAt: Date.now(),
      },
    );

    // Seed game session with 1 confirmed spot (someone else is "in")
    const session = makeGameSession({
      id: sessionId,
      groupId,
      title: 'RSVP Delta Session',
      location: 'Test Courts',
      spotsTotal: 4,
      spotsConfirmed: 1,
      createdBy: userUid,
      shareCode: shareCode(),
    });
    await seedFirestoreDocAdmin('gameSessions', sessionId, session);

    // Seed an RSVP doc for current user with response='out'
    await seedFirestoreDocAdmin(
      `gameSessions/${sessionId}/rsvps`,
      userUid,
      {
        userId: userUid,
        displayName: 'Test Player',
        photoURL: null,
        response: 'out',
        dayOfStatus: 'none',
        selectedSlotIds: [],
        respondedAt: Date.now(),
        statusUpdatedAt: null,
      },
    );

    // Navigate to session detail
    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('RSVP Delta Session')).toBeVisible({
      timeout: 15000,
    });

    // Click "In" RSVP button
    const inButton = page.getByRole('button', { name: 'In' }).first();
    await expect(inButton).toBeVisible({ timeout: 5000 });
    await inButton.click();

    // Verify spots counter incremented (1 existing + 1 new = 2 of 4)
    await expect(page.getByText(/2 of 4/)).toBeVisible({ timeout: 10000 });
  });

  test('RSVP disabled for cancelled session', async ({
    authenticatedPage: page,
  }) => {
    const sessionId = uid('session');

    // Seed a cancelled session
    const session = makeGameSession({
      id: sessionId,
      title: 'Cancelled Meetup',
      location: 'Rain Courts',
      status: 'cancelled',
      spotsTotal: 4,
      spotsConfirmed: 0,
      shareCode: shareCode(),
    });
    await seedFirestoreDocAdmin('gameSessions', sessionId, session);

    // Navigate to session detail
    await page.goto(`/session/${sessionId}`);

    // Wait for session title first (positive assertion before negative)
    await expect(page.getByText('Cancelled Meetup')).toBeVisible({
      timeout: 15000,
    });

    // Verify RSVP buttons are NOT visible
    await expect(
      page.getByRole('button', { name: 'In' }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Out' }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Maybe' }),
    ).not.toBeVisible();
  });
});
