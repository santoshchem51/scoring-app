// e2e/tournaments/layer10-admin.spec.ts
// Playwright E2E tests for Layer 10: Admin & Moderation features
import { test, expect } from '../fixtures';
import { seedFirestoreDocAdmin, getCurrentUserUid, goToTournamentDashboard } from '../helpers/emulator-auth';
import { makeTournament, makeUserProfile } from '../helpers/factories';
import { randomUUID } from 'crypto';
import type { Page } from '@playwright/test';

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
      defaultTier: 'beginner',
    },
    ...overrides,
  });
  await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);
  return { tournament, uid };
}

test.describe('Layer 10: Admin & Moderation', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. Staff Management — UI visibility and role display
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Staff Management', () => {

    test('organizer sees Staff section with Add Staff button', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Staff heading should be visible (admin+ only)
      await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible({ timeout: 10000 });

      // "Add Staff" button should be visible for organizer
      await expect(page.getByRole('button', { name: 'Add Staff' })).toBeVisible({ timeout: 5000 });

      // "No staff members yet" message when empty
      await expect(page.getByText('No staff members yet')).toBeVisible({ timeout: 5000 });
    });

    test('seeded staff members display with correct role badges', async ({
      authenticatedPage: page,
    }) => {
      const uid = await getCurrentUserUid(page);
      const adminUid = `admin-${randomUUID().slice(0, 8)}`;
      const modUid = `mod-${randomUUID().slice(0, 8)}`;
      const skUid = `sk-${randomUUID().slice(0, 8)}`;

      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
        staff: {
          [adminUid]: 'admin',
          [modUid]: 'moderator',
          [skUid]: 'scorekeeper',
        },
        staffUids: [adminUid, modUid, skUid],
      });

      // Seed user profiles for staff members so names display
      await seedFirestoreDocAdmin('users', adminUid, makeUserProfile({
        displayName: 'Alice Admin',
        displayNameLower: 'alice admin',
        email: `${adminUid}@test.com`,
      }));
      await seedFirestoreDocAdmin('users', modUid, makeUserProfile({
        displayName: 'Bob Moderator',
        displayNameLower: 'bob moderator',
        email: `${modUid}@test.com`,
      }));
      await seedFirestoreDocAdmin('users', skUid, makeUserProfile({
        displayName: 'Carol Scorekeeper',
        displayNameLower: 'carol scorekeeper',
        email: `${skUid}@test.com`,
      }));

      await goToTournamentDashboard(page, tournament.id);

      // Staff section heading
      await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible({ timeout: 10000 });

      // Role badges should be visible (use exact to avoid matching name "Alice Admin")
      await expect(page.getByText('Admin', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Moderator', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Scorekeeper', { exact: true })).toBeVisible({ timeout: 10000 });

      // Staff names should appear
      await expect(page.getByText('Alice Admin')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Bob Moderator')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Carol Scorekeeper')).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Activity Log — displayed for organizer
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Activity Log', () => {

    test('organizer sees Activity Log section', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Activity Log heading
      await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible({ timeout: 10000 });

      // Empty state
      await expect(page.getByText('No activity yet')).toBeVisible({ timeout: 5000 });
    });

    test('seeded audit entries appear in Activity Log', async ({
      authenticatedPage: page,
    }) => {
      const uid = await getCurrentUserUid(page);
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      // Seed an audit log entry
      const auditId = `audit-${randomUUID().slice(0, 8)}`;
      await seedFirestoreDocAdmin(
        `tournaments/${tournament.id}/auditLog`, auditId, {
          action: 'status_change',
          actorId: uid,
          actorName: 'Test Player',
          actorRole: 'owner',
          targetType: 'tournament',
          targetId: tournament.id,
          details: {
            action: 'status_change',
            oldStatus: 'setup',
            newStatus: 'registration',
          },
          timestamp: Date.now(),
        },
      );

      await goToTournamentDashboard(page, tournament.id);

      // Activity Log heading
      await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible({ timeout: 10000 });

      // The audit entry should be formatted and visible
      // formatAuditAction for status_change produces: "Test Player changed status from setup to registration"
      await expect(page.getByText(/changed status/)).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Quick Add Players
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Quick Add Players', () => {

    test('quick add textarea accepts names and creates placeholder registrations', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Quick-add textarea should be visible (admin+ only in registration)
      const textarea = page.getByPlaceholder('Enter one name per line');
      await expect(textarea).toBeVisible({ timeout: 10000 });

      // Type multiple player names
      await textarea.fill('Alice\nBob\nCharlie');

      // Count should show "3 names entered"
      await expect(page.getByText('3 names entered')).toBeVisible({ timeout: 5000 });

      // "Add 3 Players" button should be enabled
      const addBtn = page.getByRole('button', { name: 'Add 3 Players' });
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await expect(addBtn).toBeEnabled();

      // Click to add
      await addBtn.click();

      // After adding, the pending count should update on the status card
      // Quick-add creates placeholder registrations (status: 'placeholder') which count as pending
      await expect(page.getByText(/3 pending/)).toBeVisible({ timeout: 15000 });
    });

    test('quick add validates name length and count', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      const textarea = page.getByPlaceholder('Enter one name per line');
      await expect(textarea).toBeVisible({ timeout: 10000 });

      // Enter a name that's too long (>100 chars)
      const longName = 'A'.repeat(101);
      await textarea.fill(longName);

      // Error message should appear
      await expect(page.getByText(/exceeds 100 characters/)).toBeVisible({ timeout: 5000 });

      // Quick-add "Add Players" button should be disabled
      const addBtn = page.getByRole('button', { name: 'Add Players' });
      await expect(addBtn).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. CSV Export
  // ═══════════════════════════════════════════════════════════════════

  test.describe('CSV Export', () => {

    test('Export CSV button is visible for organizer in registration', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // "Export CSV" button should be visible (admin+ only)
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. Tournament Templates
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Tournament Templates', () => {

    test('Save as Template button opens modal', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // "Save as Template" button should be visible (admin+ only)
      const saveBtn = page.getByRole('button', { name: 'Save as Template' });
      await expect(saveBtn).toBeVisible({ timeout: 10000 });

      // Click to open modal
      await saveBtn.click();

      // Modal should appear with name input
      await expect(page.getByPlaceholder('Template name')).toBeVisible({ timeout: 5000 });
    });

    test('Save as Template saves and closes modal', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'registration',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Open template modal
      await page.getByRole('button', { name: 'Save as Template' }).click();

      // Name input should be visible
      const nameInput = page.getByPlaceholder('Template name');
      await expect(nameInput).toBeVisible({ timeout: 5000 });

      // Fill in template name
      await nameInput.fill('My Weekly Doubles');

      // Click Save button in modal (the button text is "Save")
      // Use the modal's Save button (not the Cancel button)
      const modal = page.locator('.fixed.inset-0');
      await modal.getByRole('button', { name: 'Save' }).click();

      // Modal should disappear (name input no longer visible)
      await expect(nameInput).not.toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. Dispute Panel
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Dispute Panel', () => {

    test('organizer sees Disputes section with empty state', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'pool-play',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Disputes heading (moderator+ only, organizer qualifies)
      await expect(page.getByRole('heading', { name: 'Disputes' })).toBeVisible({ timeout: 10000 });

      // Empty state
      await expect(page.getByText('No open disputes')).toBeVisible({ timeout: 5000 });
    });

    test('seeded open dispute displays with resolve buttons', async ({
      authenticatedPage: page,
    }) => {
      const uid = await getCurrentUserUid(page);
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'pool-play',
      });

      // Seed a dispute
      const disputeId = `dispute-${randomUUID().slice(0, 8)}`;
      await seedFirestoreDocAdmin(
        `tournaments/${tournament.id}/disputes`, disputeId, {
          matchId: `match-${randomUUID().slice(0, 8)}`,
          tournamentId: tournament.id,
          flaggedBy: uid,
          flaggedByName: 'Test Player',
          reason: 'Score was entered incorrectly',
          status: 'open',
          resolvedBy: null,
          resolvedByName: null,
          resolution: null,
          createdAt: Date.now(),
          resolvedAt: null,
        },
      );

      await goToTournamentDashboard(page, tournament.id);

      // Disputes heading should be visible
      await expect(page.getByRole('heading', { name: 'Disputes' })).toBeVisible({ timeout: 10000 });

      // Open dispute should display the flagged-by name and reason
      await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Score was entered incorrectly')).toBeVisible({ timeout: 10000 });

      // "Open" badge
      await expect(page.getByText('Open')).toBeVisible({ timeout: 5000 });

      // Resolve buttons (organizer can resolve)
      await expect(page.getByRole('button', { name: 'Edit Scores' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible({ timeout: 5000 });
    });

    test('dismissing a dispute removes it from open list', async ({
      authenticatedPage: page,
    }) => {
      const uid = await getCurrentUserUid(page);
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'pool-play',
      });

      // Seed a dispute
      const disputeId = `dispute-${randomUUID().slice(0, 8)}`;
      await seedFirestoreDocAdmin(
        `tournaments/${tournament.id}/disputes`, disputeId, {
          matchId: `match-${randomUUID().slice(0, 8)}`,
          tournamentId: tournament.id,
          flaggedBy: uid,
          flaggedByName: 'Test Player',
          reason: 'Wrong score',
          status: 'open',
          resolvedBy: null,
          resolvedByName: null,
          resolution: null,
          createdAt: Date.now(),
          resolvedAt: null,
        },
      );

      await goToTournamentDashboard(page, tournament.id);

      // Wait for dispute to show
      await expect(page.getByText('Wrong score')).toBeVisible({ timeout: 10000 });

      // Click Dismiss
      await page.getByRole('button', { name: 'Dismiss' }).click();

      // After dismissal, should show "No open disputes"
      await expect(page.getByText('No open disputes')).toBeVisible({ timeout: 15000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. Organizer Controls — visible only in active states
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Organizer Controls visibility', () => {

    test('organizer controls hidden when tournament is completed', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'completed',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Organizer Controls heading should NOT be visible
      await expect(page.getByText('Organizer Controls')).not.toBeVisible({ timeout: 5000 });
    });

    test('organizer controls hidden when tournament is cancelled', async ({
      authenticatedPage: page,
    }) => {
      const { tournament } = await seedOrganizerTournament(page, {
        status: 'cancelled',
      });

      await goToTournamentDashboard(page, tournament.id);

      // Organizer Controls heading should NOT be visible
      await expect(page.getByText('Organizer Controls')).not.toBeVisible({ timeout: 5000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. Template flow — create page loads templates
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Template integration', () => {

    test('create page shows TemplateSelector when user has templates', async ({
      authenticatedPage: page,
    }) => {
      const uid = await getCurrentUserUid(page);

      // Seed a template for this user
      const templateId = `tpl-${randomUUID().slice(0, 8)}`;
      await seedFirestoreDocAdmin(`users/${uid}/templates`, templateId, {
        id: templateId,
        name: 'Weekly Doubles',
        format: 'round-robin',
        gameType: 'doubles',
        config: {
          gameType: 'doubles',
          scoringMode: 'rally',
          matchFormat: 'single',
          pointsToWin: 11,
          poolCount: 2,
          teamsPerPoolAdvancing: 2,
          defaultTier: 'beginner',
        },
        teamFormation: 'byop',
        maxPlayers: 16,
        accessMode: 'open',
        rules: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 3,
      });

      // Navigate to create page
      await page.goto('/tournaments/new');

      // "From Template" button should appear (TemplateSelector is rendered)
      const fromTemplateBtn = page.getByRole('button', { name: 'From Template' });
      await expect(fromTemplateBtn).toBeVisible({ timeout: 10000 });

      // Click to open dropdown — template name should appear
      await fromTemplateBtn.click();
      await expect(page.getByText('Weekly Doubles')).toBeVisible({ timeout: 5000 });
    });
  });
});
