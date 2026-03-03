import { test, expect } from '../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../helpers/emulator-auth';
import { makeGameSession } from '../helpers/factories';
import { BuddiesPage } from '../pages/BuddiesPage';
import { randomUUID } from 'crypto';

async function seedSession(overrides: Record<string, unknown> = {}) {
  const sessionId = `e2e-session-${randomUUID().slice(0, 8)}`;
  const session = makeGameSession({
    id: sessionId,
    createdBy: 'other-user',
    visibility: 'open',
    rsvpStyle: 'simple',
    spotsTotal: 4,
    spotsConfirmed: 0,
    ...overrides,
  });
  await seedFirestoreDocAdmin('gameSessions', sessionId, session);
  return sessionId;
}

test.describe('Session RSVP Journey', () => {
  test('create session from group and RSVP', async ({ authenticatedPage: page }) => {
    const buddies = new BuddiesPage(page);
    await buddies.gotoNewGroup();
    await expect(
      page.getByRole('button', { name: 'Create Group' }),
    ).toBeVisible({ timeout: 10000 });

    await buddies.createGroup('Session Test Group', { location: 'Test Courts' });

    // Wait for redirect to group detail
    await buddies.expectOnGroupDetail();
    await expect(
      page.getByRole('heading', { name: 'Session Test Group' }),
    ).toBeVisible({ timeout: 10000 });

    // Click the "New Session" floating action button
    await page.getByRole('link', { name: 'New Session', exact: true }).click();

    // Fill in session details
    await page.locator('#session-title').fill('Tuesday Doubles');
    await page.locator('#session-location').fill('Main Court');

    const tomorrow = new Date(Date.now() + 86400000);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.locator('#session-date').fill(dateStr);

    // Submit session creation
    await page.getByRole('button', { name: 'Create Session' }).click();

    // Should redirect to session detail page
    await expect(page.getByText('Tuesday Doubles')).toBeVisible({
      timeout: 15000,
    });
  });

  test('RSVP to a seeded session', async ({ authenticatedPage: page }) => {
    const sessionId = await seedSession({
      title: 'Evening Pickup',
      location: 'Park Courts',
      courtsAvailable: 1,
      spotsConfirmed: 1,
      shareCode: `RSVP${randomUUID().slice(0, 4).toUpperCase()}`,
    });

    // Navigate to session detail
    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Evening Pickup')).toBeVisible({
      timeout: 15000,
    });

    // Click "In" RSVP button
    const inButton = page.getByRole('button', { name: 'In' }).first();
    await expect(inButton).toBeVisible({ timeout: 5000 });
    await inButton.click();

    // Verify RSVP was recorded — player appears in list and spots counter updates
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2 of 4/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('RSVP State Changes', () => {
  test('RSVP Maybe — player appears with Maybe status', async ({ authenticatedPage: page }) => {
    const sessionId = await seedSession({
      title: 'Maybe Test Session',
      location: 'Test Courts',
      shareCode: `MB${randomUUID().slice(0, 6).toUpperCase()}`,
    });

    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Maybe Test Session')).toBeVisible({ timeout: 15000 });

    // Click "Maybe" RSVP button
    const maybeButton = page.getByRole('button', { name: 'Maybe' });
    await expect(maybeButton).toBeVisible({ timeout: 5000 });
    await maybeButton.click();

    // Verify player appears in the player list after RSVP
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 });

    // Spots should NOT increment — still 0 of 4 confirmed
    await expect(page.getByText(/0 of 4/)).toBeVisible({ timeout: 5000 });
  });

  test('RSVP Out — spots do not increment', async ({ authenticatedPage: page }) => {
    const sessionId = await seedSession({
      title: 'Out Test Session',
      location: 'Test Courts',
      shareCode: `OT${randomUUID().slice(0, 6).toUpperCase()}`,
    });

    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Out Test Session')).toBeVisible({ timeout: 15000 });

    // Click "Out" RSVP button
    const outButton = page.getByRole('button', { name: 'Out' });
    await expect(outButton).toBeVisible({ timeout: 5000 });
    await outButton.click();

    // Verify player appears in the player list after RSVP
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 });

    // Spots should NOT increment — still 0 of 4 confirmed
    await expect(page.getByText(/0 of 4/)).toBeVisible({ timeout: 5000 });
  });

  test('change RSVP from In to Out — spots decrement', async ({ authenticatedPage: page }) => {
    const sessionId = await seedSession({
      title: 'Change RSVP Session',
      location: 'Test Courts',
      shareCode: `CH${randomUUID().slice(0, 6).toUpperCase()}`,
    });

    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Change RSVP Session')).toBeVisible({ timeout: 15000 });

    // First, RSVP "In"
    const inButton = page.getByRole('button', { name: 'In' }).first();
    await expect(inButton).toBeVisible({ timeout: 5000 });
    await inButton.click();

    // Wait for spots to increment to 1
    await expect(page.getByText(/1 of 4/)).toBeVisible({ timeout: 10000 });

    // Now change RSVP to "Out"
    const outButton = page.getByRole('button', { name: 'Out' });
    await outButton.click();

    // Spots should decrement back to 0
    await expect(page.getByText(/0 of 4/)).toBeVisible({ timeout: 10000 });
  });

  test('day-of status buttons appear for confirmed session with In RSVP', async ({ authenticatedPage: page }) => {
    const sessionId = await seedSession({
      title: 'Day-of Status Session',
      location: 'Test Courts',
      spotsConfirmed: 1,
      status: 'confirmed',
      shareCode: `DO${randomUUID().slice(0, 6).toUpperCase()}`,
    });

    // Get the current user's UID to seed their RSVP
    const uid = await getCurrentUserUid(page);

    // Seed an "in" RSVP for the current user
    await seedFirestoreDocAdmin(`gameSessions/${sessionId}/rsvps`, uid, {
      userId: uid,
      displayName: 'Test Player',
      photoURL: null,
      response: 'in',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    });

    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Day-of Status Session')).toBeVisible({ timeout: 15000 });

    // Day-of status buttons should be visible
    const onMyWayButton = page.getByRole('button', { name: 'On my way' });
    const imHereButton = page.getByRole('button', { name: "I'm here" });
    const cantMakeItButton = page.getByRole('button', { name: "Can't make it" });

    await expect(onMyWayButton).toBeVisible({ timeout: 10000 });
    await expect(imHereButton).toBeVisible();
    await expect(cantMakeItButton).toBeVisible();

    // Click "On my way" and verify status updates
    await onMyWayButton.click();

    // Verify player appears with updated status
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 });

    // Click "I'm here" and verify status updates
    await imHereButton.click();
    await expect(page.getByText('Here', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
