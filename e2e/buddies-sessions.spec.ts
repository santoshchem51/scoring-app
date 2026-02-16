import { test, expect } from '@playwright/test';
import {
  signInAsTestUser,
  clearEmulators,
  seedFirestoreDocAdmin,
} from './helpers/emulator-auth';

test.describe('Session RSVP Journey', () => {
  test.beforeAll(async () => {
    await clearEmulators();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await signInAsTestUser(page, { email: 'session-test@test.com' });
  });

  test('create session from group and RSVP', async ({ page }) => {
    // First create a group via the UI
    await page.goto('/buddies/new');
    await expect(
      page.getByRole('button', { name: 'Create Group' }),
    ).toBeVisible({ timeout: 10000 });

    await page.locator('#group-name').fill('Session Test Group');
    await page.locator('#group-location').fill('Test Courts');
    await page.getByRole('button', { name: 'Create Group' }).click();

    // Wait for redirect to group detail
    await page.waitForURL(/\/buddies\//, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Session Test Group' }),
    ).toBeVisible({ timeout: 10000 });

    // Click the "New Session" floating action button (exact name match)
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

  test('RSVP to a seeded session', async ({ page }) => {
    // Seed a session via admin API (bypasses security rules)
    const sessionId = 'e2e-rsvp-session';
    await seedFirestoreDocAdmin('gameSessions', sessionId, {
      id: sessionId,
      createdBy: 'other-user',
      groupId: null,
      title: 'Evening Pickup',
      scheduledDate: Date.now() + 86400000,
      location: 'Park Courts',
      courtsAvailable: 1,
      spotsTotal: 4,
      spotsConfirmed: 1,
      minPlayers: 4,
      status: 'proposed',
      visibility: 'open',
      shareCode: 'RSVPTEST',
      rsvpDeadline: null,
      confirmedSlot: null,
      timeSlots: [],
      rsvpStyle: 'simple',
      autoOpenOnDropout: false,
      schedulingMode: 'fixed',
      votingDeadline: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
