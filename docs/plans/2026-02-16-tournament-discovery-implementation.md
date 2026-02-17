# P1 Tournament Discovery — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public tournament browse feed and unified "My Tournaments" list so users can discover and join tournaments without needing a share link.

**Architecture:** Two sub-tabs (Browse / My Tournaments) inside the existing Tournaments page. Browse fetches public tournaments from Firestore with client-side filtering. My Tournaments merges results from three queries (organizer, participant via collection group, scorekeeper via array-contains) with role badges. Landing page gets a preview section.

**Tech Stack:** SolidJS 1.9 + TypeScript + Firestore + Tailwind CSS v4 (no new dependencies)

**Design doc:** `docs/plans/2026-02-16-tournament-discovery-design.md`

---

## Context for Implementers

### SolidJS Rules (CRITICAL)
- `import type` for type-only imports
- Use `class` NOT `className`
- NEVER destructure props — always use `props.foo`
- Signals: `createSignal`, Resources: `createResource`
- Components: `Show`, `For`, `Switch/Match`

### Key Files
- **Types:** `src/data/types.ts` — `Tournament`, `TournamentRegistration`, `TournamentFormat`, `TournamentStatus`, `TournamentVisibility`
- **Repository:** `src/data/firebase/firestoreTournamentRepository.ts` — Firestore CRUD
- **Constants:** `src/features/tournaments/constants.ts` — `statusLabels`, `statusColors`, `formatLabels`
- **Router:** `src/app/router.tsx`
- **Bottom nav:** `src/shared/components/BottomNav.tsx`
- **Landing page:** `src/features/landing/LandingPage.tsx`
- **Existing list page:** `src/features/tournaments/TournamentListPage.tsx`
- **Existing card:** `src/features/tournaments/components/TournamentCard.tsx`
- **Invitation inbox:** `src/features/tournaments/components/InvitationInbox.tsx`
- **Collection group pattern:** `src/data/firebase/firestoreBuddyGroupRepository.ts:getGroupsForUser()`
- **Badge pattern:** `src/shared/components/BottomNav.tsx` (Buddies unread count badge)
- **Invitation query:** `src/data/firebase/firestoreInvitationRepository.ts:getPendingForUser()`

### Test Commands
- **Run all tests:** `npx vitest run`
- **Run specific test:** `npx vitest run src/path/to/test.test.ts`
- **Type check:** `npx tsc --noEmit`
- **Build:** `npx vite build`

---

## Task 1: Create Feature Branch

**Files:** None

**Step 1:** Create and switch to feature branch

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp
git checkout -b feature/tournament-discovery
```

**Step 2:** Verify clean state

```bash
git status
```

Expected: `On branch feature/tournament-discovery, nothing to commit`

---

## Task 2: Add Firestore Composite Indexes

**Files:**
- Modify: `firestore.indexes.json`

**Step 1:** Add two new indexes to `firestore.indexes.json`

Add to the `indexes` array:

```json
{
  "collectionGroup": "tournaments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "visibility", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "registrations",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" }
  ]
}
```

The first index enables `getPublicTournaments()` query. The second enables the collection group query for `getByParticipant()`.

**Step 2:** Commit

```bash
git add firestore.indexes.json
git commit -m "chore: add Firestore indexes for tournament discovery"
```

---

## Task 3: Add Repository Query Methods

**Files:**
- Modify: `src/data/firebase/firestoreTournamentRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts`

**Step 1: Write the failing tests**

Create `src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../types';

// We'll mock Firestore — these are unit tests for query construction and result mapping
const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args: unknown[]) => ({ _query: args }));
const mockCollection = vi.fn((...args: unknown[]) => ({ _collection: args }));
const mockCollectionGroup = vi.fn((...args: unknown[]) => ({ _collectionGroup: args }));
const mockWhere = vi.fn((...args: unknown[]) => ({ _where: args }));
const mockOrderBy = vi.fn((...args: unknown[]) => ({ _orderBy: args }));
const mockLimit = vi.fn((...args: unknown[]) => ({ _limit: args }));
const mockStartAfter = vi.fn((...args: unknown[]) => ({ _startAfter: args }));
const mockDoc = vi.fn((...args: unknown[]) => ({ _doc: args }));
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('../config', () => ({
  firestore: { _firestore: true },
}));

// Import AFTER mocks are set up
const { firestoreTournamentRepository } = await import('../firestoreTournamentRepository');

function makeTournamentDoc(id: string, data: Partial<Tournament>) {
  return { id, data: () => data, exists: () => true };
}

function makeRegistrationDoc(tournamentId: string, userId: string) {
  return {
    id: `reg-${userId}`,
    data: () => ({ userId, tournamentId }),
    ref: {
      parent: {
        parent: { id: tournamentId },
      },
    },
  };
}

describe('firestoreTournamentRepository - discovery queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicTournaments', () => {
    it('fetches public tournaments ordered by date desc with limit', async () => {
      const docs = [
        makeTournamentDoc('t1', { name: 'Open A', visibility: 'public', date: 2000 }),
        makeTournamentDoc('t2', { name: 'Open B', visibility: 'public', date: 1000 }),
      ];
      mockGetDocs.mockResolvedValue({ docs });

      const result = await firestoreTournamentRepository.getPublicTournaments();

      expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'public');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result.tournaments).toHaveLength(2);
      expect(result.tournaments[0].id).toBe('t1');
      expect(result.tournaments[1].id).toBe('t2');
    });

    it('returns lastDoc for pagination', async () => {
      const docs = [makeTournamentDoc('t1', { name: 'Open A' })];
      mockGetDocs.mockResolvedValue({ docs });

      const result = await firestoreTournamentRepository.getPublicTournaments();

      expect(result.lastDoc).toBe(docs[docs.length - 1]);
    });

    it('accepts cursor for pagination', async () => {
      const cursor = { _cursor: true };
      mockGetDocs.mockResolvedValue({ docs: [] });

      await firestoreTournamentRepository.getPublicTournaments(50, cursor);

      expect(mockStartAfter).toHaveBeenCalledWith(cursor);
    });

    it('returns empty array when no public tournaments', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getPublicTournaments();

      expect(result.tournaments).toEqual([]);
      expect(result.lastDoc).toBeUndefined();
    });
  });

  describe('getByParticipant', () => {
    it('queries registrations collection group by userId', async () => {
      const regDocs = [
        makeRegistrationDoc('t1', 'user-1'),
        makeRegistrationDoc('t2', 'user-1'),
      ];
      mockGetDocs.mockResolvedValue({ docs: regDocs });

      const result = await firestoreTournamentRepository.getByParticipant('user-1');

      expect(mockCollectionGroup).toHaveBeenCalledWith({ _firestore: true }, 'registrations');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-1');
      expect(result).toEqual(['t1', 't2']);
    });

    it('deduplicates tournament IDs', async () => {
      const regDocs = [
        makeRegistrationDoc('t1', 'user-1'),
        makeRegistrationDoc('t1', 'user-1'), // duplicate
      ];
      mockGetDocs.mockResolvedValue({ docs: regDocs });

      const result = await firestoreTournamentRepository.getByParticipant('user-1');

      expect(result).toEqual(['t1']);
    });

    it('returns empty array when no registrations', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByParticipant('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getByScorekeeper', () => {
    it('queries tournaments where scorekeeperIds contains userId', async () => {
      const docs = [
        makeTournamentDoc('t1', { name: 'Open A', scorekeeperIds: ['user-1'] }),
      ];
      mockGetDocs.mockResolvedValue({ docs });

      const result = await firestoreTournamentRepository.getByScorekeeper('user-1');

      expect(mockWhere).toHaveBeenCalledWith('scorekeeperIds', 'array-contains', 'user-1');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });

    it('returns empty array when not a scorekeeper anywhere', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByScorekeeper('user-1');

      expect(result).toEqual([]);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts
```

Expected: FAIL — `getPublicTournaments`, `getByParticipant`, `getByScorekeeper` don't exist.

**Step 3: Implement the three query methods**

Add these imports to the top of `src/data/firebase/firestoreTournamentRepository.ts`:

```typescript
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  collection, collectionGroup, query, where, orderBy, serverTimestamp,
  limit as firestoreLimit, startAfter,
} from 'firebase/firestore';
```

Note: `limit` is renamed to `firestoreLimit` to avoid collision with any local variable.

Add these three methods to the `firestoreTournamentRepository` object:

```typescript
  async getPublicTournaments(
    pageSize = 50,
    cursor?: unknown,
  ): Promise<{ tournaments: Tournament[]; lastDoc: unknown }> {
    const constraints = [
      where('visibility', '==', 'public'),
      orderBy('date', 'desc'),
      firestoreLimit(pageSize),
    ];
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    const q = query(collection(firestore, 'tournaments'), ...constraints);
    const snapshot = await getDocs(q);
    const tournaments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined;
    return { tournaments, lastDoc };
  },

  async getByParticipant(userId: string): Promise<string[]> {
    const q = query(
      collectionGroup(firestore, 'registrations'),
      where('userId', '==', userId),
    );
    const snap = await getDocs(q);
    const ids = snap.docs.map((d) => d.ref.parent.parent!.id);
    return [...new Set(ids)];
  },

  async getByScorekeeper(userId: string): Promise<Tournament[]> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('scorekeeperIds', 'array-contains', userId),
      orderBy('date', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
  },
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts
```

Expected: All 8 tests PASS.

**Step 5: Run full test suite + type check**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: All tests pass, no type errors.

**Step 6: Commit**

```bash
git add src/data/firebase/firestoreTournamentRepository.ts src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts
git commit -m "feat: add discovery query methods to tournament repository

getPublicTournaments (paginated), getByParticipant (collection group),
getByScorekeeper (array-contains)"
```

---

## Task 4: Discovery Filter Engine

**Files:**
- Create: `src/features/tournaments/engine/discoveryFilters.ts`
- Create: `src/features/tournaments/engine/__tests__/discoveryFilters.test.ts`

**Step 1: Write the failing tests**

Create `src/features/tournaments/engine/__tests__/discoveryFilters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterPublicTournaments,
  mergeMyTournaments,
} from '../discoveryFilters';
import type { Tournament } from '../../../../data/types';

function makeTournament(overrides: Partial<Tournament> & { id: string }): Tournament {
  return {
    name: 'Test Tournament',
    date: Date.now(),
    location: 'Seattle, WA',
    format: 'round-robin',
    config: {} as Tournament['config'],
    organizerId: 'org-1',
    scorekeeperIds: [],
    status: 'registration',
    maxPlayers: null,
    teamFormation: null,
    minPlayers: null,
    entryFee: null,
    rules: {} as Tournament['rules'],
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility: 'public',
    shareCode: 'ABC123',
    ...overrides,
  };
}

describe('filterPublicTournaments', () => {
  const tournaments = [
    makeTournament({ id: 't1', name: 'Seattle Open', location: 'Seattle, WA', status: 'registration', format: 'round-robin' }),
    makeTournament({ id: 't2', name: 'Portland Classic', location: 'Portland, OR', status: 'pool-play', format: 'pool-bracket' }),
    makeTournament({ id: 't3', name: 'Boise Bash', location: 'Boise, ID', status: 'completed', format: 'single-elimination' }),
    makeTournament({ id: 't4', name: 'Seattle Singles', location: 'Bellevue, WA', status: 'bracket', format: 'single-elimination' }),
  ];

  it('returns all when no filters applied', () => {
    const result = filterPublicTournaments(tournaments, {});
    expect(result).toHaveLength(4);
  });

  it('filters by status', () => {
    const result = filterPublicTournaments(tournaments, { status: 'registration' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by status "upcoming" (setup + registration)', () => {
    const result = filterPublicTournaments(tournaments, { status: 'upcoming' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by status "active" (pool-play + bracket)', () => {
    const result = filterPublicTournaments(tournaments, { status: 'active' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t2', 't4']);
  });

  it('filters by format', () => {
    const result = filterPublicTournaments(tournaments, { format: 'single-elimination' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t3', 't4']);
  });

  it('filters by search text (name, case-insensitive)', () => {
    const result = filterPublicTournaments(tournaments, { search: 'seattle' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't4']);
  });

  it('filters by search text (location)', () => {
    const result = filterPublicTournaments(tournaments, { search: 'portland' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('combines multiple filters', () => {
    const result = filterPublicTournaments(tournaments, {
      status: 'active',
      format: 'single-elimination',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t4');
  });

  it('returns empty when nothing matches', () => {
    const result = filterPublicTournaments(tournaments, { search: 'nonexistent' });
    expect(result).toEqual([]);
  });
});

describe('mergeMyTournaments', () => {
  const t1 = makeTournament({ id: 't1', name: 'A', organizerId: 'user-1' });
  const t2 = makeTournament({ id: 't2', name: 'B', organizerId: 'user-2' });
  const t3 = makeTournament({ id: 't3', name: 'C', organizerId: 'user-3' });

  it('merges and deduplicates by tournament ID', () => {
    const result = mergeMyTournaments({
      organized: [t1],
      participating: [t1, t2], // t1 is duplicate
      scorekeeping: [t3],
    });
    expect(result).toHaveLength(3);
  });

  it('assigns organizer role', () => {
    const result = mergeMyTournaments({
      organized: [t1],
      participating: [],
      scorekeeping: [],
    });
    expect(result[0].role).toBe('organizer');
  });

  it('assigns player role', () => {
    const result = mergeMyTournaments({
      organized: [],
      participating: [t2],
      scorekeeping: [],
    });
    expect(result[0].role).toBe('player');
  });

  it('assigns scorekeeper role', () => {
    const result = mergeMyTournaments({
      organized: [],
      participating: [],
      scorekeeping: [t3],
    });
    expect(result[0].role).toBe('scorekeeper');
  });

  it('priority: organizer > scorekeeper > player', () => {
    // t1 is in all three lists
    const result = mergeMyTournaments({
      organized: [t1],
      participating: [t1],
      scorekeeping: [t1],
    });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('organizer');
  });

  it('scorekeeper takes priority over player', () => {
    const result = mergeMyTournaments({
      organized: [],
      participating: [t2],
      scorekeeping: [t2],
    });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('scorekeeper');
  });

  it('sorts by date descending', () => {
    const early = makeTournament({ id: 'e', date: 1000 });
    const late = makeTournament({ id: 'l', date: 2000 });
    const result = mergeMyTournaments({
      organized: [early],
      participating: [late],
      scorekeeping: [],
    });
    expect(result[0].tournament.id).toBe('l');
    expect(result[1].tournament.id).toBe('e');
  });

  it('filters by role', () => {
    const result = mergeMyTournaments({
      organized: [t1],
      participating: [t2],
      scorekeeping: [t3],
    });
    const organizedOnly = result.filter((r) => r.role === 'organizer');
    expect(organizedOnly).toHaveLength(1);
    expect(organizedOnly[0].tournament.id).toBe('t1');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/engine/__tests__/discoveryFilters.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the filter engine**

Create `src/features/tournaments/engine/discoveryFilters.ts`:

```typescript
import type { Tournament, TournamentFormat, TournamentStatus } from '../../../data/types';

export type UserRole = 'organizer' | 'scorekeeper' | 'player';

export type BrowseStatusFilter = 'all' | 'upcoming' | 'active' | 'completed' | TournamentStatus;

export interface BrowseFilters {
  status?: BrowseStatusFilter;
  format?: TournamentFormat;
  search?: string;
}

export interface MyTournamentEntry {
  tournament: Tournament;
  role: UserRole;
}

const UPCOMING_STATUSES: TournamentStatus[] = ['setup', 'registration'];
const ACTIVE_STATUSES: TournamentStatus[] = ['pool-play', 'bracket'];

export function filterPublicTournaments(
  tournaments: Tournament[],
  filters: BrowseFilters,
): Tournament[] {
  return tournaments.filter((t) => {
    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'upcoming') {
        if (!UPCOMING_STATUSES.includes(t.status)) return false;
      } else if (filters.status === 'active') {
        if (!ACTIVE_STATUSES.includes(t.status)) return false;
      } else if (filters.status === 'completed') {
        if (t.status !== 'completed') return false;
      } else {
        if (t.status !== filters.status) return false;
      }
    }

    // Format filter
    if (filters.format && t.format !== filters.format) return false;

    // Text search (case-insensitive on name + location)
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const nameMatch = t.name.toLowerCase().includes(term);
      const locationMatch = t.location.toLowerCase().includes(term);
      if (!nameMatch && !locationMatch) return false;
    }

    return true;
  });
}

export function mergeMyTournaments(sources: {
  organized: Tournament[];
  participating: Tournament[];
  scorekeeping: Tournament[];
}): MyTournamentEntry[] {
  const map = new Map<string, MyTournamentEntry>();

  // Add organized first (highest priority)
  for (const t of sources.organized) {
    map.set(t.id, { tournament: t, role: 'organizer' });
  }

  // Add scorekeeping (second priority — only if not already present)
  for (const t of sources.scorekeeping) {
    if (!map.has(t.id)) {
      map.set(t.id, { tournament: t, role: 'scorekeeper' });
    }
  }

  // Add participating (lowest priority — only if not already present)
  for (const t of sources.participating) {
    if (!map.has(t.id)) {
      map.set(t.id, { tournament: t, role: 'player' });
    }
  }

  // Sort by date descending
  const entries = [...map.values()];
  entries.sort((a, b) => b.tournament.date - a.tournament.date);

  return entries;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/tournaments/engine/__tests__/discoveryFilters.test.ts
```

Expected: All 16 tests PASS.

**Step 5: Run full test suite + type check**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/features/tournaments/engine/discoveryFilters.ts src/features/tournaments/engine/__tests__/discoveryFilters.test.ts
git commit -m "feat: add discovery filter engine

filterPublicTournaments (status/format/text search),
mergeMyTournaments (dedup, role priority, sort by date)"
```

---

## Task 5: BrowseCard Component

**Files:**
- Create: `src/features/tournaments/components/BrowseCard.tsx`
- Create: `src/features/tournaments/components/__tests__/BrowseCard.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/BrowseCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';
import BrowseCard from '../BrowseCard';
import type { Tournament } from '../../../../data/types';

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Seattle Open',
    date: new Date('2026-03-15').getTime(),
    location: 'Seattle, WA',
    format: 'round-robin',
    config: {} as Tournament['config'],
    organizerId: 'org-1',
    scorekeeperIds: [],
    status: 'registration',
    maxPlayers: 16,
    teamFormation: null,
    minPlayers: null,
    entryFee: null,
    rules: {} as Tournament['rules'],
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility: 'public',
    shareCode: 'ABC123',
    ...overrides,
  };
}

describe('BrowseCard', () => {
  const renderCard = (tournament = makeTournament(), registrationCount = 8) =>
    render(() => (
      <Router>
        <BrowseCard tournament={tournament} registrationCount={registrationCount} />
      </Router>
    ));

  it('renders tournament name', () => {
    renderCard();
    expect(screen.getByText('Seattle Open')).toBeTruthy();
  });

  it('renders date and location', () => {
    renderCard();
    expect(screen.getByText(/Seattle, WA/)).toBeTruthy();
    expect(screen.getByText(/Mar 15, 2026/)).toBeTruthy();
  });

  it('renders format label', () => {
    renderCard();
    expect(screen.getByText('Round Robin')).toBeTruthy();
  });

  it('renders status label', () => {
    renderCard();
    expect(screen.getByText('Registration Open')).toBeTruthy();
  });

  it('renders registration count with maxPlayers', () => {
    renderCard(makeTournament({ maxPlayers: 16 }), 8);
    expect(screen.getByText('8/16 registered')).toBeTruthy();
  });

  it('renders registration count without maxPlayers', () => {
    renderCard(makeTournament({ maxPlayers: null }), 5);
    expect(screen.getByText('5 registered')).toBeTruthy();
  });

  it('links to public tournament page via share code', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/t/ABC123');
  });

  it('links to dashboard when no share code (fallback)', () => {
    renderCard(makeTournament({ shareCode: null }));
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/tournaments/t1');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseCard.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement BrowseCard**

Create `src/features/tournaments/components/BrowseCard.tsx`:

```typescript
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Calendar, Activity, Trophy, X } from 'lucide-solid';
import type { Tournament } from '../../../data/types';
import { statusLabels, statusColors, formatLabels } from '../constants';

interface Props {
  tournament: Tournament;
  registrationCount: number;
}

const statusIcons: Record<string, Component<{ size: number; class?: string }>> = {
  setup: Calendar,
  registration: Calendar,
  'pool-play': Activity,
  bracket: Activity,
  completed: Trophy,
  cancelled: X,
  paused: Activity,
};

const BrowseCard: Component<Props> = (props) => {
  const dateStr = () =>
    new Date(props.tournament.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const href = () =>
    props.tournament.shareCode
      ? `/t/${props.tournament.shareCode}`
      : `/tournaments/${props.tournament.id}`;

  const registrationLabel = () =>
    props.tournament.maxPlayers
      ? `${props.registrationCount}/${props.tournament.maxPlayers} registered`
      : `${props.registrationCount} registered`;

  const StatusIcon = () => {
    const Icon = statusIcons[props.tournament.status];
    return Icon ? <Icon size={12} /> : null;
  };

  return (
    <A
      href={href()}
      class="block bg-surface-light rounded-xl p-4 border border-border active:scale-[0.98] hover-lift transition-all duration-200"
    >
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="font-bold text-on-surface truncate">{props.tournament.name}</h3>
        <span
          class={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[props.tournament.status] ?? ''}`}
        >
          <StatusIcon />
          {statusLabels[props.tournament.status] ?? props.tournament.status}
        </span>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-muted">
        <span>{dateStr()}</span>
        <Show when={props.tournament.location}>
          <span>{props.tournament.location}</span>
        </Show>
      </div>
      <div class="flex items-center justify-between mt-2 text-xs text-on-surface-muted">
        <span class="bg-surface-lighter px-2 py-0.5 rounded-full">
          {formatLabels[props.tournament.format] ?? props.tournament.format}
        </span>
        <span>{registrationLabel()}</span>
      </div>
    </A>
  );
};

export default BrowseCard;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseCard.test.tsx
```

Expected: All 8 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/BrowseCard.tsx src/features/tournaments/components/__tests__/BrowseCard.test.tsx
git commit -m "feat: add BrowseCard component for discovery feed"
```

---

## Task 6: BrowseTab Component

**Files:**
- Create: `src/features/tournaments/components/BrowseTab.tsx`
- Create: `src/features/tournaments/components/__tests__/BrowseTab.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/BrowseTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';
import BrowseTab from '../BrowseTab';

// Mock the repository
vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getPublicTournaments: vi.fn().mockResolvedValue({
      tournaments: [],
      lastDoc: undefined,
    }),
  },
}));

describe('BrowseTab', () => {
  it('renders search input', async () => {
    render(() => (
      <Router>
        <BrowseTab />
      </Router>
    ));
    expect(screen.getByPlaceholderText('Search name or location...')).toBeTruthy();
  });

  it('renders status filter dropdown', () => {
    render(() => (
      <Router>
        <BrowseTab />
      </Router>
    ));
    const statusSelect = screen.getByLabelText('Filter by status');
    expect(statusSelect).toBeTruthy();
  });

  it('renders format filter dropdown', () => {
    render(() => (
      <Router>
        <BrowseTab />
      </Router>
    ));
    const formatSelect = screen.getByLabelText('Filter by format');
    expect(formatSelect).toBeTruthy();
  });

  it('shows empty state when no tournaments match', async () => {
    render(() => (
      <Router>
        <BrowseTab />
      </Router>
    ));
    // Wait for resource to resolve
    await vi.waitFor(() => {
      expect(screen.getByText(/No tournaments found/i)).toBeTruthy();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseTab.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement BrowseTab**

Create `src/features/tournaments/components/BrowseTab.tsx`:

```typescript
import { createSignal, createResource, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Search, Sparkles } from 'lucide-solid';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import { filterPublicTournaments } from '../engine/discoveryFilters';
import type { BrowseStatusFilter } from '../engine/discoveryFilters';
import type { TournamentFormat } from '../../../data/types';
import BrowseCard from './BrowseCard';
import EmptyState from '../../../shared/components/EmptyState';

const BrowseTab: Component = () => {
  const [search, setSearch] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<BrowseStatusFilter>('upcoming');
  const [formatFilter, setFormatFilter] = createSignal<TournamentFormat | ''>('');
  const [cursor, setCursor] = createSignal<unknown>(undefined);
  const [allTournaments, setAllTournaments] = createSignal<
    Array<{ tournament: import('../../../data/types').Tournament; registrationCount: number }>
  >([]);

  const [initialLoad] = createResource(async () => {
    const result = await firestoreTournamentRepository.getPublicTournaments(50);
    setCursor(result.lastDoc);

    // Fetch registration counts for each tournament
    const withCounts = await Promise.all(
      result.tournaments.map(async (t) => {
        // Registration count will come from the tournament's registrations subcollection
        // For now, we pass 0 — the BrowseCard handles display
        return { tournament: t, registrationCount: 0 };
      }),
    );
    setAllTournaments(withCounts);
    return result;
  });

  const filteredTournaments = () => {
    const tournaments = allTournaments().map((e) => e.tournament);
    const filters = {
      status: statusFilter() || undefined,
      format: formatFilter() || undefined,
      search: search() || undefined,
    };
    const filtered = filterPublicTournaments(tournaments, filters);
    // Map back to include registration counts
    return filtered.map((t) => {
      const entry = allTournaments().find((e) => e.tournament.id === t.id);
      return { tournament: t, registrationCount: entry?.registrationCount ?? 0 };
    });
  };

  const loadMore = async () => {
    const c = cursor();
    if (!c) return;
    const result = await firestoreTournamentRepository.getPublicTournaments(50, c);
    setCursor(result.lastDoc);
    const withCounts = result.tournaments.map((t) => ({
      tournament: t,
      registrationCount: 0,
    }));
    setAllTournaments((prev) => [...prev, ...withCounts]);
  };

  return (
    <div>
      {/* Filter bar */}
      <div class="space-y-3 mb-4">
        <div class="relative">
          <Search
            size={16}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search name or location..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="w-full bg-surface-light border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary"
          />
        </div>
        <div class="flex gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter()}
            onChange={(e) => setStatusFilter(e.currentTarget.value as BrowseStatusFilter)}
            class="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2.5 text-sm text-on-surface appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select
            aria-label="Filter by format"
            value={formatFilter()}
            onChange={(e) => setFormatFilter(e.currentTarget.value as TournamentFormat | '')}
            class="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2.5 text-sm text-on-surface appearance-none cursor-pointer"
          >
            <option value="">All Formats</option>
            <option value="round-robin">Round Robin</option>
            <option value="single-elimination">Single Elim</option>
            <option value="pool-bracket">Pool + Bracket</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      <Show when={initialLoad.loading}>
        <div class="flex flex-col items-center justify-center py-16 gap-3">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p class="text-sm text-on-surface-muted">Loading tournaments...</p>
        </div>
      </Show>

      {/* Results */}
      <Show when={!initialLoad.loading}>
        <Show
          when={filteredTournaments().length > 0}
          fallback={
            <EmptyState
              icon={<Sparkles size={32} />}
              title="No tournaments found"
              description={
                search() || statusFilter() !== 'upcoming' || formatFilter()
                  ? 'Try adjusting your filters or search.'
                  : 'No public tournaments yet. Be the first to create one!'
              }
              actionLabel={!search() && statusFilter() === 'upcoming' && !formatFilter() ? 'Create Tournament' : undefined}
              actionHref={!search() && statusFilter() === 'upcoming' && !formatFilter() ? '/tournaments/new' : undefined}
            />
          }
        >
          <ul role="list" class="space-y-3 list-none p-0 m-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
            <For each={filteredTournaments()}>
              {(entry) => (
                <li>
                  <BrowseCard
                    tournament={entry.tournament}
                    registrationCount={entry.registrationCount}
                  />
                </li>
              )}
            </For>
          </ul>

          {/* Load More */}
          <Show when={cursor()}>
            <div class="mt-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                class="px-6 py-2.5 bg-surface-light border border-border text-on-surface text-sm font-semibold rounded-lg active:scale-95 transition-transform"
              >
                Load More
              </button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default BrowseTab;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseTab.test.tsx
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/BrowseTab.tsx src/features/tournaments/components/__tests__/BrowseTab.test.tsx
git commit -m "feat: add BrowseTab component with filters and pagination"
```

---

## Task 7: MyTournamentsTab Component

Refactor the existing `TournamentListPage.tsx` content into a reusable tab that fetches tournaments from all three role queries.

**Files:**
- Create: `src/features/tournaments/components/MyTournamentsTab.tsx`
- Create: `src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';
import MyTournamentsTab from '../MyTournamentsTab';
import type { Tournament } from '../../../../data/types';

function makeTournament(overrides: Partial<Tournament> & { id: string }): Tournament {
  return {
    name: 'Test Tournament',
    date: Date.now(),
    location: 'Seattle, WA',
    format: 'round-robin',
    config: {} as Tournament['config'],
    organizerId: 'org-1',
    scorekeeperIds: [],
    status: 'registration',
    maxPlayers: null,
    teamFormation: null,
    minPlayers: null,
    entryFee: null,
    rules: {} as Tournament['rules'],
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility: 'public',
    shareCode: null,
    ...overrides,
  };
}

const mockGetByOrganizer = vi.fn().mockResolvedValue([]);
const mockGetByParticipant = vi.fn().mockResolvedValue([]);
const mockGetByScorekeeper = vi.fn().mockResolvedValue([]);
const mockGetById = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getByOrganizer: (...args: unknown[]) => mockGetByOrganizer(...args),
    getByParticipant: (...args: unknown[]) => mockGetByParticipant(...args),
    getByScorekeeper: (...args: unknown[]) => mockGetByScorekeeper(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock('../../../../data/firebase/firestoreInvitationRepository', () => ({
  firestoreInvitationRepository: {
    getPendingForUser: vi.fn().mockResolvedValue([]),
  },
}));

describe('MyTournamentsTab', () => {
  it('renders role filter dropdown', () => {
    render(() => (
      <Router>
        <MyTournamentsTab userId="user-1" />
      </Router>
    ));
    expect(screen.getByLabelText('Filter by role')).toBeTruthy();
  });

  it('renders Create Tournament button', () => {
    render(() => (
      <Router>
        <MyTournamentsTab userId="user-1" />
      </Router>
    ));
    expect(screen.getByText('+ New')).toBeTruthy();
  });

  it('shows empty state when no tournaments', async () => {
    render(() => (
      <Router>
        <MyTournamentsTab userId="user-1" />
      </Router>
    ));
    await vi.waitFor(() => {
      expect(screen.getByText(/No tournaments yet/i)).toBeTruthy();
    });
  });

  it('shows tournaments with role badges when data available', async () => {
    const t1 = makeTournament({ id: 't1', name: 'My Tourney', organizerId: 'user-1' });
    mockGetByOrganizer.mockResolvedValue([t1]);

    render(() => (
      <Router>
        <MyTournamentsTab userId="user-1" />
      </Router>
    ));

    await vi.waitFor(() => {
      expect(screen.getByText('My Tourney')).toBeTruthy();
      expect(screen.getByText('Organizer')).toBeTruthy();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement MyTournamentsTab**

Create `src/features/tournaments/components/MyTournamentsTab.tsx`:

```typescript
import { createSignal, createResource, For, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { AlertTriangle, Sparkles } from 'lucide-solid';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import { mergeMyTournaments } from '../engine/discoveryFilters';
import type { UserRole, MyTournamentEntry } from '../engine/discoveryFilters';
import TournamentCard from './TournamentCard';
import InvitationInbox from './InvitationInbox';
import EmptyState from '../../../shared/components/EmptyState';

interface Props {
  userId: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  organizer: 'Organizer',
  scorekeeper: 'Scorekeeper',
  player: 'Player',
};

const ROLE_COLORS: Record<UserRole, string> = {
  organizer: 'bg-green-500/20 text-green-400',
  scorekeeper: 'bg-orange-500/20 text-orange-400',
  player: 'bg-blue-500/20 text-blue-400',
};

const MyTournamentsTab: Component<Props> = (props) => {
  const [roleFilter, setRoleFilter] = createSignal<UserRole | ''>('');

  const [data, { refetch }] = createResource(
    () => props.userId,
    async (uid) => {
      const [organized, participantIds, scorekeeping] = await Promise.all([
        firestoreTournamentRepository.getByOrganizer(uid),
        firestoreTournamentRepository.getByParticipant(uid),
        firestoreTournamentRepository.getByScorekeeper(uid),
      ]);

      // Fetch tournament docs for participant IDs (only those not already fetched)
      const knownIds = new Set([
        ...organized.map((t) => t.id),
        ...scorekeeping.map((t) => t.id),
      ]);
      const newParticipantIds = participantIds.filter((id) => !knownIds.has(id));
      const participatingTournaments = (
        await Promise.all(
          newParticipantIds.map((id) =>
            firestoreTournamentRepository.getById(id).catch(() => undefined),
          ),
        )
      ).filter(Boolean) as import('../../../data/types').Tournament[];

      // Also include organized/scorekeeping tournaments that appear in participant list
      const allParticipating = [
        ...participatingTournaments,
        ...organized.filter((t) => participantIds.includes(t.id)),
        ...scorekeeping.filter((t) => participantIds.includes(t.id)),
      ];

      return mergeMyTournaments({
        organized,
        participating: allParticipating,
        scorekeeping,
      });
    },
  );

  const filteredEntries = (): MyTournamentEntry[] => {
    const entries = data() ?? [];
    const role = roleFilter();
    if (!role) return entries;
    return entries.filter((e) => e.role === role);
  };

  return (
    <div>
      <InvitationInbox userId={props.userId} />

      <Switch>
        <Match when={data.loading}>
          <div class="flex flex-col items-center justify-center py-16 gap-3">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p class="text-sm text-on-surface-muted">Loading tournaments...</p>
          </div>
        </Match>
        <Match when={data.error}>
          <div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertTriangle size={40} class="text-red-400" />
            <p class="text-sm text-red-400 font-semibold">Failed to load tournaments</p>
            <button
              type="button"
              onClick={() => refetch()}
              class="mt-2 px-4 py-2 bg-primary text-surface text-sm font-semibold rounded-lg active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        </Match>
        <Match when={data() && (data()!.length === 0)}>
          <EmptyState
            icon={<Sparkles size={32} />}
            title="No tournaments yet"
            description="Create your first tournament or browse public tournaments to join."
            actionLabel="Create Tournament"
            actionHref="/tournaments/new"
          />
        </Match>
        <Match when={data() && data()!.length > 0}>
          <div class="flex items-center justify-between mb-4">
            <select
              aria-label="Filter by role"
              value={roleFilter()}
              onChange={(e) => setRoleFilter(e.currentTarget.value as UserRole | '')}
              class="bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-on-surface appearance-none cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="organizer">Organizing</option>
              <option value="player">Playing</option>
              <option value="scorekeeper">Scorekeeping</option>
            </select>
            <A
              href="/tournaments/new"
              class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform"
            >
              + New
            </A>
          </div>
          <Show
            when={filteredEntries().length > 0}
            fallback={
              <p class="text-center text-on-surface-muted text-sm py-8">
                No tournaments match this filter.
              </p>
            }
          >
            <ul role="list" class="space-y-3 list-none p-0 m-0">
              <For each={filteredEntries()}>
                {(entry) => (
                  <li class="relative">
                    <TournamentCard tournament={entry.tournament} />
                    <span
                      class={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[entry.role]}`}
                    >
                      {ROLE_LABELS[entry.role]}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Match>
      </Switch>
    </div>
  );
};

export default MyTournamentsTab;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/MyTournamentsTab.tsx src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx
git commit -m "feat: add MyTournamentsTab with role badges and role filter

Fetches from organizer, participant (collection group), scorekeeper
queries. Merges with role priority, displays role badges."
```

---

## Task 8: DiscoverPage with Sub-Tabs

**Files:**
- Create: `src/features/tournaments/DiscoverPage.tsx`
- Create: `src/features/tournaments/__tests__/DiscoverPage.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/__tests__/DiscoverPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';
import DiscoverPage from '../DiscoverPage';

// Mock auth — logged out by default
const mockUser = vi.fn(() => null);
vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock repository
vi.mock('../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getPublicTournaments: vi.fn().mockResolvedValue({ tournaments: [], lastDoc: undefined }),
    getByOrganizer: vi.fn().mockResolvedValue([]),
    getByParticipant: vi.fn().mockResolvedValue([]),
    getByScorekeeper: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../data/firebase/firestoreInvitationRepository', () => ({
  firestoreInvitationRepository: {
    getPendingForUser: vi.fn().mockResolvedValue([]),
  },
}));

describe('DiscoverPage', () => {
  it('shows Browse tab only when logged out (no tab switcher)', () => {
    mockUser.mockReturnValue(null);
    render(() => (
      <Router>
        <DiscoverPage />
      </Router>
    ));
    // Browse content should be visible (search input)
    expect(screen.getByPlaceholderText('Search name or location...')).toBeTruthy();
    // Tab switcher should NOT be visible
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('shows tab switcher when logged in', () => {
    mockUser.mockReturnValue({ uid: 'user-1' });
    render(() => (
      <Router>
        <DiscoverPage />
      </Router>
    ));
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /browse/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /my tournaments/i })).toBeTruthy();
  });

  it('renders page title', () => {
    mockUser.mockReturnValue(null);
    render(() => (
      <Router>
        <DiscoverPage />
      </Router>
    ));
    expect(screen.getByText('Tournaments')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/__tests__/DiscoverPage.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement DiscoverPage**

Create `src/features/tournaments/DiscoverPage.tsx`:

```typescript
import { createSignal, createResource, Show } from 'solid-js';
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreInvitationRepository } from '../../data/firebase/firestoreInvitationRepository';
import BrowseTab from './components/BrowseTab';
import MyTournamentsTab from './components/MyTournamentsTab';

type TabId = 'browse' | 'my';

const DiscoverPage: Component = () => {
  const { user } = useAuth();

  // Determine smart default tab
  const [defaultResolved, setDefaultResolved] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<TabId>('browse');

  // Resolve smart default for logged-in users
  createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) {
        setDefaultResolved(true);
        return;
      }
      try {
        // Check if user has pending invitations
        const pending = await firestoreInvitationRepository.getPendingForUser(uid);
        if (pending.length > 0) {
          setActiveTab('my');
          setDefaultResolved(true);
          return;
        }

        // Check if user has any tournaments (organizer or participant)
        const [organized, participantIds, scorekeeping] = await Promise.all([
          firestoreTournamentRepository.getByOrganizer(uid),
          firestoreTournamentRepository.getByParticipant(uid),
          firestoreTournamentRepository.getByScorekeeper(uid),
        ]);

        if (organized.length > 0 || participantIds.length > 0 || scorekeeping.length > 0) {
          setActiveTab('my');
        }
      } catch {
        // Default to browse on error
      }
      setDefaultResolved(true);
    },
  );

  const isLoggedIn = () => !!user();

  const tabClass = (tab: TabId) =>
    `flex-1 py-2.5 text-sm font-semibold text-center rounded-lg transition-colors ${
      activeTab() === tab
        ? 'bg-primary/10 text-primary'
        : 'text-on-surface-muted hover:text-on-surface'
    }`;

  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        {/* Tab switcher — only shown for logged-in users */}
        <Show when={isLoggedIn()}>
          <div role="tablist" class="flex gap-1 bg-surface-lighter rounded-xl p-1 mb-4">
            <button
              role="tab"
              aria-selected={activeTab() === 'browse'}
              aria-label="Browse"
              class={tabClass('browse')}
              onClick={() => setActiveTab('browse')}
            >
              Browse
            </button>
            <button
              role="tab"
              aria-selected={activeTab() === 'my'}
              aria-label="My Tournaments"
              class={tabClass('my')}
              onClick={() => setActiveTab('my')}
            >
              My Tournaments
            </button>
          </div>
        </Show>

        {/* Tab content */}
        <Show when={activeTab() === 'browse'}>
          <BrowseTab />
        </Show>
        <Show when={activeTab() === 'my' && user()}>
          {(u) => <MyTournamentsTab userId={u().uid} />}
        </Show>
      </div>
    </PageLayout>
  );
};

export default DiscoverPage;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/tournaments/__tests__/DiscoverPage.test.tsx
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/DiscoverPage.tsx src/features/tournaments/__tests__/DiscoverPage.test.tsx
git commit -m "feat: add DiscoverPage with Browse/My Tournaments sub-tabs

Smart default: browse for logged-out, my-tournaments for users
with existing tournaments or pending invitations."
```

---

## Task 9: Update Routing

Remove `RequireAuth` wrapper from `/tournaments` route so Browse tab is accessible without auth. Point to `DiscoverPage` instead of `TournamentListPage`.

**Files:**
- Modify: `src/app/router.tsx`

**Step 1: Update router.tsx**

Replace the tournaments route block. Change from:

```typescript
<Route path="/tournaments" component={RequireAuth}>
  <Route path="/" component={TournamentListPage} />
  <Route path="/new" component={TournamentCreatePage} />
  <Route path="/:id" component={TournamentDashboardPage} />
</Route>
```

To:

```typescript
<Route path="/tournaments">
  <Route path="/" component={DiscoverPage} />
  <Route path="/new" component={RequireAuth}>
    <Route path="/" component={TournamentCreatePage} />
  </Route>
  <Route path="/:id" component={RequireAuth}>
    <Route path="/" component={TournamentDashboardPage} />
  </Route>
</Route>
```

Also add the lazy import at the top:

```typescript
const DiscoverPage = lazy(() => import('../features/tournaments/DiscoverPage'));
```

Keep the `TournamentListPage` import for now (it's still used by MyTournamentsTab indirectly through InvitationInbox etc.), but the route no longer points to it.

**Step 2: Run type check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 3: Commit**

```bash
git add src/app/router.tsx
git commit -m "feat: update routing for tournament discovery

/tournaments now public (Browse tab), /tournaments/new and
/tournaments/:id still require auth."
```

---

## Task 10: Show Tournaments Tab for All Users

Currently `BottomNav.tsx` wraps the Tournaments link in `<Show when={user()}>`. Remove that guard so logged-out users can access Browse.

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

**Step 1: Remove the auth guard from Tournaments link**

In `BottomNav.tsx`, the Tournaments link is wrapped in `<Show when={user()}>`. Unwrap it so it's always visible (like New Game, History, Players, Settings).

Remove the `<Show when={user()}>` wrapper around the Tournaments `<A>` tag, keeping the `<A>` tag itself intact.

**Step 2: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 3: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "feat: show Tournaments tab for all users (logged-out browse)"
```

---

## Task 11: Add Invitation Badge to BottomNav

Add a notification badge on the Tournaments icon showing pending invitation count, following the exact pattern used for Buddies unread count.

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

**Step 1: Add invitation count hook**

Create a simple resource that fetches pending invitation count. Add to BottomNav:

```typescript
import { firestoreInvitationRepository } from '../../data/firebase/firestoreInvitationRepository';

// Inside the component, after the existing useBuddyNotifications hook:
const [invitationCount] = createResource(
  () => user()?.uid,
  async (uid) => {
    if (!uid) return 0;
    const pending = await firestoreInvitationRepository.getPendingForUser(uid);
    return pending.length;
  },
);
```

Add the `createResource` import from `solid-js` (it's not currently imported in BottomNav).

Then add the badge to the Tournaments `<A>` element, following the exact Buddies pattern:

```tsx
<Show when={(invitationCount() ?? 0) > 0}>
  <span
    class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
    aria-label={`${invitationCount()} pending invitations`}
  >
    {(invitationCount() ?? 0) > 9 ? '9+' : invitationCount()}
  </span>
</Show>
```

**Step 2: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 3: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "feat: add invitation badge to Tournaments bottom nav icon"
```

---

## Task 12: Landing Page Tournament Preview

Add an "Upcoming Tournaments" section to the landing page showing up to 5 public tournaments.

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Add the preview section**

Add this section between the "How It Works" section and the "Final CTA" section in `LandingPage.tsx`:

```tsx
{/* Upcoming Tournaments Preview */}
<TournamentPreview />
```

Create a `TournamentPreview` component inside the same file (or as a local function component):

```typescript
import { createResource, Show, For } from 'solid-js';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { filterPublicTournaments } from '../tournaments/engine/discoveryFilters';

function TournamentPreview() {
  const [upcoming] = createResource(async () => {
    try {
      const result = await firestoreTournamentRepository.getPublicTournaments(10);
      return filterPublicTournaments(result.tournaments, { status: 'upcoming' }).slice(0, 5);
    } catch {
      return [];
    }
  });

  return (
    <Show when={upcoming() && upcoming()!.length > 0}>
      <section class="px-4 py-12 md:py-16">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-2 text-gradient-subtle"
            style={{ "font-family": "var(--font-score)" }}
          >
            Upcoming Tournaments
          </h2>
          <p class="text-center text-on-surface-muted text-sm mb-6">
            Find and join public tournaments near you
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={upcoming()}>
              {(t) => (
                <A
                  href={t.shareCode ? `/t/${t.shareCode}` : `/tournaments/${t.id}`}
                  class="block bg-surface-light rounded-xl p-4 border border-border hover-lift transition-all duration-200"
                >
                  <h3 class="font-bold text-on-surface truncate mb-1">{t.name}</h3>
                  <div class="text-sm text-on-surface-muted">
                    {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {t.location ? ` · ${t.location}` : ''}
                  </div>
                  <span class="inline-block mt-2 text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                    {formatLabels[t.format] ?? t.format}
                  </span>
                </A>
              )}
            </For>
          </div>
          <div class="text-center mt-4">
            <A
              href="/tournaments"
              class="text-primary text-sm font-semibold hover:underline"
            >
              Browse All Tournaments →
            </A>
          </div>
        </div>
      </section>
    </Show>
  );
}
```

Import `formatLabels` at the top:

```typescript
import { formatLabels } from '../tournaments/constants';
```

**Step 2: Run type check + build**

```bash
npx tsc --noEmit && npx vite build
```

**Step 3: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "feat: add upcoming tournaments preview to landing page"
```

---

## Task 13: Final Verification

**Files:** None (verification only)

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (existing 382+ plus new tests).

**Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Build**

```bash
npx vite build
```

Expected: Build succeeds.

**Step 4: Visual verification with Playwright**

Start dev server and take screenshots:

```bash
npx vite --port 5199 &
```

Take screenshots at mobile (390x844) and desktop (1280x800):
- `/tournaments` — Browse tab (logged out)
- `/tournaments` — My Tournaments tab (logged in)
- `/` — Landing page with tournament preview section

**Step 5: Commit any final fixes, then verify clean**

```bash
git status
git log --oneline -15
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Create feature branch | — | — |
| 2 | Firestore indexes | — | `firestore.indexes.json` |
| 3 | Repository query methods | `firestoreTournamentRepository.discovery.test.ts` | `firestoreTournamentRepository.ts` |
| 4 | Discovery filter engine | `discoveryFilters.ts`, `discoveryFilters.test.ts` | — |
| 5 | BrowseCard component | `BrowseCard.tsx`, `BrowseCard.test.tsx` | — |
| 6 | BrowseTab component | `BrowseTab.tsx`, `BrowseTab.test.tsx` | — |
| 7 | MyTournamentsTab component | `MyTournamentsTab.tsx`, `MyTournamentsTab.test.tsx` | — |
| 8 | DiscoverPage with sub-tabs | `DiscoverPage.tsx`, `DiscoverPage.test.tsx` | — |
| 9 | Update routing | — | `router.tsx` |
| 10 | Show Tournaments tab for all | — | `BottomNav.tsx` |
| 11 | Invitation badge on nav | — | `BottomNav.tsx` |
| 12 | Landing page preview | — | `LandingPage.tsx` |
| 13 | Final verification | — | — |
