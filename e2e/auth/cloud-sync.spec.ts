import { test, expect } from '../fixtures';
import { signInAsTestUser, getCurrentUserUid } from '../helpers/emulator-auth';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../helpers/emulator-config';
import { randomUUID } from 'crypto';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Cloud Sync (Manual Plan 6.2)', () => {
  test('user profile created in Firestore after sign-in', async ({ page }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Synced User' });

    // Get the authenticated user's UID from the page
    const uid = await getCurrentUserUid(page);
    expect(uid).toBeTruthy();

    // The initial cloudSync.syncUserProfile() runs via onAuthStateChanged, which
    // fires BEFORE updateProfile() completes in the emulator-auth helper.
    // So the first Firestore write has an empty displayName. After signInAsTestUser
    // returns, the displayName IS updated on the auth object. Reload the page to
    // trigger a fresh onAuthStateChanged with the correct displayName.
    await page.reload();
    await page.waitForFunction(
      () =>
        (window as any).__TEST_FIREBASE__ &&
        (window as any).__TEST_FIREBASE__?.auth?.currentUser !== null,
      { timeout: 10000 },
    );

    // Poll Firestore emulator until the profile document appears
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const doc = await response.json();
      expect(doc.fields?.displayName?.stringValue).toBe('Synced User');
      expect(doc.fields?.email?.stringValue).toBe(email);
    }).toPass({ timeout: 15000 });
  });

  test('sync errors do not crash the app', async ({ page }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Resilient User' });

    // Listen for dialog events (error alerts) — fail if any appear
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss();
    });

    // Navigate to game setup and start a match
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();

    // Score some points to trigger potential sync operations
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');

    // Verify the app is still functioning — scoring screen is responsive
    await scoring.expectOnScoringScreen();
    await scoring.expectScore('3-0-2');

    // No error dialogs should have appeared
    expect(dialogs).toHaveLength(0);
  });
});
