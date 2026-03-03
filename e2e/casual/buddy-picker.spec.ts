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

    // Tap Alice → action sheet → Team 1
    await page.getByRole('button', { name: /Alice/ }).click();
    await page.getByText(/Team 1/).first().click();

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
    await page.getByText(/Team 1/).first().click();

    // Now tap Bob — Team 1 option should be disabled (full)
    await page.getByRole('button', { name: /Bob/ }).click();
    const team1Option = page.getByRole('button', { name: /Team 1/ }).first();
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

    // Assign Alice to team 1
    await page.getByText(/Add Players/).click();
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Alice/ }).click();
    await page.getByText(/Team 1/).first().click();
    await page.getByText('Done').click();

    // Change scorer role to spectator
    await page.getByText('Change').click();
    await page.getByText(/Scoring for Others/).click();
    await page.getByText('Done').last().click();

    // Re-expand buddy picker to check capacity updated
    await page.getByText(/Change/).first().click();
    await expect(page.getByText(/Team 1: 1\/2/)).toBeVisible({ timeout: 5000 });
  });
});
