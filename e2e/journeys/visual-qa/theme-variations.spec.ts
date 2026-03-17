// e2e/journeys/visual-qa/theme-variations.spec.ts
// Visual QA screenshots: 10 key screens re-captured in Classic and Ember themes (dark mode only)
// Total: ~20 captures (10 screens x 2 themes)
import { test as baseTest } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName,
  type Theme,
} from '../../helpers/visual-qa';
import {
  seedBetweenGamesMatch,
  seedCompletedMatch,
  seedPoolPlayTournament,
  seedProfileWithHistory,
} from '../../helpers/seeders';

// ── Alternate themes (dark mode only) ────────────────────────────────
const ALT_THEMES: Array<[Theme, 'dark']> = [
  ['classic', 'dark'],
  ['ember', 'dark'],
];

// =====================================================================
// 1  SCOREBOARD MIDGAME
// =====================================================================
test.describe('Theme Variations', () => {

  for (const [theme, mode] of ALT_THEMES) {
    test(`1 · scoreboard midgame — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectDoubles();
      await setup.selectSideoutScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 5);
      await scoring.triggerSideOut();
      await scoring.expectTeam2Enabled();
      await scoring.scorePoints('Team 2', 3);

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'scoreboard', 'midgame', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 2  BETWEEN-GAMES OVERLAY
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`2 · between-games overlay — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
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

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'between-games', 'overlay', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 3  MATCH-OVER
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`3 · match-over — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoints('Team 1', 11);
      await scoring.expectMatchOver();

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'match-over', 'winner', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 4  GAME SETUP FORM
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`4 · game setup form — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.expectSetupVisible();

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'game-setup', 'full-form', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 5  TOURNAMENT HUB (POOL-PLAY)
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`5 · tournament hub pool-play — ${theme}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedPoolPlayTournament(testUserUid);
      await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Pool A' })).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'tournament-hub', 'pool-play', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 6  SETTINGS PAGE
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`6 · settings page — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Settings')).toBeVisible({ timeout: 15000 });

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'settings', 'full', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 7  PROFILE
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`7 · profile — ${theme}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      await seedProfileWithHistory(testUserUid);
      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'profile', 'with-history', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 9  LEADERBOARD / PLAYERS
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`9 · leaderboard — ${theme}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      await page.goto('/players', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Capture whatever state renders — empty state still validates theme colors
      await captureScreen(page, testInfo, screenshotName(
        'themes', 'leaderboard', 'players', '393', theme, mode,
      ));
    });
  }

  // =====================================================================
  // 10  PUBLIC TOURNAMENT
  // =====================================================================
  for (const [theme, mode] of ALT_THEMES) {
    test(`10 · public tournament — ${theme}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedPoolPlayTournament(testUserUid);
      await page.goto(`/t/${seed.shareCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'themes', 'public-tournament', 'spectator', '393', theme, mode,
      ));
    });
  }
});

// =====================================================================
// 8  LANDING PAGE HERO (unauthenticated — uses baseTest)
// =====================================================================
for (const [theme, mode] of ALT_THEMES) {
  baseTest(`8 · landing page hero — ${theme}`, async ({ page }, testInfo) => {
    await setTheme(page, theme, mode);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for hero content to render
    await expect(page.getByText('Score.')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'themes', 'landing', 'hero', '393', theme, mode,
    ));
  });
}
