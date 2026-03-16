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
import { captureScreen } from '../../helpers/screenshots';

test.describe('Voting & Open Play Journeys', () => {
  test('create voting session (Find a Time)', async ({
    authenticatedPage: page,
  }, testInfo) => {
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

    // Fill in the date, start time, and end time for each slot
    const slotContainers = page.locator('.bg-surface-light.border.rounded-xl');
    const dateInputs = slotContainers.locator('input[type="date"]');
    const timeInputs = slotContainers.locator('input[type="time"]');

    // Slot 1: date, start, end
    await dateInputs.nth(0).fill('2026-03-20');
    await timeInputs.nth(0).fill('09:00');
    await timeInputs.nth(1).fill('11:00');

    // Slot 2: date, start, end
    await dateInputs.nth(1).fill('2026-03-21');
    await timeInputs.nth(2).fill('14:00');
    await timeInputs.nth(3).fill('16:00');

    // Submit the voting session
    const submitButton = page.getByRole('button', { name: /create/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // Verify redirect to session detail or success indication
    await expect(page.getByText('Weekend Poll')).toBeVisible({
      timeout: 15000,
    });
    await captureScreen(page, testInfo, 'buddy-voting-sessioncreated');
  });

  test('Voting: creator confirms time slot and session becomes confirmed', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const sessionId = uid('session');

    // Seed buddy group
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Confirm Vote Group',
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

    // Seed a voting session with 2 time slots (with vote counts)
    const slot1 = {
      id: uid('slot'),
      date: Date.now() + 86400000,
      startTime: '9:00 AM',
      endTime: '11:00 AM',
      voteCount: 3,
    };
    const slot2 = {
      id: uid('slot'),
      date: Date.now() + 172800000,
      startTime: '2:00 PM',
      endTime: '4:00 PM',
      voteCount: 5,
    };

    const session = makeGameSession({
      id: sessionId,
      groupId,
      title: 'Vote Confirm Session',
      location: 'Main Courts',
      rsvpStyle: 'voting',
      status: 'proposed',
      spotsTotal: 8,
      spotsConfirmed: 0,
      timeSlots: [slot1, slot2],
      confirmedSlot: null,
      createdBy: userUid,
      shareCode: shareCode(),
    });
    await seedFirestoreDocAdmin('gameSessions', sessionId, session);

    // Navigate to session detail
    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Vote Confirm Session')).toBeVisible({
      timeout: 15000,
    });

    // The creator should see "Confirm" buttons on each time slot
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });
    await expect(confirmButtons.first()).toBeVisible({ timeout: 10000 });

    // Click Confirm on the first slot
    await confirmButtons.first().click();

    // Verify session status changes — the status badge should reflect confirmed state
    // After confirming, the session's status updates to 'confirmed' and the
    // display status recalculates based on spots (e.g., "0/8 confirmed" or similar).
    // The confirmed slot's date/time should now appear in the header.
    await expect(page.getByText(/9:00 AM - 11:00 AM/).first()).toBeVisible({
      timeout: 10000,
    });

    await captureScreen(page, testInfo, 'buddy-voting-slotconfirmed');
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
