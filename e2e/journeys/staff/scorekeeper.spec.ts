// e2e/journeys/staff/scorekeeper.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid } from '../../helpers/emulator-auth';
import { makeTournament, uid } from '../../helpers/factories';
import { captureScreen } from '../../helpers/screenshots';
import { seedScorekeeperTournament } from '../../helpers/seeders';

test.describe('@p0 Staff P0: Scorekeeper Permissions', () => {

  // S1: scorekeeper sees "Matches to Score" list
  test('S1: scorekeeper sees match list on tournament dashboard', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);
    const seed = await seedScorekeeperTournament(userUid, {
      teamCount: 2,
      teamNames: ['Alpha Squad', 'Beta Squad'],
      gameType: 'doubles',
      scoringMode: 'sideout',
    });

    await page.goto(`/tournaments/${seed.tournamentId}`);

    // Wait for positive element first
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Alpha Squad vs Beta Squad').first()).toBeVisible({ timeout: 10000 });
    await captureScreen(page, testInfo, 'staff-scorekeeper-matchlist');
  });

  // S2: scorekeeper taps Score → navigates to scoring page
  test('S2: scorekeeper taps Score and navigates to scoring page', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const seed = await seedScorekeeperTournament(userUid, {
      teamCount: 2,
      teamNames: ['Alpha Squad', 'Beta Squad'],
      gameType: 'doubles',
      scoringMode: 'sideout',
    });

    await page.goto(`/tournaments/${seed.tournamentId}`);

    // Wait for match list to appear
    await expect(page.getByText('Matches to Score')).toBeVisible({ timeout: 15000 });

    // Click the Score button on the match row
    const scoreBtn = page.getByRole('button', { name: 'Score', exact: true });
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
    const seed = await seedScorekeeperTournament(userUid, {
      teamCount: 2,
      teamNames: ['Alpha Squad', 'Beta Squad'],
      gameType: 'doubles',
      scoringMode: 'sideout',
    });

    await page.goto(`/tournaments/${seed.tournamentId}`);

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
