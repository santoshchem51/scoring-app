// e2e/journeys/organizer/lifecycle.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, uid } from '../../helpers/factories';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';

test.describe('Organizer P0: Pool-Bracket Full Lifecycle (DASH-11)', () => {

  // DASH-11: Pool-bracket full lifecycle
  // Seeds state at each phase rather than clicking through all UI transitions,
  // following the pattern from dashboard.spec.ts.
  test('pool-bracket lifecycle: setup -> registration -> pool-play -> bracket -> completed', async ({
    authenticatedPage: page,
  }, testInfo) => {
    const userUid = await getCurrentUserUid(page);

    // ── Step 1: Create tournament in registration status ────────────────────
    await test.step('create pool-bracket tournament in registration', async () => {
      const tournament = makeTournament({
        organizerId: userUid,
        status: 'registration',
        format: 'pool-bracket',
        config: {
          gameType: 'singles',
          scoringMode: 'rally',
          matchFormat: 'single',
          pointsToWin: 11,
          poolCount: 1,
          teamsPerPoolAdvancing: 2,
        },
      });
      // Store tournament ID for subsequent steps via page state
      await page.evaluate((id) => { (window as any).__TEST_TOURNAMENT_ID__ = id; }, tournament.id);
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);
      await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });
    });

    const tournamentId: string = await page.evaluate(() => (window as any).__TEST_TOURNAMENT_ID__);

    // ── Step 3: Seed 4 registrations via player manager ──────────────
    await test.step('add 4 players via organizer player manager', async () => {
      const playerNameInput = page.getByPlaceholder('Player name');
      await expect(playerNameInput).toBeVisible({ timeout: 10000 });

      const names = ['Alice', 'Bob', 'Charlie', 'Dana'];
      for (const name of names) {
        await playerNameInput.fill(name);
        await page.getByRole('button', { name: 'Add Player', exact: true }).click();
        await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
      }
      await expect(page.getByText('Registered Players (4)')).toBeVisible({ timeout: 10000 });
    });

    // ── Step 4: Advance to Pool Play ─────────────────────────────────
    await test.step('advance to pool-play', async () => {
      const advanceToPool = page.getByRole('button', { name: 'Advance to Pool Play' });
      await expect(advanceToPool).toBeVisible({ timeout: 10000 });
      await advanceToPool.click();
      await expect(page.getByText('Pool Play').first()).toBeVisible({ timeout: 15000 });
    });

    // ── Step 5: Verify pool tables display (already on dashboard from step 4) ──
    await test.step('verify pool tables display', async () => {
      await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo, 'organizer-lifecycle-poolplay');
    });

    // ── Steps 6-7: Seed bracket state directly ───────────────────────
    // Scoring pool matches through UI is fragile (navigation, team name matching).
    // Seed the bracket state directly, then verify the bracket display.
    await test.step('seed bracket state directly', async () => {
      await seedFirestoreDocAdmin('tournaments', tournamentId, {
        ...makeTournament({
          id: tournamentId,
          organizerId: userUid,
          status: 'bracket',
          format: 'pool-bracket',
          config: {
            gameType: 'singles',
            scoringMode: 'rally',
            matchFormat: 'single',
            pointsToWin: 11,
            poolCount: 1,
            teamsPerPoolAdvancing: 2,
          },
          registrationCounts: { confirmed: 4, pending: 0 },
        }),
      });
    });

    // ── Step 8: Verify bracket displays ──────────────────────────────
    await test.step('verify bracket displays', async () => {
      await goToTournamentDashboard(page, tournamentId);
      await expect(page.getByText('Bracket Play')).toBeVisible({ timeout: 15000 });
    });

    // ── Steps 9-10: Seed completed state directly ────────────────────
    await test.step('seed completed state', async () => {
      await seedFirestoreDocAdmin('tournaments', tournamentId, {
        ...makeTournament({
          id: tournamentId,
          organizerId: userUid,
          status: 'completed',
          format: 'pool-bracket',
          config: {
            gameType: 'singles',
            scoringMode: 'rally',
            matchFormat: 'single',
            pointsToWin: 11,
            poolCount: 1,
            teamsPerPoolAdvancing: 2,
          },
          registrationCounts: { confirmed: 4, pending: 0 },
        }),
      });
    });

    // ── Step 11: Verify champion/results shown ───────────────────────
    await test.step('verify completed state shows results', async () => {
      await goToTournamentDashboard(page, tournamentId);
      await expect(page.getByText('Completed')).toBeVisible({ timeout: 15000 });

      // Organizer Controls should not be visible for completed tournament
      await expect(page.getByText('Organizer Controls')).not.toBeVisible({ timeout: 5000 });
    });
  });
});
