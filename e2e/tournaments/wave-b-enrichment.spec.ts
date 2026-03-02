// e2e/tournaments/wave-b-enrichment.spec.ts
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeStatsSummary } from '../helpers/factories';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../helpers/emulator-config';
import { randomUUID } from 'crypto';

// ── Helpers ────────────────────────────────────────────────────────

/** Select an option inside a specific fieldset (scoped by legend text). */
async function selectInFieldset(
  page: import('@playwright/test').Page,
  legendText: string,
  buttonLabel: string | RegExp,
) {
  const fieldset = page.locator('fieldset', {
    has: page.locator('legend', { hasText: legendText }),
  });
  await fieldset.getByRole('button', { name: buttonLabel }).click();
}

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Wave B Enrichment Features', () => {

  // ── 1. Default Skill Level dropdown saves to Firestore ────────────

  test('Default Skill Level dropdown visible with correct default and saves to Firestore', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/tournaments/new');
    await expect(page.locator('#t-name')).toBeVisible({ timeout: 15000 });

    // Verify the "Default Skill Level" fieldset is visible
    const skillFieldset = page.locator('fieldset', {
      has: page.locator('legend', { hasText: 'Default Skill Level' }),
    });
    await expect(skillFieldset).toBeVisible();

    // Verify helper text is visible
    await expect(
      page.getByText('Used for rating players without match history'),
    ).toBeVisible();

    // Verify all 4 tier options are visible
    await expect(skillFieldset.getByRole('button', { name: 'Beginner' })).toBeVisible();
    await expect(skillFieldset.getByRole('button', { name: 'Intermediate' })).toBeVisible();
    await expect(skillFieldset.getByRole('button', { name: 'Advanced' })).toBeVisible();
    await expect(skillFieldset.getByRole('button', { name: 'Expert' })).toBeVisible();

    // Verify "Beginner" is selected by default (aria-pressed="true")
    await expect(
      skillFieldset.getByRole('button', { name: 'Beginner' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Verify others are not selected
    await expect(
      skillFieldset.getByRole('button', { name: 'Advanced' }),
    ).toHaveAttribute('aria-pressed', 'false');

    // Click "Advanced" to change the selection
    await selectInFieldset(page, 'Default Skill Level', 'Advanced');

    // Verify "Advanced" is now selected
    await expect(
      skillFieldset.getByRole('button', { name: 'Advanced' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Verify "Beginner" is no longer selected
    await expect(
      skillFieldset.getByRole('button', { name: 'Beginner' }),
    ).toHaveAttribute('aria-pressed', 'false');

    // Fill required fields
    const tournamentName = `WaveB Tier Test ${randomUUID().slice(0, 8)}`;
    await page.locator('#t-name').fill(tournamentName);
    const tomorrow = new Date(Date.now() + 86400000);
    await page.locator('#t-date').fill(tomorrow.toISOString().split('T')[0]);
    await page.locator('#t-location').fill('Test Courts');

    // Submit the form
    await page.getByRole('button', { name: 'Create Tournament' }).click();

    // Wait for navigation to tournament dashboard
    await expect(page).toHaveURL(/\/tournaments\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByText(tournamentName)).toBeVisible({ timeout: 10000 });

    // Extract tournament ID from URL
    const url = page.url();
    const tournamentId = url.split('/tournaments/')[1].split(/[?#]/)[0];
    expect(tournamentId).toBeTruthy();

    // Read the created tournament from Firestore emulator REST API
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/tournaments/${tournamentId}`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const doc = await response.json();

      // Extract defaultTier from the nested Firestore REST format:
      // config is a mapValue with fields including defaultTier as a stringValue
      const configFields = doc.fields?.config?.mapValue?.fields;
      expect(configFields).toBeTruthy();
      expect(configFields.defaultTier?.stringValue).toBe('advanced');
    }).toPass({ timeout: 15000 });
  });

  // ── 2. Cross-user public tier readability ─────────────────────────

  test('authenticated user can read another user\'s public tier doc', async ({
    authenticatedPage: page,
  }) => {
    // Seed a public tier doc for a fake "user A" (via admin bypass)
    const userAUid = `user-a-${randomUUID().slice(0, 8)}`;

    await seedFirestoreDocAdmin(`users/${userAUid}/public`, 'tier', {
      tier: 'advanced',
    });

    // The authenticated page is signed in as a different user (user B).
    // Verify user B can read user A's public tier doc via the in-browser Firestore SDK.
    const tierData = await page.evaluate(async (uid: string) => {
      const { firestore } = (window as any).__TEST_FIREBASE__;
      const { doc, getDoc } = (window as any).__TEST_FIREBASE_FIRESTORE__;
      const tierSnap = await getDoc(doc(firestore, 'users', uid, 'public', 'tier'));
      return tierSnap.exists() ? tierSnap.data() : null;
    }, userAUid);

    expect(tierData).not.toBeNull();
    expect(tierData.tier).toBe('advanced');
  });

  // ── 3. Stats summary is owner-only (permission denied for others) ─

  test('authenticated user cannot read another user\'s stats summary (owner-only)', async ({
    authenticatedPage: page,
  }) => {
    // Seed a stats/summary doc for a fake "user A" (via admin bypass)
    const userAUid = `user-a-${randomUUID().slice(0, 8)}`;

    await seedFirestoreDocAdmin(`users/${userAUid}/stats`, 'summary', makeStatsSummary({
      tier: 'advanced',
    }));

    // The authenticated page is signed in as a different user (user B).
    // Attempt to read user A's stats/summary — should throw permission denied.
    const result = await page.evaluate(async (uid: string) => {
      const { firestore } = (window as any).__TEST_FIREBASE__;
      const { doc, getDoc } = (window as any).__TEST_FIREBASE_FIRESTORE__;
      try {
        await getDoc(doc(firestore, 'users', uid, 'stats', 'summary'));
        return { success: true, error: null };
      } catch (e: any) {
        return { success: false, error: e.code || e.message };
      }
    }, userAUid);

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission-denied');
  });
});
