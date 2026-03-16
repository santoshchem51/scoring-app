// e2e/journeys/staff/admin-e2e.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, uid } from '../../helpers/factories';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';

test.describe('Staff P0: Admin & Scorekeeper E2E', () => {

  // S12: admin sees StaffManager with role badges for all staff
  test('S12: admin sees StaffManager with role badges for 3 staff members', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const modUid = uid('user');
    const skUid = uid('user');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid, // admin is the organizer (gets admin+ via organizer role)
      status: 'pool-play',
      format: 'round-robin',
      staff: {
        [userUid]: 'admin',
        [modUid]: 'moderator',
        [skUid]: 'scorekeeper',
      },
      staffUids: [userUid, modUid, skUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed user profiles so StaffManager can display names
    await seedFirestoreDocAdmin('users', userUid, {
      id: userUid,
      displayName: 'Admin Alice',
      email: 'alice@test.com',
      photoURL: null,
      createdAt: Date.now(),
    });
    await seedFirestoreDocAdmin('users', modUid, {
      id: modUid,
      displayName: 'Mod Bob',
      email: 'bob@test.com',
      photoURL: null,
      createdAt: Date.now(),
    });
    await seedFirestoreDocAdmin('users', skUid, {
      id: skUid,
      displayName: 'Scorer Carol',
      email: 'carol@test.com',
      photoURL: null,
      createdAt: Date.now(),
    });

    await page.goto(`/tournaments/${tournamentId}`);

    // Wait for Staff heading to appear (admin+ only section)
    await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible({ timeout: 15000 });

    // Verify role badges are displayed
    await expect(page.getByText('Admin')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Moderator')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Scorekeeper')).toBeVisible({ timeout: 10000 });

    // Verify the Add Staff button is visible (admin privilege)
    await expect(page.getByRole('button', { name: 'Add Staff' })).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-admin-staffmanager');
  });

  // S16: scorekeeper scores a pool match end-to-end
  // Flow: dashboard → Score button → scoring page → score 11 pts → save → back to dashboard → match gone from unscored
  test('S16: scorekeeper scores pool match end-to-end (sideout, 11 points)', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');
    const poolId = uid('pool');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'scorekeeper' },
      staffUids: [userUid],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    const team1 = makeTeam({ id: team1Id, tournamentId, name: 'Volley Kings', poolId });
    const team2 = makeTeam({ id: team2Id, tournamentId, name: 'Net Ninjas', poolId });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, team1);
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, team2);

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
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolId, pool);

    // Step 1: Navigate to tournament dashboard
    await page.goto(`/tournaments/${tournamentId}`);

    // Step 2: Verify match list appears
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Volley Kings vs Net Ninjas')).toBeVisible({ timeout: 10000 });

    // Step 3: Click Score to navigate to scoring page
    const scoreBtn = page.getByText('Score', { exact: true });
    await expect(scoreBtn).toBeVisible({ timeout: 10000 });
    await scoreBtn.click();

    // Step 4: Verify we're on the scoring page
    await expect(page).toHaveURL(/\/score\//, { timeout: 15000 });

    // Step 5: Score 11 points using ScoringPage POM
    // Sideout scoring: serving team (Team 1) scores all 11 points
    const scoring = new ScoringPage(page);

    // In sideout doubles, Team 1 starts serving (second server starts at 0-0-2)
    // Score 11 points for Team 1 (serving team can score)
    await scoring.scorePoints('Team 1', 11);

    // Step 6: Match should be over
    await scoring.expectMatchOver();

    // Step 7: Save and finish
    await scoring.saveAndFinish();

    // Step 8: Navigate back to tournament dashboard
    await page.goto(`/tournaments/${tournamentId}`);

    // Step 9: Wait for the page to load, then verify the match is no longer in the unscored list
    // The "Matches to Score" section should either show "No matches waiting" or not show the match
    await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 15000 });

    // Wait a moment for live data to propagate, then check
    // The match should no longer appear as scoreable
    await expect(page.getByText('No matches waiting to be scored.')).toBeVisible({ timeout: 15000 });
  });
});
