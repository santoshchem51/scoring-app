// e2e/journeys/organizer/advance-guards.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, makeBracketSlot, uid } from '../../helpers/factories';

test.describe('Organizer P0: Advance Guards (DASH-12, DASH-14)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // DASH-12: Advance to Completed via button
  // ═══════════════════════════════════════════════════════════════════

  test('DASH-12: advance to completed via button when all bracket matches done', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');
    const team1Id = uid('team');
    const team2Id = uid('team');
    const slotId = uid('slot');
    const matchId = uid('match');

    // Seed tournament in bracket phase with all matches completed
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid,
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
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed teams
    const team1 = makeTeam({ id: team1Id, tournamentId, name: 'Champions', playerIds: ['p1'] });
    const team2 = makeTeam({ id: team2Id, tournamentId, name: 'Runners Up', playerIds: ['p2'] });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, team1);
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, team2);

    // Seed bracket slot with a completed match (winnerId set)
    const slot = makeBracketSlot({
      id: slotId,
      tournamentId,
      round: 1,
      position: 1,
      team1Id,
      team2Id,
      matchId,
      winnerId: team1Id,
      nextSlotId: null,
    });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, slotId, slot);

    await goToTournamentDashboard(page, tournamentId);

    // Verify bracket status first
    await expect(page.getByText('Bracket Play')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });

    // Click "Advance to Completed" or "Complete Tournament" button
    const completeBtn = page.getByRole('button', { name: /Advance to Completed|Complete Tournament/ });
    await expect(completeBtn).toBeVisible({ timeout: 10000 });
    await completeBtn.click();

    // Verify status changes to completed
    await expect(page.getByText('Completed')).toBeVisible({ timeout: 15000 });

    // Organizer Controls should no longer be visible
    await expect(page.getByText('Organizer Controls')).not.toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DASH-14: Advance blocked with insufficient players
  // ═══════════════════════════════════════════════════════════════════

  test('DASH-14: advance blocked with 0 registered players', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    // Seed tournament in registration with 0 players
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid,
      status: 'registration',
      format: 'round-robin',
      config: {
        gameType: 'singles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 1,
        teamsPerPoolAdvancing: 2,
      },
      registrationCounts: { confirmed: 0, pending: 0 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    await goToTournamentDashboard(page, tournamentId);

    // Verify we're in registration
    await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

    // The advance button should be disabled or not visible with 0 players
    const advanceBtn = page.getByRole('button', { name: /Advance to Pool Play|Advance to Bracket/ });
    const advanceBtnVisible = await advanceBtn.isVisible().catch(() => false);

    if (advanceBtnVisible) {
      // Button exists but should be disabled
      await expect(advanceBtn).toBeDisabled({ timeout: 5000 });
    } else {
      // Button is not shown at all — this is also valid guard behavior
      await expect(advanceBtn).not.toBeVisible();
    }
  });

  test('DASH-14: advance blocked with only 1 registered player', async ({
    authenticatedPage: page,
  }) => {
    const userUid = await getCurrentUserUid(page);
    const tournamentId = uid('tournament');

    // Seed tournament in registration
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid,
      status: 'registration',
      format: 'round-robin',
      config: {
        gameType: 'singles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 1,
        teamsPerPoolAdvancing: 2,
      },
      registrationCounts: { confirmed: 0, pending: 0 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    await goToTournamentDashboard(page, tournamentId);
    await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

    // Add 1 player via organizer player manager
    const playerNameInput = page.getByPlaceholder('Player name');
    await expect(playerNameInput).toBeVisible({ timeout: 10000 });
    await playerNameInput.fill('Solo Player');
    await page.getByRole('button', { name: 'Add Player', exact: true }).click();
    await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
    await expect(page.getByText('Registered Players (1)')).toBeVisible({ timeout: 10000 });

    // The advance button should be disabled with only 1 player
    const advanceBtn = page.getByRole('button', { name: /Advance to Pool Play|Advance to Bracket/ });
    const advanceBtnVisible = await advanceBtn.isVisible().catch(() => false);

    if (advanceBtnVisible) {
      // Button exists but should be disabled
      await expect(advanceBtn).toBeDisabled({ timeout: 5000 });
    } else {
      // Button is not shown at all — this is also valid guard behavior
      await expect(advanceBtn).not.toBeVisible();
    }
  });
});
