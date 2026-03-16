// e2e/journeys/organizer/approval-queue.spec.ts
import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../../helpers/emulator-auth';
import { makeTournament, uid } from '../../helpers/factories';

test.describe('Organizer P0: Approval Queue (REG-09)', () => {

  // REG-09: Organizer approves pending registration
  // Two browser contexts: authenticatedPage (organizer), secondAuthenticatedPage (player)
  test('REG-09: organizer approves pending registration from approval queue', async ({
    authenticatedPage: organizerPage,
    secondAuthenticatedPage: playerPage,
  }) => {
    const organizerUid = await getCurrentUserUid(organizerPage);
    const tournamentId = uid('tournament');

    // Step 1: Organizer creates an approval-mode tournament
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: organizerUid,
      status: 'registration',
      accessMode: 'approval',
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
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);

    // Step 2: Player registers (pending status for approval mode)
    await goToTournamentDashboard(playerPage, tournamentId);

    const askBtn = playerPage.getByRole('button', { name: 'Ask to Join' });
    await expect(askBtn).toBeVisible({ timeout: 15000 });
    await askBtn.click();

    // Player sees pending status
    await expect(playerPage.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });

    // Step 3: Organizer navigates to dashboard and sees pending registration
    await goToTournamentDashboard(organizerPage, tournamentId);
    await expect(organizerPage.getByText('Registration Open')).toBeVisible({ timeout: 10000 });

    // Organizer should see the pending registration in the approval queue
    // The ApprovalQueue component shows pending registrations with Approve/Reject buttons
    await expect(organizerPage.getByText('Pending')).toBeVisible({ timeout: 15000 });

    // Click "Approve" button for the pending registration
    const approveBtn = organizerPage.getByRole('button', { name: /Approve/ });
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    // Step 4: Verify the registration status changes
    // After approval, the pending entry should no longer show "Pending" with Approve button
    // The confirmed count should update
    await expect(approveBtn).not.toBeVisible({ timeout: 10000 });

    // Reload player page to verify they now see confirmed status
    await goToTournamentDashboard(playerPage, tournamentId);
    await expect(playerPage.getByText("You're In!")).toBeVisible({ timeout: 15000 });
  });
});
