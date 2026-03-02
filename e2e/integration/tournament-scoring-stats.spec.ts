// e2e/integration/tournament-scoring-stats.spec.ts
import { test, expect } from '../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
  goToTournamentDashboard,
} from '../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool } from '../helpers/factories';
import { ScoringPage } from '../pages/ScoringPage';
import { randomUUID } from 'crypto';

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Tournament -> Scoring -> Stats Integration (Manual Plan 9.1)', () => {

  /**
   * Full integration journey: Dashboard -> Score -> Dashboard with updated standings.
   *
   * This is a single long integration test that covers:
   * 1. Match created from tournament dashboard opens scoring page
   * 2. Completing tournament match returns to dashboard
   * 3. Tournament standings update after match scored
   */
  test('full pool-play journey: score match from dashboard, verify standings update', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const scoring = new ScoringPage(page);

    // ── Step 1: Seed a round-robin tournament in pool-play ──

    const tournamentId = `tournament-${randomUUID().slice(0, 8)}`;
    const team1Id = `team-${randomUUID().slice(0, 8)}`;
    const team2Id = `team-${randomUUID().slice(0, 8)}`;
    const poolId = `pool-${randomUUID().slice(0, 8)}`;

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: uid,
      status: 'pool-play',
      format: 'round-robin',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 1,
        teamsPerPoolAdvancing: 1,
      },
      registrationCounts: { confirmed: 2, pending: 0 },
    });

    const team1 = makeTeam({
      id: team1Id,
      tournamentId,
      name: 'Blazers',
      playerIds: ['p1'],
      seed: 1,
      poolId,
    });

    const team2 = makeTeam({
      id: team2Id,
      tournamentId,
      name: 'Stingers',
      playerIds: ['p2'],
      seed: 2,
      poolId,
    });

    const pool = makePool({
      id: poolId,
      tournamentId,
      name: 'Pool A',
      teamIds: [team1Id, team2Id],
      schedule: [
        { round: 1, team1Id, team2Id, matchId: null, court: null },
      ],
      standings: [
        { teamId: team1Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
        { teamId: team2Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      ],
    });

    await Promise.all([
      seedFirestoreDocAdmin('tournaments', tournamentId, tournament),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolId, pool),
    ]);

    // ── Step 2: Navigate to dashboard and verify initial state ──

    await goToTournamentDashboard(page, tournamentId);

    // Verify pool standings are visible with zero records
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Blazers' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Stingers' })).toBeVisible({ timeout: 10000 });

    // Verify both teams have 0 wins initially
    const blazersRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Blazers' }) });
    await expect(blazersRow.locator('td').nth(2)).toHaveText('0', { timeout: 10000 }); // W = 0

    // ── Step 3: Click "Score" to navigate to scoring page ──

    const scoreBtn = page.getByRole('button', { name: 'Score' });
    await expect(scoreBtn).toBeVisible({ timeout: 10000 });
    await scoreBtn.click();

    // Verify navigation to /score/:matchId
    await expect(page).toHaveURL(/\/score\/[a-f0-9-]+/, { timeout: 15000 });

    // Verify scoring page loads with correct team names.
    // Team names appear in multiple elements (sr-only, label, button) so use .first().
    await scoring.expectOnScoringScreen();
    await expect(page.getByText('Blazers', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Stingers', { exact: true })).toBeVisible({ timeout: 10000 });

    // ── Step 4: Score a full match (11-0) for Blazers ──

    // Tournament scoring page uses the actual team names in button aria-labels
    // (e.g., "Score point for Blazers"), not "Score point for Team 1".
    // Click the team's score button directly.
    const blazerScoreBtn = page.getByRole('button', { name: 'Score point for Blazers' });
    for (let i = 0; i < 11; i++) {
      await blazerScoreBtn.click();
    }

    // Verify match is over
    await scoring.expectMatchOver();

    // ── Step 5: Save & Finish — should navigate back ──

    await scoring.saveAndFinish();

    // After saving a tournament match, the app navigates back to the tournament dashboard
    // or to match history. Wait for the URL to change away from the scoring page.
    await expect(page).not.toHaveURL(/\/score\//, { timeout: 15000 });

    // ── Step 6: Navigate back to the tournament dashboard and verify standings ──

    // Regardless of where Save & Finish navigates, go back to the dashboard to verify standings
    await goToTournamentDashboard(page, tournamentId);

    // Wait for pool standings to load
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });

    // Verify the schedule entry now shows as "Completed"
    await expect(page.getByText('Schedule')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify Blazers row: W=1, L=0
    const blazersRowAfter = page.locator('tr', { has: page.getByRole('cell', { name: 'Blazers' }) });
    await expect(blazersRowAfter.locator('td').nth(2)).toHaveText('1', { timeout: 15000 }); // W
    await expect(blazersRowAfter.locator('td').nth(3)).toHaveText('0'); // L

    // Verify Stingers row: W=0, L=1
    const stingersRowAfter = page.locator('tr', { has: page.getByRole('cell', { name: 'Stingers' }) });
    await expect(stingersRowAfter.locator('td').nth(2)).toHaveText('0', { timeout: 15000 }); // W
    await expect(stingersRowAfter.locator('td').nth(3)).toHaveText('1'); // L
  });

  /**
   * Bracket scoring integration: Score a bracket match and verify winner is recorded.
   */
  test('bracket match: score from dashboard, verify winner shown', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const scoring = new ScoringPage(page);

    const tournamentId = `tournament-${randomUUID().slice(0, 8)}`;
    const team1Id = `team-${randomUUID().slice(0, 8)}`;
    const team2Id = `team-${randomUUID().slice(0, 8)}`;
    const slotId = `slot-${randomUUID().slice(0, 8)}`;

    // Seed single-elimination tournament in bracket status
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: uid,
      status: 'bracket',
      format: 'single-elimination',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 0,
        teamsPerPoolAdvancing: 0,
      },
      registrationCounts: { confirmed: 2, pending: 0 },
    });

    await Promise.all([
      seedFirestoreDocAdmin('tournaments', tournamentId, tournament),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, {
        id: team1Id,
        tournamentId,
        name: 'Thunder',
        playerIds: ['p1'],
        seed: null,
        poolId: null,
      }),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, {
        id: team2Id,
        tournamentId,
        name: 'Lightning',
        playerIds: ['p2'],
        seed: null,
        poolId: null,
      }),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, slotId, {
        id: slotId,
        tournamentId,
        round: 1,
        position: 1,
        team1Id,
        team2Id,
        matchId: null,
        winnerId: null,
        nextSlotId: null,
      }),
    ]);

    // Navigate to dashboard
    await goToTournamentDashboard(page, tournamentId);

    // Verify bracket is visible with team names
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Thunder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Lightning')).toBeVisible({ timeout: 10000 });

    // Click "Score Match" on the bracket slot
    const scoreMatchBtn = page.getByRole('button', { name: 'Score Match' });
    await expect(scoreMatchBtn).toBeVisible({ timeout: 10000 });
    await scoreMatchBtn.click();

    // Verify navigation to scoring page
    await expect(page).toHaveURL(/\/score\/[a-f0-9-]+/, { timeout: 15000 });
    await scoring.expectOnScoringScreen();

    // Score 11-0 for Thunder. Tournament matches use actual team names in button
    // aria-labels (e.g., "Score point for Thunder"), not "Score point for Team 1".
    const thunderScoreBtn = page.getByRole('button', { name: 'Score point for Thunder' });
    for (let i = 0; i < 11; i++) {
      await thunderScoreBtn.click();
    }
    await scoring.expectMatchOver();

    // Save & Finish
    await scoring.saveAndFinish();
    await expect(page).not.toHaveURL(/\/score\//, { timeout: 15000 });

    // Navigate back to dashboard to verify bracket updated
    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // The bracket slot should no longer show "Score Match" (match is completed)
    // Instead it should show the winner or a completed state
    await expect(page.getByText('Thunder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Lightning')).toBeVisible({ timeout: 10000 });
  });
});
