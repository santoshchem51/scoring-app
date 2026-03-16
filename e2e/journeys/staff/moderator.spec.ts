// e2e/journeys/staff/moderator.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, uid } from '../../helpers/factories';

test.describe('Staff P0: Moderator Permissions', () => {

  // S7: moderator sees Edit Score button on completed matches
  test('S7: moderator sees Edit Score button on completed pool match', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');
    const poolId = uid('pool');
    const matchId = uid('match');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'moderator' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    const team1 = makeTeam({ id: team1Id, tournamentId, name: 'Team Crimson', poolId });
    const team2 = makeTeam({ id: team2Id, tournamentId, name: 'Team Jade', poolId });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, team1);
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, team2);

    const pool = makePool({
      id: poolId,
      tournamentId,
      name: 'Pool A',
      teamIds: [team1Id, team2Id],
      schedule: [
        { matchId, team1Id, team2Id, round: 1, court: null },
      ],
      standings: [
        { teamId: team1Id, wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 5, pointDiff: 6 },
        { teamId: team2Id, wins: 0, losses: 1, pointsFor: 5, pointsAgainst: 11, pointDiff: -6 },
      ],
    });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolId, pool);

    await page.goto(`/tournaments/${tournamentId}`);

    // Wait for pool standings to load
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });

    // Moderator should see Edit Score button on the completed match
    await expect(page.getByRole('button', { name: /Edit Score/i })).toBeVisible({ timeout: 10000 });
  });

  // S8: moderator sees DisputePanel
  test('S8: moderator sees Disputes section with seeded dispute', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const disputeId = uid('dispute');
    const matchId = uid('match');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'moderator' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed a dispute document
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/disputes`, disputeId, {
      id: disputeId,
      matchId,
      tournamentId,
      flaggedBy: 'some-player-uid',
      flaggedByName: 'Angry Player',
      reason: 'Score was recorded incorrectly',
      status: 'open',
      resolvedBy: null,
      resolvedByName: null,
      resolution: null,
      createdAt: Date.now(),
      resolvedAt: null,
    });

    await page.goto(`/tournaments/${tournamentId}`);

    // Wait for Disputes heading to appear
    await expect(page.getByText('Disputes')).toBeVisible({ timeout: 15000 });

    // The dispute details should be visible
    await expect(page.getByText('Angry Player')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Score was recorded incorrectly')).toBeVisible({ timeout: 10000 });

    // The "Open" badge should be visible
    await expect(page.getByText('Open')).toBeVisible({ timeout: 10000 });

    // Moderator should see resolve actions
    await expect(page.getByRole('button', { name: 'Edit Scores' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible({ timeout: 10000 });
  });
});
