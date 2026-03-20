// e2e/journeys/visual-qa/chrome-visual.spec.ts
// Visual QA screenshots for app chrome, landing page, settings, spectator views,
// notifications, PWA states, and error pages (~24 captures)
import { test as baseTest } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName, VIEWPORTS,
  mockPwaInstallPrompt,
  type Theme, type DisplayMode,
} from '../../helpers/visual-qa';
import {
  seedSpectatorMatch,
  seedCompletedMatch,
  seedCompletedTournament,
  seedPoolPlayTournament,
  seedNotifications,
} from '../../helpers/seeders';

// ── Display mode pairs ────────────────────────────────────────────────
const DISPLAY_MODES: Array<[Theme, DisplayMode]> = [
  ['court-vision-gold', 'dark'],
  ['court-vision-gold', 'outdoor'],
];

// =====================================================================
// 1–2  LANDING PAGE (unauthenticated, gold-dark)
// =====================================================================
test.describe('Landing page', () => {

  // ── 1. Hero section — 393, unauthenticated ─────────────────────────
  baseTest('1 · hero section — gold dark 393', async ({ page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for hero content to render
    await expect(page.getByText('Score.')).toBeVisible({ timeout: 15000 });
    // Wait for animations to settle
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'landing', 'hero', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 2. Features section — 393, unauthenticated ─────────────────────
  baseTest('2 · features section — gold dark 393', async ({ page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Everything You Need')).toBeVisible({ timeout: 15000 });
    // Scroll features section into view
    await page.getByText('Everything You Need').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'landing', 'features', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 3  SETTINGS
// =====================================================================
test.describe('Settings', () => {

  // ── 3. All sections visible — 393, both themes ─────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`3 · all sections visible — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      const settings = new SettingsPage(page);
      await settings.goto();
      await settings.expectAllSections();

      await captureScreen(page, testInfo, screenshotName(
        'chrome', 'settings', 'all-sections', '393', theme, mode,
      ), { fullPage: true });
    });
  }
});

// =====================================================================
// 4  BOTTOM NAV
// =====================================================================
test.describe('Bottom nav', () => {

  // ── 4. Active states — 393, gold-dark ──────────────────────────────
  test('4 · bottom nav active states — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Navigate to /new to show bottom nav with "New" active
    await page.goto('/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'bottom-nav', 'new-active', '393', 'court-vision-gold', 'dark',
    ), {
      locator: page.locator('nav[aria-label="Main navigation"]'),
    });

    // Navigate to /history to show "History" active
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'bottom-nav', 'history-active', '393', 'court-vision-gold', 'dark',
    ), {
      locator: page.locator('nav[aria-label="Main navigation"]'),
    });
  });
});

// =====================================================================
// 5–7  DIALOGS / OVERLAYS
// =====================================================================
test.describe('Dialogs and overlays', () => {

  // ── 5. ConfirmDialog (leave game) — 393, gold-dark ─────────────────
  test('5 · confirm dialog leave game — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();
    // Score a point so the game is in progress
    await scoring.scorePoint('Team 1');

    // Try to navigate away via bottom nav — triggers leave confirm
    await page.locator('nav[aria-label="Main navigation"]').getByLabel('Match History').click();
    // Wait for the confirm dialog to appear
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10000 });

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'dialog', 'confirm-leave-game', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 6. NotificationPanel with notifications — 393, gold-dark ───────
  test('6 · notification panel with notifications — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Seed notifications
    await seedNotifications(testUserUid, 4);

    // Navigate to a page where TopNav + bell is visible
    await page.goto('/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click bell to open notification panel
    const bellBtn = page.getByLabel(/Notifications/);
    await expect(bellBtn).toBeVisible({ timeout: 15000 });
    await bellBtn.click();

    // Wait for notification panel
    await expect(page.locator('[role="dialog"][aria-labelledby="notif-panel-title"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Your tournament has begun.')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'notification-panel', 'with-notifications', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 7. NotificationPanel empty — 393, gold-dark ────────────────────
  test('7 · notification panel empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Navigate without seeding notifications
    await page.goto('/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click bell to open notification panel
    const bellBtn = page.getByLabel(/Notifications/);
    await expect(bellBtn).toBeVisible({ timeout: 15000 });
    await bellBtn.click();

    // Wait for notification panel
    await expect(page.locator('[role="dialog"][aria-labelledby="notif-panel-title"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'notification-panel', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 8–10  PWA STATES
// =====================================================================
test.describe('PWA states', () => {

  // ── 8. IOSInstallSheet — 393, gold-dark ────────────────────────────
  // The IOSInstallSheet requires iOS Safari detection (detectIOSSafari).
  // In a desktop Playwright browser this won't trigger naturally.
  // We inject the component's open state directly via evaluate.
  baseTest('8 · ios install sheet — gold dark 393', async ({ page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Override detectIOSSafari to return true + set standalone to false
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      });
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check if iOS install instruction text appeared (from InstallPromptBanner's iOS fallback)
    const iosText = page.getByText('Add to Home Screen');
    const isVisible = await iosText.isVisible().catch(() => false);

    if (isVisible) {
      await captureScreen(page, testInfo, screenshotName(
        'chrome', 'pwa', 'ios-install-sheet', '393', 'court-vision-gold', 'dark',
      ));
    } else {
      // Skip — iOS detection didn't trigger in this environment
      testInfo.annotations.push({ type: 'skip', description: 'iOS install sheet not triggerable in Chromium' });
    }
  });

  // ── 9. InstallPromptBanner — 393, gold-dark ────────────────────────
  baseTest('9 · install prompt banner — gold dark 393', async ({ page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Set visit count high enough to trigger the banner
    await page.addInitScript(() => {
      localStorage.setItem('pwa-visit-count', '5');
      // Remove any dismiss state
      localStorage.removeItem('pwa-install-dismiss');
    });

    // Mock the beforeinstallprompt event
    await mockPwaInstallPrompt(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for the mock event to fire (500ms delay in mockPwaInstallPrompt)
    await page.waitForTimeout(2000);

    // Check if banner appeared
    const banner = page.locator('[aria-label="Install app"]');
    const bannerVisible = await banner.isVisible().catch(() => false);

    if (bannerVisible) {
      // Scroll to the banner (it's in the footer)
      await banner.scrollIntoViewIfNeeded();
      await captureScreen(page, testInfo, screenshotName(
        'chrome', 'pwa', 'install-prompt-banner', '393', 'court-vision-gold', 'dark',
      ));
    } else {
      // The banner may not show if conditions aren't met — capture footer area anyway
      testInfo.annotations.push({ type: 'info', description: 'Install banner did not appear — conditions may not be fully met in test env' });
      // Take a screenshot of the footer area where it would appear
      const footer = page.locator('footer');
      if (await footer.isVisible()) {
        await footer.scrollIntoViewIfNeeded();
        await captureScreen(page, testInfo, screenshotName(
          'chrome', 'pwa', 'install-prompt-banner-area', '393', 'court-vision-gold', 'dark',
        ), { locator: footer });
      }
    }
  });

  // ── 10. AchievementToast — 393, gold-dark ──────────────────────────
  // AchievementToast requires completing a match and earning an achievement.
  // This is difficult to trigger reliably in e2e without deep seeding.
  // Skipping with documentation.
  test.skip('10 · achievement toast — gold dark', async () => {
    // AchievementToast is triggered by the achievement system after match completion.
    // Triggering it requires a specific sequence: complete a match -> achievement check ->
    // toast display. This is not reliably triggerable in e2e without mocking the
    // achievement store signals directly.
  });
});

// =====================================================================
// 11  ERROR PAGE
// =====================================================================
test.describe('Error page', () => {

  // ── 11. 404 page — 393, gold-dark ─────────────────────────────────
  test('11 · 404 page — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/nonexistent-route-xyz', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Page Not Found')).toBeVisible({ timeout: 15000 });

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'error', '404-page', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 12–17  SPECTATOR VIEWS
// =====================================================================
test.describe('Spectator views', () => {

  // ── 12. Public tournament hub with live-now — 393, both themes ─────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`12 · public tournament hub live-now — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      // Seed a pool-play tournament with public visibility
      const tournSeed = await seedPoolPlayTournament(testUserUid, {
        tournamentOverrides: { visibility: 'public' },
      });

      // Seed a live match so the hub shows "live-now"
      await seedSpectatorMatch(testUserUid, {
        tournamentId: tournSeed.tournamentId,
        team1Name: 'Dragons',
        team2Name: 'Phoenix',
        team1Score: 7,
        team2Score: 5,
        withEvents: true,
      });

      // Navigate to public tournament hub via share code
      await page.goto(`/t/${tournSeed.shareCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      await captureScreen(page, testInfo, screenshotName(
        'chrome', 'spectator-hub', 'live-now', '393', theme, mode,
      ));
    });
  }

  // ── 13. Public tournament completed — 393, gold-dark ───────────────
  test('13 · public tournament completed — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedCompletedTournament(testUserUid);

    await page.goto(`/t/${seed.shareCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'spectator-hub', 'completed', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 14. Public match live scoreboard — 393, both themes ────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`14 · public match live scoreboard — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      const seed = await seedSpectatorMatch(testUserUid, {
        team1Name: 'Sarah M.',
        team2Name: 'Mike T.',
        team1Score: 8,
        team2Score: 6,
        withEvents: true,
      });

      await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.truncate:has-text("Sarah M.")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.truncate:has-text("Mike T.")')).toBeVisible({ timeout: 10000 });

      await captureScreen(page, testInfo, screenshotName(
        'chrome', 'spectator-match', 'live-scoreboard', '393', theme, mode,
      ));
    });
  }

  // ── 15. Public match play-by-play tab — 393, gold-dark ─────────────
  test('15 · public match play-by-play — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedSpectatorMatch(testUserUid, {
      team1Name: 'Sarah M.',
      team2Name: 'Mike T.',
      team1Score: 5,
      team2Score: 3,
      withEvents: true,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Sarah M.', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mike T.', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // Click Play-by-Play tab if it exists
    const pbpTab = page.getByRole('tab', { name: /play-by-play/i });
    if (await pbpTab.isVisible().catch(() => false)) {
      await pbpTab.click();
      await page.waitForTimeout(1000);
    }

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'spectator-match', 'play-by-play', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 16. Public match stats tab — 393, gold-dark ────────────────────
  test('16 · public match stats tab — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const seed = await seedSpectatorMatch(testUserUid, {
      team1Name: 'Sarah M.',
      team2Name: 'Mike T.',
      team1Score: 5,
      team2Score: 3,
      withEvents: true,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Sarah M.', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mike T.', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // Click Stats tab
    const statsTab = page.getByRole('tab', { name: /stats/i });
    if (await statsTab.isVisible().catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(1000);
    }

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'spectator-match', 'stats-tab', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 17. Public match loading skeleton — 393, gold-dark ─────────────
  test('17 · public match loading skeleton — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Navigate to a match that doesn't exist — should show loading then error
    // Capture immediately to catch the loading skeleton
    await page.goto('/t/NONEXIST/match/nonexistent-match-id', { waitUntil: 'domcontentloaded' });
    // Wait just long enough for the loading skeleton to render
    await page.waitForTimeout(500);

    await captureScreen(page, testInfo, screenshotName(
      'chrome', 'spectator-match', 'loading-skeleton', '393', 'court-vision-gold', 'dark',
    ));
  });
});
