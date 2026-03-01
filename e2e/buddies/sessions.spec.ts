import { test, expect } from '@playwright/test';
import {
  signInAsTestUser,
  seedFirestoreDocAdmin,
} from '../helpers/emulator-auth';
import { makeGameSession } from '../helpers/factories';
import { BuddiesPage } from '../pages/BuddiesPage';
import { randomUUID } from 'crypto';

test.describe('Session RSVP Journey', () => {
  const testEmail = () => `session-${randomUUID().slice(0, 8)}@test.com`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { email: testEmail() });
  });

  test('create session from group and RSVP', async ({ page }) => {
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

  test('RSVP to a seeded session', async ({ page }) => {
    const sessionId = `e2e-rsvp-${randomUUID().slice(0, 8)}`;
    await seedFirestoreDocAdmin('gameSessions', sessionId, makeGameSession({
      id: sessionId,
      createdBy: 'other-user',
      title: 'Evening Pickup',
      location: 'Park Courts',
      courtsAvailable: 1,
      spotsTotal: 4,
      spotsConfirmed: 1,
      visibility: 'open',
      shareCode: `RSVP${randomUUID().slice(0, 4).toUpperCase()}`,
      rsvpStyle: 'simple',
    }));

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
