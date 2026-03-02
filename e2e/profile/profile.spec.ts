import { test, expect } from '@playwright/test';
import { signInAsTestUser, getCurrentUserUid, seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeUserProfile, makeStatsSummary, makeMatchRefSeed } from '../helpers/factories';
import { ProfilePage } from '../pages/ProfilePage';

test.describe('Profile Page', () => {
  test('displays user info, stats, and recent matches', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Alice Stats', email: 'alice-stats@example.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Alice Stats',
      displayNameLower: 'alice stats',
      email: 'alice-stats@example.com',
      createdAt: new Date('2024-06-15').getTime(),
    }));

    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 10,
      wins: 7,
      losses: 3,
      winRate: 0.7,
      currentStreak: { type: 'W', count: 3 },
      bestWinStreak: 5,
      tier: 'intermediate',
      tierConfidence: 'medium',
    }));

    const match1 = makeMatchRefSeed({
      result: 'win',
      scores: '11-7, 11-4',
      opponentNames: ['Bob'],
      completedAt: Date.now() - 3600000,
    });
    const match2 = makeMatchRefSeed({
      result: 'loss',
      scores: '9-11, 11-8, 5-11',
      opponentNames: ['Carol'],
      completedAt: Date.now() - 86400000,
    });
    await seedFirestoreDocAdmin(`users/${uid}/matchRefs`, match1.id, match1.data);
    await seedFirestoreDocAdmin(`users/${uid}/matchRefs`, match2.id, match2.data);

    const profile = new ProfilePage(page);
    await profile.goto();

    await profile.expectHeaderVisible('Alice Stats', 'alice-stats@example.com');
    await profile.expectMemberSince('Jun 2024');
    await profile.expectTierBadge('intermediate');

    await profile.expectWinRate('70%');
    await profile.expectTotalMatches(10);

    await profile.expectMatchCount(2);
    await expect(page.getByLabel(/Win against Bob/)).toBeVisible();
    await expect(page.getByLabel(/Loss against Carol/)).toBeVisible();
  });

  test('shows empty state for user with no matches', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'New Player', email: 'newplayer@example.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'New Player',
      displayNameLower: 'new player',
      email: 'newplayer@example.com',
    }));

    const profile = new ProfilePage(page);
    await profile.goto();

    await profile.expectHeaderVisible('New Player', 'newplayer@example.com');
    await profile.expectEmptyState();
  });

  test('requires authentication — shows sign-in prompt', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Sign in required')).toBeVisible({ timeout: 10000 });
  });

  test('shows stats but handles missing matches gracefully', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Stats Only', email: 'statsonly@example.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Stats Only',
      displayNameLower: 'stats only',
      email: 'statsonly@example.com',
    }));
    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 5,
      wins: 3,
      losses: 2,
      winRate: 0.6,
    }));

    const profile = new ProfilePage(page);
    await profile.goto();

    await profile.expectHeaderVisible('Stats Only', 'statsonly@example.com');
    await profile.expectWinRate('60%');
    await profile.expectTotalMatches(5);

    await expect(profile.matchesList).not.toBeVisible();
  });

  test('Load More button loads additional matches', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Paginated User', email: 'paginated@example.com' });
    const uid = await getCurrentUserUid(page);

    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Paginated User',
      displayNameLower: 'paginated user',
      email: 'paginated@example.com',
    }));
    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 15,
    }));

    const seedPromises = [];
    for (let i = 0; i < 12; i++) {
      const match = makeMatchRefSeed({
        opponentNames: [`Player${i}`],
        completedAt: Date.now() - (i + 1) * 3600000,
      });
      seedPromises.push(
        seedFirestoreDocAdmin(`users/${uid}/matchRefs`, match.id, match.data),
      );
    }
    await Promise.all(seedPromises);

    const profile = new ProfilePage(page);
    await profile.goto();

    await profile.expectMatchCount(10);
    await expect(profile.loadMoreButton).toBeVisible();

    await profile.clickLoadMore();

    await profile.expectMatchCount(12);
  });
});
