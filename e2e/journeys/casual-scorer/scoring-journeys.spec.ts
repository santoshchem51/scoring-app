import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { captureScreen } from '../../helpers/screenshots';

test.describe('@p0 Casual Scorer: Core Journeys', () => {

  test('CS-1: landing page Start Scoring navigates to game setup', async ({ page }) => {
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expectSetupVisible();
  });

  test('CS-3: best-of-3 plays through game boundary', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Win game 1 (rally mode: either team can score)
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();
    await captureScreen(page, testInfo, 'scoring-betweengames-game1complete');

    // Start game 2
    await scoring.startNextGame();
    await scoring.expectScores(0, 0);

    // Win game 2 -> match over
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await captureScreen(page, testInfo, 'scoring-matchover-bestof3');
  });

  test('CS-4: doubles sideout serving restrictions + score call', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();
    await scoring.expectScoreCall('0-0-2');

    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 1);

    await scoring.triggerSideOut();
    await scoring.expectTeam1Disabled();
    await scoring.expectTeam2Enabled();
    await captureScreen(page, testInfo, 'scoring-sideout-team2serving');
  });

  test('CS-6: rally scoring win-by-2 enforced', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    await scoring.scorePoints('Team 1', 10);
    await scoring.expectTeamScore('Team 1', 10);

    await scoring.scorePoints('Team 2', 10);
    await scoring.expectScores(10, 10);

    await scoring.scorePoint('Team 1');
    await scoring.expectScores(11, 10);
    await expect(scoring.team1ScoreBtn).toBeVisible();

    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
    await captureScreen(page, testInfo, 'scoring-rally-winby2-matchover');
  });

  test('CS-2: quick game to completion appears in history', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    const nav = new NavigationBar(page);
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();
    await expect(matchCard.getByText('0', { exact: true })).toBeVisible();
  });

  test('CS-16: match history persists across reload', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    const nav = new NavigationBar(page);
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();

    await page.reload();
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();
  });
});

test.describe('@p1 Casual Scorer: P1 Journeys', () => {

  test('CS-5: singles sideout — serve alternates, no server number', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectSingles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Team 1 starts serving
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();
    await scoring.expectServingIndicator(1);
    await captureScreen(page, testInfo, 'cs5-singles-team1-serving');

    // Score a point for Team 1, then side out
    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 1);
    await scoring.triggerSideOut();

    // Team 2 now serving
    await scoring.expectTeam2Enabled();
    await scoring.expectTeam1Disabled();
    await scoring.expectServingIndicator(2);

    // Serving indicator says "Serving", NOT "Server 1" or "Server 2"
    const indicator = page.getByTestId('serving-indicator-2');
    await expect(indicator).toHaveText('Serving');

    // No score-call in singles (score-call is doubles-only)
    await expect(scoring.team2ScoreBtn).toBeVisible();
    await expect(page.getByTestId('score-call')).not.toBeVisible();
    await captureScreen(page, testInfo, 'cs5-singles-team2-serving');
  });

  test('CS-10: navigation guard — confirm leave + cancel stay', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a few points to have an active game
    await scoring.scorePoints('Team 1', 3);
    await scoring.expectTeamScore('Team 1', 3);

    // Try to navigate away via History tab
    const nav = new NavigationBar(page);
    await nav.goToHistory();

    // "Leave Game?" dialog appears
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Leave Game?')).toBeVisible();
    await captureScreen(page, testInfo, 'cs10-leave-dialog');

    // Click Cancel — still on scoring page
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await scoring.expectOnScoringScreen();
    await expect(dialog).not.toBeVisible();

    // Try again — dialog reappears
    await nav.goToHistory();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2).toBeVisible();
    await expect(dialog2.getByText('Leave Game?')).toBeVisible();

    // Click Leave — navigated away
    await dialog2.getByRole('button', { name: 'Leave' }).click();
    await expect(page).not.toHaveURL(/\/score\//);
    await captureScreen(page, testInfo, 'cs10-after-leave');
  });

  test('CS-11: scorer role — "I\'m Playing" indicator + "Scoring for Others" hides it', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Part 1: "I'm Playing" on Team 1
    await setup.goto();
    await setup.expandYourRole();
    await setup.selectImPlaying();
    await setup.selectScorerTeam(1);
    await setup.collapseYourRole();
    await setup.startGame();
    await scoring.expectOnScoringScreen();
    await scoring.expectTeamIndicator('Team 1');
    await captureScreen(page, testInfo, 'cs11-im-playing-team1');

    // Part 2: "Scoring for Others" — no indicator
    await setup.goto();
    await setup.expandYourRole();
    await setup.selectScoringForOthers();
    await setup.collapseYourRole();
    await setup.startGame();
    await scoring.expectOnScoringScreen();
    // Wait for page to be stable before negative assertion
    await expect(scoring.team1ScoreBtn).toBeVisible();
    await scoring.expectNoTeamIndicator();
    await captureScreen(page, testInfo, 'cs11-scoring-for-others');
  });

  test('CS-12: landscape mode — side-by-side layout', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Resize to landscape
    await page.setViewportSize({ width: 800, height: 400 });

    // Page still renders — both score buttons work
    await expect(scoring.team1ScoreBtn).toBeVisible();
    await expect(scoring.team2ScoreBtn).toBeVisible();
    await captureScreen(page, testInfo, 'cs12-landscape');

    // Score a point and verify update
    await scoring.scorePoint('Team 1');
    // In landscape, two scoreboards may render; verify via first matching panel
    const scoreboard = page.locator('[aria-label="Scoreboard"]').first();
    await expect(scoreboard.locator('[aria-label*="Team 1: 1"]')).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'cs12-landscape-scored');
  });

  test('CS-13: share score card from match-over screen', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score 11 points for Team 1 to end match
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();

    // Share Score Card button visible
    const shareBtn = page.getByRole('button', { name: /Share Score Card/ });
    await expect(shareBtn).toBeVisible();
    await captureScreen(page, testInfo, 'cs13-match-over-share');

    // Click share — text changes to feedback
    await shareBtn.click();
    await expect(page.getByRole('button', { name: /Shared!|Copied to clipboard!|Downloaded!|Share failed/ })).toBeVisible({ timeout: 5000 });
    await captureScreen(page, testInfo, 'cs13-share-feedback');
  });

  test('CS-14: settings defaults carry to game setup', async ({ page }, testInfo) => {
    // Go to settings and change defaults
    await page.goto('/settings');
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 10000 });

    // Select Rally scoring default — click the Rally button in the Default Scoring fieldset
    const scoringFieldset = page.locator('fieldset', { has: page.getByText('Default Scoring') });
    await scoringFieldset.getByRole('button', { name: 'Rally' }).click();

    // Select 15 points default — click 15 in the Default Points to Win fieldset
    const pointsFieldset = page.locator('fieldset', { has: page.getByText('Default Points to Win') });
    await pointsFieldset.getByRole('button', { name: '15' }).click();
    await captureScreen(page, testInfo, 'cs14-settings-defaults');

    // Navigate to game setup
    const nav = new NavigationBar(page);
    await nav.goToNew();

    // Assert Rally is pre-selected (aria-pressed="true")
    const rallyBtn = page.getByRole('button', { name: /Rally/ });
    await expect(rallyBtn).toHaveAttribute('aria-pressed', 'true');

    // Assert 15 points is pre-selected
    const pointsSection = page.locator('fieldset', { has: page.getByText('Points to Win') });
    const pts15Btn = pointsSection.getByRole('button', { name: '15', exact: true });
    await expect(pts15Btn).toHaveAttribute('aria-pressed', 'true');
    await captureScreen(page, testInfo, 'cs14-setup-defaults-applied');

    // Use Quick Game — spec requires verifying Quick Game uses changed defaults
    const setup = new GameSetupPage(page);
    await setup.quickGame();
    const scoring = new ScoringPage(page);
    await scoring.expectOnScoringScreen();

    // Rally mode: both team score buttons enabled (not sideout)
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Enabled();

    // Points to win should be 15 (from settings default)
    await scoring.expectPointsToWin(15);
  });

  test('CS-15: team names + colors carry to scoreboard', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.fillTeamName(1, 'Dragons');
    await setup.fillTeamName(2, 'Phoenix');

    // Select non-default colors: Gold for Team 1, Purple for Team 2
    // ColorPicker renders radio buttons with aria-label = color name
    // Each team's picker is in a radiogroup with label "Team N color"
    const team1ColorPicker = page.getByRole('radiogroup', { name: 'Team 1 color' });
    await team1ColorPicker.getByRole('radio', { name: 'Gold' }).click();
    const team2ColorPicker = page.getByRole('radiogroup', { name: 'Team 2 color' });
    await team2ColorPicker.getByRole('radio', { name: 'Purple' }).click();

    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score buttons have custom team names in aria-labels
    await expect(page.getByRole('button', { name: 'Score point for Dragons' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Score point for Phoenix' })).toBeVisible();

    // Scoreboard aria-labels contain custom names
    const scoreboard = page.locator('[aria-label="Scoreboard"]');
    await expect(scoreboard.locator('[aria-label*="Dragons"]')).toBeVisible();
    await expect(scoreboard.locator('[aria-label*="Phoenix"]')).toBeVisible();

    // Verify selected colors propagate to scoreboard panels via --team-color CSS variable
    // Gold = #D4A853, Purple = #a855f7
    const team1Panel = scoreboard.locator('[aria-label*="Dragons"]');
    const team2Panel = scoreboard.locator('[aria-label*="Phoenix"]');
    await expect(team1Panel).toHaveCSS('--team-color', '#D4A853');
    await expect(team2Panel).toHaveCSS('--team-color', '#a855f7');
    await captureScreen(page, testInfo, 'cs15-custom-team-names-colors');
  });

  test('CS-17: empty states — history and players pages', async ({ page }, testInfo) => {
    // Fresh page — navigate directly to History (landing page hides bottom nav)
    await page.goto('/history');
    const nav = new NavigationBar(page);

    await expect(page.getByText('No Matches Yet')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Start your first game')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start a Game' })).toBeVisible();
    await captureScreen(page, testInfo, 'cs17-history-empty');

    // Navigate to Players
    await nav.goToPlayers();
    await expect(page.getByText('No Players Yet')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Add players to track')).toBeVisible();
    await captureScreen(page, testInfo, 'cs17-players-empty');
  });

  test('CS-18: game point indicator thresholds', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Game 1: Rally scoring, 11 points to win
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectPointsToWin(11);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score Team 1 to 10, Team 2 to 9
    await scoring.scorePoints('Team 1', 10);
    await scoring.scorePoints('Team 2', 9);
    await scoring.expectScores(10, 9);

    // Team 1 at game point (10 >= 10, 10 > 9)
    await scoring.expectGamePoint();
    await captureScreen(page, testInfo, 'cs18-game-point-10-9');

    // Score Team 2 to 10 (now 10-10) — no game point (tied)
    await scoring.scorePoint('Team 2');
    await scoring.expectScores(10, 10);
    await expect(page.getByText('GAME POINT')).not.toBeVisible();
    await captureScreen(page, testInfo, 'cs18-no-game-point-10-10');

    // Game 2: Rally scoring, 15 points to win
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectPointsToWin(15);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score Team 1 to 14, Team 2 to 13
    await scoring.scorePoints('Team 1', 14);
    await scoring.scorePoints('Team 2', 13);
    await scoring.expectScores(14, 13);

    // Team 1 at game point (14 >= 14, 14 > 13)
    await scoring.expectGamePoint();
    await captureScreen(page, testInfo, 'cs18-game-point-14-13');
  });
});
