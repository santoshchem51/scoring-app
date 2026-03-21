// e2e/journeys/visual-qa/accessibility-visual.spec.ts
// Visual QA screenshots for focus indicators and accessibility states (~11 captures)
import { test as baseTest } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName,
  type Theme, type DisplayMode,
} from '../../helpers/visual-qa';
import {
  seedSpectatorMatch,
  seedPoolPlayTournament,
  seedSessionWithRsvps,
} from '../../helpers/seeders';

// =====================================================================
// 1–3  SCOREBOARD FOCUS RINGS (score button, 3 themes in dark)
// =====================================================================
test.describe('Scoreboard focus rings', () => {

  const THEMES: Array<[Theme, DisplayMode, string]> = [
    ['court-vision-gold', 'dark', 'gold'],
    ['classic', 'dark', 'classic'],
    ['ember', 'dark', 'ember'],
  ];

  for (const [theme, mode, label] of THEMES) {
    test(`1-3 · focus ring on score button — ${label}-dark`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.selectRallyScoring();
      await setup.startGame();

      const scoring = new ScoringPage(page);
      await scoring.expectOnScoringScreen();
      await scoring.scorePoint('Team 1');

      // Tab to focus interactive elements on the scoreboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      await captureScreen(page, testInfo, screenshotName(
        'accessibility', 'scoreboard', 'focus-ring', '393', label, 'dark',
      ));
    });
  }
});

// =====================================================================
// 4  GAME SETUP FOCUS RING (start button, gold-dark)
// =====================================================================
test.describe('Game setup focus ring', () => {

  test('4 · focus ring on start button — gold-dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expectSetupVisible();

    // Tab through the form to reach the Start Game button
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'game-setup', 'focus-ring-start', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 5  TOURNAMENT HUB FOCUS RING (tab/control, gold-dark)
// =====================================================================
test.describe('Tournament hub focus ring', () => {

  test('5 · focus ring on tab control — gold-dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedPoolPlayTournament(testUserUid, {
      tournamentOverrides: { visibility: 'public' },
    });

    await page.goto(`/tournaments/${seed.tournamentId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Tab to focus on a tab or control
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'tournament-hub', 'focus-ring-tab', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 6  BOTTOM NAV FOCUS RING (nav item, gold-dark)
// =====================================================================
test.describe('Bottom nav focus ring', () => {

  test('6 · focus ring on nav item — gold-dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 15000 });

    // Tab enough times to reach the bottom nav items
    // Use Shift+Tab from the top to find nav, or just Tab forward
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'bottom-nav', 'focus-ring', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 7  SETTINGS FOCUS RING (toggle/button, gold-dark)
// =====================================================================
test.describe('Settings focus ring', () => {

  test('7 · focus ring on toggle/button — gold-dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectAllSections();

    // Tab to focus on a toggle or button in settings
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'settings', 'focus-ring', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 8  MODAL FOCUS RING (confirm button, gold-dark)
// =====================================================================
test.describe('Modal focus ring', () => {

  test('8 · focus ring on confirm button — gold-dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Start a game and score to make it in-progress
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    await scoring.scorePoint('Team 1');

    // Navigate away via bottom nav to trigger the ConfirmDialog
    await page.locator('nav[aria-label="Main navigation"]').getByLabel('Match History').click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10000 });

    // Tab within the dialog to focus the confirm button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'modal', 'focus-ring-confirm', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 9  LANDING PAGE FOCUS RING (CTA button, gold-dark, unauthenticated)
// =====================================================================
test.describe('Landing page focus ring', () => {

  baseTest('9 · focus ring on CTA button — gold-dark', async ({ page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Score.')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Tab to reach the CTA button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'landing', 'focus-ring-cta', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 10  SESSION RSVP FOCUS RING (RSVP button, gold-dark)
// =====================================================================
test.describe('Session RSVP focus ring', () => {

  test('10 · focus ring on RSVP button — gold-dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Compute next Saturday so title matches the displayed date
    const now = new Date();
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    const nextSaturday = new Date(now);
    nextSaturday.setDate(now.getDate() + daysUntilSaturday);
    nextSaturday.setHours(9, 0, 0, 0);

    const sessionSeed = await seedSessionWithRsvps(testUserUid, {
      rsvpCount: 4,
      sessionOverrides: {
        title: 'Saturday Morning Play',
        location: 'Central Park Courts',
        spotsTotal: 8,
        scheduledDate: nextSaturday.getTime(),
      },
    });

    await page.goto(`/session/${sessionSeed.sessionId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Tab to reach the RSVP button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'session-rsvp', 'focus-ring', '393', 'gold', 'dark',
    ));
  });
});

// =====================================================================
// 11  COLOR ACCESSIBILITY — similar team colors (gold-dark)
// =====================================================================
test.describe('Color accessibility', () => {

  test('11 · scoreboard with similar team colors — gold-dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectRallyScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    // Score some points so both scores are visible
    await scoring.scorePoints('Team 1', 5);
    await scoring.scorePoints('Team 2', 4);

    await captureScreen(page, testInfo, screenshotName(
      'accessibility', 'scoreboard', 'similar-team-colors', '393', 'gold', 'dark',
    ));
  });
});
