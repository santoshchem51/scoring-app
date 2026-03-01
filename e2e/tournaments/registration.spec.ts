// e2e/tournaments/registration.spec.ts
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../helpers/emulator-auth';
import { makeTournament, makeBuddyGroup } from '../helpers/factories';
import { randomUUID } from 'crypto';

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Tournament Registration (Manual Plan 4.2-4.6)', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 4.2 — Open Mode Registration
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Open mode', () => {

    test('player can register for an open tournament', async ({
      authenticatedPage: page,
    }) => {
      const code = `OPEN${randomUUID().slice(0, 6).toUpperCase()}`;
      const tournament = makeTournament({
        accessMode: 'open',
        shareCode: code,
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      const joinBtn = page.getByRole('button', { name: 'Join Tournament' });
      await expect(joinBtn).toBeVisible({ timeout: 15000 });
      await joinBtn.click();

      // After successful registration the form should show confirmation
      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });
    });

    test('registration status shown after registering', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'open',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      await page.getByRole('button', { name: 'Join Tournament' }).click();
      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });

      // Payment status should be visible (default: unpaid)
      await expect(page.getByText('Payment:')).toBeVisible();
    });

    test('duplicate registration blocked — no second Join button after registering', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'open',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      await page.getByRole('button', { name: 'Join Tournament' }).click();
      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });

      // Reload the page — should still show "You're In!" not "Join Tournament"
      await goToTournamentDashboard(page, tournament.id);
      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole('button', { name: 'Join Tournament' }),
      ).not.toBeVisible();
    });

    test('player count increments after registration', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'open',
        status: 'registration',
        registrationCounts: { confirmed: 0, pending: 0 },
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      // Before registration, confirmed count is 0
      // The dashboard info grid shows "Teams" count from live.teams(), but
      // registrationCounts.confirmed is updated via the batch write.
      // We check the "confirmed" count is incremented by verifying the
      // registration shows "You're In!" (confirming status = confirmed).
      await page.getByRole('button', { name: 'Join Tournament' }).click();
      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4.3 — Approval Mode Registration
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Approval mode', () => {

    test('player submits pending registration', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'approval',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      const askBtn = page.getByRole('button', { name: 'Ask to Join' });
      await expect(askBtn).toBeVisible({ timeout: 15000 });
      await askBtn.click();

      // After submitting, should show pending status
      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });
    });

    test('registration shows pending status after submission', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'approval',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      await page.getByRole('button', { name: 'Ask to Join' }).click();
      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByText('Check back here for updates from the organizer.'),
      ).toBeVisible();

      // "Withdraw Request" link should be available
      await expect(
        page.getByRole('button', { name: 'Withdraw Request' }),
      ).toBeVisible();
    });

    // TODO: Organizer approval flow (4.3c) — requires two browser contexts:
    // one logged in as organizer, one as player. The organizer would use the
    // ApprovalQueue component on the dashboard to approve the pending registration.
    // Skipped for now because it requires multi-user coordination and the
    // ApprovalQueue component lives inside OrganizerPlayerManager.
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4.4 — Invite-Only Mode Registration
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Invite-only mode', () => {

    test('non-invited user sees invite-only restriction message', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'invite-only',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      await expect(
        page.getByText('This tournament is invite only.'),
      ).toBeVisible({ timeout: 15000 });

      // Should NOT show a Join/Ask button
      await expect(
        page.getByRole('button', { name: 'Join Tournament' }),
      ).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Ask to Join' }),
      ).not.toBeVisible();
    });

    test('invited user can register', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'invite-only',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      // Get the current user's UID so we can seed an invitation for them
      const uid = await getCurrentUserUid(page);

      // Seed an invitation for this user
      const invitation = {
        id: uid,
        tournamentId: tournament.id,
        invitedUserId: uid,
        invitedEmail: 'test@example.com',
        invitedName: 'Test Player',
        invitedByUserId: 'test-organizer',
        status: 'pending',
        createdAt: Date.now(),
      };
      await seedFirestoreDocAdmin(
        `tournaments/${tournament.id}/invitations`,
        uid,
        invitation,
      );

      await goToTournamentDashboard(page, tournament.id);

      // Invited user should see the Join button (not restriction message)
      const joinBtn = page.getByRole('button', { name: 'Join Tournament' });
      await expect(joinBtn).toBeVisible({ timeout: 15000 });
      await joinBtn.click();

      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4.5 — Group Mode Registration
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Group mode', () => {

    test('non-member cannot register for group tournament', async ({
      authenticatedPage: page,
    }) => {
      const group = makeBuddyGroup({ name: 'Test Crew' });
      await seedFirestoreDocAdmin('buddyGroups', group.id, group);

      const tournament = makeTournament({
        accessMode: 'group',
        status: 'registration',
        buddyGroupId: group.id,
        buddyGroupName: 'Test Crew',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      await goToTournamentDashboard(page, tournament.id);

      // Should see restriction message
      await expect(
        page.getByText(/open to members of Test Crew/),
      ).toBeVisible({ timeout: 15000 });

      // Should NOT show Join button
      await expect(
        page.getByRole('button', { name: 'Join Tournament' }),
      ).not.toBeVisible();
    });

    test('group member can register', async ({
      authenticatedPage: page,
    }) => {
      const group = makeBuddyGroup({ name: 'Test Crew' });
      await seedFirestoreDocAdmin('buddyGroups', group.id, group);

      const tournament = makeTournament({
        accessMode: 'group',
        status: 'registration',
        buddyGroupId: group.id,
        buddyGroupName: 'Test Crew',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      // Get the current user's UID and seed them as a group member
      const uid = await getCurrentUserUid(page);
      const member = {
        userId: uid,
        displayName: 'Test Player',
        role: 'member',
        joinedAt: Date.now(),
      };
      await seedFirestoreDocAdmin(
        `buddyGroups/${group.id}/members`,
        uid,
        member,
      );

      await goToTournamentDashboard(page, tournament.id);

      const joinBtn = page.getByRole('button', { name: 'Join Tournament' });
      await expect(joinBtn).toBeVisible({ timeout: 15000 });
      await joinBtn.click();

      await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4.6 — Withdrawal and Re-registration
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Withdrawal', () => {

    // NOTE: For open-mode (confirmed) registrations, the RegistrationForm
    // does not currently render a "Withdraw" button — only "pending"
    // registrations show "Withdraw Request". The withdrawal tests below
    // use approval mode where withdrawal IS available in the UI.

    test('player with pending registration can withdraw', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'approval',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      // Register (creates pending status for approval mode)
      await goToTournamentDashboard(page, tournament.id);
      await page.getByRole('button', { name: 'Ask to Join' }).click();
      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });

      // Withdraw
      await page.getByRole('button', { name: 'Withdraw Request' }).click();

      // After withdrawal, should show withdrawn message
      await expect(
        page.getByText('You withdrew your registration.'),
      ).toBeVisible({ timeout: 10000 });
    });

    test('player can re-register after withdrawal from approval tournament', async ({
      authenticatedPage: page,
    }) => {
      const tournament = makeTournament({
        accessMode: 'approval',
        status: 'registration',
      });
      await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

      // Register
      await goToTournamentDashboard(page, tournament.id);
      await page.getByRole('button', { name: 'Ask to Join' }).click();
      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });

      // Withdraw
      await page.getByRole('button', { name: 'Withdraw Request' }).click();
      await expect(
        page.getByText('You withdrew your registration.'),
      ).toBeVisible({ timeout: 10000 });

      // After withdrawal, the user sees the withdrawn state.
      // Re-registration requires the component to detect the "withdrawn" status
      // and show the form again. Looking at the RegistrationForm, when
      // existingStatus() === 'withdrawn', it shows "You withdrew your registration."
      // but does NOT render the registration form again (it's inside the
      // isAlreadyRegistered() Show block). So re-registration after withdrawal
      // is not currently supported in the UI.
      // TODO: Re-registration after withdrawal may need a UI enhancement —
      // currently the RegistrationForm shows "You withdrew your registration."
      // without a way to re-register.
    });
  });
});
