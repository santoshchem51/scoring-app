// e2e/journeys/visual-qa/tournament-visual.spec.ts
// Visual QA screenshots for all tournament-related screens (~26 captures)
import { test, expect } from '../../fixtures';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName, VIEWPORTS,
  type Theme, type DisplayMode,
} from '../../helpers/visual-qa';
import {
  seedRegistrationTournament,
  seedPoolPlayTournament,
  seedBracketTournament,
  seedCompletedTournament,
  seedScorekeeperTournament,
} from '../../helpers/seeders';

// ── Display mode pairs ────────────────────────────────────────────────
const DISPLAY_MODES: Array<[Theme, DisplayMode]> = [
  ['court-vision-gold', 'dark'],
  ['court-vision-gold', 'outdoor'],
];

// =====================================================================
// 1  TOURNAMENT CREATE FORM
// =====================================================================
test.describe('Tournament create', () => {

  // ── 1. Full create form — gold-dark, 393 + 375 ────────────────────
  test('1 · full create form — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/tournaments/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Create Tournament' })).toBeVisible({ timeout: 15000 });

    // 393 viewport
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'create', 'full-form', '393', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    // 375 viewport
    await page.setViewportSize(VIEWPORTS.portrait375);
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'create', 'full-form', '375', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    await page.setViewportSize(VIEWPORTS.portrait393);
  });
});

// =====================================================================
// 2–6  TOURNAMENT HUB BY PHASE
// =====================================================================
test.describe('Tournament hub by phase', () => {

  // ── 2. Setup phase (organizer view) — gold-dark only, 393 ─────────
  test('2 · setup phase organizer — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedRegistrationTournament(testUserUid, {
      tournamentOverrides: { status: 'setup' },
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Setup')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'hub', 'setup-organizer', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 3. Registration phase — gold-dark + gold-outdoor, 393 ─────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`3 · registration phase — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedRegistrationTournament(testUserUid, {
        teamCount: 3,
        teamNames: ['Alpha', 'Bravo', 'Charlie'],
      });

      await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Registration')).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'hub', 'registration', '393', theme, mode,
      ));
    });
  }

  // ── 4. Pool-play phase — gold-dark + gold-outdoor, 393 ────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`4 · pool-play phase — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedPoolPlayTournament(testUserUid, {
        teamCount: 4,
        teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      });

      await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'hub', 'pool-play', '393', theme, mode,
      ));
    });
  }

  // ── 5. Bracket phase — gold-dark + gold-outdoor, 393 ──────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`5 · bracket phase — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedBracketTournament(testUserUid, {
        teamCount: 4,
        teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      });

      await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Bracket Play')).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'hub', 'bracket', '393', theme, mode,
      ));
    });
  }

  // ── 6. Completed + results — gold-dark + gold-outdoor, 393 ────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`6 · completed results — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedCompletedTournament(testUserUid);

      await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Completed')).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'hub', 'completed', '393', theme, mode,
      ));
    });
  }
});

// =====================================================================
// 7–9  POOL / BRACKET DETAIL
// =====================================================================
test.describe('Pool and bracket detail', () => {

  // ── 7. Pool table with standings — gold-dark, 393 + 375 ───────────
  test('7 · pool table with standings — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedPoolPlayTournament(testUserUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });

    // 393 viewport
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'pool', 'standings', '393', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    // 375 viewport
    await page.setViewportSize(VIEWPORTS.portrait375);
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'pool', 'standings', '375', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    await page.setViewportSize(VIEWPORTS.portrait393);
  });

  // ── 8. Bracket in progress — gold-dark, 393 + 375 ─────────────────
  test('8 · bracket in progress — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedBracketTournament(testUserUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // 393 viewport
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'bracket', 'in-progress', '393', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    // 375 viewport
    await page.setViewportSize(VIEWPORTS.portrait375);
    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'bracket', 'in-progress', '375', 'court-vision-gold', 'dark',
    ), { fullPage: true });

    await page.setViewportSize(VIEWPORTS.portrait393);
  });

  // ── 9. Bracket completed (winner) — gold-dark, 393 ────────────────
  test('9 · bracket completed winner — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedCompletedTournament(testUserUid);

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Completed')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'bracket', 'completed-winner', '393', 'court-vision-gold', 'dark',
    ), { fullPage: true });
  });
});

// =====================================================================
// 10–12  DISCOVER PAGE
// =====================================================================
test.describe('Discover page', () => {

  // ── 10. Browse tab — gold-dark + gold-outdoor, 393 ────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`10 · browse tab — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      // Seed a public tournament so the browse tab has content
      await seedRegistrationTournament(testUserUid, {
        teamCount: 2,
        tournamentOverrides: { listed: true, visibility: 'public' },
      });

      await page.goto('/tournaments', { waitUntil: 'domcontentloaded' });
      // Wait for the Browse tab or tab list to be visible
      await expect(page.getByRole('tab', { name: 'Browse' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Browse' }).click();

      // Wait for content to load
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'discover', 'browse', '393', theme, mode,
      ));
    });
  }

  // ── 11. My tournaments tab — gold-dark only, 393 ──────────────────
  test('11 · my tournaments tab — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Seed a tournament the user organizes
    await seedRegistrationTournament(testUserUid, {
      teamCount: 2,
      tournamentOverrides: { listed: true, visibility: 'public' },
    });

    await page.goto('/tournaments', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'My Tournaments' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('tab', { name: 'My Tournaments' }).click();

    // Wait for content to load
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'discover', 'my-tournaments', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 12. Empty state — gold-dark only, 393 ─────────────────────────
  test('12 · empty state — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/tournaments', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Browse' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('tab', { name: 'Browse' }).click();

    // Wait for empty state to appear
    await page.waitForTimeout(3000);

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'discover', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 13–15  MODALS
// =====================================================================
test.describe('Modals', () => {

  // ── 13. ShareTournamentModal — gold-dark, 393 ─────────────────────
  test('13 · share tournament modal — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedRegistrationTournament(testUserUid, {
      teamCount: 2,
      teamNames: ['Alpha', 'Bravo'],
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Registration')).toBeVisible({ timeout: 15000 });

    // Click the Share button to open modal
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByText('Share Tournament')).toBeVisible({ timeout: 5000 });

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'modal', 'share', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 14. SaveTemplateModal — gold-dark, 393 ────────────────────────
  test('14 · save template modal — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Need a tournament in registration phase (Save as Template button is shown)
    const seed = await seedRegistrationTournament(testUserUid, {
      teamCount: 2,
      teamNames: ['Alpha', 'Bravo'],
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Registration')).toBeVisible({ timeout: 15000 });

    // Click "Save as Template" button
    await page.getByRole('button', { name: 'Save as Template' }).click();
    await expect(page.getByText('Save as Template').nth(1)).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, screenshotName(
      'tournament', 'modal', 'save-template', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 15. ScoreEditModal — gold-dark, 393 ───────────────────────────
  // Note: ScoreEditModal requires a completed match to edit. This needs a pool-play
  // tournament with a completed match, then clicking the edit button on that match.
  // If the edit button is not accessible in the seeded state, this test will be skipped.
  test('15 · score edit modal — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedPoolPlayTournament(testUserUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      withCompletedMatch: true,
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });

    // Look for an Edit button in the pool table — if the match has been completed
    // and the user is organizer (moderator+), Edit should be visible
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    const editVisible = await editButton.isVisible().catch(() => false);

    if (editVisible) {
      await editButton.click();
      await page.waitForTimeout(1000);
      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'modal', 'score-edit', '393', 'court-vision-gold', 'dark',
      ));
    } else {
      // ScoreEditModal not triggerable — attach a note screenshot instead
      testInfo.annotations.push({ type: 'skip', description: 'ScoreEditModal not triggerable — no completed match with edit button in seeded state' });
      await captureScreen(page, testInfo, screenshotName(
        'tournament', 'modal', 'score-edit-skipped', '393', 'court-vision-gold', 'dark',
      ));
    }
  });
});
