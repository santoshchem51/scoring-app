// e2e/journeys/visual-qa/scoring-visual.spec.ts
// Visual QA screenshots for all scoring-related screens (~34 captures)
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName, VIEWPORTS,
  type Theme, type DisplayMode,
} from '../../helpers/visual-qa';

// ── Display mode pairs ────────────────────────────────────────────────
const DISPLAY_MODES: Array<[Theme, DisplayMode]> = [
  ['court-vision-gold', 'dark'],
  ['court-vision-gold', 'outdoor'],
];

// ── Helpers ───────────────────────────────────────────────────────────
const SCOREBOARD_VISIBLE = '[aria-label="Scoreboard"]';
const waitForScoreboard = async (page: import('@playwright/test').Page) =>
  expect(page.locator(SCOREBOARD_VISIBLE)).toBeVisible({ timeout: 15000 });

// =====================================================================
// 1–9  SCOREBOARD STATES
// =====================================================================
test.describe('Scoreboard states', () => {

  // ── 1. Midgame, sideout doubles, team 1 serving ──────────────────
  // 393 + 375 + landscape in gold-dark; 393 in gold-outdoor
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`1 · midgame sideout doubles team1 serving — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectDoubles();
      await setup.selectSideoutScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      // Score a few points — team 1 is serving
      await scoring.scorePoint('Team 1');
      await scoring.scorePoint('Team 1');
      await scoring.scorePoint('Team 1');
      await scoring.expectTeamScore('Team 1', 3);

      // 393 viewport
      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'scoreboard', 'midgame-sideout-t1serving', '393', theme, mode,
      ));

      if (mode === 'dark') {
        // 375 viewport
        await page.setViewportSize(VIEWPORTS.portrait375);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'scoreboard', 'midgame-sideout-t1serving', '375', theme, mode,
        ));

        // landscape viewport
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'scoreboard', 'midgame-sideout-t1serving', 'landscape', theme, mode,
        ));

        // reset
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // ── 2. Midgame, team 2 serving ───────────────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`2 · midgame team2 serving — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectDoubles();
      await setup.selectSideoutScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();

      // Side out to team 2 so they serve
      await scoring.triggerSideOut();
      await scoring.expectTeam2Enabled();
      await scoring.scorePoint('Team 2');
      await scoring.scorePoint('Team 2');

      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'scoreboard', 'midgame-t2serving', '393', theme, mode,
      ));
    });
  }

  // ── 3. Rally scoring (both buttons active) — gold-dark only ──────
  test('3 · rally scoring both active — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.scorePoints('Team 1', 4);
    await scoring.scorePoints('Team 2', 3);
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Enabled();

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'rally-both-active', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 4. Singles mode (no server number) — gold-dark only ──────────
  test('4 · singles sideout no server number — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectSingles();
    await setup.selectSideoutScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 1);

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'singles-sideout', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 5. Game point ────────────────────────────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`5 · game point — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 10);
      await scoring.scorePoints('Team 2', 8);
      await scoring.expectGamePoint();

      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'scoreboard', 'game-point', '393', theme, mode,
      ));
    });
  }

  // ── 6. Deuce — gold-dark only ────────────────────────────────────
  test('6 · deuce — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.scorePoints('Team 1', 10);
    await scoring.scorePoints('Team 2', 10);
    await scoring.expectScores(10, 10);

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'deuce', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 7. Score call (sideout doubles) — gold-dark only ─────────────
  test('7 · score call sideout doubles — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.expectScoreCall('0-0-2');
    await scoring.scorePoint('Team 1');
    await scoring.expectScoreCall('1-0-2');

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'score-call', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 8. Scorer team indicator — gold-dark only ────────────────────
  test('8 · scorer team indicator — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expandYourRole();
    await setup.selectImPlaying();
    await setup.selectScorerTeam(1);
    await setup.collapseYourRole();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.expectTeamIndicator('Team 1');

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'scorer-team-indicator', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 9. Multi-game series badge (between-games match) — gold-dark only
  test('9 · multi-game series badge — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    // Win game 1
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();
    await scoring.startNextGame();
    // Now in game 2 — should show series badge
    await scoring.expectGameNumber(2);

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'series-badge-game2', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 10–11  MATCH FLOW STATES
// =====================================================================
test.describe('Match flow states', () => {

  // ── 10. Between-games overlay ────────────────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`10 · between-games overlay — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.selectBestOf(3);
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 11);
      await scoring.expectBetweenGames();

      // 393 viewport
      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'between-games', 'overlay', '393', theme, mode,
      ));

      if (mode === 'dark') {
        // landscape
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'between-games', 'overlay', 'landscape', theme, mode,
        ));
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // ── 11. Match-over (winner announcement) ─────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`11 · match-over winner — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 11);
      await scoring.expectMatchOver();

      // 393 viewport
      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'match-over', 'winner', '393', theme, mode,
      ));

      if (mode === 'dark') {
        // landscape
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'match-over', 'winner', 'landscape', theme, mode,
        ));
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }
});

// =====================================================================
// 12–13  LOADING / ERROR STATES
// =====================================================================
test.describe('Loading and error states', () => {

  // ── 12. Loading state ────────────────────────────────────────────
  test('12 · loading state — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Navigate to a match URL that will show loading spinner before resolving
    // Use a seeded match so the page attempts to load it
    await page.goto('/score/loading-test-nonexistent', { waitUntil: 'domcontentloaded' });

    // Capture immediately while loading/error state renders
    // Wait briefly for the page to show something
    await page.waitForTimeout(1000);
    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'loading', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 13. Error state (match not found) ────────────────────────────
  test('13 · error match not found — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/score/nonexistent-match-id-99999', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Match not found')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'scoreboard', 'error-not-found', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 14–15  GAME SETUP
// =====================================================================
test.describe('Game setup', () => {

  // ── 14. Full form ────────────────────────────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`14 · full form — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.expectSetupVisible();

      // 393 viewport
      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'game-setup', 'full-form', '393', theme, mode,
      ));

      if (mode === 'dark') {
        // 375 viewport
        await page.setViewportSize(VIEWPORTS.portrait375);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'game-setup', 'full-form', '375', theme, mode,
        ));

        // landscape viewport
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo, screenshotName(
          'scoring', 'game-setup', 'full-form', 'landscape', theme, mode,
        ));

        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // ── 15a. Role expanded — gold-dark only ────────────────────────
  test('15a · role expanded — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expandYourRole();

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'game-setup', 'role-expanded', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 15b. Buddy picker — gold-dark only ───────────────────────────
  test('15b · buddy picker — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expandBuddyPicker();

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'game-setup', 'buddy-picker', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 15c. Full form scrolled (full page) — gold-dark only ─────────
  test('15c · full form scrolled — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.selectBestOf(3);
    await setup.fillTeamName(1, 'Dragons');
    await setup.fillTeamName(2, 'Phoenix');

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'game-setup', 'filled-form', '393', 'court-vision-gold', 'dark',
    ), { fullPage: true });
  });
});

// =====================================================================
// 16–17  MATCH HISTORY
// =====================================================================
test.describe('Match history', () => {

  // ── 16. With matches ─────────────────────────────────────────────
  // History reads from local Dexie (not Firestore), so we play a quick game first.
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`16 · history with matches — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      // Play a quick game to completion so it appears in history
      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 11);
      await scoring.expectMatchOver();
      await scoring.saveAndFinish();

      // Navigate to history
      await page.goto('/history', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'scoring', 'history', 'with-matches', '393', theme, mode,
      ));
    });
  }

  // ── 17. Empty state — gold-dark only ─────────────────────────────
  test('17 · history empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('No Matches Yet')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'scoring', 'history', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });
});
