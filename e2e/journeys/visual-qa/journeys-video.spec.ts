// e2e/journeys/visual-qa/journeys-video.spec.ts
// Journey video recordings for visual QA review.
// Each test produces a ~15-30s video of a complete user journey.
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { SettingsPage } from '../../pages/SettingsPage';
import { VIEWPORTS, mockPwaInstallPrompt, mockPwaUpdateAvailable } from '../../helpers/visual-qa';
import { signOut } from '../../helpers/emulator-auth';
import { getCurrentUserUid, goToTournamentDashboard } from '../../helpers/emulator-auth';
import {
  seedRegistrationTournament,
  seedPoolPlayTournament,
  seedSpectatorMatch,
  seedCompletedTournament,
  seedBuddyGroupWithMember,
  seedGameSessionWithAccess,
  seedSessionWithRsvps,
  seedProfileWithHistory,
  seedNotifications,
} from '../../helpers/seeders';
import { BuddiesPage } from '../../pages/BuddiesPage';
import { ProfilePage } from '../../pages/ProfilePage';

// Record video for every test (overrides project-level retain-on-first-retry)
test.use({ video: 'on' });

// =====================================================================
// Journey Videos: Casual Scoring (8 videos)
// =====================================================================
test.describe('Journey Videos: Casual Scoring', () => {

  // ── 1. Quick rally game (full) ──────────────────────────────────────
  test('journey 1: quick rally game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score Team 1 to 11 (rally: both buttons always active)
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to history, verify match appears
    const nav = new NavigationBar(page);
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
  });

  // ── 2. Sideout doubles game ─────────────────────────────────────────
  test('journey 2: sideout doubles game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Team 1 starts serving (server 2 in doubles)
    await scoring.expectScoreCall('0-0-2');
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();

    // Score a couple points for Team 1
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 2);

    // Side out to Team 2
    await scoring.triggerSideOut();
    await scoring.expectTeam2Enabled();
    await scoring.expectTeam1Disabled();

    // Score for Team 2
    await scoring.scorePoint('Team 2');
    await scoring.expectTeamScore('Team 2', 1);

    // Side out — in doubles this goes to Team 2 server 2
    await scoring.triggerSideOut();

    // Score more for Team 2 if enabled, or sideout again to get to Team 1
    // Doubles sideout: Team1-S2 -> Team2-S1 -> Team2-S2 -> Team1-S1 -> Team1-S2...
    // After 2nd sideout from Team2-S1, Team2-S2 is serving
    await scoring.expectTeam2Enabled();
    await scoring.scorePoint('Team 2');
    await scoring.expectTeamScore('Team 2', 2);

    // Side out to Team 1 server 1
    await scoring.triggerSideOut();
    await scoring.expectTeam1Enabled();

    // Score Team 1 to 11 (currently at 2, need 9 more)
    for (let i = 0; i < 9; i++) {
      await scoring.scorePoint('Team 1');
    }
    await scoring.expectMatchOver();
  });

  // ── 3. Singles game ──────────────────────────────────────────────────
  test('journey 3: singles game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectSingles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Team 1 starts serving in singles
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();

    // Score a few, sideout, score more — then run Team 1 to 11
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.triggerSideOut();
    await scoring.expectTeam2Enabled();
    await scoring.scorePoint('Team 2');
    await scoring.triggerSideOut();
    await scoring.expectTeam1Enabled();

    // Score remaining to 11
    for (let i = 0; i < 9; i++) {
      await scoring.scorePoint('Team 1');
    }
    await scoring.expectMatchOver();
  });

  // ── 4. Best-of-3 multi-game ─────────────────────────────────────────
  test('journey 4: best-of-3 multi-game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Game 1: Team 1 wins
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();
    await scoring.startNextGame();

    // Game 2: Team 2 wins
    await scoring.scorePoints('Team 2', 11);
    await scoring.expectBetweenGames();
    await scoring.startNextGame();

    // Game 3: Team 1 wins — match over
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
  });

  // ── 5. Win-by-2 / deuce ─────────────────────────────────────────────
  test('journey 5: win-by-2 deuce', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score both teams to 10-10
    for (let i = 0; i < 10; i++) {
      await scoring.scorePoint('Team 1');
      await scoring.scorePoint('Team 2');
    }
    await scoring.expectScores(10, 10);

    // Score to 11-10 — game should NOT end (win-by-2)
    await scoring.scorePoint('Team 1');
    await scoring.expectScores(11, 10);
    // Both buttons should still be visible (game continues)
    await expect(scoring.team1ScoreBtn).toBeVisible();

    // Score to 12-10 — now Team 1 wins by 2
    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
  });

  // ── 6. Undo + navigation guards ─────────────────────────────────────
  test('journey 6: undo and navigation guards', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score 5 points
    await scoring.scorePoints('Team 1', 5);
    await scoring.expectTeamScore('Team 1', 5);

    // Undo twice
    await scoring.undoLastAction();
    await scoring.expectTeamScore('Team 1', 4);
    await scoring.undoLastAction();
    await scoring.expectTeamScore('Team 1', 3);

    // Try to navigate away — dialog appears
    await nav.goToHistory();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Leave Game?')).toBeVisible();

    // Cancel — stay on scoring page
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await scoring.expectOnScoringScreen();
    await expect(dialog).not.toBeVisible();

    // Try again — this time confirm leave
    await nav.goToHistory();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2).toBeVisible();
    await dialog2.getByRole('button', { name: 'Leave' }).click();
    await expect(page).not.toHaveURL(/\/score\//);
  });

  // ── 7. Custom names, colors + share score card ──────────────────────
  test('journey 7: custom names and share score card', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.fillTeamName(1, 'Dragons');
    await setup.fillTeamName(2, 'Phoenix');
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // After custom names, buttons use those names in aria-labels
    // Use scorePointByName for custom-named teams
    await scoring.scorePointsByName('Dragons', 11);
    await scoring.expectMatchOver();

    // Share Score Card button
    const shareBtn = page.getByRole('button', { name: /Share Score Card/ });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    // Wait for share feedback
    await expect(
      page.getByRole('button', { name: /Shared!|Copied to clipboard!|Downloaded!|Share failed/ })
    ).toBeVisible({ timeout: 5000 });
  });

  // ── 8. Landscape scoring ────────────────────────────────────────────
  test('journey 8: landscape scoring', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a couple in portrait first
    await scoring.scorePoints('Team 1', 2);
    await scoring.expectTeamScore('Team 1', 2);

    // Switch to landscape
    await page.setViewportSize({ width: 851, height: 393 });
    await expect(scoring.team1ScoreBtn).toBeVisible();
    await expect(scoring.team2ScoreBtn).toBeVisible();

    // Score several points in landscape
    await scoring.scorePoints('Team 1', 5);
    await scoring.scorePoints('Team 2', 3);

    // Switch back to portrait
    await page.setViewportSize(VIEWPORTS.portrait393);
    await expect(scoring.team1ScoreBtn).toBeVisible();

    // Score to completion (Team 1 needs 4 more: has 7, target 11)
    await scoring.scorePoints('Team 1', 4);
    await scoring.expectMatchOver();
  });
});

// =====================================================================
// Journey Videos: Auth & Onboarding (2 videos)
// =====================================================================
test.describe('Journey Videos: Auth & Onboarding', () => {

  // ── 9. First-time user onboarding ─────────────────────────────────
  // Uses authenticatedPage because /buddies and /tournaments require auth
  test('journey 9: first-time user onboarding', async ({ authenticatedPage: page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Navigate to various pages — show initial state for a new user
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.goto('/buddies');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.goto('/tournaments');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Navigate to /new — start first game setup
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a few points to show it working
    await scoring.scorePoints('Team 1', 3);
    await scoring.scorePoints('Team 2', 2);
    await scoring.expectTeamScore('Team 1', 3);
    await scoring.expectTeamScore('Team 2', 2);
  });

  // ── 10. Sign out + user switch ────────────────────────────────────
  test('journey 10: sign out', async ({ authenticatedPage: page }) => {
    // Start on a page that shows signed-in state
    await page.goto('/settings');
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Sign out via Firebase
    await signOut(page);
    await page.waitForTimeout(1000);

    // Navigate to /buddies which requires auth — should see sign-in prompt
    await page.goto('/buddies');
    await page.waitForTimeout(1500);

    // RequireAuth blocks buddies access for signed-out users
    await expect(
      page.getByText('Sign in required')
    ).toBeVisible({ timeout: 10000 });
  });
});

// =====================================================================
// Journey Videos: Settings & Preferences (2 videos)
// =====================================================================
test.describe('Journey Videos: Settings & Preferences', () => {

  // ── 11. Theme + display mode tour ─────────────────────────────────
  test('journey 11: theme and display mode tour', async ({ page }) => {
    const settingsPage = new SettingsPage(page);

    await settingsPage.goto();
    await page.waitForTimeout(1000);

    // Click through theme options
    // Theme buttons have aria-pressed and the theme label text
    const classicBtn = page.locator('button', { hasText: 'Classic' }).first();
    const emberBtn = page.locator('button', { hasText: 'Ember' }).first();
    const goldBtn = page.locator('button', { hasText: 'Court Vision Gold' }).first();

    await classicBtn.click();
    await page.waitForTimeout(1000);

    await emberBtn.click();
    await page.waitForTimeout(1000);

    await goldBtn.click();
    await page.waitForTimeout(1000);

    // Toggle display mode (use button locators — OptionCard renders as buttons)
    const displayFieldset = page.locator('fieldset', { has: page.getByText('Display') });
    await displayFieldset.getByRole('button', { name: 'Outdoor' }).click();
    await page.waitForTimeout(1000);

    await displayFieldset.getByRole('button', { name: 'Dark' }).click();
    await page.waitForTimeout(1000);

    // Navigate to /new to see theme applied on a different page
    await page.goto('/new');
    await expect(page.getByText(/New Game|Game Setup/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
  });

  // ── 12. Settings defaults -> game setup ───────────────────────────
  test('journey 12: settings defaults to game setup', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Go to settings and change defaults
    await settingsPage.goto();
    await page.waitForTimeout(1000);

    await settingsPage.selectDefaultScoringMode('rally');
    await page.waitForTimeout(500);

    await settingsPage.selectDefaultPointsToWin(15);
    await page.waitForTimeout(500);

    // selectDefaultMatchFormat uses getByLabel which doesn't match OptionCard buttons
    const matchFormatFieldset = page.locator('fieldset', { has: page.getByText('Default Match Format') });
    await matchFormatFieldset.getByRole('button', { name: 'Best of 3' }).click();
    await page.waitForTimeout(1000);

    // Navigate to /new and verify defaults are pre-selected
    await setup.goto();
    await page.waitForTimeout(1500);

    // Verify the "Rally" button is selected (aria-pressed)
    const rallyBtn = page.locator('button[aria-pressed="true"]', { hasText: 'Rally' });
    await expect(rallyBtn).toBeVisible({ timeout: 5000 });

    // Start a quick game to confirm defaults work
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a few points
    await scoring.scorePoints('Team 1', 3);
    await scoring.expectTeamScore('Team 1', 3);
  });
});

// =====================================================================
// Journey Videos: Tournament Organizer (4 videos)
// =====================================================================
test.describe('Journey Videos: Tournament Organizer', () => {

  // ── 13. Create tournament + registration ──────────────────────────
  test('journey 13: tournament registration dashboard', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a registration tournament and show the dashboard
    const { tournamentId } = await seedRegistrationTournament(userUid, {
      teamCount: 3,
      teamNames: ['Alice', 'Bob', 'Charlie'],
      tournamentOverrides: { name: 'Spring Open 2025' },
    });

    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Show the player management area — add a player via the form
    const playerNameInput = page.getByPlaceholder('Player name');
    if (await playerNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playerNameInput.fill('Dana');
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      await page.waitForTimeout(1500);
    }

    // Scroll down to show full dashboard
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
  });

  // ── 14. Approval queue + staff management ─────────────────────────
  test('journey 14: organizer dashboard with registered players', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a registration tournament with several registered players
    const { tournamentId } = await seedRegistrationTournament(userUid, {
      teamCount: 6,
      teamNames: ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank'],
      tournamentOverrides: { name: 'Club Championship' },
    });

    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Show player list / registration section
    await expect(page.getByText(/Registered Players/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Scroll to show all dashboard sections
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1500);

    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
  });

  // ── 15. Full tournament lifecycle ─────────────────────────────────
  test('journey 15: pool-play tournament lifecycle', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a pool-play tournament
    const { tournamentId } = await seedPoolPlayTournament(userUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      tournamentOverrides: { name: 'Weekend Pool Play' },
    });

    // View the pool-play dashboard
    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Pool Play').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Show pool standings if visible
    const standings = page.getByText('Pool Standings');
    if (await standings.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll to show schedule / matches
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);

    // Try to click on a match to view the scoring screen (if schedule links exist)
    const matchLink = page.locator('button, a').filter({ hasText: /Alpha.*vs.*Bravo|Score|Start Match/i }).first();
    if (await matchLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matchLink.click();
      await page.waitForTimeout(2000);

      // If we landed on a scoring page, score a few points using team names
      const scoreBtn = page.getByRole('button', { name: /Score point for Alpha/i });
      if (await scoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await scoreBtn.click();
        await page.waitForTimeout(500);
        await scoreBtn.click();
        await page.waitForTimeout(500);
        await scoreBtn.click();
        await page.waitForTimeout(1000);
      }

      // Navigate back to dashboard
      await goToTournamentDashboard(page, tournamentId);
      await page.waitForTimeout(1500);
    }

    // Scroll back to top to show final state
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
  });

  // ── 16. Score edit + dispute resolution ───────────────────────────
  test('journey 16: tournament dashboard with scored matches', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a pool-play tournament with a completed match
    const { tournamentId } = await seedPoolPlayTournament(userUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      withCompletedMatch: true,
      tournamentOverrides: { name: 'Scored Tournament' },
    });

    // View the dashboard
    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Pool Play').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Show standings (some matches may show scores)
    const standings = page.getByText('Pool Standings');
    if (await standings.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll to show match schedule with completed match indicator
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);

    // Look for any edit/dispute controls
    const editBtn = page.locator('button').filter({ hasText: /Edit|Dispute|Correct/i }).first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(2000);
    }

    // Scroll back up to capture final dashboard state
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
  });
});

// =====================================================================
// Journey Videos: Spectator (2 videos)
// =====================================================================
test.describe('Journey Videos: Spectator', () => {

  // ── 17. Live tournament spectating ──────────────────────────────────
  test('journey 17: live tournament spectating', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a pool-play tournament with a live match
    const { tournamentId, shareCode: tShareCode } = await seedPoolPlayTournament(userUid, {
      teamCount: 4,
      teamNames: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      tournamentOverrides: { name: 'Summer Slam Live', visibility: 'public' },
    });

    // Seed a live spectator match linked to this tournament
    const { matchId } = await seedSpectatorMatch(userUid, {
      tournamentId,
      team1Name: 'Alpha',
      team2Name: 'Bravo',
      team1Score: 7,
      team2Score: 5,
      withEvents: true,
    });

    // Navigate to public tournament hub via share code
    await page.goto(`/t/${tShareCode}`);
    await expect(page.getByText('Summer Slam Live')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Show any live-now section if visible
    const liveSection = page.getByText(/live/i).first();
    if (await liveSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Navigate to match detail — show live scoreboard
    await page.goto(`/t/${tShareCode}/match/${matchId}`);
    await expect(page.getByText('Alpha', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bravo', { exact: true })).toBeVisible();
    await page.waitForTimeout(2000);

    // Show tabs if available
    const statsTab = page.getByRole('tab', { name: /stats/i });
    if (await statsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(1500);
    }

    // Navigate back to hub
    const backLink = page.getByRole('link', { name: /back to tournament/i });
    if (await backLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backLink.click();
      await page.waitForTimeout(1500);
    }
  });

  // ── 18. Completed tournament viewing ────────────────────────────────
  test('journey 18: completed tournament viewing', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a completed tournament with bracket and winner
    const { shareCode: tShareCode } = await seedCompletedTournament(userUid, {
      teamCount: 4,
    });

    // Navigate to public tournament hub
    await page.goto(`/t/${tShareCode}`);
    await page.waitForTimeout(2000);

    // Show tournament name / completed status
    await expect(page.locator('body')).toContainText(/completed|champion|winner|bracket|final/i, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Scroll down to show full results / bracket
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
  });
});

// =====================================================================
// Journey Videos: Buddies & Sessions (3 videos)
// =====================================================================
test.describe('Journey Videos: Buddies & Sessions', () => {

  // ── 19. Create group + invite flow ──────────────────────────────────
  test('journey 19: create group and invite flow', async ({
    authenticatedPage: page,
  }) => {
    const buddies = new BuddiesPage(page);

    // Navigate to create group form
    await buddies.gotoNewGroup();
    await expect(
      page.getByRole('button', { name: 'Create Group' }),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill and submit the create group form
    await buddies.createGroup('Pickle Pals', { location: 'Central Courts', description: 'Weekend group' });

    // Wait for redirect to group detail
    await buddies.expectOnGroupDetail();
    await expect(
      page.getByRole('heading', { name: 'Pickle Pals' }),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Show the share code / share link if visible
    const shareText = page.getByText(/share|invite|code/i).first();
    if (await shareText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll down to show full group detail
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
  });

  // ── 20. Session lifecycle ───────────────────────────────────────────
  test('journey 20: session lifecycle with RSVPs', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a session with multiple RSVPs
    const { sessionId } = await seedSessionWithRsvps(userUid, {
      rsvpCount: 4,
      sessionOverrides: {
        title: 'Tuesday Doubles',
        location: 'Park Courts',
        status: 'proposed',
      },
    });

    // Navigate to session detail
    await page.goto(`/session/${sessionId}`);
    await expect(page.getByText('Tuesday Doubles')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Show RSVP buttons and spots tracker
    const inButton = page.getByRole('button', { name: 'In' }).first();
    if (await inButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1000);
      // Click "In" to RSVP
      await inButton.click();
      await page.waitForTimeout(2000);
    }

    // Try changing to "Maybe"
    const maybeButton = page.getByRole('button', { name: 'Maybe' });
    if (await maybeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maybeButton.click();
      await page.waitForTimeout(1500);
    }

    // Scroll to show full session detail and player list
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
  });

  // ── 21. Open play browse + join ─────────────────────────────────────
  test('journey 21: open play browse and join', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a couple open-visibility sessions
    await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Morning Pickup',
      sessionLocation: 'Riverside Courts',
      visibility: 'open',
      sessionOverrides: { status: 'proposed', spotsTotal: 8, spotsConfirmed: 3 },
    });
    const { sessionId: session2Id } = await seedGameSessionWithAccess(userUid, {
      sessionTitle: 'Evening Doubles',
      sessionLocation: 'Main Park',
      visibility: 'open',
      sessionOverrides: { status: 'proposed', spotsTotal: 4, spotsConfirmed: 1 },
    });

    // Try /play first; if it doesn't show sessions, fall back to /buddies
    await page.goto('/play');
    await page.waitForTimeout(2000);

    // Check if any session is visible on the play page
    const sessionVisible = await page.getByText('Morning Pickup').isVisible({ timeout: 5000 }).catch(() => false)
      || await page.getByText('Evening Doubles').isVisible({ timeout: 2000 }).catch(() => false);

    if (!sessionVisible) {
      // Fall back to navigating to buddies
      await page.goto('/buddies');
      await page.waitForTimeout(2000);
    }

    // Click into a session detail if visible
    const sessionLink = page.getByText('Evening Doubles');
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
      await expect(page.getByText('Evening Doubles')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);
    } else {
      // Navigate directly to the session
      await page.goto(`/session/${session2Id}`);
      await expect(page.getByText('Evening Doubles')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);
    }

    // Show session detail
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(1500);
  });
});

// =====================================================================
// Journey Videos: Profile & Stats (1 video)
// =====================================================================
test.describe('Journey Videos: Profile & Stats', () => {

  // ── 22. Profile + achievements + leaderboard ────────────────────────
  test('journey 22: profile stats and leaderboard', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed profile with match history and achievements
    await seedProfileWithHistory(userUid, {
      matchCount: 5,
      achievementCount: 3,
    });

    // Navigate to profile page
    const profile = new ProfilePage(page);
    await profile.goto();
    await page.waitForTimeout(2000);

    // Show stats section
    const statsSection = page.locator('section[aria-labelledby="stats-heading"]');
    if (await statsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Show recent matches
    const matchesList = page.locator('ul[aria-label="Recent match results"]');
    if (await matchesList.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll down to show achievements section
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);

    // Navigate to /players — show leaderboard tab
    await page.goto('/players');
    await page.waitForTimeout(1500);

    // Click Leaderboard tab
    const leaderboardTab = page.getByRole('tab', { name: 'Leaderboard' });
    if (await leaderboardTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await leaderboardTab.click();
      await page.waitForTimeout(2000);
    }

    // Show scope and timeframe toggles
    const globalRadio = page.getByRole('radio', { name: 'Global' });
    if (await globalRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(1000);
    }
  });
});

// =====================================================================
// Journey Videos: Cross-Cutting (3 videos)
// =====================================================================
test.describe('Journey Videos: Cross-Cutting', () => {

  // ── 23. Offline scoring + sync ──────────────────────────────────────
  test('journey 23: offline scoring and sync', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    // Start a quick rally game
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a couple points online first
    await scoring.scorePoints('Team 1', 2);
    await scoring.expectTeamScore('Team 1', 2);
    await page.waitForTimeout(1000);

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Score several points while offline
    await scoring.scorePoints('Team 1', 5);
    await scoring.scorePoints('Team 2', 3);
    await scoring.expectTeamScore('Team 1', 7);
    await scoring.expectTeamScore('Team 2', 3);
    await page.waitForTimeout(1000);

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    // Score to completion (Team 1 needs 4 more: has 7, target 11)
    await scoring.scorePoints('Team 1', 4);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to history — verify match appears
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
  });

  // ── 24. Local-to-cloud sync on first sign-in ─────────────────────────
  test('journey 24: local persistence flow', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    // Start a quick game without signing in
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.fillTeamName(1, 'Local Hawks');
    await setup.fillTeamName(2, 'Local Eagles');
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score and complete the match
    await scoring.scorePointsByName('Local Hawks', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to history — verify the locally saved match appears
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Local Hawks' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Show that the match details are persisted
    await expect(page.locator('article', { hasText: 'Local Eagles' })).toBeVisible();
    await page.waitForTimeout(1500);
  });

  // ── 25. Notification panel flow ──────────────────────────────────────
  test('journey 25: notification panel flow', async ({
    authenticatedPage: page,
    testUserUid,
  }) => {
    // Seed notifications
    await seedNotifications(testUserUid, 4);

    // Navigate to a page where TopNav + bell is visible
    await page.goto('/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click the notification bell icon
    const bellBtn = page.getByLabel(/Notifications/);
    await expect(bellBtn).toBeVisible({ timeout: 15000 });
    await bellBtn.click();

    // Wait for notification panel to appear
    const panel = page.locator('[role="dialog"][aria-labelledby="notif-panel-title"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Click "Mark all read" if available
    const markAllBtn = panel.getByRole('button', { name: /Mark all read/i });
    if (await markAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await markAllBtn.click();
      await page.waitForTimeout(1500);
    }

    // Close panel by clicking outside it (on the page backdrop)
    await page.mouse.click(10, 400);
    await page.waitForTimeout(2000);
  });
});

// =====================================================================
// Journey Videos: Tournament Participant (2 videos)
// =====================================================================
test.describe('Journey Videos: Tournament Participant', () => {

  // ── 26. Discover + register ──────────────────────────────────────────
  test('journey 26: discover and register for tournament', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a registration tournament (public, open access)
    const { tournamentId, shareCode: tShareCode } = await seedRegistrationTournament(userUid, {
      teamCount: 3,
      teamNames: ['Alice', 'Bob', 'Charlie'],
      tournamentOverrides: { name: 'Open Doubles Classic', visibility: 'public' },
    });

    // Navigate to tournaments page — browse tab
    await page.goto('/tournaments');
    await page.waitForTimeout(2000);

    // Try to find the tournament in browse / discover section
    const tournamentLink = page.getByText('Open Doubles Classic');
    if (await tournamentLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tournamentLink.click();
      await page.waitForTimeout(2000);
    } else {
      // Fall back to navigating directly via share code
      await page.goto(`/t/${tShareCode}`);
      await expect(page.getByText('Open Doubles Classic')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);
    }

    // Show registration UI / join button
    const joinBtn = page.getByRole('button', { name: /Join|Register|Sign Up/i });
    if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll to show full tournament detail
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
  });

  // ── 27. Approval-mode registration ───────────────────────────────────
  test('journey 27: approval-mode registration', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);

    // Seed a registration tournament with approval access mode
    const { shareCode: tShareCode } = await seedRegistrationTournament(userUid, {
      teamCount: 2,
      teamNames: ['Alice', 'Bob'],
      accessMode: 'approval',
      tournamentOverrides: { name: 'Invite Only Cup', visibility: 'public' },
    });

    // Navigate to the public tournament page
    await page.goto(`/t/${tShareCode}`);
    await expect(page.getByText('Invite Only Cup')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Show "Ask to Join" or similar request button
    const askBtn = page.getByRole('button', { name: /Ask to Join|Request|Join/i });
    if (await askBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Scroll to show full page
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
  });
});

// =====================================================================
// Journey Videos: PWA (1 video)
// =====================================================================
test.describe('Journey Videos: PWA', () => {

  // ── 28. PWA install + update toast ───────────────────────────────────
  test('journey 28: PWA install and update toast', async ({ page }) => {
    // Mock PWA install prompt before navigation
    await mockPwaInstallPrompt(page);

    // Navigate to landing page
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Show install banner if rendered by the app
    const installBanner = page.getByRole('button', { name: /Install|Add to Home/i });
    if (await installBanner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Navigate into the app to show more context
    await page.goto('/new');
    await expect(page.getByText(/New Game|Game Setup/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Mock PWA update available
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('sw-update-available'));
    });
    await page.waitForTimeout(1500);

    // Show update toast if rendered
    const updateToast = page.getByText(/Update available|New version/i);
    if (await updateToast.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(1500);
    }

    // Final state capture
    await page.waitForTimeout(1000);
  });
});
