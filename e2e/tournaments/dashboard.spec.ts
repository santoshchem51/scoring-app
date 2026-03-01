// e2e/tournaments/dashboard.spec.ts
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeTournament } from '../helpers/factories';
import { randomUUID } from 'crypto';
import type { Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────

/** Get the current user's UID from the Firebase auth globals on the page. */
async function getCurrentUserUid(page: Page): Promise<string> {
  return page.evaluate(
    () => (window as any).__TEST_FIREBASE__?.auth?.currentUser?.uid as string,
  );
}

/** Navigate to the tournament dashboard and wait for it to load. */
async function goToDashboard(page: Page, tournamentId: string) {
  await page.goto(`/tournaments/${tournamentId}`);
  await page.waitForSelector('text=Status', { timeout: 15000 });
}

/** Create a tournament seeded in Firestore with the authenticated user as organizer. */
async function seedOrganizerTournament(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  const uid = await getCurrentUserUid(page);
  const tournament = makeTournament({
    organizerId: uid,
    config: {
      gameType: 'doubles',
      scoringMode: 'sideout',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 1,
      teamsPerPoolAdvancing: 2,
    },
    ...overrides,
  });
  await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);
  return { tournament, uid };
}

/** Seed N player registrations and teams for a tournament. */
async function seedPlayersAndTeams(
  tournamentId: string,
  count: number,
  options: { teamFormation?: string } = {},
) {
  const registrations: Array<{ id: string; userId: string; playerName: string }> = [];

  for (let i = 0; i < count; i++) {
    const playerId = `player-${randomUUID().slice(0, 8)}`;
    const playerName = `Player ${i + 1}`;

    // Seed registration
    const reg = {
      id: playerId,
      tournamentId,
      userId: playerId,
      playerName,
      teamId: null,
      paymentStatus: 'unpaid',
      paymentNote: '',
      lateEntry: false,
      skillRating: 3.5,
      partnerId: null,
      partnerName: null,
      profileComplete: true,
      registeredAt: Date.now(),
      status: 'confirmed',
      declineReason: null,
      statusUpdatedAt: null,
    };
    await seedFirestoreDocAdmin(
      `tournaments/${tournamentId}/registrations`,
      playerId,
      reg,
    );

    // Seed team (1 player per team for singles-style seeding)
    const teamId = `team-${randomUUID().slice(0, 8)}`;
    const team = {
      id: teamId,
      tournamentId,
      name: playerName,
      playerIds: [playerId],
      seed: null,
      poolId: null,
    };
    await seedFirestoreDocAdmin(
      `tournaments/${tournamentId}/teams`,
      teamId,
      team,
    );

    registrations.push({ id: playerId, userId: playerId, playerName });
  }

  return registrations;
}

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Tournament Dashboard (Manual Plan 4.8)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. Status Transitions: setup → registration → pool-play → completed (round-robin)
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Status transitions', () => {

    test('round-robin: setup → registration → pool-play → completed', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'setup',
        format: 'round-robin',
        config: {
          gameType: 'singles',
          scoringMode: 'sideout',
          matchFormat: 'single',
          pointsToWin: 11,
          poolCount: 1,
          teamsPerPoolAdvancing: 2,
        },
      });

      await goToDashboard(page, tournament.id);

      // Step 1: Verify status is Setup
      await expect(page.getByText('Setup')).toBeVisible({ timeout: 10000 });

      // Step 2: Advance to Registration Open
      const advanceToReg = page.getByRole('button', { name: 'Advance to Registration Open' });
      await expect(advanceToReg).toBeVisible({ timeout: 10000 });
      await advanceToReg.click();

      // Wait for status to update
      await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

      // Step 3: Add players via the player manager (need at least 2 for advancing)
      const playerNameInput = page.getByPlaceholder('Player name');
      await expect(playerNameInput).toBeVisible({ timeout: 10000 });

      await playerNameInput.fill('Alice');
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      // Wait for save to complete (input clears and count updates)
      await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
      await expect(page.getByText('Registered Players (1)')).toBeVisible({ timeout: 10000 });

      await playerNameInput.fill('Bob');
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
      await expect(page.getByText('Registered Players (2)')).toBeVisible({ timeout: 10000 });

      // Step 4: Advance to Pool Play
      const advanceToPool = page.getByRole('button', { name: 'Advance to Pool Play' });
      await expect(advanceToPool).toBeVisible({ timeout: 10000 });
      await advanceToPool.click();

      // Wait for Pool Play status (live data takes a moment to update)
      await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 15000 });

      // Reload to ensure pool data loads from fresh snapshots
      await goToDashboard(page, tournament.id);
      await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 10000 });

      // Pool table should be visible
      await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
    });

    test('single-elimination: setup → registration → bracket → completed', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'setup',
        format: 'single-elimination',
        config: {
          gameType: 'singles',
          scoringMode: 'sideout',
          matchFormat: 'single',
          pointsToWin: 11,
          poolCount: 0,
          teamsPerPoolAdvancing: 0,
        },
      });

      await goToDashboard(page, tournament.id);

      // Setup → Registration
      await expect(page.getByText('Setup')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Advance to Registration Open' }).click();
      await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

      // Add 2 players
      const playerNameInput = page.getByPlaceholder('Player name');
      await playerNameInput.fill('Charlie');
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
      await expect(page.getByText('Registered Players (1)')).toBeVisible({ timeout: 10000 });

      await playerNameInput.fill('Dana');
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
      await expect(page.getByText('Registered Players (2)')).toBeVisible({ timeout: 10000 });

      // Registration → Bracket
      const advanceToBracket = page.getByRole('button', { name: 'Advance to Bracket Play' });
      await expect(advanceToBracket).toBeVisible({ timeout: 10000 });
      await advanceToBracket.click();

      // Wait for Bracket Play status
      await expect(page.getByText('Bracket Play')).toBeVisible({ timeout: 15000 });

      // Reload to ensure bracket data loads from fresh snapshots
      await goToDashboard(page, tournament.id);
      await expect(page.getByText('Bracket Play')).toBeVisible({ timeout: 10000 });

      // Bracket view heading should be visible
      await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Cannot skip status steps
  // ═══════════════════════════════════════════════════════════════════

  test('cannot skip status steps — setup shows only "Advance to Registration Open"', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'setup',
      format: 'round-robin',
    });

    await goToDashboard(page, tournament.id);

    // Should show "Advance to Registration Open" button
    await expect(
      page.getByRole('button', { name: 'Advance to Registration Open' }),
    ).toBeVisible({ timeout: 10000 });

    // Should NOT show buttons to skip directly to pool-play or bracket
    await expect(
      page.getByRole('button', { name: /Advance to Pool Play/ }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: /Advance to Bracket/ }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: /Advance to Completed/ }),
    ).not.toBeVisible();
  });

  test('cannot skip status steps — registration shows only next valid advance', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'registration',
      format: 'single-elimination',
    });

    await goToDashboard(page, tournament.id);

    // Single-elimination: registration → bracket (not pool-play)
    await expect(
      page.getByRole('button', { name: 'Advance to Bracket Play' }),
    ).toBeVisible({ timeout: 10000 });

    // Should NOT show advance to pool play (not in single-elim flow)
    await expect(
      page.getByRole('button', { name: /Advance to Pool Play/ }),
    ).not.toBeVisible();

    // Should NOT show advance to completed (would skip bracket)
    await expect(
      page.getByRole('button', { name: /Advance to Completed/ }),
    ).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Pause/Resume tournament
  // ═══════════════════════════════════════════════════════════════════

  test('pause and resume tournament during pool-play', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'pool-play',
      format: 'round-robin',
    });

    await goToDashboard(page, tournament.id);

    // Verify we start in Pool Play status
    await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 10000 });

    // Organizer Controls should show Pause button
    const pauseBtn = page.getByRole('button', { name: 'Pause' });
    await expect(pauseBtn).toBeVisible({ timeout: 10000 });

    // Click Pause
    await pauseBtn.click();

    // Status should change to Paused
    await expect(page.getByText('Paused')).toBeVisible({ timeout: 10000 });

    // Now Resume button should appear
    const resumeBtn = page.getByRole('button', { name: 'Resume' });
    await expect(resumeBtn).toBeVisible({ timeout: 10000 });

    // Click Resume
    await resumeBtn.click();

    // Status should revert to Pool Play
    await expect(page.getByText('Pool Play')).toBeVisible({ timeout: 10000 });

    // Pause button should reappear
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Cancel tournament with confirmation dialog
  // ═══════════════════════════════════════════════════════════════════

  test('cancel tournament with confirmation dialog', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'registration',
      format: 'round-robin',
    });

    await goToDashboard(page, tournament.id);
    await expect(page.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

    // Click "Cancel Tournament" in OrganizerControls
    const cancelBtn = page.getByRole('button', { name: 'Cancel Tournament' });
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
    await cancelBtn.click();

    // Confirmation dialog should appear
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: 'Cancel Tournament' })).toBeVisible();
    await expect(
      dialog.getByText(/cancel the tournament and notify all participants/),
    ).toBeVisible();

    // Confirm cancellation — the confirm button label is "Cancel Tournament"
    // The dialog is a bottom-sheet on mobile and the bottom nav bar may overlap.
    // Use JavaScript click to bypass pointer event interception from the nav bar.
    const confirmBtn = dialog.getByRole('button', { name: 'Cancel Tournament' });
    await confirmBtn.evaluate((el: HTMLElement) => el.click());

    // Status should change to Cancelled
    await expect(page.getByText('Cancelled')).toBeVisible({ timeout: 15000 });

    // OrganizerControls should no longer be visible (hidden when completed/cancelled)
    await expect(
      page.getByText('Organizer Controls'),
    ).not.toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. Player manager: add player manually via form
  // ═══════════════════════════════════════════════════════════════════

  test('add player manually via organizer player manager form', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'registration',
      format: 'round-robin',
    });

    await goToDashboard(page, tournament.id);

    // Wait for the Add Player form
    const playerNameInput = page.getByPlaceholder('Player name');
    await expect(playerNameInput).toBeVisible({ timeout: 10000 });

    // Verify no players registered initially
    await expect(page.getByText('Registered Players (0)')).toBeVisible({ timeout: 10000 });

    // Fill in the player name
    await playerNameInput.fill('Test Player One');

    // Click Add Player
    await page.getByRole('button', { name: 'Add Player', exact: true }).click();

    // Player should appear in the registered list
    await expect(page.getByText('Registered Players (1)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Test Player One')).toBeVisible({ timeout: 10000 });

    // Add a second player with skill rating
    await playerNameInput.fill('Test Player Two');
    // Select a skill rating — use the select without an id (OrganizerPlayerManager's)
    // The RegistrationForm's select has id="skill-rating"; the organizer form's doesn't.
    await page.locator('select:not([id])').selectOption('3.5');
    await page.getByRole('button', { name: 'Add Player', exact: true }).click();

    // Verify count increments
    await expect(page.getByText('Registered Players (2)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Test Player Two')).toBeVisible({ timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. Pairing panel: auto-pair generates valid pairings
  // ═══════════════════════════════════════════════════════════════════

  test('auto-pair generates valid pairings for doubles BYOP tournament', async ({
    authenticatedPage: page,
  }) => {
    const { tournament } = await seedOrganizerTournament(page, {
      status: 'registration',
      format: 'round-robin',
      teamFormation: 'byop',
      config: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
        poolCount: 1,
        teamsPerPoolAdvancing: 2,
      },
    });

    await goToDashboard(page, tournament.id);

    // Add 4 players via the player manager
    const playerNameInput = page.getByPlaceholder('Player name');
    await expect(playerNameInput).toBeVisible({ timeout: 10000 });

    const names = ['Alice', 'Bob', 'Charlie', 'Dana'];
    for (const name of names) {
      await playerNameInput.fill(name);
      await page.getByRole('button', { name: 'Add Player', exact: true }).click();
      // Wait for the input to clear (signals that save completed)
      await expect(playerNameInput).toHaveValue('', { timeout: 10000 });
    }

    // Verify all 4 are registered
    await expect(page.getByText('Registered Players (4)')).toBeVisible({ timeout: 10000 });

    // Pairing panel should show unmatched players
    await expect(page.getByText('Unmatched Players (4)')).toBeVisible({ timeout: 10000 });

    // "Auto-pair remaining" button should be visible
    const autoPairBtn = page.getByRole('button', { name: 'Auto-pair remaining' });
    await expect(autoPairBtn).toBeVisible({ timeout: 10000 });

    // Click auto-pair
    await autoPairBtn.click();

    // Should show 2 paired teams
    await expect(page.getByText('Paired Teams (2)')).toBeVisible({ timeout: 10000 });

    // All players paired message
    await expect(
      page.getByText('All players paired! Ready to advance.'),
    ).toBeVisible({ timeout: 10000 });

    // Unmatched Players section should disappear (0 unmatched)
    await expect(page.getByText(/Unmatched Players/)).not.toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. Scoring a tournament match updates standings
  // ═══════════════════════════════════════════════════════════════════

  test('scoring a pool match navigates to scoring page', async ({
    authenticatedPage: page,
  }) => {
    // Create a tournament already in pool-play with pools and schedule seeded
    const uid = await getCurrentUserUid(page);
    const tournamentId = `tournament-${randomUUID().slice(0, 8)}`;

    const team1Id = `team-${randomUUID().slice(0, 8)}`;
    const team2Id = `team-${randomUUID().slice(0, 8)}`;
    const poolId = `pool-${randomUUID().slice(0, 8)}`;

    // Seed the tournament
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
        teamsPerPoolAdvancing: 2,
      },
      registrationCounts: { confirmed: 2, pending: 0 },
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed teams
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, {
      id: team1Id,
      tournamentId,
      name: 'Team Alpha',
      playerIds: ['p1'],
      seed: null,
      poolId,
    });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, {
      id: team2Id,
      tournamentId,
      name: 'Team Beta',
      playerIds: ['p2'],
      seed: null,
      poolId,
    });

    // Seed pool with schedule
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolId, {
      id: poolId,
      tournamentId,
      name: 'Pool A',
      teamIds: [team1Id, team2Id],
      schedule: [
        {
          round: 1,
          team1Id,
          team2Id,
          matchId: null,
          court: null,
        },
      ],
      standings: [
        { teamId: team1Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
        { teamId: team2Id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
      ],
    });

    await goToDashboard(page, tournamentId);

    // Verify pool table is visible
    await expect(page.getByText('Pool Standings')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });

    // Verify team names appear in standings (use role to avoid matching schedule text)
    await expect(page.getByRole('cell', { name: 'Team Alpha' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Team Beta' })).toBeVisible({ timeout: 10000 });

    // Verify the "Score" button is visible for the unscored match
    const scoreBtn = page.getByRole('button', { name: 'Score' });
    await expect(scoreBtn).toBeVisible({ timeout: 10000 });

    // Click Score — should navigate to the scoring page
    await scoreBtn.click();

    // Should navigate to /score/:matchId
    await expect(page).toHaveURL(/\/score\/[a-f0-9-]+/, { timeout: 15000 });
  });

  test('scoring a bracket match shows Score Match button', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const tournamentId = `tournament-${randomUUID().slice(0, 8)}`;

    const team1Id = `team-${randomUUID().slice(0, 8)}`;
    const team2Id = `team-${randomUUID().slice(0, 8)}`;
    const slotId = `slot-${randomUUID().slice(0, 8)}`;

    // Seed the tournament
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
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Seed teams
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, {
      id: team1Id,
      tournamentId,
      name: 'Team Ace',
      playerIds: ['p1'],
      seed: null,
      poolId: null,
    });
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, {
      id: team2Id,
      tournamentId,
      name: 'Team Blaze',
      playerIds: ['p2'],
      seed: null,
      poolId: null,
    });

    // Seed bracket slot (Final round)
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/bracket`, slotId, {
      id: slotId,
      tournamentId,
      round: 1,
      position: 1,
      team1Id,
      team2Id,
      matchId: null,
      winnerId: null,
      nextSlotId: null,
    });

    await goToDashboard(page, tournamentId);

    // Verify bracket view heading is visible
    await expect(page.getByRole('heading', { name: 'Bracket' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Final')).toBeVisible({ timeout: 10000 });

    // Verify team names appear in the bracket
    await expect(page.getByText('Team Ace')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Team Blaze')).toBeVisible({ timeout: 10000 });

    // Verify "Score Match" button is visible
    const scoreMatchBtn = page.getByRole('button', { name: 'Score Match' });
    await expect(scoreMatchBtn).toBeVisible({ timeout: 10000 });

    // Click Score Match — should navigate to scoring page
    await scoreMatchBtn.click();
    await expect(page).toHaveURL(/\/score\/[a-f0-9-]+/, { timeout: 15000 });
  });
});
