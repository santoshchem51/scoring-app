// e2e/integration/auth-data-continuity.spec.ts
import { test, expect } from '../fixtures';
import { signInAsTestUser, signOut } from '../helpers/emulator-auth';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';
import { NavigationBar } from '../pages/NavigationBar';
import { randomUUID } from 'crypto';

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Auth -> Data Continuity Integration (Manual Plan 9.2)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. Matches created before login persist after login
  // ═══════════════════════════════════════════════════════════════════

  test('matches created before login persist after sign-in', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    // ── Step 1: Score a match while NOT logged in ──
    // (uses `page` directly, not `authenticatedPage`)

    await setup.goto();
    await setup.quickGame();

    // Score a full match: 11-0 for Team 1
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Team 1');
    await scoring.saveAndFinish();

    // ── Step 2: Verify match appears in history (stored in local Dexie/IndexedDB) ──

    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible({ timeout: 10000 });
    const matchCard = page.getByRole('article', { name: 'Team 1 vs Team 2' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });

    // ── Step 3: Sign in via emulator auth ──

    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;
    await signInAsTestUser(page, { email, displayName: 'Data Persist User' });

    // ── Step 4: Navigate to history and verify match is STILL there ──
    // Sign-in should NOT wipe local IndexedDB data

    await nav.goToHistory();
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible({ timeout: 15000 });

    // Verify the match details are intact (score should still show 11 and 0).
    // Use { exact: true } because '11' also matches 'Doubles . To 11' text.
    const card = page.getByRole('article', { name: 'Team 1 vs Team 2' });
    await expect(card.getByText('11', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(card.getByText('0', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Logging out and back in retains all data
  // ═══════════════════════════════════════════════════════════════════

  test('logging out and back in retains all match data', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    const email = `e2e-${randomUUID().slice(0, 8)}@test.com`;

    // ── Step 1: Sign in ──

    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Logout Test User' });

    // ── Step 2: Score a match while signed in ──

    await setup.goto();
    await setup.quickGame();

    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Team 1');
    await scoring.saveAndFinish();

    // Verify match appears in history
    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Sign out ──

    await signOut(page);

    // Verify signed-out state (auth currentUser is null)
    await page.waitForFunction(
      () => (window as any).__TEST_FIREBASE__?.auth?.currentUser === null,
      { timeout: 10000 },
    );

    // ── Step 4: Navigate to history — match should still be there (local data persists) ──

    await nav.goToHistory();
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible({ timeout: 15000 });

    // ── Step 5: Sign in again (same user) ──

    await signInAsTestUser(page, { email, displayName: 'Logout Test User' });

    // ── Step 6: Navigate to history — match should still be there ──

    await nav.goToHistory();
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible({ timeout: 15000 });

    // Verify match details are intact.
    // Use { exact: true } because '11' also matches 'Doubles . To 11' text.
    const card = page.getByRole('article', { name: 'Team 1 vs Team 2' });
    await expect(card.getByText('11', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(card.getByText('0', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
