import { test, expect } from '../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../helpers/emulator-auth';
import { GameSetupPage } from '../pages/GameSetupPage';
import { randomUUID } from 'crypto';

// Seed a buddy group with members for the test user
async function seedBuddyGroupForUser(
  ownerUid: string,
  members: Array<{ userId: string; displayName: string }>,
) {
  const groupId = `e2e-group-${randomUUID().slice(0, 8)}`;

  // Main group doc
  await seedFirestoreDocAdmin('buddyGroups', groupId, {
    id: groupId,
    name: 'Test Group',
    createdBy: ownerUid,
    memberCount: members.length + 1,
    createdAt: Date.now(),
  });

  // Owner as member (required for getGroupsForUser collection group query)
  await seedFirestoreDocAdmin(
    `buddyGroups/${groupId}/members`,
    ownerUid,
    {
      userId: ownerUid,
      displayName: 'Test Player',
      photoURL: null,
      role: 'admin',
      joinedAt: Date.now(),
    },
  );

  // Buddy members
  for (const member of members) {
    await seedFirestoreDocAdmin(
      `buddyGroups/${groupId}/members`,
      member.userId,
      {
        userId: member.userId,
        displayName: member.displayName,
        photoURL: null,
        role: 'member',
        joinedAt: Date.now(),
      },
    );
  }

  return groupId;
}

/** Seed a user profile doc so global search can find them */
async function seedUserProfile(
  userId: string,
  displayName: string,
  opts?: { profileVisibility?: 'public' | 'private'; photoURL?: string | null },
) {
  await seedFirestoreDocAdmin('users', userId, {
    id: userId,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email: `${userId}@test.com`,
    photoURL: opts?.photoURL ?? null,
    createdAt: Date.now(),
    profileVisibility: opts?.profileVisibility ?? 'public',
  });
}

test.describe('Casual Phase 2: Buddy Picker', () => {
  test('expand picker, assign buddy to team, start match → scoring page loads', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const setup = new GameSetupPage(page);

    // Seed buddy group with 2 buddies
    await seedBuddyGroupForUser(uid, [
      { userId: 'buddy-alice', displayName: 'Alice' },
      { userId: 'buddy-bob', displayName: 'Bob' },
    ]);

    await setup.goto();

    // Expand Add Players section
    await page.getByText(/Add Players/).click();
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10000 });

    // Tap Alice → action sheet opens
    await page.getByRole('button', { name: /Alice/ }).click();

    // Scope to the action sheet (fixed z-50 overlay) and click Team 1
    const actionSheet = page.locator('[data-testid="sheet-backdrop"]').locator('..');
    await expect(actionSheet.getByRole('heading', { name: 'Alice' })).toBeVisible();
    await actionSheet.getByRole('button', { name: /Team 1/ }).click();

    // Tap Done, then start match
    await page.getByText('Done').click();
    await setup.startGame();

    // Verify scoring page loaded
    await expect(
      page.getByRole('button', { name: /Score point/ }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('full doubles team → action sheet disables full team option', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const setup = new GameSetupPage(page);

    await seedBuddyGroupForUser(uid, [
      { userId: 'buddy-1', displayName: 'Alice' },
      { userId: 'buddy-2', displayName: 'Bob' },
      { userId: 'buddy-3', displayName: 'Charlie' },
    ]);

    await setup.goto();

    // Expand and assign: scorer on team 1 (default) + Alice on team 1 → team 1 full (2/2)
    await page.getByText(/Add Players/).click();
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Alice/ }).click();
    const actionSheet = page.locator('[data-testid="sheet-backdrop"]').locator('..');
    await expect(actionSheet.getByRole('heading', { name: 'Alice' })).toBeVisible();
    await actionSheet.getByRole('button', { name: /Team 1/ }).click();

    // Team 1 is now full (scorer + Alice = 2/2).
    // Tap Alice AGAIN (already assigned) → action sheet opens (auto-assign skips assigned buddies)
    await page.getByRole('button', { name: /Alice/ }).click();
    await expect(actionSheet.getByRole('heading', { name: 'Alice' })).toBeVisible();

    // Team 1 option should be disabled (full)
    const team1Option = actionSheet.getByRole('button', { name: /Team 1/ });
    await expect(team1Option).toHaveAttribute('aria-disabled', 'true');
  });

  test('Quick Start → no buddy data, match starts normally', async ({
    authenticatedPage: page,
  }) => {
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.quickGame();

    // Verify scoring page loaded without buddies
    await expect(
      page.getByRole('button', { name: /Score point/ }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('scorer flips to spectator after assigning → capacity updates', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const setup = new GameSetupPage(page);

    await seedBuddyGroupForUser(uid, [
      { userId: 'buddy-1', displayName: 'Alice' },
    ]);

    await setup.goto();

    // Assign Alice to team 1 via action sheet
    await page.getByText(/Add Players/).click();
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Alice/ }).click();
    const actionSheet = page.locator('[data-testid="sheet-backdrop"]').locator('..');
    await expect(actionSheet.getByRole('heading', { name: 'Alice' })).toBeVisible();
    await actionSheet.getByRole('button', { name: /Team 1/ }).click();
    await page.getByText('Done').click();

    // Change scorer role to spectator via "Your Role" section
    // The "Your Role" Change is a <button> with exact name "Change",
    // while BuddyPicker's collapsed row is a <div role="button"> with name "Players: Alice (T1) Change"
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('button', { name: /Scoring for Others/ }).click();
    // Collapse "Your Role" — the "Done" is inside the role fieldset
    const roleFieldset = page.locator('fieldset', { hasText: 'Your Role' });
    await roleFieldset.getByText('Done').click();

    // Re-expand buddy picker to check capacity updated
    // Click the BuddyPicker collapsed row which shows "Players: Alice (T1)"
    await page.getByRole('button', { name: /Players:.*Alice/ }).click();
    await expect(page.getByText(/Team 1: 1\/2/)).toBeVisible({ timeout: 5000 });
  });

  test('search for user → assign to team → start match → scoring page loads', async ({
    authenticatedPage: page,
  }) => {
    const setup = new GameSetupPage(page);

    // Seed a searchable user profile (not a buddy)
    await seedUserProfile('search-dana', 'Dana');

    await setup.goto();

    // Expand BuddyPicker and search
    await setup.expandBuddyPicker();
    await setup.searchPlayers('da');

    // Wait for search result
    await setup.expectSearchResult('Dana');

    // Tap result → action sheet → assign to Team 2
    await setup.tapSearchResult('Dana');
    const actionSheet = page.locator('[data-testid="sheet-backdrop"]').locator('..');
    await expect(actionSheet.getByRole('heading', { name: 'Dana' })).toBeVisible();
    await actionSheet.getByRole('button', { name: /Team 2/ }).click();

    // Collapse and start match
    await page.getByText('Done').click();
    await setup.startGame();

    // Verify scoring page loaded
    await expect(
      page.getByRole('button', { name: /Score point/ }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('search result that is already a buddy does not appear in search', async ({
    authenticatedPage: page,
  }) => {
    const uid = await getCurrentUserUid(page);
    const setup = new GameSetupPage(page);

    // Seed buddy group with Eve
    await seedBuddyGroupForUser(uid, [
      { userId: 'buddy-eve', displayName: 'Eve' },
    ]);
    // Also seed Eve as a user profile (she's both a buddy AND a user)
    await seedUserProfile('buddy-eve', 'Eve');
    // Seed another non-buddy user with similar name
    await seedUserProfile('search-evelyn', 'Evelyn');

    await setup.goto();

    // Expand and search
    await setup.expandBuddyPicker();
    await expect(page.getByText('Eve')).toBeVisible({ timeout: 10000 });
    await setup.searchPlayers('ev');

    // Evelyn should appear, Eve should NOT (already a buddy)
    await setup.expectSearchResult('Evelyn');
    // Eve appears in buddy row but NOT in search results
    const searchResults = page.locator('button', { hasText: /Tap to assign/ });
    await expect(searchResults.filter({ hasText: 'Eve' }).filter({ hasNotText: 'Evelyn' })).toHaveCount(0);
  });
});
