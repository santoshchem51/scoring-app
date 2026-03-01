// e2e/tournaments/bracket.spec.ts
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../helpers/emulator-auth';
import { makeTournament, makeTeam, makeBracketSlot } from '../helpers/factories';

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Bracket (Manual Plan 4.10)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. Bracket renders correctly with round labels and team names
  // ═══════════════════════════════════════════════════════════════════

  test('bracket renders with correct round labels and team names', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);

    // Seed single-elimination tournament in bracket status
    const tournament = makeTournament({
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
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed 4 teams
    const team1 = makeTeam({ tournamentId, name: 'Lions', playerIds: ['p1'], seed: 1 });
    const team2 = makeTeam({ tournamentId, name: 'Tigers', playerIds: ['p2'], seed: 2 });
    const team3 = makeTeam({ tournamentId, name: 'Panthers', playerIds: ['p3'], seed: 3 });
    const team4 = makeTeam({ tournamentId, name: 'Jaguars', playerIds: ['p4'], seed: 4 });

    // Seed bracket: 2 semifinals (round 1) + 1 final (round 2)
    const semi1 = makeBracketSlot({ tournamentId, round: 1, position: 1, team1Id: team1.id, team2Id: team2.id });
    const semi2 = makeBracketSlot({ tournamentId, round: 1, position: 2, team1Id: team3.id, team2Id: team4.id });
    const final = makeBracketSlot({ tournamentId, round: 2, position: 1 });

    // Set nextSlotId references
    semi1.nextSlotId = final.id;
    semi2.nextSlotId = final.id;

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team3.id, team3),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team4.id, team4),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi1.id, semi1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi2.id, semi2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, final.id, final),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify bracket heading
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // Verify round labels: "Semifinals" (round 1 of 2) and "Final" (round 2 of 2)
    // Note: "Semifinals" contains "final", so use exact: true for "Final"
    await expect(page.getByText('Semifinals')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Final', { exact: true })).toBeVisible({ timeout: 10000 });

    // Verify all team names appear in the bracket
    await expect(page.getByText('Lions')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tigers')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Panthers')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Jaguars')).toBeVisible({ timeout: 10000 });

    // Verify "Score Match" buttons for the 2 semifinal matches
    const scoreMatchBtns = page.getByRole('button', { name: 'Score Match' });
    await expect(scoreMatchBtns).toHaveCount(2, { timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Match results advance winner to next round
  // ═══════════════════════════════════════════════════════════════════

  test('match result advances winner to next bracket slot', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const matchId1 = `match-${crypto.randomUUID().slice(0, 8)}`;

    // Seed tournament
    const tournament = makeTournament({
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
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed 4 teams
    const team1 = makeTeam({ tournamentId, name: 'Aces', playerIds: ['p1'], seed: 1 });
    const team2 = makeTeam({ tournamentId, name: 'Blaze', playerIds: ['p2'], seed: 2 });
    const team3 = makeTeam({ tournamentId, name: 'Crush', playerIds: ['p3'], seed: 3 });
    const team4 = makeTeam({ tournamentId, name: 'Dynamo', playerIds: ['p4'], seed: 4 });

    // Semifinal 1: Aces beat Blaze (winnerId set, matchId set)
    const semi1 = makeBracketSlot({
      tournamentId, round: 1, position: 1,
      team1Id: team1.id, team2Id: team2.id,
      matchId: matchId1, winnerId: team1.id,
    });
    // Semifinal 2: Crush vs Dynamo (not yet played)
    const semi2 = makeBracketSlot({
      tournamentId, round: 1, position: 2,
      team1Id: team3.id, team2Id: team4.id,
    });
    // Final: Aces (advanced from semi1) vs TBD (waiting for semi2)
    const final = makeBracketSlot({
      tournamentId, round: 2, position: 1,
      team1Id: team1.id,
    });

    // Set nextSlotId references
    semi1.nextSlotId = final.id;
    semi2.nextSlotId = final.id;

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team3.id, team3),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team4.id, team4),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi1.id, semi1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi2.id, semi2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, final.id, final),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify bracket heading
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // Verify round labels
    await expect(page.getByText('Semifinals')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Final', { exact: true })).toBeVisible({ timeout: 10000 });

    // Verify Aces appears in the Final round (advanced from semifinal 1)
    // The Final bracket card should contain "Aces" as team1
    // We already know Aces is in the semifinal — verify it also appears in Final area
    // Count occurrences: Aces should appear twice (once in semi, once in final)
    const acesLocators = page.getByText('Aces', { exact: true });
    await expect(acesLocators).toHaveCount(2, { timeout: 10000 });

    // Verify the other semifinal still has "Score Match" button (not yet played)
    await expect(page.getByRole('button', { name: 'Score Match' })).toBeVisible({ timeout: 10000 });

    // Verify the second semifinal teams are visible
    await expect(page.getByText('Crush')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Dynamo')).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Final match determines winner (tournament completed)
  // ═══════════════════════════════════════════════════════════════════

  test('final match winner shows as champion when tournament is completed', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const matchId1 = `match-${crypto.randomUUID().slice(0, 8)}`;
    const matchId2 = `match-${crypto.randomUUID().slice(0, 8)}`;
    const matchIdFinal = `match-${crypto.randomUUID().slice(0, 8)}`;

    // Seed completed single-elimination tournament
    const tournament = makeTournament({
      organizerId: uid,
      status: 'completed',
      format: 'single-elimination',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 0,
        teamsPerPoolAdvancing: 0,
      },
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    const tournamentId = tournament.id;
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed 4 teams
    const team1 = makeTeam({ tournamentId, name: 'Storm', playerIds: ['p1'], seed: 1 });
    const team2 = makeTeam({ tournamentId, name: 'Thunder', playerIds: ['p2'], seed: 2 });
    const team3 = makeTeam({ tournamentId, name: 'Lightning', playerIds: ['p3'], seed: 3 });
    const team4 = makeTeam({ tournamentId, name: 'Tornado', playerIds: ['p4'], seed: 4 });

    // Seed fully completed bracket
    // Semifinal 1: Storm beat Thunder
    const semi1 = makeBracketSlot({
      tournamentId, round: 1, position: 1,
      team1Id: team1.id, team2Id: team2.id,
      matchId: matchId1, winnerId: team1.id,
    });
    // Semifinal 2: Lightning beat Tornado
    const semi2 = makeBracketSlot({
      tournamentId, round: 1, position: 2,
      team1Id: team3.id, team2Id: team4.id,
      matchId: matchId2, winnerId: team3.id,
    });
    // Final: Storm vs Lightning — Storm wins the championship
    const final = makeBracketSlot({
      tournamentId, round: 2, position: 1,
      team1Id: team1.id, team2Id: team3.id,
      matchId: matchIdFinal, winnerId: team1.id,
    });

    // Set nextSlotId references
    semi1.nextSlotId = final.id;
    semi2.nextSlotId = final.id;

    await Promise.all([
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1.id, team1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2.id, team2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team3.id, team3),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team4.id, team4),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi1.id, semi1),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, semi2.id, semi2),
      seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, final.id, final),
    ]);

    await goToTournamentDashboard(page, tournamentId);

    // Verify tournament is in Completed status (exact match to avoid "Tournament Complete" ambiguity)
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify TournamentResults shows "Tournament Complete" and "Champion"
    await expect(page.getByText('Tournament Complete')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Champion')).toBeVisible({ timeout: 10000 });

    // Verify the champion name is shown (Storm)
    // TournamentResults shows champion in a text-xl div; "Storm" also appears in bracket slots
    // Use .first() to avoid strict mode violation from multiple matches
    await expect(page.getByText('Storm').first()).toBeVisible({ timeout: 10000 });

    // Verify bracket view is also visible (bracket shows in completed status)
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Semifinals')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Final', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
