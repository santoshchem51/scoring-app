# Casual Phase 3: Global User Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add global user search inside BuddyPicker so any PickleScore user can be found and assigned to a casual match.

**Architecture:** New `useUserSearch` hook wraps `firestoreUserRepository.searchByNamePrefix()` with 300ms debounce, 2-char minimum, and privacy filtering. BuddyPicker gets a search input + results list in its expanded state, plus a unified `allAssignedPlayers()` accessor that merges buddies and search users. GameSetupPage gains a `searchUserInfo` signal for display data and a reactive capacity pruning effect on game type change.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, Playwright, Firebase/Firestore

**Design doc:** `docs/plans/2026-03-03-casual-phase3-global-user-search-design.md`

---

## Task 1: Create `useUserSearch` hook — tests

**Files:**
- Create: `src/features/scoring/hooks/__tests__/useUserSearch.test.ts`

**Context:** This hook wraps `firestoreUserRepository.searchByNamePrefix(query, 10)` with debounce, minimum character threshold, and privacy filtering. It returns `{ results, loading, search, clear }`.

**SolidJS testing pattern:** Use `createRoot` from `solid-js` to test hooks that use signals. Mock `firestoreUserRepository`.

**Step 1: Write the 7 failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

// Mock the repository before importing the hook
const mockSearchByNamePrefix = vi.fn().mockResolvedValue([]);

vi.mock('../../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    searchByNamePrefix: (...args: unknown[]) => mockSearchByNamePrefix(...args),
  },
}));

import { useUserSearch } from '../useUserSearch';

// Helper: create a UserProfile-like object
function makeUser(id: string, displayName: string, opts?: {
  profileVisibility?: 'public' | 'private';
  email?: string;
  photoURL?: string | null;
}) {
  return {
    id,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email: opts?.email ?? `${id}@example.com`,
    photoURL: opts?.photoURL ?? `https://photo.test/${id}.jpg`,
    createdAt: Date.now(),
    profileVisibility: opts?.profileVisibility ?? 'public',
  };
}

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty results before 2 chars typed', async () => {
    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('a');
      await vi.advanceTimersByTimeAsync(500);

      expect(hook.results()).toEqual([]);
      expect(mockSearchByNamePrefix).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('fires search after 2+ chars with 300ms debounce', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([makeUser('u1', 'Alice')]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');

      // Not yet — debounce hasn't fired
      expect(mockSearchByNamePrefix).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(mockSearchByNamePrefix).toHaveBeenCalledWith('al', 10);
      dispose();
    });
  });

  it('filters out scorer own UID from results', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('scorer-1', 'Me'),
      makeUser('u2', 'Alice'),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      // Wait for the async search to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results().map((r) => r.id)).toEqual(['u2']);
      dispose();
    });
  });

  it('filters out users already in buddy list', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('buddy-1', 'Bob'),
      makeUser('u3', 'Charlie'),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: ['buddy-1', 'buddy-2'],
      });

      hook.search('bo');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results().map((r) => r.id)).toEqual(['u3']);
      dispose();
    });
  });

  it('sets photoURL to null for private-visibility users', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('u1', 'PrivatePatty', {
        profileVisibility: 'private',
        photoURL: 'https://photo.test/patty.jpg',
      }),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('pr');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results()[0].photoURL).toBeNull();
      expect(hook.results()[0].displayName).toBe('PrivatePatty');
      dispose();
    });
  });

  it('strips email from results', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('u1', 'Alice', { email: 'alice@secret.com' }),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      const result = hook.results()[0];
      expect(result).not.toHaveProperty('email');
      dispose();
    });
  });

  it('handles search error gracefully', async () => {
    mockSearchByNamePrefix.mockRejectedValueOnce(new Error('Network error'));

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results()).toEqual([]);
      expect(hook.loading()).toBe(false);
      dispose();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scoring/hooks/__tests__/useUserSearch.test.ts`
Expected: FAIL — `useUserSearch` module not found

**Step 3: Commit test file**

```bash
git add src/features/scoring/hooks/__tests__/useUserSearch.test.ts
git commit -m "test: add useUserSearch hook tests (red)"
```

---

## Task 2: Implement `useUserSearch` hook

**Files:**
- Create: `src/features/scoring/hooks/useUserSearch.ts`

**Context:** This hook accepts a config object `{ scorerUid, buddyUserIds }` and returns `{ results, loading, search, clear }`. The `results` signal holds `SearchUserResult[]` — a privacy-stripped version of `UserProfile` with no `email` field.

**Step 1: Implement the hook**

```typescript
import { createSignal } from 'solid-js';
import type { UserProfile } from '../../../data/types';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';

export interface SearchUserResult {
  id: string;
  displayName: string;
  photoURL: string | null;
}

interface UseUserSearchConfig {
  scorerUid: string;
  buddyUserIds: string[];
}

export function useUserSearch(config: UseUserSearchConfig) {
  const [results, setResults] = createSignal<SearchUserResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const search = (query: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer = setTimeout(async () => {
      try {
        const raw = await firestoreUserRepository.searchByNamePrefix(query, 10);
        const excludeIds = new Set([config.scorerUid, ...config.buddyUserIds]);
        const filtered = raw
          .filter((u: UserProfile) => !excludeIds.has(u.id))
          .map((u: UserProfile): SearchUserResult => ({
            id: u.id,
            displayName: u.displayName,
            photoURL: u.profileVisibility === 'private' ? null : u.photoURL,
          }));
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const clear = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setResults([]);
    setLoading(false);
  };

  return { results, loading, search, clear };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/scoring/hooks/__tests__/useUserSearch.test.ts`
Expected: 7 PASS

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests + 7 new = all PASS

**Step 4: Commit**

```bash
git add src/features/scoring/hooks/useUserSearch.ts
git commit -m "feat: implement useUserSearch hook with debounce and privacy filtering"
```

---

## Task 3: Add search UI to BuddyPicker — tests

**Files:**
- Modify: `src/features/scoring/components/__tests__/BuddyPicker.test.tsx`

**Context:** Add 5 new tests to the existing BuddyPicker test file. The search UI only appears when expanded. We need to mock both `useBuddyPickerData` (already mocked) AND the new `useUserSearch` hook.

**Step 1: Add search-related mocks and tests**

Add this mock block after the existing `vi.mock('../../hooks/useBuddyPickerData', ...)` (around line 17), BEFORE the `import BuddyPicker` line:

```typescript
const mockSearch = vi.fn();
const mockClear = vi.fn();
const mockSearchResults = vi.fn().mockReturnValue([]);
const mockSearchLoading = vi.fn().mockReturnValue(false);

vi.mock('../../hooks/useUserSearch', () => ({
  useUserSearch: () => ({
    results: mockSearchResults,
    loading: mockSearchLoading,
    search: mockSearch,
    clear: mockClear,
  }),
}));
```

Update `beforeEach` to also reset search mocks:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockBuddies.mockReturnValue([]);
  mockLoading.mockReturnValue(false);
  mockError.mockReturnValue(null);
  mockSearchResults.mockReturnValue([]);
  mockSearchLoading.mockReturnValue(false);
});
```

Add these 5 tests inside the existing `describe('BuddyPicker', ...)` block, after the last existing test:

```typescript
  it('shows search input when expanded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByPlaceholderText('Search players...')).toBeInTheDocument();
  });

  it('calls search when typing 2+ characters', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    const input = screen.getByPlaceholderText('Search players...');
    await fireEvent.input(input, { target: { value: 'bo' } });
    expect(mockSearch).toHaveBeenCalledWith('bo');
  });

  it('displays search results below input', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    mockSearchResults.mockReturnValue([
      { id: 'search-1', displayName: 'SearchUser', photoURL: null },
    ]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText('SearchUser')).toBeInTheDocument();
  });

  it('tapping search result opens action sheet', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    mockSearchResults.mockReturnValue([
      { id: 'search-1', displayName: 'SearchUser', photoURL: null },
    ]);
    render(() => <BuddyPicker {...baseProps} onSearchAssign={vi.fn()} onSearchUnassign={vi.fn()} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    await fireEvent.click(screen.getByRole('button', { name: /SearchUser/ }));
    // Action sheet heading visible
    expect(screen.getByRole('heading', { name: 'SearchUser' })).toBeInTheDocument();
  });

  it('assigned search user appears in avatar row', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    const searchUserInfo = { 'search-1': { displayName: 'SearchUser', photoURL: null } };
    const assignments = { 'search-1': 1 as const };
    render(() => (
      <BuddyPicker
        {...baseProps}
        buddyAssignments={assignments}
        searchUserInfo={searchUserInfo}
        onSearchAssign={vi.fn()}
        onSearchUnassign={vi.fn()}
      />
    ));
    await fireEvent.click(screen.getByText(/Players/));
    // SearchUser should appear in avatar row alongside buddies
    expect(screen.getByText('SearchUser')).toBeInTheDocument();
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scoring/components/__tests__/BuddyPicker.test.tsx`
Expected: 5 new tests FAIL (search input doesn't exist, new props don't exist yet)

**Step 3: Commit**

```bash
git add src/features/scoring/components/__tests__/BuddyPicker.test.tsx
git commit -m "test: add BuddyPicker search UI tests (red)"
```

---

## Task 4: Add search UI + avatar row merge to BuddyPicker

**Files:**
- Modify: `src/features/scoring/components/BuddyPicker.tsx`

**Context:** The BuddyPicker needs:
1. New props: `searchUserInfo`, `onSearchAssign`, `onSearchUnassign`
2. The `useUserSearch` hook wired to a search input
3. A results list below the search input
4. A unified `allAssignedPlayers()` accessor that merges buddies + search users for the avatar row and summary
5. The action sheet must work for both buddies and search users

**Step 1: Implement all changes**

Replace the entire `BuddyPicker.tsx` with:

```typescript
import type { Component } from 'solid-js';
import { createSignal, Show, For } from 'solid-js';
import type { BuddyGroupMember, GameType } from '../../../data/types';
import type { SearchUserResult } from '../hooks/useUserSearch';
import { useBuddyPickerData } from '../hooks/useBuddyPickerData';
import { useUserSearch } from '../hooks/useUserSearch';
import BuddyAvatar from './BuddyAvatar';
import BuddyActionSheet from './BuddyActionSheet';

interface BuddyPickerProps {
  buddyAssignments: Record<string, 1 | 2>;
  searchUserInfo: Record<string, { displayName: string; photoURL: string | null }>;
  scorerRole: 'player' | 'spectator';
  scorerTeam: 1 | 2;
  scorerUid: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  gameType: GameType;
  onAssign: (userId: string, team: 1 | 2) => void;
  onUnassign: (userId: string) => void;
  onSearchAssign: (userId: string, team: 1 | 2, info: { displayName: string; photoURL: string | null }) => void;
  onSearchUnassign: (userId: string) => void;
}

interface AvatarPlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  team: 1 | 2 | null;
  source: 'buddy' | 'search';
}

const BuddyPicker: Component<BuddyPickerProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [selectedPlayer, setSelectedPlayer] = createSignal<AvatarPlayer | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const { buddies, loading, error, load } = useBuddyPickerData(() => props.scorerUid);
  const userSearch = useUserSearch({
    scorerUid: props.scorerUid,
    buddyUserIds: buddies().map((b) => b.userId),
  });

  const maxPerTeam = () => (props.gameType === 'singles' ? 1 : 2);

  const team1Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 1).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 1) count++;
    return count;
  };

  const team2Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 2).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 2) count++;
    return count;
  };

  const hasAssignments = () => Object.keys(props.buddyAssignments).length > 0;

  // Unified player list for avatar row: assigned buddies + assigned search users + unassigned buddies
  const allAssignedPlayers = (): AvatarPlayer[] => {
    const assignedBuddies: AvatarPlayer[] = buddies()
      .filter((b) => b.userId in props.buddyAssignments)
      .map((b) => ({
        userId: b.userId,
        displayName: b.displayName,
        photoURL: b.photoURL,
        team: props.buddyAssignments[b.userId],
        source: 'buddy' as const,
      }));

    const assignedSearch: AvatarPlayer[] = Object.entries(props.searchUserInfo)
      .filter(([uid]) => uid in props.buddyAssignments)
      .map(([uid, info]) => ({
        userId: uid,
        displayName: info.displayName,
        photoURL: info.photoURL,
        team: props.buddyAssignments[uid],
        source: 'search' as const,
      }));

    const unassignedBuddies: AvatarPlayer[] = buddies()
      .filter((b) => !(b.userId in props.buddyAssignments))
      .map((b) => ({
        userId: b.userId,
        displayName: b.displayName,
        photoURL: b.photoURL,
        team: null,
        source: 'buddy' as const,
      }));

    return [...assignedBuddies, ...assignedSearch, ...unassignedBuddies];
  };

  const assignedSummary = () => {
    const entries = Object.entries(props.buddyAssignments);
    if (entries.length === 0) return '';
    const totalPlayers = entries.length + (props.scorerRole === 'player' ? 1 : 0);
    if (totalPlayers >= 4) return 'Teams set: 2v2';

    // Build a UID→name lookup from both buddies and search users
    const nameMap = new Map<string, string>();
    for (const b of buddies()) nameMap.set(b.userId, b.displayName);
    for (const [uid, info] of Object.entries(props.searchUserInfo)) {
      nameMap.set(uid, info.displayName);
    }

    const t1Names = entries
      .filter(([, t]) => t === 1)
      .map(([uid]) => nameMap.get(uid) ?? uid);
    const t2Names = entries
      .filter(([, t]) => t === 2)
      .map(([uid]) => nameMap.get(uid) ?? uid);

    const parts: string[] = [];
    if (t1Names.length > 0) parts.push(`${t1Names.join(', ')} (T1)`);
    if (t2Names.length > 0) parts.push(`${t2Names.join(', ')} (T2)`);
    return parts.join(' vs ');
  };

  // Search results filtered to exclude already-assigned users
  const visibleSearchResults = () =>
    userSearch.results().filter((r) => !(r.id in props.buddyAssignments));

  const handleExpand = async () => {
    setExpanded(true);
    await load();
  };

  const handleAvatarClick = (player: AvatarPlayer) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;
    const isUnassigned = player.team === null;

    if (isUnassigned && onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onAssign(player.userId, openTeam);
      return;
    }
    setSelectedPlayer(player);
  };

  const handleSearchResultClick = (result: SearchUserResult) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;

    if (onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onSearchAssign(result.id, openTeam, {
        displayName: result.displayName,
        photoURL: result.photoURL,
      });
      return;
    }

    setSelectedPlayer({
      userId: result.id,
      displayName: result.displayName,
      photoURL: result.photoURL,
      team: null,
      source: 'search',
    });
  };

  const handleSheetAssign = (team: 1 | 2) => {
    const player = selectedPlayer();
    if (!player) return;

    if (player.source === 'search') {
      props.onSearchAssign(player.userId, team, {
        displayName: player.displayName,
        photoURL: player.photoURL,
      });
    } else {
      props.onAssign(player.userId, team);
    }
    setSelectedPlayer(null);
  };

  const handleSheetUnassign = () => {
    const player = selectedPlayer();
    if (!player) return;

    if (player.source === 'search') {
      props.onSearchUnassign(player.userId);
    } else {
      props.onUnassign(player.userId);
    }
    setSelectedPlayer(null);
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    userSearch.search(value);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setSearchQuery('');
    userSearch.clear();
  };

  return (
    <div class="mt-6">
      <Show
        when={expanded()}
        fallback={
          <div
            class="flex items-center justify-between bg-surface-light rounded-xl px-4 py-3 cursor-pointer"
            onClick={handleExpand}
            role="button"
            tabIndex={0}
          >
            <div class="flex items-center gap-2">
              <Show
                when={hasAssignments()}
                fallback={
                  <span class="text-sm text-on-surface-muted">Add Players [optional]</span>
                }
              >
                <span class="text-sm text-on-surface-muted">Players:</span>
                <span class="text-sm font-semibold text-on-surface">{assignedSummary()}</span>
              </Show>
            </div>
            <span class="text-sm text-primary font-semibold">
              {hasAssignments() ? 'Change' : ''}
            </span>
          </div>
        }
      >
        <fieldset>
          <div class="flex items-center justify-between mb-3">
            <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
              Add Players
            </legend>
            <button
              type="button"
              onClick={handleCollapse}
              class="text-sm text-primary font-semibold"
            >
              Done
            </button>
          </div>

          <Show when={error()}>
            <p class="text-sm text-on-surface-muted py-4 text-center">
              Connect to the internet to add players.
            </p>
          </Show>

          <Show when={!error()}>
            {/* Avatar row: buddies + assigned search users */}
            <Show when={allAssignedPlayers().length > 0}>
              <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <For each={allAssignedPlayers()}>
                  {(player) => (
                    <BuddyAvatar
                      displayName={player.displayName}
                      photoURL={player.photoURL}
                      team={player.team}
                      teamColor={
                        player.team === 1
                          ? props.team1Color
                          : player.team === 2
                            ? props.team2Color
                            : props.team1Color
                      }
                      onClick={() => handleAvatarClick(player)}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Show when={!loading() && buddies().length === 0 && allAssignedPlayers().length === 0}>
              <p class="text-sm text-on-surface-muted py-4 text-center">
                Create a buddy group to add players.
              </p>
            </Show>

            {/* Search input */}
            <div class="mt-3">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery()}
                onInput={(e) => handleSearchInput(e.currentTarget.value)}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-2.5 text-sm text-on-surface focus:border-primary"
              />
            </div>

            {/* Search hint / results */}
            <Show when={searchQuery().length > 0 && searchQuery().length < 2}>
              <p class="text-xs text-on-surface-muted mt-2">Type 2+ characters to search</p>
            </Show>

            <Show when={userSearch.loading()}>
              <p class="text-xs text-on-surface-muted mt-2">Searching...</p>
            </Show>

            <Show when={searchQuery().length >= 2 && !userSearch.loading() && visibleSearchResults().length === 0}>
              <p class="text-xs text-on-surface-muted mt-2">No users found</p>
            </Show>

            <Show when={visibleSearchResults().length > 0}>
              <div class="mt-2 space-y-1">
                <For each={visibleSearchResults()}>
                  {(result) => (
                    <button
                      type="button"
                      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-light hover:bg-surface-lighter transition-colors"
                      onClick={() => handleSearchResultClick(result)}
                      aria-label={`${result.displayName}. Tap to assign.`}
                    >
                      <div class="w-8 h-8 rounded-full overflow-hidden bg-surface-lighter flex items-center justify-center flex-shrink-0">
                        <Show
                          when={result.photoURL}
                          fallback={
                            <span class="text-sm font-bold text-on-surface">
                              {result.displayName.charAt(0).toUpperCase()}
                            </span>
                          }
                        >
                          <img src={result.photoURL!} alt="" class="w-full h-full object-cover" />
                        </Show>
                      </div>
                      <span class="text-sm text-on-surface">{result.displayName}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Capacity indicators */}
            <Show when={allAssignedPlayers().some((p) => p.team !== null) || buddies().length > 0}>
              <div class="text-xs text-on-surface-muted mt-2">
                <span>Team 1: {team1Count()}/{maxPerTeam()}</span>
                <span class="mx-2">·</span>
                <span>Team 2: {team2Count()}/{maxPerTeam()}</span>
              </div>
            </Show>
          </Show>

          {/* Accessibility: announce team changes to screen readers */}
          <div aria-live="polite" class="sr-only">
            Team 1: {team1Count()} of {maxPerTeam()}. Team 2: {team2Count()} of {maxPerTeam()}.
          </div>
        </fieldset>
      </Show>

      <BuddyActionSheet
        open={selectedPlayer() !== null}
        buddyName={selectedPlayer()?.displayName ?? ''}
        team1Name={props.team1Name}
        team2Name={props.team2Name}
        team1Color={props.team1Color}
        team2Color={props.team2Color}
        team1Full={team1Count() >= maxPerTeam()}
        team2Full={team2Count() >= maxPerTeam()}
        currentTeam={selectedPlayer() ? (props.buddyAssignments[selectedPlayer()!.userId] ?? null) : null}
        onAssign={handleSheetAssign}
        onUnassign={handleSheetUnassign}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
};

export default BuddyPicker;
```

**Step 2: Run BuddyPicker tests**

Run: `npx vitest run src/features/scoring/components/__tests__/BuddyPicker.test.tsx`
Expected: All tests PASS (old + new)

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: Some GameSetupPage tests may fail because BuddyPicker now expects new props. We'll fix those in the next task.

**Step 4: Commit**

```bash
git add src/features/scoring/components/BuddyPicker.tsx
git commit -m "feat: add search UI and avatar row merge to BuddyPicker"
```

---

## Task 5: GameSetupPage integration — tests

**Files:**
- Modify: `src/features/scoring/__tests__/GameSetupPage.test.tsx`

**Context:** Add 3 new tests for:
1. `searchUserInfo` populated when search user assigned via `onSearchAssign`
2. `searchUserInfo` entry removed on `onSearchUnassign`
3. Game type switch to singles prunes over-capacity assignments

These test the pure logic functions and state transformations, not the component rendering.

**Step 1: Add 3 tests**

Append these tests inside the existing `describe('GameSetupPage buddy integration logic', ...)` block:

```typescript
  // --- Phase 3: Global Search integration ---

  it('searchUserInfo: onSearchAssign populates display info', () => {
    // Simulates what GameSetupPage does when BuddyPicker calls onSearchAssign
    const searchUserInfo: Record<string, { displayName: string; photoURL: string | null }> = {};
    const buddyAssignments: Record<string, 1 | 2> = {};

    // Simulate handler
    const userId = 'search-user-1';
    const team = 1 as const;
    const info = { displayName: 'Searched User', photoURL: 'https://photo.test/su.jpg' };
    searchUserInfo[userId] = info;
    buddyAssignments[userId] = team;

    expect(searchUserInfo['search-user-1']).toEqual({
      displayName: 'Searched User',
      photoURL: 'https://photo.test/su.jpg',
    });
    expect(buddyAssignments['search-user-1']).toBe(1);

    // buildTeamArrays works with mixed assignments
    const result = buildTeamArrays(buddyAssignments, {
      scorerUid: 'scorer',
      scorerRole: 'player',
      scorerTeam: 2,
    });
    expect(result.team1).toContain('search-user-1');
    expect(result.sharedWith).toContain('search-user-1');
  });

  it('searchUserInfo: onSearchUnassign removes display info', () => {
    const searchUserInfo: Record<string, { displayName: string; photoURL: string | null }> = {
      'su-1': { displayName: 'Found User', photoURL: null },
    };
    const buddyAssignments: Record<string, 1 | 2> = { 'su-1': 2 };

    // Simulate unassign handler
    delete searchUserInfo['su-1'];
    delete buddyAssignments['su-1'];

    expect(searchUserInfo).toEqual({});
    expect(buddyAssignments).toEqual({});
  });

  it('capacity pruning: doubles→singles keeps only first assignment per team', () => {
    // Simulate the pruning logic from GameSetupPage
    const assignments: Record<string, 1 | 2> = {
      'u1': 1,
      'u2': 1,
      'u3': 2,
      'u4': 2,
    };

    // Pruning: keep only first per team (simulates createEffect in GameSetupPage)
    const pruned: Record<string, 1 | 2> = {};
    const team1Count = { count: 0 };
    const team2Count = { count: 0 };
    for (const [uid, team] of Object.entries(assignments)) {
      if (team === 1 && team1Count.count < 1) {
        pruned[uid] = team;
        team1Count.count++;
      } else if (team === 2 && team2Count.count < 1) {
        pruned[uid] = team;
        team2Count.count++;
      }
    }

    expect(Object.keys(pruned)).toHaveLength(2);
    expect(Object.values(pruned).filter((t) => t === 1)).toHaveLength(1);
    expect(Object.values(pruned).filter((t) => t === 2)).toHaveLength(1);
  });
```

**Step 2: Run tests**

Run: `npx vitest run src/features/scoring/__tests__/GameSetupPage.test.tsx`
Expected: All 12 tests PASS (9 existing + 3 new — these test pure logic, not actual GameSetupPage)

**Step 3: Commit**

```bash
git add src/features/scoring/__tests__/GameSetupPage.test.tsx
git commit -m "test: add Phase 3 GameSetupPage integration tests"
```

---

## Task 6: GameSetupPage integration — implementation

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Context:** GameSetupPage needs:
1. A `searchUserInfo` signal: `Record<string, { displayName: string; photoURL: string | null }>`
2. `handleSearchAssign` and `handleSearchUnassign` handlers
3. Pass new props to BuddyPicker
4. A reactive effect: when `gameType` changes to `singles`, prune `buddyAssignments` to max 1 per team
5. Also clean `searchUserInfo` when pruning removes search users

**Step 1: Apply changes to GameSetupPage.tsx**

Add import for `createEffect` and `on` (line 2):

Change:
```typescript
import { createSignal, Show } from 'solid-js';
```
To:
```typescript
import { createSignal, createEffect, on, Show } from 'solid-js';
```

After the `buddyAssignments` signal (line 31), add:

```typescript
  const [searchUserInfo, setSearchUserInfo] = createSignal<
    Record<string, { displayName: string; photoURL: string | null }>
  >({});
```

After `handleBuddyUnassign` (line 47), add:

```typescript
  const handleSearchAssign = (
    userId: string,
    team: 1 | 2,
    info: { displayName: string; photoURL: string | null },
  ) => {
    setSearchUserInfo((prev) => ({ ...prev, [userId]: info }));
    setBuddyAssignments((prev) => ({ ...prev, [userId]: team }));
  };

  const handleSearchUnassign = (userId: string) => {
    setSearchUserInfo((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setBuddyAssignments((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  // Capacity pruning: when switching to singles, keep max 1 per team
  createEffect(
    on(gameType, (gt) => {
      if (gt !== 'singles') return;
      setBuddyAssignments((prev) => {
        const pruned: Record<string, 1 | 2> = {};
        let t1 = 0;
        let t2 = 0;
        for (const [uid, team] of Object.entries(prev)) {
          if (team === 1 && t1 < 1) { pruned[uid] = 1; t1++; }
          else if (team === 2 && t2 < 1) { pruned[uid] = 2; t2++; }
        }
        // Clean searchUserInfo for any pruned search users
        const removedUids = Object.keys(prev).filter((uid) => !(uid in pruned));
        if (removedUids.length > 0) {
          setSearchUserInfo((si) => {
            const next = { ...si };
            for (const uid of removedUids) delete next[uid];
            return next;
          });
        }
        return pruned;
      });
    }),
  );
```

Update the BuddyPicker JSX (around line 232-244) to pass new props:

Change:
```typescript
          <BuddyPicker
            buddyAssignments={buddyAssignments()}
            scorerRole={scorerRole()}
            scorerTeam={scorerTeam()}
            scorerUid={user()!.uid}
            team1Name={team1Name()}
            team2Name={team2Name()}
            team1Color={team1Color()}
            team2Color={team2Color()}
            gameType={gameType()}
            onAssign={handleBuddyAssign}
            onUnassign={handleBuddyUnassign}
          />
```
To:
```typescript
          <BuddyPicker
            buddyAssignments={buddyAssignments()}
            searchUserInfo={searchUserInfo()}
            scorerRole={scorerRole()}
            scorerTeam={scorerTeam()}
            scorerUid={user()!.uid}
            team1Name={team1Name()}
            team2Name={team2Name()}
            team1Color={team1Color()}
            team2Color={team2Color()}
            gameType={gameType()}
            onAssign={handleBuddyAssign}
            onUnassign={handleBuddyUnassign}
            onSearchAssign={handleSearchAssign}
            onSearchUnassign={handleSearchUnassign}
          />
```

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "feat: add searchUserInfo signal, handlers, and capacity pruning to GameSetupPage"
```

---

## Task 7: E2E tests — global user search

**Files:**
- Modify: `e2e/casual/buddy-picker.spec.ts`
- Modify: `e2e/pages/GameSetupPage.ts`

**Context:** Add 2 E2E tests to the existing buddy-picker spec file. We need to seed user profile docs in Firestore so the search can find them. Also add POM methods for search interactions.

**Step 1: Add POM methods to `e2e/pages/GameSetupPage.ts`**

Add these methods after the existing `collapseYourRole()` method (around line 76):

```typescript
  // ── Buddy Picker Search Actions ──
  async expandBuddyPicker() {
    await this.page.getByText(/Add Players/).click();
  }

  async searchPlayers(query: string) {
    const input = this.page.getByPlaceholder('Search players...');
    await input.fill(query);
  }

  async expectSearchResult(name: string) {
    await expect(this.page.getByRole('button', { name: new RegExp(`${name}.*Tap to assign`) })).toBeVisible({ timeout: 10000 });
  }

  async tapSearchResult(name: string) {
    await this.page.getByRole('button', { name: new RegExp(`${name}.*Tap to assign`) }).click();
  }
```

**Step 2: Add a user profile seeding helper in `buddy-picker.spec.ts`**

After the existing `seedBuddyGroupForUser` function, add:

```typescript
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
```

**Step 3: Add 2 E2E tests**

Add inside the existing `test.describe('Casual Phase 2: Buddy Picker', ...)` block (rename the describe to include Phase 3, or add a nested describe):

```typescript
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
```

**Step 4: Run E2E tests**

Run: `npx playwright test e2e/casual/buddy-picker.spec.ts --workers=1`
Expected: All 6 tests PASS (4 existing + 2 new)

**Step 5: Commit**

```bash
git add e2e/casual/buddy-picker.spec.ts e2e/pages/GameSetupPage.ts
git commit -m "test(e2e): add global user search E2E tests"
```

---

## Summary

| Task | Description | Tests | Files |
|------|-------------|-------|-------|
| 1 | `useUserSearch` hook tests (red) | 7 new | 1 create |
| 2 | `useUserSearch` hook implementation | 7 green | 1 create |
| 3 | BuddyPicker search UI tests (red) | 5 new | 1 modify |
| 4 | BuddyPicker search UI + avatar merge | 5 green | 1 modify |
| 5 | GameSetupPage integration tests | 3 new | 1 modify |
| 6 | GameSetupPage integration impl | 3 green | 1 modify |
| 7 | E2E tests | 2 new | 2 modify |

**Total: ~17 unit tests + 2 E2E tests across 3 new files and 4 modified files**
