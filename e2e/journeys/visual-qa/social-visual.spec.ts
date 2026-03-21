// e2e/journeys/visual-qa/social-visual.spec.ts
// Visual QA screenshots for all social/buddy/profile/player screens (~24 captures)
import { test, expect } from '../../fixtures';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme, screenshotName,
  type Theme, type DisplayMode,
} from '../../helpers/visual-qa';
import {
  seedBuddyGroupWithMember,
  seedGameSessionWithAccess,
  seedSessionWithRsvps,
  seedProfileWithHistory,
} from '../../helpers/seeders';

// ── Display mode pairs ────────────────────────────────────────────────
const DISPLAY_MODES: Array<[Theme, DisplayMode]> = [
  ['court-vision-gold', 'dark'],
  ['court-vision-gold', 'outdoor'],
];

// =====================================================================
// 1–13  BUDDIES
// =====================================================================
test.describe('Buddies', () => {

  // ── 1. Buddies list with groups — 393, both themes ────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`1 · buddies list with groups — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      // Seed a group so the list has content
      await seedBuddyGroupWithMember(testUserUid, {
        name: 'Pickle Pals',
        description: 'Weekly pickleball crew',
      });
      await seedBuddyGroupWithMember(testUserUid, {
        name: 'Court Crusaders',
        description: 'Tournament prep group',
      });

      await page.goto('/buddies', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'social', 'buddies-list', 'with-groups', '393', theme, mode,
      ));
    });
  }

  // ── 2. Buddies list empty — 393, gold-dark ────────────────────────
  test('2 · buddies list empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/buddies', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'buddies-list', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 3. Group detail with sessions + members — 393, both themes ────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`3 · group detail with sessions — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      // Seed a group with a session
      const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
        name: 'Pickle Pals',
        description: 'Weekly pickleball crew',
        defaultLocation: 'Central Park Courts',
      });

      // Seed a session within the group
      await seedGameSessionWithAccess(testUserUid, {
        name: 'Pickle Pals',
        sessionTitle: 'Saturday Morning Play',
        sessionLocation: 'Central Park Courts',
        visibility: 'private',
      });

      await page.goto(`/buddies/${groupSeed.groupId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'social', 'group-detail', 'with-sessions', '393', theme, mode,
      ));
    });
  }

  // ── 4. Group detail no sessions (empty) — 393, gold-dark ──────────
  test('4 · group detail empty — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
      name: 'Empty Group',
      description: 'No sessions yet',
    });

    await page.goto(`/buddies/${groupSeed.groupId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'group-detail', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 5. Create group form — 393, gold-dark ─────────────────────────
  test('5 · create group form — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/buddies/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'create-group', 'form', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 6. Group invite public page (/g/:shareCode) — 393, gold-dark ──
  test('6 · group invite page — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
      name: 'Pickle Pals',
      description: 'Join our group!',
    });

    await page.goto(`/g/${groupSeed.shareCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'group-invite', 'public', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 7. Session detail with RSVP buttons + spots — 393, both themes
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`7 · session detail with rsvps — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

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

      await captureScreen(page, testInfo, screenshotName(
        'social', 'session-detail', 'with-rsvps', '393', theme, mode,
      ));
    });
  }

  // ── 8. Create session form — 393, gold-dark ───────────────────────
  test('8 · create session form — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
      name: 'Pickle Pals',
    });

    await page.goto(`/buddies/${groupSeed.groupId}/session/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'create-session', 'form', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 9. Public session page (/s/:shareCode) — 393, gold-dark ──────
  test('9 · public session page — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const sessionSeed = await seedGameSessionWithAccess(testUserUid, {
      sessionTitle: 'Open Court Time',
      sessionLocation: 'Riverside Courts',
      visibility: 'open',
      sessionOverrides: { visibility: 'open' },
    });

    const sessionShareCode = (sessionSeed.session as any).shareCode;
    await page.goto(`/s/${sessionShareCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'public-session', 'page', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 10. Open play browse sessions — 393, both themes ──────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`10 · open play browse — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      // Seed an open session so the browse has content
      await seedGameSessionWithAccess(testUserUid, {
        sessionTitle: 'Community Play',
        sessionLocation: 'Downtown Courts',
        visibility: 'open',
        sessionOverrides: { visibility: 'open' },
      });

      await page.goto('/play', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'social', 'open-play', 'browse', '393', theme, mode,
      ));
    });
  }

  // ── 11. Open play empty — 393, gold-dark ──────────────────────────
  test('11 · open play empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/play', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'open-play', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 12. BuddyActionSheet overlay — 393, gold-dark ─────────────────
  test('12 · buddy action sheet — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
      name: 'Pickle Pals',
      description: 'Weekly crew',
    });

    await page.goto(`/buddies/${groupSeed.groupId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Try to trigger the action sheet via a menu/more button
    const moreButton = page.getByRole('button', { name: /more|menu|options|actions/i }).first();
    const moreVisible = await moreButton.isVisible().catch(() => false);
    if (moreVisible) {
      await moreButton.click();
      await page.waitForTimeout(500);
    } else {
      // Try an ellipsis or kebab icon button
      const kebab = page.locator('[aria-label*="menu"], [aria-label*="More"], [aria-label*="actions"], button:has(svg)').first();
      const kebabVisible = await kebab.isVisible().catch(() => false);
      if (kebabVisible) {
        await kebab.click();
        await page.waitForTimeout(500);
      }
    }

    await captureScreen(page, testInfo, screenshotName(
      'social', 'buddy-action-sheet', 'overlay', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 13. ShareSheet (buddy) overlay — 393, gold-dark ────────────────
  test('13 · share sheet buddy — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    const groupSeed = await seedBuddyGroupWithMember(testUserUid, {
      name: 'Pickle Pals',
      description: 'Share this group',
    });

    await page.goto(`/buddies/${groupSeed.groupId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Try to trigger the share sheet
    const shareButton = page.getByRole('button', { name: /share|invite/i }).first();
    const shareVisible = await shareButton.isVisible().catch(() => false);
    if (shareVisible) {
      await shareButton.click();
      await page.waitForTimeout(1000);
    }

    await captureScreen(page, testInfo, screenshotName(
      'social', 'share-sheet', 'buddy-overlay', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 14–15  PROFILE
// =====================================================================
test.describe('Profile', () => {

  // ── 14. Profile stats + achievements — 393, both themes ───────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`14 · profile stats + achievements — ${theme} ${mode}`, async ({ authenticatedPage: page, testUserUid }, testInfo) => {
      await setTheme(page, theme, mode);

      await seedProfileWithHistory(testUserUid, {
        matchCount: 5,
        achievementCount: 3,
      });

      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await captureScreen(page, testInfo, screenshotName(
        'social', 'profile', 'stats-achievements', '393', theme, mode,
      ), { fullPage: true });
    });
  }

  // ── 15. Profile empty achievements — 393, gold-dark ───────────────
  test('15 · profile empty — gold dark', async ({ authenticatedPage: page, testUserUid }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    // Navigate without seeding — empty state
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'profile', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });
});

// =====================================================================
// 16–19  PLAYERS
// =====================================================================
test.describe('Players', () => {

  // ── 16. Players tab — 393, both themes ────────────────────────────
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`16 · players tab — ${theme} ${mode}`, async ({ authenticatedPage: page }, testInfo) => {
      await setTheme(page, theme, mode);

      await page.goto('/players', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Add some players so the list has content
      const input = page.getByPlaceholder('Player name');
      const inputVisible = await input.isVisible().catch(() => false);
      if (inputVisible) {
        await input.fill('Alice');
        await page.getByRole('button', { name: 'Add' }).click();
        await expect(page.getByText('Alice', { exact: true })).toBeVisible({ timeout: 5000 });

        await input.fill('Bob');
        await page.getByRole('button', { name: 'Add' }).click();
        await expect(page.getByText('Bob', { exact: true })).toBeVisible({ timeout: 5000 });

        await input.fill('Charlie');
        await page.getByRole('button', { name: 'Add' }).click();
        await expect(page.getByText('Charlie', { exact: true })).toBeVisible({ timeout: 5000 });
      }

      await captureScreen(page, testInfo, screenshotName(
        'social', 'players', 'tab', '393', theme, mode,
      ));
    });
  }

  // ── 17. Leaderboard tab — 393, gold-dark ──────────────────────────
  test('17 · leaderboard tab — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/players', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Look for a Leaderboard tab to click
    const leaderboardTab = page.getByRole('tab', { name: /leaderboard/i }).first();
    const tabVisible = await leaderboardTab.isVisible().catch(() => false);
    if (tabVisible) {
      await leaderboardTab.click();
      await page.waitForTimeout(1000);
    } else {
      // Try a link or button variant
      const leaderboardLink = page.getByText(/leaderboard/i).first();
      const linkVisible = await leaderboardLink.isVisible().catch(() => false);
      if (linkVisible) {
        await leaderboardLink.click();
        await page.waitForTimeout(1000);
      }
    }

    await captureScreen(page, testInfo, screenshotName(
      'social', 'players', 'leaderboard', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 18. Players empty — 393, gold-dark ────────────────────────────
  test('18 · players empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/players', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, screenshotName(
      'social', 'players', 'empty', '393', 'court-vision-gold', 'dark',
    ));
  });

  // ── 19. Leaderboard empty — 393, gold-dark ────────────────────────
  test('19 · leaderboard empty — gold dark', async ({ authenticatedPage: page }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');

    await page.goto('/players', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Look for a Leaderboard tab to click
    const leaderboardTab = page.getByRole('tab', { name: /leaderboard/i }).first();
    const tabVisible = await leaderboardTab.isVisible().catch(() => false);
    if (tabVisible) {
      await leaderboardTab.click();
      await page.waitForTimeout(1000);
    } else {
      const leaderboardLink = page.getByText(/leaderboard/i).first();
      const linkVisible = await leaderboardLink.isVisible().catch(() => false);
      if (linkVisible) {
        await leaderboardLink.click();
        await page.waitForTimeout(1000);
      }
    }

    await captureScreen(page, testInfo, screenshotName(
      'social', 'players', 'leaderboard-empty', '393', 'court-vision-gold', 'dark',
    ));
  });
});
