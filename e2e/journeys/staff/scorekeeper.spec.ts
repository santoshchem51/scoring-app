// e2e/journeys/staff/scorekeeper.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, uid } from '../../helpers/factories';
import { captureScreen } from '../../helpers/screenshots';

async function seedScorekeeperTournament(userUid: string, role: string = 'scorekeeper') {
  const ids = {
    tournament: uid('tournament'),
    team1: uid('team'),
    team2: uid('team'),
    pool: uid('pool'),
  };

  const tournament = makeTournament({
    id: ids.tournament,
    organizerId: 'other-organizer',
    status: 'pool-play',
    format: 'round-robin',
    staff: { [userUid]: role },
    staffUids: [userUid],
    config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
  });
  await seedFirestoreDocAdmin('tournaments', ids.tournament, tournament);

  const team1 = makeTeam({ id: ids.team1, tournamentId: ids.tournament, name: 'Alpha Squad', poolId: ids.pool });
  const team2 = makeTeam({ id: ids.team2, tournamentId: ids.tournament, name: 'Beta Squad', poolId: ids.pool });
  await seedFirestoreDocAdmin(`tournaments/${ids.tournament}/teams`, ids.team1, team1);
  await seedFirestoreDocAdmin(`tournaments/${ids.tournament}/teams`, ids.team2, team2);

  const pool = makePool({
    id: ids.pool,
    tournamentId: ids.tournament,
    name: 'Pool A',
    teamIds: [ids.team1, ids.team2],
    schedule: [
      { matchId: null, team1Id: ids.team1, team2Id: ids.team2, round: 1, court: null },
    ],
    standings: [
      { teamId: ids.team1, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      { teamId: ids.team2, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
    ],
  });
  await seedFirestoreDocAdmin(`tournaments/${ids.tournament}/pools`, ids.pool, pool);

  return ids;
}

test.describe('Staff P0: Scorekeeper Permissions', () => {

  // S1: scorekeeper sees "Matches to Score" list
  test('S1: scorekeeper sees match list on tournament dashboard', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const ids = await seedScorekeeperTournament(userUid);

    await page.goto(`/tournaments/${ids.tournament}`);

    // Wait for positive element first
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Alpha Squad vs Beta Squad')).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-scorekeeper-matchlist');
  });

  // S2: scorekeeper taps Score → navigates to scoring page
  test('S2: scorekeeper taps Score and navigates to scoring page', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const ids = await seedScorekeeperTournament(userUid);

    await page.goto(`/tournaments/${ids.tournament}`);

    // Wait for match list to appear
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });

    // Click the Score button on the match row
    const scoreBtn = page.getByText('Score', { exact: true });
    await expect(scoreBtn).toBeVisible({ timeout: 10000 });
    await scoreBtn.click();

    // Should navigate to /score/ URL
    await expect(page).toHaveURL(/\/score\//, { timeout: 15000 });
  });

  // S3: scorekeeper does NOT see admin UI (StaffManager, OrganizerControls)
  test('S3: scorekeeper does NOT see admin-only UI sections', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const ids = await seedScorekeeperTournament(userUid);

    await page.goto(`/tournaments/${ids.tournament}`);

    // Wait for positive element first — scorekeeper should see Activity Log
    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 15000 });

    // Should NOT see admin-only sections
    await expect(page.getByRole('heading', { name: 'Staff' })).not.toBeVisible();
    await expect(page.getByText('Organizer Controls')).not.toBeVisible();
    await expect(page.getByText('Add Staff')).not.toBeVisible();
  });

  // S5: scorekeeper sees Activity Log
  test('S5: scorekeeper sees Activity Log section', async ({
    authenticatedPage: page,
  }) => {
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
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText('Activity Log')).toBeVisible({ timeout: 15000 });
    // With no audit entries, should show empty state
    await expect(page.getByText('No activity yet')).toBeVisible({ timeout: 10000 });
  });

  // S20: non-staff user sees NO staff sections
  test('S20: non-staff user sees no staff sections', async ({
    authenticatedPage: page,
  }) => {
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      organizerId: 'other-organizer',
      status: 'pool-play',
      format: 'round-robin',
      staff: {},
      staffUids: [],
      config: { poolCount: 2, poolSize: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    await page.goto(`/tournaments/${tournamentId}`);

    // Wait for page to load — the status card should be visible
    await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 15000 });

    // None of the staff sections should appear
    await expect(page.getByText('Matches to Score')).not.toBeVisible();
    await expect(page.getByText('Activity Log')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff' })).not.toBeVisible();
    await expect(page.getByText('Disputes')).not.toBeVisible();
  });
});
