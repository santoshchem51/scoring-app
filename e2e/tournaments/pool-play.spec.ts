// e2e/tournaments/pool-play.spec.ts
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool } from '../helpers/factories';

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Pool Play (Manual Plan 4.9)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. Pool assignments display correctly
  // ═══════════════════════════════════════════════════════════════════

  test('pool assignments display correctly with 2 pools', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    // Seed tournament in pool-play status with round-robin format
    const tournament = makeTournament({
      organizerId: uid,
      status: 'pool-play',
      format: 'round-robin',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 2,
        teamsPerPoolAdvancing: 1,
      },
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Create pools first to get their IDs
    const poolA = makePool({ tournamentId, name: 'Pool A' });
    const poolB = makePool({ tournamentId, name: 'Pool B' });

    // Seed 4 teams (2 per pool)
    const team1 = makeTeam({ tournamentId, name: 'Eagles', playerIds: ['p1'], seed: 1, poolId: poolA.id });
    const team2 = makeTeam({ tournamentId, name: 'Hawks', playerIds: ['p2'], seed: 2, poolId: poolA.id });
    const team3 = makeTeam({ tournamentId, name: 'Falcons', playerIds: ['p3'], seed: 3, poolId: poolB.id });
    const team4 = makeTeam({ tournamentId, name: 'Ravens', playerIds: ['p4'], seed: 4, poolId: poolB.id });

    // Set pool data now that team IDs are known
    poolA.teamIds = [team1.id, team2.id];
    poolA.schedule = [
      { round: 1, team1Id: team1.id, team2Id: team2.id, matchId: null, court: null },
    ];
    poolA.standings = [
      { teamId: team1.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      { teamId: team2.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
    ];

    poolB.teamIds = [team3.id, team4.id];
    poolB.schedule = [
      { round: 1, team1Id: team3.id, team2Id: team4.id, matchId: null, court: null },
    ];
    poolB.standings = [
      { teamId: team3.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      { teamId: team4.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
    ];

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team3.id, team3),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team4.id, team4),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolA.id, poolA),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolB.id, poolB),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify "Pool Standings" section heading
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });

    // Verify both pool names are displayed
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Pool B')).toBeVisible({ timeout: 10000 });

    // Verify team names appear in standings table cells
    await expect(page.getByRole('cell', { name: 'Eagles' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Hawks' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Falcons' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Ravens' })).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Standings update after each match (seeded with scored match)
  // ═══════════════════════════════════════════════════════════════════

  test('standings reflect results after a scored match', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;

    // Seed tournament in pool-play
    const tournament = makeTournament({
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
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed teams
    const pool = makePool({ tournamentId, name: 'Pool A' });
    const team1 = makeTeam({ tournamentId, name: 'Strikers', playerIds: ['p1'], seed: 1, poolId: pool.id });
    const team2 = makeTeam({ tournamentId, name: 'Defenders', playerIds: ['p2'], seed: 2, poolId: pool.id });

    // Seed pool with standings reflecting a completed match:
    // Strikers beat Defenders 11-5
    pool.teamIds = [team1.id, team2.id];
    pool.schedule = [
      { round: 1, team1Id: team1.id, team2Id: team2.id, matchId, court: null },
    ];
    pool.standings = [
      { teamId: team1.id, wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 5, pointDiff: 6 },
      { teamId: team2.id, wins: 0, losses: 1, pointsFor: 5, pointsAgainst: 11, pointDiff: -6 },
    ];

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, pool.id, pool),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify pool standings heading and pool name
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });

    // Verify team names in standings
    await expect(page.getByRole('cell', { name: 'Strikers' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Defenders' })).toBeVisible({ timeout: 10000 });

    // Verify standings values for Strikers (W=1, L=0, PF=11, PA=5, +/-=+6)
    // The PoolTable renders W/L/PF/PA/+/- as separate <td> cells
    // Strikers row: cells should contain 1, 0, 11, 5, +6
    const strikersRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Strikers' }) });
    const strikersCells = strikersRow.locator('td');
    // Cell order: #, Team, W, L, PF, PA, +/-
    await expect(strikersCells.nth(2)).toHaveText('1', { timeout: 10000 }); // W
    await expect(strikersCells.nth(3)).toHaveText('0'); // L
    await expect(strikersCells.nth(4)).toHaveText('11'); // PF
    await expect(strikersCells.nth(5)).toHaveText('5'); // PA
    await expect(strikersCells.nth(6)).toHaveText('+6'); // +/-

    // Verify standings values for Defenders (W=0, L=1, PF=5, PA=11, +/-=-6)
    const defendersRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Defenders' }) });
    const defendersCells = defendersRow.locator('td');
    await expect(defendersCells.nth(2)).toHaveText('0', { timeout: 10000 }); // W
    await expect(defendersCells.nth(3)).toHaveText('1'); // L
    await expect(defendersCells.nth(4)).toHaveText('5'); // PF
    await expect(defendersCells.nth(5)).toHaveText('11'); // PA
    await expect(defendersCells.nth(6)).toHaveText('-6'); // +/-

    // Verify the match shows as "Completed" in the schedule section
    await expect(page.getByText('Schedule')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Pool winners advance to bracket (pool-bracket format)
  // ═══════════════════════════════════════════════════════════════════

  test('pool winners advance to bracket in pool-bracket format', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;

    // Seed pool-bracket tournament in pool-play status
    const tournament = makeTournament({
      organizerId: uid,
      status: 'pool-play',
      format: 'pool-bracket',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 1,
        teamsPerPoolAdvancing: 2,
      },
      registrationCounts: { confirmed: 2, pending: 0 },
    });
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed 2 teams
    const pool = makePool({ tournamentId, name: 'Pool A' });
    const team1 = makeTeam({ tournamentId, name: 'Wolves', playerIds: ['p1'], seed: 1, poolId: pool.id });
    const team2 = makeTeam({ tournamentId, name: 'Bears', playerIds: ['p2'], seed: 2, poolId: pool.id });

    // Seed pool with ALL schedule entries having matchIds (all matches scored)
    // This is the key requirement — the advance button only works when pool is complete
    pool.teamIds = [team1.id, team2.id];
    pool.schedule = [
      { round: 1, team1Id: team1.id, team2Id: team2.id, matchId, court: null },
    ];
    pool.standings = [
      { teamId: team1.id, wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 5, pointDiff: 6 },
      { teamId: team2.id, wins: 0, losses: 1, pointsFor: 5, pointsAgainst: 11, pointDiff: -6 },
    ];

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, pool.id, pool),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify we start in pool-play (use exact match to avoid matching "Pool Play + Bracket" format label)
    await expect(page.getByText('Pool Play', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 10000 });

    // Click "Advance to Bracket Play" button
    const advanceBtn = page.getByRole('button', { name: 'Advance to Bracket Play' });
    await expect(advanceBtn).toBeVisible({ timeout: 10000 });
    await advanceBtn.click();

    // Wait for status to change to Bracket Play
    await expect(page.getByText('Bracket Play', { exact: true })).toBeVisible({ timeout: 15000 });

    // Reload to ensure bracket data loads from fresh snapshots
    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Bracket Play', { exact: true })).toBeVisible({ timeout: 10000 });

    // Bracket view heading should be visible
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // Both teams should appear in the bracket (they both advance since teamsPerPoolAdvancing=2)
    // Pool tables are still visible in bracket status for pool-bracket format, so team names
    // appear in multiple places. Use .first() to avoid strict mode violations.
    await expect(page.getByText('Wolves').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bears').first()).toBeVisible({ timeout: 10000 });
  });
});
