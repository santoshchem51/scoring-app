import { test, expect } from '../../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../../helpers/emulator-auth';
import {
  uid,
  shareCode,
  makeBuddyGroup,
  makeGameSession,
} from '../../helpers/factories';
import {
  seedBuddyGroupWithMember,
  seedGameSessionWithAccess,
} from '../../helpers/seeders';
import { PATHS } from '../../helpers/firestore-paths';
import { captureScreen } from '../../helpers/screenshots';

test.describe('@p1 Buddy: P1 Group & Session Features', () => {
  // ── Task 34: RSVP transitions, day-of boundaries, share feedback, session fills ──

  test('@p1 RSVP-TRANSITION: RSVP In→Out decrements spots', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with spotsTotal=4, spotsConfirmed=2, user already RSVP'd as 'in'
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'In-to-Out Session',
      spotsTotal: 4,
      status: 'proposed',
      sessionOverrides: { spotsConfirmed: 2 },
    });

    // Seed user's RSVP as 'in'
    await seedFirestoreDocAdmin(PATHS.rsvps(seed.sessionId), userUid, {
      userId: userUid,
      displayName: 'Test Player',
      photoURL: null,
      response: 'in',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('In-to-Out Session')).toBeVisible({ timeout: 15000 });

    // Verify current spots: 2 of 4
    await expect(page.getByText(/2 of 4/)).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'rsvp-transition-before');

    // Click "Out" to change RSVP
    const outButton = page.getByRole('button', { name: 'Out' });
    await expect(outButton).toBeVisible({ timeout: 5000 });
    await outButton.click();

    // Spots should decrement: now 1 of 4
    await expect(page.getByText(/1 of 4/)).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'rsvp-transition-after');
  });

  test('@p1 RSVP-WAITLIST: Session at capacity shows full status', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed full session: spotsTotal=4, spotsConfirmed=4
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Full Session',
      spotsTotal: 4,
      status: 'proposed',
      sessionOverrides: { spotsConfirmed: 4, minPlayers: 4 },
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Full Session')).toBeVisible({ timeout: 15000 });

    // Assert: "Full" status badge is visible (from getSessionDisplayStatus)
    await expect(page.getByText('Full', { exact: true })).toBeVisible({ timeout: 10000 });

    // Spots should show 4 of 4 confirmed
    await expect(page.getByText(/4 of 4/)).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'session-full-status');
  });

  test('@p1 SESSION-SHARE: Share session button is visible', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Shareable Session',
      spotsTotal: 8,
      status: 'proposed',
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Shareable Session')).toBeVisible({ timeout: 15000 });

    // Assert: Share Session button is visible
    const shareButton = page.getByRole('button', { name: /Share Session/i });
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'session-share-button');
  });

  test('@p1 SESSION-FILLS: Session spots counter displays correctly', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with spotsTotal=8, spotsConfirmed=5
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Spots Counter Session',
      spotsTotal: 8,
      status: 'proposed',
      sessionOverrides: { spotsConfirmed: 5, minPlayers: 4 },
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Spots Counter Session')).toBeVisible({ timeout: 15000 });

    // Assert: "5 of 8 confirmed" text visible in SpotsTracker
    await expect(page.getByText(/5 of 8/)).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'spots-counter-display');
  });

  test('@p1 DAY-OF: Session date is displayed on session detail', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with scheduledDate set to today
    const now = new Date();
    const todayTimestamp = now.getTime();

    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Today Session',
      spotsTotal: 8,
      status: 'proposed',
      sessionOverrides: { scheduledDate: todayTimestamp },
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Today Session')).toBeVisible({ timeout: 15000 });

    // The date is formatted as "weekday, month day" — check for today's formatted date
    const todayFormatted = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    // Just verify some date-related text is visible (the formatted date string)
    await expect(page.getByText(todayFormatted)).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'session-today-date');
  });

  // ── Task 35: Creator controls, validation, notifications ──

  test('@p1 CREATOR-CONTROLS: Creator sees Open-to-community toggle', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session where user is creator (createdBy = userUid)
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Creator Session',
      spotsTotal: 8,
      status: 'proposed',
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Creator Session')).toBeVisible({ timeout: 15000 });

    // Assert: Creator-only "Open to community" toggle is visible
    await expect(page.getByText('Open to community')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('switch', { name: /Toggle open to community/i })).toBeVisible();
    await captureScreen(page, testInfo, 'creator-toggle-visible');
  });

  test('@p1 CREATOR-TOGGLE: Creator can toggle session visibility', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Toggle Visibility Session',
      spotsTotal: 8,
      status: 'proposed',
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Toggle Visibility Session')).toBeVisible({ timeout: 15000 });

    // Toggle should start unchecked (visibility = 'group' by default from seedGameSessionWithAccess)
    const toggle = page.getByRole('switch', { name: /Toggle open to community/i });
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Click toggle to change to 'open'
    await toggle.click();

    // Verify toggle is now checked
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
    await captureScreen(page, testInfo, 'creator-toggle-enabled');
  });

  test('@p1 VALIDATION: Create session with missing title shows error', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a group so we can navigate to session creation
    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: 'Validation Test Group',
      displayName: 'Test Player',
    });

    await page.goto(`/buddies/${groupSeed.groupId}/session/new`);
    await expect(page.getByText('New Session')).toBeVisible({ timeout: 15000 });

    // Don't fill title — just click Create Session
    // But fill a date since that's also required
    const tomorrow = new Date(Date.now() + 86400000);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.locator('#session-date').fill(dateStr);

    await page.getByRole('button', { name: 'Create Session' }).click();

    // Assert: Validation error "Title is required" visible
    await expect(page.getByText('Title is required')).toBeVisible({ timeout: 5000 });
    await captureScreen(page, testInfo, 'validation-missing-title');
  });

  test('@p1 VALIDATION: Create session with missing date shows error', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: 'Date Validation Group',
      displayName: 'Test Player',
    });

    await page.goto(`/buddies/${groupSeed.groupId}/session/new`);
    await expect(page.getByText('New Session')).toBeVisible({ timeout: 15000 });

    // Fill title but no date
    await page.locator('#session-title').fill('Session Without Date');

    await page.getByRole('button', { name: 'Create Session' }).click();

    // Assert: Validation error about date visible
    await expect(page.getByText('Please select a date')).toBeVisible({ timeout: 5000 });
    await captureScreen(page, testInfo, 'validation-missing-date');
  });

  test('@p1 MEMBER-LIST: Session detail shows RSVP\'d members', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with access
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Member List Session',
      spotsTotal: 8,
      status: 'proposed',
      sessionOverrides: { spotsConfirmed: 2 },
    });

    // Seed 3 RSVP docs with mix of responses
    await seedFirestoreDocAdmin(PATHS.rsvps(seed.sessionId), 'user-alice', {
      userId: 'user-alice',
      displayName: 'Alice',
      photoURL: null,
      response: 'in',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    });

    await seedFirestoreDocAdmin(PATHS.rsvps(seed.sessionId), 'user-bob', {
      userId: 'user-bob',
      displayName: 'Bob',
      photoURL: null,
      response: 'out',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    });

    await seedFirestoreDocAdmin(PATHS.rsvps(seed.sessionId), 'user-carol', {
      userId: 'user-carol',
      displayName: 'Carol',
      photoURL: null,
      response: 'maybe',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Member List Session')).toBeVisible({ timeout: 15000 });

    // Assert: "Who's Playing (3)" heading visible
    await expect(page.getByText(/Who's Playing.*3/)).toBeVisible({ timeout: 10000 });

    // Assert: Member names visible
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Bob')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Carol')).toBeVisible({ timeout: 5000 });

    // Assert: RSVP status labels visible
    await expect(page.getByText('In', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Out', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Maybe', { exact: true }).first()).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'member-list-rsvps');
  });

  test('@p1 GROUP-SHARE: Group invite page shows group info and join button', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const code = shareCode();

    // Seed a group (created by a different user so current user is NOT a member)
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Joinable Group',
      description: 'A group to join via share code',
      createdBy: 'other-user-123',
      memberCount: 3,
      shareCode: code,
    });
    await seedFirestoreDocAdmin(PATHS.buddyGroups, groupId, group);

    // Navigate to the group invite page
    await page.goto(`/g/${code}`);

    // Assert: Group name visible
    await expect(page.getByText('Joinable Group')).toBeVisible({ timeout: 15000 });

    // Assert: Group description visible
    await expect(page.getByText('A group to join via share code')).toBeVisible({ timeout: 5000 });

    // Assert: Member count visible
    await expect(page.getByText(/3 members/)).toBeVisible({ timeout: 5000 });

    // Assert: Join button visible
    await expect(page.getByRole('button', { name: /Join Group/i })).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'group-invite-page');
  });
});
