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

test.describe('@p2 Buddy: P2 Edge Cases', () => {
  test('@p2 BUD-P2-1: Completed session shows read-only state', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with status: 'completed'
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Completed Session',
      spotsTotal: 8,
      status: 'completed',
      sessionOverrides: { spotsConfirmed: 6 },
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Completed Session')).toBeVisible({ timeout: 15000 });

    // Assert: Status badge shows "Completed"
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 });

    // Assert: Session details still visible (date, location)
    await expect(page.getByText('Test Courts')).toBeVisible({ timeout: 5000 });

    // Assert: No RSVP section visible (canRsvp returns false for completed)
    await expect(page.getByText('Your RSVP')).not.toBeVisible();

    await captureScreen(page, testInfo, 'completed-session-read-only');
  });

  test('@p2 BUD-P2-2: Past sessions are displayed in group detail', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed group with member
    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: 'Past Sessions Group',
      displayName: 'Test Player',
    });

    // Seed a completed session (past) for this group
    const sessionId = uid('session');
    const pastDate = Date.now() - 7 * 86400000; // 7 days ago
    const session = makeGameSession({
      id: sessionId,
      groupId: groupSeed.groupId,
      title: 'Old Game Night',
      location: 'Past Courts',
      status: 'completed',
      visibility: 'private',
      spotsTotal: 8,
      spotsConfirmed: 6,
      createdBy: userUid,
      scheduledDate: pastDate,
      shareCode: shareCode(),
    });
    await seedFirestoreDocAdmin(PATHS.gameSessions, sessionId, session);

    await page.goto(`/buddies/${groupSeed.groupId}`);
    await expect(page.getByRole('heading', { name: 'Past Sessions Group' })).toBeVisible({ timeout: 15000 });

    // Past sessions are in a collapsible section — click to expand
    const pastToggle = page.getByText(/Past Sessions \(/);
    await expect(pastToggle).toBeVisible({ timeout: 10000 });
    await pastToggle.click();

    // Assert: Past session visible
    await expect(page.getByText('Old Game Night')).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'past-sessions-displayed');
  });

  test('@p2 BUD-P2-3: Deadline guard — RSVP section hidden after deadline', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with rsvpDeadline in the past
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Deadline Passed Session',
      spotsTotal: 8,
      status: 'proposed',
      sessionOverrides: { rsvpDeadline: Date.now() - 3600000 }, // 1 hour ago
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Deadline Passed Session')).toBeVisible({ timeout: 15000 });

    // Assert: Session details still visible
    await expect(page.getByText('Test Courts')).toBeVisible({ timeout: 5000 });

    // Assert: No RSVP section visible (canRsvp returns false when deadline passed)
    await expect(page.getByText('Your RSVP')).not.toBeVisible();

    await captureScreen(page, testInfo, 'rsvp-deadline-passed');
  });

  test('@p2 BUD-P2-4: Invalid group share code shows error', async ({
    authenticatedPage: page,
  }, testInfo) => {
    // Navigate to a nonexistent share code
    await page.goto('/g/INVALID_CODE_99999');

    // The GroupInvitePage fetches by share code; if not found, it shows a fallback
    // Wait for loading to finish, then check for error/not found state
    await page.waitForLoadState('domcontentloaded');

    // Assert: either "not found" or error state visible
    await expect(
      page.getByText(/not found|Group not found|No group/i).first(),
    ).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, 'invalid-share-code');
  });

  test('@p2 BUD-P2-5: Empty group shows no sessions state', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed group with member but NO sessions
    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: 'Empty Group',
      displayName: 'Test Player',
    });

    await page.goto(`/buddies/${groupSeed.groupId}`);
    await expect(page.getByRole('heading', { name: 'Empty Group' })).toBeVisible({ timeout: 15000 });

    // Assert: "No upcoming sessions" empty state visible
    await expect(page.getByText('No upcoming sessions')).toBeVisible({ timeout: 10000 });

    // Assert: FAB (+ button) to create session is visible
    const createButton = page.locator(`a[href="/buddies/${groupSeed.groupId}/session/new"]`);
    await expect(createButton).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'empty-group-no-sessions');
  });

  test('@p2 BUD-P2-6: Group detail shows member count', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const code = shareCode();

    // Seed a group with memberCount: 5
    const group = makeBuddyGroup({
      id: groupId,
      name: 'Big Group',
      description: 'A group with several members',
      createdBy: userUid,
      memberCount: 5,
      shareCode: code,
    });
    await seedFirestoreDocAdmin(PATHS.buddyGroups, groupId, group);

    // Seed current user as member so they have access
    await seedFirestoreDocAdmin(PATHS.buddyMembers(groupId), userUid, {
      displayName: 'Test Player',
      photoURL: null,
      role: 'admin',
      joinedAt: Date.now(),
    });

    await page.goto(`/buddies/${groupId}`);
    await expect(page.getByRole('heading', { name: 'Big Group' })).toBeVisible({ timeout: 15000 });

    // Assert: "5 members" text visible
    await expect(page.getByText('5 members')).toBeVisible({ timeout: 10000 });

    await captureScreen(page, testInfo, 'group-member-count');
  });

  test('@p2 BUD-P2-7: Session with spotsTotal 0 renders without capacity error', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // Seed session with spotsTotal: 0 (could represent unlimited)
    const seed = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Unlimited Spots Session',
      spotsTotal: 0,
      status: 'proposed',
      sessionOverrides: { spotsConfirmed: 0, minPlayers: 0 },
    });

    await page.goto(`/session/${seed.sessionId}`);
    await expect(page.getByText('Unlimited Spots Session')).toBeVisible({ timeout: 15000 });

    // Assert: Page renders without crashing — session details visible
    await expect(page.getByText('Test Courts')).toBeVisible({ timeout: 5000 });

    // Assert: RSVP buttons are still available (session is active)
    await expect(page.getByText('Your RSVP')).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'unlimited-spots-session');
  });
});
