// e2e/journeys/staff/staff-p1.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, makeBracketSlot, uid } from '../../helpers/factories';
import { PATHS } from '../../helpers/firestore-paths';
import { captureScreen } from '../../helpers/screenshots';

test.describe('@p1 Staff: P1 Role Permissions & Features', () => {

  // S4: Scorekeeper empty state — no matches to score
  test('S4: scorekeeper sees empty state when no matches to score', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'scorekeeper' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    // Seed an empty pool (no schedule entries) so ScorekeeperMatchList renders with zero matches
    const poolId = uid('pool');
    const pool = {
      id: poolId,
      tournamentId,
      name: 'Pool A',
      teamIds: [],
      schedule: [],
      standings: [],
    };
    await seedFirestoreDocAdmin(PATHS.pools(tournamentId), poolId, pool);

    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No matches waiting to be scored.')).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-s4-scorekeeper-empty');
  });

  // S6: Moderator sees Activity Log
  test('S6: moderator sees Activity Log with empty state', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'moderator' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No activity yet')).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-s6-moderator-activity-log');
  });

  // S9: Moderator does NOT see StaffManager
  test('S9: moderator does NOT see StaffManager section', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'moderator' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    await page.goto(`/tournaments/${tournamentId}`);

    // Positive wait: moderator sees Activity Log
    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 15000 });

    // Negative assertions: Staff heading and Add Staff button NOT visible
    await expect(page.getByRole('heading', { name: 'Staff' })).not.toBeVisible();
    await expect(page.getByText('Add Staff')).not.toBeVisible();
    await captureScreen(page, testInfo, 'staff-s9-moderator-no-staff-manager');
  });

  // S10: Moderator sees all moderator features
  test('S10: moderator sees Matches to Score, Disputes, Activity Log but NOT Organizer Controls or Staff', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');
    const poolId = uid('pool');
    const disputeId = uid('dispute');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'moderator' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    const team1 = makeTeam({ id: team1Id, tournamentId, name: 'Team Crimson', poolId });
    const team2 = makeTeam({ id: team2Id, tournamentId, name: 'Team Jade', poolId });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team1Id, team1);
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team2Id, team2);

    const pool = makePool({
      id: poolId,
      tournamentId,
      name: 'Pool A',
      teamIds: [team1Id, team2Id],
      schedule: [
        { matchId: null, team1Id, team2Id, round: 1, court: null },
      ],
      standings: [
        { teamId: team1Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
        { teamId: team2Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      ],
    });
    await seedFirestoreDocAdmin(PATHS.pools(tournamentId), poolId, pool);

    // Seed a dispute
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/disputes`, disputeId, {
      id: disputeId,
      matchId: uid('match'),
      tournamentId,
      flaggedBy: 'some-player-uid',
      flaggedByName: 'Angry Player',
      reason: 'Score was wrong',
      status: 'open',
      resolvedBy: null,
      resolvedByName: null,
      resolution: null,
      createdAt: Date.now(),
      resolvedAt: null,
    });

    await page.goto(`/tournaments/${tournamentId}`);

    // Moderator should see: Matches to Score, Disputes, Activity Log
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Disputes')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 10000 });

    // Moderator should NOT see: Organizer Controls, Staff heading
    await expect(page.getByText('Organizer Controls')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff' })).not.toBeVisible();
    await captureScreen(page, testInfo, 'staff-s10-moderator-features');
  });

  // S11: Admin sees Organizer Controls
  test('S11: admin sees Organizer Controls section', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'different-organizer-uid', // NOT the test user
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'admin' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    await page.goto(`/tournaments/${tournamentId}`);

    // Admin should see Organizer Controls heading
    await expect(page.getByText('Organizer Controls')).toBeVisible({ timeout: 15000 });

    // At least one control button visible (Pause or End Early available in pool-play)
    const pauseBtn = page.getByRole('button', { name: 'Pause' });
    const endEarlyBtn = page.getByRole('button', { name: 'End Early' });
    // At least one should be visible
    const pauseVisible = await pauseBtn.isVisible().catch(() => false);
    const endVisible = await endEarlyBtn.isVisible().catch(() => false);
    expect(pauseVisible || endVisible).toBe(true);
    await captureScreen(page, testInfo, 'staff-s11-admin-organizer-controls');
  });

  // S13: Admin advances tournament status
  test('S13: admin advances tournament from registration to pool play', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');
    const team3Id = uid('team');
    const team4Id = uid('team');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'different-organizer-uid',
      status: 'registration',
      format: 'round-robin',
      staff: { [userUid]: 'admin' },
      staffUids: [userUid],
      registrationCounts: { confirmed: 4, pending: 0 },
      config: { poolCount: 1, poolSize: 4, gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    // Seed 4 teams so advance is valid
    const teamNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
    const teamIds = [team1Id, team2Id, team3Id, team4Id];
    for (let i = 0; i < 4; i++) {
      const team = makeTeam({ id: teamIds[i], tournamentId, name: teamNames[i], playerIds: [`player-${i}`] });
      await seedFirestoreDocAdmin(PATHS.teams(tournamentId), teamIds[i], team);
    }

    // Also seed registrations so createTeamsFromRegistrations has data
    for (let i = 0; i < 4; i++) {
      const regId = uid('reg');
      await seedFirestoreDocAdmin(`tournaments/${tournamentId}/registrations`, regId, {
        id: regId,
        tournamentId,
        playerId: `player-${i}`,
        playerName: teamNames[i],
        status: 'confirmed',
        createdAt: Date.now(),
      });
    }

    await page.goto(`/tournaments/${tournamentId}`);

    // The advance button text should be "Advance to Pool Play"
    const advanceBtn = page.getByRole('button', { name: 'Advance to Pool Play' });
    await expect(advanceBtn).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo, 'staff-s13-before-advance');

    await advanceBtn.click();

    // Wait for status to change — either the button disappears or new status text appears
    // After advancing to pool-play, the status badge should show "Pool Play"
    await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo, 'staff-s13-after-advance');
  });

  // S14: Bracket scoring by scorekeeper
  test('S14: scorekeeper sees bracket match in Matches to Score and can click Score', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'bracket',
      format: 'single-elimination',
      staff: { [userUid]: 'scorekeeper' },
      staffUids: [userUid],
      config: { poolCount: 0, poolSize: 0, gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, teamsPerPoolAdvancing: 0 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    const team1 = makeTeam({ id: team1Id, tournamentId, name: 'Bracket Hawks' });
    const team2 = makeTeam({ id: team2Id, tournamentId, name: 'Bracket Eagles' });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team1Id, team1);
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team2Id, team2);

    // Seed a bracket slot with two teams — round 1, only slot = "Final"
    const slotId = uid('slot');
    const slot = makeBracketSlot({
      id: slotId,
      tournamentId,
      round: 1,
      position: 1,
      team1Id,
      team2Id,
    });
    await seedFirestoreDocAdmin(PATHS.bracket(tournamentId), slotId, slot);

    await page.goto(`/tournaments/${tournamentId}`);

    // Wait for Matches to Score heading
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });

    // The bracket match should be listed with team names
    await expect(page.getByText('Bracket Hawks vs Bracket Eagles').first()).toBeVisible({ timeout: 10000 });

    // It should show "Final" label since it's the only round
    await expect(page.getByText('Final').first()).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-s14-bracket-match-list');

    // Click the match row (which is a button containing "Score" text)
    const matchButton = page.getByText('Bracket Hawks vs Bracket Eagles').first().locator('..');
    await matchButton.click();

    // Should navigate to scoring page
    await expect(page).toHaveURL(/\/score\//, { timeout: 15000 });
    await captureScreen(page, testInfo, 'staff-s14-bracket-scoring-page');
  });

  // S17: Activity Log shows seeded audit entries
  test('S17: Activity Log shows seeded audit entries instead of empty state', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'scorekeeper' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

    // Seed audit log entries in the correct subcollection: tournaments/{id}/auditLog
    // Note: details must be a simple map (no nested arrays) for Firestore REST API seeding
    const auditId = uid('audit');
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/auditLog`, auditId, {
      id: auditId,
      action: 'score_edit',
      actorId: 'some-user',
      actorName: 'Scorer Sam',
      actorRole: 'scorekeeper',
      targetType: 'match',
      targetId: 'match-123',
      details: {
        action: 'score_edit',
        matchId: 'match-123',
      },
      timestamp: Date.now(),
    });

    await page.goto(`/tournaments/${tournamentId}`);

    // Activity Log heading should be visible
    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 15000 });

    // The formatted audit entry should appear: "Scorer Sam edited match scores"
    await expect(page.getByText('Scorer Sam edited match scores')).toBeVisible({ timeout: 10000 });

    // "No activity yet" should NOT be visible
    await expect(page.getByText('No activity yet')).not.toBeVisible();
    await captureScreen(page, testInfo, 'staff-s17-activity-log-with-entries');
  });
});
