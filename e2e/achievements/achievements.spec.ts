import { test, expect } from '@playwright/test';
import { signInAsTestUser, getCurrentUserUid, seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeUserProfile, makeStatsSummary } from '../helpers/factories';

test.describe('Achievements', () => {

  test('Trophy Case shows on profile with seeded achievements', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Achievement User', email: 'achieve@test.com' });
    const uid = await getCurrentUserUid(page);

    // Seed user profile
    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Achievement User',
      displayNameLower: 'achievement user',
      email: 'achieve@test.com',
    }));

    // Seed stats (10 matches, 7 wins = should qualify for first_rally, warming_up, first_win, hat_trick)
    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 10,
      wins: 7,
      losses: 3,
      winRate: 0.7,
      currentStreak: { type: 'W', count: 3 },
      bestWinStreak: 3,
      tier: 'beginner',
      tierConfidence: 'low',
    }));

    // Seed some achievements (use Date.now() — the REST seeder serialises numbers correctly)
    await seedFirestoreDocAdmin(`users/${uid}/achievements`, 'first_rally', {
      achievementId: 'first_rally',
      unlockedAt: Date.now(),
      triggerMatchId: 'match-1',
      triggerContext: { type: 'stats', field: 'totalMatches', value: 1 },
    });

    await seedFirestoreDocAdmin(`users/${uid}/achievements`, 'first_win', {
      achievementId: 'first_win',
      unlockedAt: Date.now(),
      triggerMatchId: 'match-1',
      triggerContext: { type: 'stats', field: 'wins', value: 1 },
    });

    // Navigate to profile
    await page.goto('/profile');

    // Verify Trophy Case section is visible
    const trophyCase = page.locator('section[aria-labelledby="trophycase-heading"]');
    await expect(trophyCase).toBeVisible();

    // Verify heading shows count
    const heading = trophyCase.locator('#trophycase-heading');
    await expect(heading).toContainText('Achievements');
    await expect(heading).toContainText('/23');

    // Verify category headers exist
    await expect(trophyCase.getByText('Milestones')).toBeVisible();
    await expect(trophyCase.getByText('Consistency')).toBeVisible();
  });

  test('Trophy Case shows locked badges with progress', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Progress User', email: 'progress@test.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Progress User',
      displayNameLower: 'progress user',
      email: 'progress@test.com',
    }));

    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 5,
      wins: 3,
      losses: 2,
      winRate: 0.6,
    }));

    await page.goto('/profile');

    const trophyCase = page.locator('section[aria-labelledby="trophycase-heading"]');
    await expect(trophyCase).toBeVisible();

    // Should see locked badges (locked badges show aria-disabled)
    const lockedBadge = trophyCase.locator('[aria-disabled="true"]').first();
    await expect(lockedBadge).toBeVisible();
  });

  test('profile page shows empty state when no stats', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'New User', email: 'newuser@test.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'New User',
      displayNameLower: 'new user',
      email: 'newuser@test.com',
    }));

    await page.goto('/profile');

    // When there are no stats, the profile shows empty state (not trophy case)
    await expect(page.getByText('No matches recorded yet')).toBeVisible();
  });
});
