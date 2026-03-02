# Profile Page Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unit/component tests for ProfileHeader, StatsOverview, RecentMatches + E2E tests for the profile page user journeys.

**Architecture:** Unit tests use Vitest + @solidjs/testing-library to verify rendering logic (photo validation, formatting, conditionals). E2E tests use Playwright with Firestore emulator seeding to verify real data flow.

**Tech Stack:** Vitest, @solidjs/testing-library, Playwright, Firestore emulator REST API

---

### Task 1: ProfileHeader Unit Tests

**Files:**
- Create: `src/features/profile/__tests__/ProfileHeader.test.tsx`
- Reference: `src/features/profile/components/ProfileHeader.tsx`

**Step 1: Write all ProfileHeader tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ProfileHeader from '../components/ProfileHeader';

function renderHeader(overrides: Record<string, unknown> = {}) {
  const defaults = {
    displayName: 'Alice Johnson',
    email: 'alice@example.com',
    photoURL: null as string | null,
    createdAt: new Date('2024-03-15').getTime(),
    hasStats: false,
  };
  return render(() => <ProfileHeader {...{ ...defaults, ...overrides }} />);
}

describe('ProfileHeader', () => {
  it('displays display name in heading', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice Johnson');
  });

  it('displays email', () => {
    renderHeader();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('formats "Member since" correctly', () => {
    renderHeader({ createdAt: new Date('2024-03-15').getTime() });
    expect(screen.getByText('Member since Mar 2024')).toBeTruthy();
  });

  it('shows initials avatar when photoURL is null', () => {
    renderHeader({ photoURL: null });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for non-HTTPS photo URL', () => {
    renderHeader({ photoURL: 'http://lh3.googleusercontent.com/photo.jpg' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for non-Google domain', () => {
    renderHeader({ photoURL: 'https://evil.com/photo.jpg' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows <img> for valid Google photo URL', () => {
    renderHeader({ photoURL: 'https://lh3.googleusercontent.com/a/photo123' });
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('Profile photo of Alice Johnson');
  });

  it('shows ? fallback when displayName is empty', () => {
    renderHeader({ displayName: '' });
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('shows tier badge when hasStats is true', () => {
    renderHeader({ hasStats: true, tier: 'intermediate', tierConfidence: 'medium' });
    expect(screen.getByLabelText(/Skill tier: intermediate/)).toBeTruthy();
  });

  it('hides tier badge when hasStats is false', () => {
    renderHeader({ hasStats: false, tier: 'intermediate', tierConfidence: 'medium' });
    expect(screen.queryByLabelText(/Skill tier/)).toBeNull();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/profile/__tests__/ProfileHeader.test.tsx`
Expected: 10 tests PASS

**Step 3: Commit**

```bash
git add src/features/profile/__tests__/ProfileHeader.test.tsx
git commit -m "test: add ProfileHeader unit tests"
```

---

### Task 2: StatsOverview Unit Tests

**Files:**
- Create: `src/features/profile/__tests__/StatsOverview.test.tsx`
- Reference: `src/features/profile/components/StatsOverview.tsx`

**Step 1: Write all StatsOverview tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StatsOverview from '../components/StatsOverview';
import type { StatsSummary } from '../../../data/types';

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: 2000000,
    lastPlayedAt: 3000000,
    updatedAt: 3000000,
    ...overrides,
  };
}

describe('StatsOverview', () => {
  it('displays win rate as percentage', () => {
    render(() => <StatsOverview stats={makeStats({ winRate: 0.7 })} />);
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('displays 0% win rate', () => {
    render(() => <StatsOverview stats={makeStats({ winRate: 0 })} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('displays total matches count', () => {
    render(() => <StatsOverview stats={makeStats({ totalMatches: 10 })} />);
    expect(screen.getByLabelText('Total matches: 10')).toBeTruthy();
  });

  it('displays current win streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'W', count: 3 } })} />);
    expect(screen.getByText('W3')).toBeTruthy();
  });

  it('displays current loss streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'L', count: 2 } })} />);
    expect(screen.getByText('L2')).toBeTruthy();
  });

  it('displays dash for zero streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'W', count: 0 } })} />);
    expect(screen.getByLabelText(/Current streak/)).toHaveTextContent('—');
  });

  it('displays best win streak', () => {
    render(() => <StatsOverview stats={makeStats({ bestWinStreak: 5 })} />);
    expect(screen.getByText('W5')).toBeTruthy();
  });

  it('displays singles/doubles breakdown', () => {
    render(() => <StatsOverview stats={makeStats()} />);
    expect(screen.getByText(/Singles 4-2/)).toBeTruthy();
    expect(screen.getByText(/Doubles 3-1/)).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/profile/__tests__/StatsOverview.test.tsx`
Expected: 8 tests PASS

**Step 3: Commit**

```bash
git add src/features/profile/__tests__/StatsOverview.test.tsx
git commit -m "test: add StatsOverview unit tests"
```

---

### Task 3: RecentMatches Unit Tests

**Files:**
- Create: `src/features/profile/__tests__/RecentMatches.test.tsx`
- Reference: `src/features/profile/components/RecentMatches.tsx`

**Step 1: Write all RecentMatches tests**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import RecentMatches from '../components/RecentMatches';
import type { MatchRef } from '../../../data/types';

function makeMatch(overrides: Partial<MatchRef> = {}): MatchRef {
  return {
    matchId: 'm1',
    startedAt: 1000,
    completedAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
    gameType: 'singles',
    scoringMode: 'sideout',
    result: 'win',
    scores: '11-7, 11-4',
    gameScores: [[11, 7], [11, 4]],
    playerTeam: 1,
    opponentNames: ['Bob'],
    opponentIds: [],
    partnerName: null,
    partnerId: null,
    ownerId: 'user-1',
    tournamentId: null,
    tournamentName: null,
    ...overrides,
  };
}

describe('RecentMatches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders match rows with W/L badges', () => {
    const matches = [
      makeMatch({ matchId: 'm1', result: 'win', completedAt: Date.now() - 3600000 }),
      makeMatch({ matchId: 'm2', result: 'loss', completedAt: Date.now() - 7200000 }),
    ];
    render(() => <RecentMatches matches={matches} hasMore={false} loadingMore={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByLabelText(/^Win against/)).toBeTruthy();
    expect(screen.getByLabelText(/^Loss against/)).toBeTruthy();
  });

  it('displays opponent names', () => {
    render(() => (
      <RecentMatches matches={[makeMatch({ opponentNames: ['Bob'] })]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.getByText(/vs Bob/)).toBeTruthy();
  });

  it('displays scores', () => {
    render(() => (
      <RecentMatches matches={[makeMatch({ scores: '11-7, 11-4' })]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.getByText('11-7, 11-4')).toBeTruthy();
  });

  it('joins multiple opponent names with &', () => {
    render(() => (
      <RecentMatches
        matches={[makeMatch({ opponentNames: ['Bob', 'Carol'] })]}
        hasMore={false}
        loadingMore={false}
      />
    ));
    expect(screen.getByText(/vs Bob & Carol/)).toBeTruthy();
  });

  it('shows Load More button when hasMore is true', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={true} loadingMore={false} />
    ));
    expect(screen.getByLabelText('Load more matches')).toBeTruthy();
    expect(screen.getByText('Load More')).toBeTruthy();
  });

  it('hides Load More button when hasMore is false', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.queryByLabelText('Load more matches')).toBeNull();
  });

  it('shows Loading... when loadingMore', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={true} loadingMore={true} />
    ));
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('formats relative dates correctly', () => {
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const matches = [
      makeMatch({ matchId: 'today', completedAt: now - 1000, opponentNames: ['Today-Opp'] }),
      makeMatch({ matchId: '1d', completedAt: now - DAY, opponentNames: ['Yesterday-Opp'] }),
      makeMatch({ matchId: '3d', completedAt: now - 3 * DAY, opponentNames: ['ThreeDays-Opp'] }),
      makeMatch({ matchId: '2w', completedAt: now - 14 * DAY, opponentNames: ['TwoWeeks-Opp'] }),
      makeMatch({ matchId: '3mo', completedAt: now - 90 * DAY, opponentNames: ['ThreeMonths-Opp'] }),
      makeMatch({ matchId: '1y', completedAt: now - 400 * DAY, opponentNames: ['OneYear-Opp'] }),
    ];
    render(() => <RecentMatches matches={matches} hasMore={false} loadingMore={false} />);
    expect(screen.getByLabelText(/Today-Opp/)).toHaveTextContent(/today/);
    expect(screen.getByLabelText(/Yesterday-Opp/)).toHaveTextContent(/1d/);
    expect(screen.getByLabelText(/ThreeDays-Opp/)).toHaveTextContent(/3d/);
    expect(screen.getByLabelText(/TwoWeeks-Opp/)).toHaveTextContent(/2w/);
    expect(screen.getByLabelText(/ThreeMonths-Opp/)).toHaveTextContent(/3mo/);
    expect(screen.getByLabelText(/OneYear-Opp/)).toHaveTextContent(/1y/);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/profile/__tests__/RecentMatches.test.tsx`
Expected: 8 tests PASS

**Step 3: Commit**

```bash
git add src/features/profile/__tests__/RecentMatches.test.tsx
git commit -m "test: add RecentMatches unit tests"
```

---

### Task 4: E2E Page Object + Factory Helpers

**Files:**
- Create: `e2e/pages/ProfilePage.ts`
- Modify: `e2e/helpers/factories.ts`

**Step 1: Create ProfilePage page object**

```typescript
// e2e/pages/ProfilePage.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class ProfilePage {
  readonly header: Locator;
  readonly statsSection: Locator;
  readonly matchesList: Locator;
  readonly loadMoreButton: Locator;
  readonly emptyState: Locator;
  readonly loadingSkeleton: Locator;

  constructor(private page: Page) {
    this.header = page.locator('header[aria-label="Player profile"]');
    this.statsSection = page.locator('section[aria-labelledby="stats-heading"]');
    this.matchesList = page.locator('ul[aria-label="Recent match results"]');
    this.loadMoreButton = page.getByLabel('Load more matches');
    this.emptyState = page.getByText('No matches recorded yet');
    this.loadingSkeleton = page.locator('[aria-label="Loading profile"]');
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async expectHeaderVisible(name: string, email: string) {
    await expect(this.header.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(this.header.getByText(email)).toBeVisible();
  }

  async expectMemberSince(text: string) {
    await expect(this.header.getByText(`Member since ${text}`)).toBeVisible();
  }

  async expectTierBadge(tier: string) {
    await expect(this.header.getByLabelText(new RegExp(`Skill tier: ${tier}`))).toBeVisible();
  }

  async expectWinRate(percentage: string) {
    await expect(this.statsSection.getByText(percentage)).toBeVisible();
  }

  async expectTotalMatches(count: number) {
    await expect(this.statsSection.getByLabelText(`Total matches: ${count}`)).toBeVisible();
  }

  async expectMatchCount(count: number) {
    const items = this.matchesList.locator('li');
    await expect(items).toHaveCount(count);
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.page.getByText('Start a Match')).toBeVisible();
  }

  async clickLoadMore() {
    await this.loadMoreButton.click();
  }
}
```

**Step 2: Add profile factory helpers to `e2e/helpers/factories.ts`**

Append to the end of `e2e/helpers/factories.ts`:

```typescript
export function makeUserProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Test Player',
    displayNameLower: 'test player',
    email: 'testplayer@example.com',
    photoURL: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function makeStatsSummary(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: Date.now(),
    lastPlayedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeMatchRefSeed(overrides: Record<string, unknown> = {}) {
  const id = `match-${randomUUID().slice(0, 8)}`;
  return {
    id,
    data: {
      matchId: id,
      startedAt: Date.now() - 7200000,
      completedAt: Date.now() - 3600000,
      gameType: 'singles',
      scoringMode: 'sideout',
      result: 'win',
      scores: '11-7, 11-4',
      gameScores: [[11, 7], [11, 4]],
      playerTeam: 1,
      opponentNames: ['Opponent'],
      opponentIds: [],
      partnerName: null,
      partnerId: null,
      ownerId: 'test-user',
      tournamentId: null,
      tournamentName: null,
      ...overrides,
    },
  };
}
```

**Step 3: Commit**

```bash
git add e2e/pages/ProfilePage.ts e2e/helpers/factories.ts
git commit -m "test: add ProfilePage page object and profile factory helpers"
```

---

### Task 5: E2E — Profile Page Happy Path

**Files:**
- Create: `e2e/profile/profile.spec.ts`
- Reference: `e2e/helpers/emulator-auth.ts`, `e2e/helpers/factories.ts`, `e2e/pages/ProfilePage.ts`

**Step 1: Write E2E tests for happy path, empty state, and auth guard**

```typescript
import { test, expect } from '@playwright/test';
import { signInAsTestUser, getCurrentUserUid, seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeUserProfile, makeStatsSummary, makeMatchRefSeed } from '../helpers/factories';
import { ProfilePage } from '../pages/ProfilePage';

test.describe('Profile Page', () => {
  test('displays user info, stats, and recent matches', async ({ page }) => {
    // Sign in to get a UID
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Alice Stats', email: 'alice-stats@example.com' });
    const uid = await getCurrentUserUid(page);

    // Seed profile, stats, and match refs
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

    // Navigate to profile
    const profile = new ProfilePage(page);
    await profile.goto();

    // Verify header
    await profile.expectHeaderVisible('Alice Stats', 'alice-stats@example.com');
    await profile.expectMemberSince('Jun 2024');
    await profile.expectTierBadge('intermediate');

    // Verify stats
    await profile.expectWinRate('70%');
    await profile.expectTotalMatches(10);

    // Verify matches
    await profile.expectMatchCount(2);
    await expect(page.getByLabelText(/Win against Bob/)).toBeVisible();
    await expect(page.getByLabelText(/Loss against Carol/)).toBeVisible();
  });

  test('shows empty state for user with no matches', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'New Player', email: 'newplayer@example.com' });
    const uid = await getCurrentUserUid(page);

    // Seed profile only (no stats, no match refs)
    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'New Player',
      displayNameLower: 'new player',
      email: 'newplayer@example.com',
    }));

    const profile = new ProfilePage(page);
    await profile.goto();

    // Header should still show
    await profile.expectHeaderVisible('New Player', 'newplayer@example.com');

    // Empty state should show
    await profile.expectEmptyState();
  });

  test('requires authentication — shows sign-in prompt', async ({ page }) => {
    await page.goto('/profile');
    // RequireAuth shows "Sign in required" for unauthenticated users
    await expect(page.getByText('Sign in required')).toBeVisible({ timeout: 10000 });
  });

  test('Load More button loads additional matches', async ({ page }) => {
    await page.goto('/');
    await signInAsTestUser(page, { displayName: 'Paginated User', email: 'paginated@example.com' });
    const uid = await getCurrentUserUid(page);

    // Seed profile + stats
    await seedFirestoreDocAdmin('users', uid, makeUserProfile({
      displayName: 'Paginated User',
      displayNameLower: 'paginated user',
      email: 'paginated@example.com',
    }));
    await seedFirestoreDocAdmin(`users/${uid}/stats`, 'summary', makeStatsSummary({
      totalMatches: 15,
    }));

    // Seed 12 match refs (page size is 10, so Load More should appear)
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

    // Should show first 10 matches + Load More
    await profile.expectMatchCount(10);
    await expect(profile.loadMoreButton).toBeVisible();

    // Click Load More
    await profile.clickLoadMore();

    // Should now show all 12
    await profile.expectMatchCount(12);
  });
});
```

**Step 2: Run E2E tests to verify they pass**

Run: `npx playwright test e2e/profile/profile.spec.ts --project=emulator`
Expected: 4 tests PASS

**Step 3: Commit**

```bash
git add e2e/profile/profile.spec.ts
git commit -m "test: add profile page E2E tests"
```

---

### Task 6: Run Full Suite + Final Verification

**Step 1: Run all unit tests**

Run: `npx vitest run src/features/profile/__tests__/`
Expected: All tests PASS (existing 41 + new 26 = 67 tests)

**Step 2: Run full E2E suite**

Run: `npx playwright test --project=emulator --workers=2`
Expected: All tests PASS (no regressions)

**Step 3: Commit any needed fixes, then final commit if clean**

```bash
git add -A
git commit -m "test: profile page test coverage complete"
```
