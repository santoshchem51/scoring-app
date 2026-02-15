# Tournament Management (Layer 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tournament creation, pool play, bracket generation, and organizer tools to PickleScore.

**Architecture:** Five sub-phases build on Layer 1's Firebase foundation. Phase 2A adds tournament data types and Firestore repositories. Phase 2B adds pure-function algorithms (scheduling, bracketing). Phase 2C wires up the core UI pages and routing. Phase 2D builds pool/bracket visualization components. Phase 2E adds player registration, fee tracking, and edge-case flows.

**Tech Stack:** SolidJS 1.9, TypeScript 5.9, Firebase 12 (Firestore + Auth), XState v5, Dexie 4, Tailwind CSS v4, Vitest 4

**SolidJS Rules (CRITICAL):**
- Use `class` NOT `className`
- NEVER destructure props — always `props.foo`
- `import type` for type-only imports (`verbatimModuleSyntax: true`)
- Components: `Show`, `For`, `Switch/Match` from `solid-js`
- Signals: `createSignal`, Effects: `createEffect`, `on()` for watching

**Test runner:** `npx vitest run` (config in `vite.config.ts`, setup in `src/test-setup.ts`)

**Project root:** `C:\Projects\Personal_BrainStrom_Projects\Superpowers\Projects\ScoringApp`

---

## Phase 2A: Tournament Data Foundation

### Task 1: Tournament Types

**Files:**
- Modify: `src/data/types.ts` (append after Cloud types)

**Step 1: Add tournament type definitions**

Append to `src/data/types.ts`:

```typescript
// --- Tournament types (Layer 2) ---

export type TournamentFormat = 'round-robin' | 'single-elimination' | 'pool-bracket';
export type TournamentStatus = 'setup' | 'registration' | 'pool-play' | 'bracket' | 'completed' | 'cancelled' | 'paused';
export type PaymentStatus = 'unpaid' | 'paid' | 'waived';

export interface EntryFee {
  amount: number;
  currency: string;
  paymentInstructions: string;
  deadline: number | null;
}

export interface TournamentRules {
  registrationDeadline: number | null;
  checkInRequired: boolean;
  checkInOpens: number | null;
  checkInCloses: number | null;
  scoringRules: string;
  timeoutRules: string;
  conductRules: string;
  penalties: Array<{ offense: string; consequence: string }>;
  additionalNotes: string;
}

export interface TournamentConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: 11 | 15 | 21;
  poolCount: number;
  teamsPerPoolAdvancing: number;
}

export interface Tournament {
  id: string;
  name: string;
  date: number;
  location: string;
  format: TournamentFormat;
  config: TournamentConfig;
  organizerId: string;
  scorekeeperIds: string[];
  status: TournamentStatus;
  maxPlayers: number | null;
  minPlayers: number | null;
  entryFee: EntryFee | null;
  rules: TournamentRules;
  cancellationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  playerIds: string[];
  seed: number | null;
  poolId: string | null;
}

export interface PoolStanding {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface PoolScheduleEntry {
  round: number;
  team1Id: string;
  team2Id: string;
  matchId: string | null;
  court: string | null;
}

export interface TournamentPool {
  id: string;
  tournamentId: string;
  name: string;
  teamIds: string[];
  schedule: PoolScheduleEntry[];
  standings: PoolStanding[];
}

export interface BracketSlot {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  matchId: string | null;
  winnerId: string | null;
  nextSlotId: string | null;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  lateEntry: boolean;
  rulesAcknowledged: boolean;
  registeredAt: number;
}
```

**Step 2: Add tournament fields to Match type**

In `src/data/types.ts`, update the `Match` interface — add these optional fields before `lastSnapshot`:

```typescript
  tournamentId?: string;
  poolId?: string;
  bracketSlotId?: string;
  court?: string;
```

**Step 3: Run existing tests to verify no breakage**

Run: `npx vitest run`
Expected: All 55 tests pass (new types are additive only).

**Step 4: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add tournament type definitions"
```

---

### Task 2: Dexie Schema Migration

**Files:**
- Modify: `src/data/db.ts`

**Step 1: Add Dexie v2 schema with tournaments table**

Update `src/data/db.ts`:

```typescript
import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Match, Player, ScoreEvent, Tournament } from './types';

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
};

db.version(1).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
});

db.version(2).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
});

export { db };
```

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All pass. Dexie auto-migrates.

**Step 3: Commit**

```bash
git add src/data/db.ts
git commit -m "feat: add tournaments table to Dexie (schema v2)"
```

---

### Task 3: Firestore Tournament Repository

**Files:**
- Create: `src/data/firebase/firestoreTournamentRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreTournamentRepository.test.ts`

**Step 1: Write the test**

Create `src/data/firebase/__tests__/firestoreTournamentRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { firestoreTournamentRepository } from '../firestoreTournamentRepository';

describe('firestoreTournamentRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreTournamentRepository.save).toBe('function');
  });

  it('exports getById method', () => {
    expect(typeof firestoreTournamentRepository.getById).toBe('function');
  });

  it('exports getByOrganizer method', () => {
    expect(typeof firestoreTournamentRepository.getByOrganizer).toBe('function');
  });

  it('exports delete method', () => {
    expect(typeof firestoreTournamentRepository.delete).toBe('function');
  });

  it('exports updateStatus method', () => {
    expect(typeof firestoreTournamentRepository.updateStatus).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTournamentRepository.test.ts`
Expected: FAIL — module not found.

**Step 3: Write implementation**

Create `src/data/firebase/firestoreTournamentRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { Tournament, TournamentStatus } from '../types';

export const firestoreTournamentRepository = {
  async save(tournament: Tournament): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournament.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, {
        ...tournament,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...tournament,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  async getById(id: string): Promise<Tournament | undefined> {
    const ref = doc(firestore, 'tournaments', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return { id: snap.id, ...snap.data() } as Tournament;
  },

  async getByOrganizer(organizerId: string): Promise<Tournament[]> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('organizerId', '==', organizerId),
      orderBy('date', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
  },

  async updateStatus(id: string, status: TournamentStatus, reason?: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    const updates: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (reason !== undefined) {
      updates.cancellationReason = reason;
    }
    await updateDoc(ref, updates);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', id));
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTournamentRepository.test.ts`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreTournamentRepository.ts src/data/firebase/__tests__/firestoreTournamentRepository.test.ts
git commit -m "feat: add Firestore tournament repository"
```

---

### Task 4: Firestore Team Repository

**Files:**
- Create: `src/data/firebase/firestoreTeamRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreTeamRepository.test.ts`

**Step 1: Write the test**

Create `src/data/firebase/__tests__/firestoreTeamRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { firestoreTeamRepository } from '../firestoreTeamRepository';

describe('firestoreTeamRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreTeamRepository.save).toBe('function');
  });

  it('exports getByTournament method', () => {
    expect(typeof firestoreTeamRepository.getByTournament).toBe('function');
  });

  it('exports delete method', () => {
    expect(typeof firestoreTeamRepository.delete).toBe('function');
  });

  it('exports updatePool method', () => {
    expect(typeof firestoreTeamRepository.updatePool).toBe('function');
  });
});
```

**Step 2: Run test — expect FAIL**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTeamRepository.test.ts`

**Step 3: Write implementation**

Create `src/data/firebase/firestoreTeamRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentTeam } from '../types';

export const firestoreTeamRepository = {
  async save(team: TournamentTeam): Promise<void> {
    const ref = doc(firestore, 'tournaments', team.tournamentId, 'teams', team.id);
    await setDoc(ref, { ...team, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<TournamentTeam[]> {
    const q = query(
      collection(firestore, 'tournaments', tournamentId, 'teams'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam);
  },

  async updatePool(tournamentId: string, teamId: string, poolId: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'teams', teamId);
    await updateDoc(ref, { poolId, updatedAt: serverTimestamp() });
  },

  async delete(tournamentId: string, teamId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', tournamentId, 'teams', teamId));
  },
};
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTeamRepository.test.ts`

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreTeamRepository.ts src/data/firebase/__tests__/firestoreTeamRepository.test.ts
git commit -m "feat: add Firestore team repository"
```

---

### Task 5: Firestore Pool Repository

**Files:**
- Create: `src/data/firebase/firestorePoolRepository.ts`
- Create: `src/data/firebase/__tests__/firestorePoolRepository.test.ts`

**Step 1: Write the test**

Create `src/data/firebase/__tests__/firestorePoolRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { firestorePoolRepository } from '../firestorePoolRepository';

describe('firestorePoolRepository', () => {
  it('exports save method', () => {
    expect(typeof firestorePoolRepository.save).toBe('function');
  });

  it('exports getByTournament method', () => {
    expect(typeof firestorePoolRepository.getByTournament).toBe('function');
  });

  it('exports updateStandings method', () => {
    expect(typeof firestorePoolRepository.updateStandings).toBe('function');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/data/firebase/firestorePoolRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentPool, PoolStanding } from '../types';

export const firestorePoolRepository = {
  async save(pool: TournamentPool): Promise<void> {
    const ref = doc(firestore, 'tournaments', pool.tournamentId, 'pools', pool.id);
    await setDoc(ref, { ...pool, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<TournamentPool[]> {
    const snapshot = await getDocs(
      collection(firestore, 'tournaments', tournamentId, 'pools'),
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool);
  },

  async updateStandings(tournamentId: string, poolId: string, standings: PoolStanding[]): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'pools', poolId);
    await updateDoc(ref, { standings, updatedAt: serverTimestamp() });
  },
};
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePoolRepository.ts src/data/firebase/__tests__/firestorePoolRepository.test.ts
git commit -m "feat: add Firestore pool repository"
```

---

### Task 6: Firestore Bracket & Registration Repositories

**Files:**
- Create: `src/data/firebase/firestoreBracketRepository.ts`
- Create: `src/data/firebase/firestoreRegistrationRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreBracketRepository.test.ts`
- Create: `src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`

**Step 1: Write bracket test**

Create `src/data/firebase/__tests__/firestoreBracketRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { firestoreBracketRepository } from '../firestoreBracketRepository';

describe('firestoreBracketRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreBracketRepository.save).toBe('function');
  });

  it('exports getByTournament method', () => {
    expect(typeof firestoreBracketRepository.getByTournament).toBe('function');
  });

  it('exports updateResult method', () => {
    expect(typeof firestoreBracketRepository.updateResult).toBe('function');
  });
});
```

**Step 2: Write bracket implementation**

Create `src/data/firebase/firestoreBracketRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { BracketSlot } from '../types';

export const firestoreBracketRepository = {
  async save(slot: BracketSlot): Promise<void> {
    const ref = doc(firestore, 'tournaments', slot.tournamentId, 'bracket', slot.id);
    await setDoc(ref, { ...slot, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<BracketSlot[]> {
    const snapshot = await getDocs(
      collection(firestore, 'tournaments', tournamentId, 'bracket'),
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot);
  },

  async updateResult(tournamentId: string, slotId: string, winnerId: string, matchId: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'bracket', slotId);
    await updateDoc(ref, { winnerId, matchId, updatedAt: serverTimestamp() });
  },
};
```

**Step 3: Write registration test**

Create `src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { firestoreRegistrationRepository } from '../firestoreRegistrationRepository';

describe('firestoreRegistrationRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreRegistrationRepository.save).toBe('function');
  });

  it('exports getByTournament method', () => {
    expect(typeof firestoreRegistrationRepository.getByTournament).toBe('function');
  });

  it('exports updatePayment method', () => {
    expect(typeof firestoreRegistrationRepository.updatePayment).toBe('function');
  });
});
```

**Step 4: Write registration implementation**

Create `src/data/firebase/firestoreRegistrationRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRegistration, PaymentStatus } from '../types';

export const firestoreRegistrationRepository = {
  async save(reg: TournamentRegistration): Promise<void> {
    const ref = doc(firestore, 'tournaments', reg.tournamentId, 'registrations', reg.id);
    await setDoc(ref, { ...reg, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<TournamentRegistration[]> {
    const snapshot = await getDocs(
      collection(firestore, 'tournaments', tournamentId, 'registrations'),
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration);
  },

  async getByUser(tournamentId: string, userId: string): Promise<TournamentRegistration | undefined> {
    const q = query(
      collection(firestore, 'tournaments', tournamentId, 'registrations'),
      where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as TournamentRegistration;
  },

  async updatePayment(tournamentId: string, regId: string, status: PaymentStatus, note?: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
    const updates: Record<string, unknown> = { paymentStatus: status, updatedAt: serverTimestamp() };
    if (note !== undefined) updates.paymentNote = note;
    await updateDoc(ref, updates);
  },
};
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/data/firebase/firestoreBracketRepository.ts src/data/firebase/firestoreRegistrationRepository.ts src/data/firebase/__tests__/firestoreBracketRepository.test.ts src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts
git commit -m "feat: add Firestore bracket and registration repositories"
```

---

### Task 7: Firestore Security Rules for Tournaments

**Files:**
- Modify: `firestore.rules`

**Step 1: Add tournament rules**

Replace `firestore.rules` with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Match rules
    match /matches/{matchId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      allow read, write: if request.auth != null && request.auth.uid in resource.data.sharedWith;
      allow read: if resource.data.visibility == 'public';

      match /scoreEvents/{eventId} {
        allow read, write: if request.auth != null && (
          get(/databases/$(database)/documents/matches/$(matchId)).data.ownerId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.sharedWith
        );
        allow read: if get(/databases/$(database)/documents/matches/$(matchId)).data.visibility == 'public';
      }
    }

    // Tournament rules
    match /tournaments/{tournamentId} {
      // Organizer full access
      allow read, write: if request.auth != null && request.auth.uid == resource.data.organizerId;
      // Create: any authenticated user
      allow create: if request.auth != null && request.resource.data.organizerId == request.auth.uid;
      // Scorekeepers can read
      allow read: if request.auth != null && request.auth.uid in resource.data.scorekeeperIds;
      // Any authenticated user can read (for joining)
      allow read: if request.auth != null;

      // Teams subcollection
      match /teams/{teamId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && (
          get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.scorekeeperIds
        );
      }

      // Pools subcollection
      match /pools/{poolId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null &&
          get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid;
      }

      // Bracket subcollection
      match /bracket/{slotId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && (
          get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.scorekeeperIds
        );
      }

      // Registrations subcollection
      match /registrations/{regId} {
        allow read: if request.auth != null;
        // Players can create their own registration
        allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
        // Organizer can update any registration
        allow update: if request.auth != null &&
          get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid;
        // Player can update own registration
        allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for tournaments"
```

---

### Task 8: Cloud Sync Extension for Tournaments

**Files:**
- Modify: `src/data/firebase/cloudSync.ts`
- Modify: `src/test-setup.ts`

**Step 1: Add tournament sync methods to cloudSync**

Add to `src/data/firebase/cloudSync.ts` — import and methods:

Add import at top:
```typescript
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import type { Match, ScoreEvent, Tournament } from '../types';
```

(Remove the existing `import type { Match, ScoreEvent } from '../types';` line.)

Add these methods inside the `cloudSync` object:

```typescript
  /**
   * Save a tournament to Firestore. Fire-and-forget.
   */
  syncTournamentToCloud(tournament: Tournament): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreTournamentRepository.save(tournament).catch((err) => {
      console.warn('Cloud sync failed for tournament:', tournament.id, err);
    });
  },

  /**
   * Pull organizer's tournaments from Firestore.
   */
  async pullTournamentsFromCloud(): Promise<Tournament[]> {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      return await firestoreTournamentRepository.getByOrganizer(user.uid);
    } catch (err) {
      console.warn('Failed to pull tournaments:', err);
      return [];
    }
  },
```

**Step 2: Update test-setup.ts mock**

In `src/test-setup.ts`, update the cloudSync mock to include tournament methods:

```typescript
vi.mock('./data/firebase/cloudSync', () => ({
  cloudSync: {
    syncMatchToCloud: vi.fn(),
    syncScoreEventToCloud: vi.fn(),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncUserProfile: vi.fn(() => Promise.resolve()),
    pushLocalMatchesToCloud: vi.fn(() => Promise.resolve(0)),
    syncTournamentToCloud: vi.fn(),
    pullTournamentsFromCloud: vi.fn(() => Promise.resolve([])),
  },
}));
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/test-setup.ts
git commit -m "feat: add tournament sync to cloudSync"
```

---

## Phase 2B: Tournament Algorithms

These are pure functions with no Firestore or UI dependencies — highly testable.

### Task 9: Round-Robin Schedule Generator

**Files:**
- Create: `src/features/tournaments/engine/roundRobin.ts`
- Create: `src/features/tournaments/engine/__tests__/roundRobin.test.ts`

**Step 1: Write the tests**

Create `src/features/tournaments/engine/__tests__/roundRobin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateRoundRobinSchedule } from '../roundRobin';

describe('generateRoundRobinSchedule', () => {
  it('generates correct number of matches for 4 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    // 4 teams = 4C2 = 6 matches
    expect(schedule).toHaveLength(6);
  });

  it('generates correct number of matches for 3 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C']);
    // 3 teams = 3C2 = 3 matches
    expect(schedule).toHaveLength(3);
  });

  it('every team plays every other team exactly once', () => {
    const teams = ['A', 'B', 'C', 'D'];
    const schedule = generateRoundRobinSchedule(teams);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchCount = schedule.filter(
          (m) =>
            (m.team1Id === teams[i] && m.team2Id === teams[j]) ||
            (m.team1Id === teams[j] && m.team2Id === teams[i]),
        ).length;
        expect(matchCount).toBe(1);
      }
    }
  });

  it('assigns round numbers', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    for (const entry of schedule) {
      expect(entry.round).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles 2 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B']);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].team1Id).toBe('A');
    expect(schedule[0].team2Id).toBe('B');
  });

  it('generates correct rounds for 4 teams (3 rounds)', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(3);
  });

  it('no team plays twice in the same round', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D', 'E', 'F']);
    const roundMap = new Map<number, string[]>();
    for (const entry of schedule) {
      if (!roundMap.has(entry.round)) roundMap.set(entry.round, []);
      const teams = roundMap.get(entry.round)!;
      expect(teams).not.toContain(entry.team1Id);
      expect(teams).not.toContain(entry.team2Id);
      teams.push(entry.team1Id, entry.team2Id);
    }
  });
});
```

**Step 2: Run test — expect FAIL**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roundRobin.test.ts`

**Step 3: Write implementation**

Create `src/features/tournaments/engine/roundRobin.ts`:

```typescript
import type { PoolScheduleEntry } from '../../../data/types';

/**
 * Generate a round-robin schedule using the circle method.
 * For N teams (N even): N-1 rounds, N/2 matches per round.
 * For N teams (N odd): N rounds, (N-1)/2 matches per round (one bye per round).
 */
export function generateRoundRobinSchedule(teamIds: string[]): PoolScheduleEntry[] {
  const teams = [...teamIds];
  // Circle method requires even number — add a BYE placeholder if odd
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push('__BYE__');

  const n = teams.length;
  const rounds = n - 1;
  const halfN = n / 2;
  const schedule: PoolScheduleEntry[] = [];

  // Fix first team, rotate the rest
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < halfN; i++) {
      const home = i === 0 ? teams[0] : teams[((round + i - 1) % (n - 1)) + 1];
      const away = teams[((round + (n - 1) - i - 1) % (n - 1)) + 1];

      // Skip BYE matches
      if (home === '__BYE__' || away === '__BYE__') continue;

      schedule.push({
        round: round + 1,
        team1Id: home,
        team2Id: away,
        matchId: null,
        court: null,
      });
    }
  }

  return schedule;
}
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roundRobin.test.ts`

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/roundRobin.ts src/features/tournaments/engine/__tests__/roundRobin.test.ts
git commit -m "feat: add round-robin schedule generator"
```

---

### Task 10: Snake-Draft Pool Generator

**Files:**
- Create: `src/features/tournaments/engine/poolGenerator.ts`
- Create: `src/features/tournaments/engine/__tests__/poolGenerator.test.ts`

**Step 1: Write the tests**

Create `src/features/tournaments/engine/__tests__/poolGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generatePools } from '../poolGenerator';

describe('generatePools', () => {
  it('distributes 8 teams into 2 pools of 4', () => {
    const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
    const pools = generatePools(teams, 2);
    expect(pools).toHaveLength(2);
    expect(pools[0]).toHaveLength(4);
    expect(pools[1]).toHaveLength(4);
  });

  it('uses snake-draft order (seeds balanced)', () => {
    // Seeds 1-8, 2 pools: Pool A gets 1,4,5,8 and Pool B gets 2,3,6,7
    const teams = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
    const pools = generatePools(teams, 2);
    expect(pools[0]).toEqual(['S1', 'S4', 'S5', 'S8']);
    expect(pools[1]).toEqual(['S2', 'S3', 'S6', 'S7']);
  });

  it('handles uneven distribution (5 teams, 2 pools)', () => {
    const teams = ['A', 'B', 'C', 'D', 'E'];
    const pools = generatePools(teams, 2);
    expect(pools).toHaveLength(2);
    // One pool has 3, other has 2
    const sizes = pools.map((p) => p.length).sort();
    expect(sizes).toEqual([2, 3]);
  });

  it('handles 4 teams, 2 pools', () => {
    const pools = generatePools(['A', 'B', 'C', 'D'], 2);
    expect(pools[0]).toEqual(['A', 'D']);
    expect(pools[1]).toEqual(['B', 'C']);
  });

  it('single pool returns all teams', () => {
    const pools = generatePools(['A', 'B', 'C'], 1);
    expect(pools).toHaveLength(1);
    expect(pools[0]).toEqual(['A', 'B', 'C']);
  });

  it('every team appears exactly once', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const pools = generatePools(teams, 3);
    const allTeams = pools.flat();
    expect(allTeams.sort()).toEqual([...teams].sort());
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/features/tournaments/engine/poolGenerator.ts`:

```typescript
/**
 * Distribute teams into pools using snake-draft ordering.
 * Teams should be pre-sorted by seed (index 0 = top seed).
 *
 * Snake draft: Round 1 goes 0,1,2,...,N-1. Round 2 goes N-1,...,2,1,0. Repeat.
 * This ensures balanced pool strength.
 */
export function generatePools(teamIds: string[], poolCount: number): string[][] {
  const pools: string[][] = Array.from({ length: poolCount }, () => []);

  let direction = 1; // 1 = forward, -1 = backward
  let poolIndex = 0;

  for (const teamId of teamIds) {
    pools[poolIndex].push(teamId);

    // Snake: if we hit the boundary, reverse direction
    const nextIndex = poolIndex + direction;
    if (nextIndex >= poolCount || nextIndex < 0) {
      direction *= -1;
      // Stay at current pool for next iteration (snake turn)
    } else {
      poolIndex = nextIndex;
    }
  }

  return pools;
}
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/tournaments/engine/__tests__/poolGenerator.test.ts`

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/poolGenerator.ts src/features/tournaments/engine/__tests__/poolGenerator.test.ts
git commit -m "feat: add snake-draft pool generator"
```

---

### Task 11: Single-Elimination Bracket Generator

**Files:**
- Create: `src/features/tournaments/engine/bracketGenerator.ts`
- Create: `src/features/tournaments/engine/__tests__/bracketGenerator.test.ts`

**Step 1: Write the tests**

Create `src/features/tournaments/engine/__tests__/bracketGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateBracket } from '../bracketGenerator';
import type { BracketSlot } from '../../../../data/types';

describe('generateBracket', () => {
  it('generates correct slots for 4 teams', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    // 4 teams: 2 first-round + 1 final = 3 slots
    expect(slots).toHaveLength(3);
  });

  it('generates correct slots for 8 teams', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    // 8 teams: 4 + 2 + 1 = 7 slots
    expect(slots).toHaveLength(7);
  });

  it('seeds first round correctly (1v4, 2v3 for 4 teams)', () => {
    const slots = generateBracket('t1', ['S1', 'S2', 'S3', 'S4']);
    const firstRound = slots.filter((s) => s.round === 1);
    expect(firstRound).toHaveLength(2);
    // Standard bracket seeding: 1v4, 2v3
    const matchups = firstRound.map((s) => [s.team1Id, s.team2Id]);
    expect(matchups).toContainEqual(['S1', 'S4']);
    expect(matchups).toContainEqual(['S2', 'S3']);
  });

  it('final round slots have no nextSlotId', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const maxRound = Math.max(...slots.map((s) => s.round));
    const finals = slots.filter((s) => s.round === maxRound);
    expect(finals).toHaveLength(1);
    expect(finals[0].nextSlotId).toBeNull();
  });

  it('first round slots link to next round', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const firstRound = slots.filter((s) => s.round === 1);
    for (const slot of firstRound) {
      expect(slot.nextSlotId).not.toBeNull();
    }
  });

  it('later round slots have null teams (to be filled)', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const finalSlot = slots.find((s) => s.round === 2);
    expect(finalSlot?.team1Id).toBeNull();
    expect(finalSlot?.team2Id).toBeNull();
  });

  it('handles non-power-of-2 teams with byes', () => {
    // 6 teams: bracket of 8, 2 byes. First round has 8 slots but 2 teams get byes.
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D', 'E', 'F']);
    // Total slots: 4 + 2 + 1 = 7 (bracket of 8)
    expect(slots).toHaveLength(7);
    // Two first-round slots should have a bye (one team is null)
    const firstRound = slots.filter((s) => s.round === 1);
    const byes = firstRound.filter((s) => s.team1Id === null || s.team2Id === null);
    expect(byes).toHaveLength(2);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/features/tournaments/engine/bracketGenerator.ts`:

```typescript
import type { BracketSlot } from '../../../data/types';

/**
 * Find the next power of 2 >= n.
 */
function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generate standard bracket seeding for N slots.
 * Returns pairs of seed indices: [0, N-1], [1, N-2], etc.
 * Seeds are 0-indexed.
 */
function bracketSeeding(bracketSize: number): Array<[number, number]> {
  // Recursive bracket seeding for proper separation of top seeds
  if (bracketSize === 2) return [[0, 1]];

  const half = bracketSize / 2;
  const topHalf = bracketSeeding(half);

  return topHalf.map(([a, b]) => [a, bracketSize - 1 - a] as [number, number])
    .concat(topHalf.map(([a, b]) => [bracketSize - 1 - b, b] as [number, number]));
}

/**
 * Simple standard seeding: pair seed 1 vs last, seed 2 vs second-last, etc.
 */
function standardSeeding(bracketSize: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    pairs.push([i, bracketSize - 1 - i]);
  }
  return pairs;
}

/**
 * Generate a single-elimination bracket.
 * Teams ordered by seed (index 0 = top seed).
 * Non-power-of-2 counts get byes (null team slots).
 */
export function generateBracket(tournamentId: string, seededTeamIds: string[]): BracketSlot[] {
  const bracketSize = nextPowerOf2(seededTeamIds.length);
  const totalRounds = Math.log2(bracketSize);
  const slots: BracketSlot[] = [];

  // Pad teams with nulls for byes
  const teams: Array<string | null> = [...seededTeamIds];
  while (teams.length < bracketSize) teams.push(null);

  // Generate all slots round by round
  let slotCounter = 0;
  const slotsByRound: BracketSlot[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const roundSlots: BracketSlot[] = [];

    for (let pos = 0; pos < matchesInRound; pos++) {
      roundSlots.push({
        id: `slot-${slotCounter++}`,
        tournamentId,
        round,
        position: pos,
        team1Id: null,
        team2Id: null,
        matchId: null,
        winnerId: null,
        nextSlotId: null,
      });
    }

    slotsByRound.push(roundSlots);
    slots.push(...roundSlots);
  }

  // Link slots: each slot in round R feeds into round R+1
  for (let r = 0; r < slotsByRound.length - 1; r++) {
    const currentRound = slotsByRound[r];
    const nextRound = slotsByRound[r + 1];
    for (let i = 0; i < currentRound.length; i++) {
      currentRound[i].nextSlotId = nextRound[Math.floor(i / 2)].id;
    }
  }

  // Seed first round using standard seeding
  const firstRound = slotsByRound[0];
  const pairs = standardSeeding(bracketSize);

  for (let i = 0; i < firstRound.length; i++) {
    const [seedA, seedB] = pairs[i];
    firstRound[i].team1Id = teams[seedA];
    firstRound[i].team2Id = teams[seedB];
  }

  return slots;
}
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/tournaments/engine/__tests__/bracketGenerator.test.ts`

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/bracketGenerator.ts src/features/tournaments/engine/__tests__/bracketGenerator.test.ts
git commit -m "feat: add single-elimination bracket generator"
```

---

### Task 12: Pool Standings Calculator

**Files:**
- Create: `src/features/tournaments/engine/standings.ts`
- Create: `src/features/tournaments/engine/__tests__/standings.test.ts`

**Step 1: Write the tests**

Create `src/features/tournaments/engine/__tests__/standings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateStandings } from '../standings';
import type { Match } from '../../../../data/types';

function makeMatch(overrides: Partial<Match> & { team1Name: string; team2Name: string }): Match {
  return {
    id: crypto.randomUUID(),
    config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Color: undefined,
    team2Color: undefined,
    games: [],
    winningSide: null,
    status: 'completed',
    startedAt: Date.now(),
    completedAt: Date.now(),
    ...overrides,
  };
}

describe('calculateStandings', () => {
  it('returns empty standings for no matches', () => {
    const standings = calculateStandings(['A', 'B'], []);
    expect(standings).toHaveLength(2);
    expect(standings[0].wins).toBe(0);
    expect(standings[0].losses).toBe(0);
  });

  it('calculates wins and losses correctly', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const teamMatchMap = { A: { team1: [matches[0]], team2: [] }, B: { team1: [], team2: [matches[0]] } };
    const standings = calculateStandings(['A', 'B'], matches, teamMatchMap);
    const teamA = standings.find((s) => s.teamId === 'A');
    const teamB = standings.find((s) => s.teamId === 'B');
    expect(teamA?.wins).toBe(1);
    expect(teamA?.losses).toBe(0);
    expect(teamB?.wins).toBe(0);
    expect(teamB?.losses).toBe(1);
  });

  it('calculates point differential', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const teamMatchMap = { A: { team1: [matches[0]], team2: [] }, B: { team1: [], team2: [matches[0]] } };
    const standings = calculateStandings(['A', 'B'], matches, teamMatchMap);
    const teamA = standings.find((s) => s.teamId === 'A');
    expect(teamA?.pointsFor).toBe(11);
    expect(teamA?.pointsAgainst).toBe(7);
    expect(teamA?.pointDiff).toBe(4);
  });

  it('sorts by wins first, then point diff', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 9, winningSide: 1 }],
        winningSide: 1,
      }),
      makeMatch({
        team1Name: 'C', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 3, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    // A: 1W, +2 diff. C: 1W, +8 diff. B: 0W, -10 diff.
    const teamMatchMap = {
      A: { team1: [matches[0]], team2: [] },
      B: { team1: [], team2: [matches[0], matches[1]] },
      C: { team1: [matches[1]], team2: [] },
    };
    const standings = calculateStandings(['A', 'B', 'C'], matches, teamMatchMap);
    expect(standings[0].teamId).toBe('C'); // 1W, +8
    expect(standings[1].teamId).toBe('A'); // 1W, +2
    expect(standings[2].teamId).toBe('B'); // 0W, -10
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/features/tournaments/engine/standings.ts`:

```typescript
import type { Match, PoolStanding } from '../../../data/types';

interface TeamMatchMap {
  [teamId: string]: {
    team1: Match[];
    team2: Match[];
  };
}

/**
 * Calculate pool standings from completed matches.
 * Sorts by wins (desc), then point differential (desc).
 *
 * If teamMatchMap is not provided, matches are filtered by team name (fallback).
 */
export function calculateStandings(
  teamIds: string[],
  matches: Match[],
  teamMatchMap?: TeamMatchMap,
): PoolStanding[] {
  const standings: PoolStanding[] = teamIds.map((teamId) => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    const completedMatches = matches.filter((m) => m.status === 'completed');

    for (const match of completedMatches) {
      let isTeam1 = false;
      let isTeam2 = false;

      if (teamMatchMap) {
        const teamMatches = teamMatchMap[teamId];
        if (teamMatches) {
          isTeam1 = teamMatches.team1.includes(match);
          isTeam2 = teamMatches.team2.includes(match);
        }
      } else {
        isTeam1 = match.team1Name === teamId;
        isTeam2 = match.team2Name === teamId;
      }

      if (!isTeam1 && !isTeam2) continue;

      for (const game of match.games) {
        if (isTeam1) {
          pointsFor += game.team1Score;
          pointsAgainst += game.team2Score;
        } else {
          pointsFor += game.team2Score;
          pointsAgainst += game.team1Score;
        }
      }

      if (isTeam1 && match.winningSide === 1) wins++;
      else if (isTeam2 && match.winningSide === 2) wins++;
      else losses++;
    }

    return {
      teamId,
      wins,
      losses,
      pointsFor,
      pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
    };
  });

  // Sort: wins desc, then pointDiff desc
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointDiff - a.pointDiff;
  });

  return standings;
}
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/tournaments/engine/__tests__/standings.test.ts`

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/standings.ts src/features/tournaments/engine/__tests__/standings.test.ts
git commit -m "feat: add pool standings calculator"
```

---

### Task 13: Bracket Seeding from Pool Results

**Files:**
- Create: `src/features/tournaments/engine/bracketSeeding.ts`
- Create: `src/features/tournaments/engine/__tests__/bracketSeeding.test.ts`

**Step 1: Write the tests**

Create `src/features/tournaments/engine/__tests__/bracketSeeding.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { seedBracketFromPools } from '../bracketSeeding';
import type { PoolStanding } from '../../../../data/types';

function standing(teamId: string, wins: number, pointDiff: number): PoolStanding {
  return { teamId, wins, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff };
}

describe('seedBracketFromPools', () => {
  it('cross-seeds 2 pools, top 2 advancing', () => {
    const poolStandings = [
      [standing('A1', 3, 10), standing('A2', 2, 5), standing('A3', 1, -5)],
      [standing('B1', 3, 8), standing('B2', 2, 3), standing('B3', 0, -11)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 2);
    // Cross-seed: A1, B1, A2, B2 (ordered as bracket seeds)
    expect(seeded).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('handles 3 pools, top 1 advancing + best second', () => {
    const poolStandings = [
      [standing('A1', 2, 10), standing('A2', 1, 5)],
      [standing('B1', 2, 6), standing('B2', 1, 2)],
      [standing('C1', 2, 8), standing('C2', 1, -1)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 1);
    // Pool winners only: A1, C1, B1 (sorted by wins, then diff)
    expect(seeded).toEqual(['A1', 'C1', 'B1']);
  });

  it('returns empty for empty pools', () => {
    expect(seedBracketFromPools([], 2)).toEqual([]);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/features/tournaments/engine/bracketSeeding.ts`:

```typescript
import type { PoolStanding } from '../../../data/types';

/**
 * Seed bracket teams from pool standings using cross-pool seeding.
 *
 * Takes top N teams from each pool, then interleaves:
 * All #1 seeds (sorted by record), all #2 seeds (sorted by record), etc.
 */
export function seedBracketFromPools(
  poolStandings: PoolStanding[][],
  teamsPerPoolAdvancing: number,
): string[] {
  if (poolStandings.length === 0) return [];

  const seeded: string[] = [];

  // Collect advancing teams by their rank within pool
  for (let rank = 0; rank < teamsPerPoolAdvancing; rank++) {
    const teamsAtRank: PoolStanding[] = [];
    for (const pool of poolStandings) {
      if (rank < pool.length) {
        teamsAtRank.push(pool[rank]);
      }
    }
    // Sort teams at same rank: wins desc, then pointDiff desc
    teamsAtRank.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    });
    seeded.push(...teamsAtRank.map((s) => s.teamId));
  }

  return seeded;
}
```

**Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/tournaments/engine/__tests__/bracketSeeding.test.ts`

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/bracketSeeding.ts src/features/tournaments/engine/__tests__/bracketSeeding.test.ts
git commit -m "feat: add bracket seeding from pool results"
```

---

## Phase 2C: Tournament Core UI

### Task 14: Router & Navigation Updates

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/shared/components/BottomNav.tsx`

**Step 1: Add tournament routes**

Update `src/app/router.tsx`:

```typescript
import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const TournamentListPage = lazy(() => import('../features/tournaments/TournamentListPage'));
const TournamentCreatePage = lazy(() => import('../features/tournaments/TournamentCreatePage'));
const TournamentDashboardPage = lazy(() => import('../features/tournaments/TournamentDashboardPage'));

function NotFoundPage() {
  return (
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <p class="text-2xl font-bold text-on-surface">Page Not Found</p>
      <p class="text-on-surface-muted">The page you're looking for doesn't exist.</p>
      <a href="/" class="inline-block px-6 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform">Back to Home</a>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/tournaments" component={TournamentListPage} />
      <Route path="/tournaments/new" component={TournamentCreatePage} />
      <Route path="/tournaments/:id" component={TournamentDashboardPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
```

**Step 2: Add Tournaments tab to BottomNav**

Replace `src/shared/components/BottomNav.tsx` with a 5-tab version. Add a trophy icon tab between Players and Settings:

```typescript
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useAuth } from '../hooks/useAuth';

const BottomNav: Component = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const linkClass = (path: string) =>
    `relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[48px] px-2 py-1 text-xs font-medium transition-colors ${
      isActive(path) ? 'text-primary' : 'text-on-surface-muted'
    }`;

  return (
    <nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter safe-bottom">
      <div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1">
        <A href="/" class={linkClass('/')} aria-current={isActive('/') ? 'page' : undefined} aria-label="New Game">
          <Show when={isActive('/')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span class="relative">New</span>
        </A>
        <A href="/history" class={linkClass('/history')} aria-current={isActive('/history') ? 'page' : undefined} aria-label="Match History">
          <Show when={isActive('/history')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span class="relative">History</span>
        </A>
        <A href="/players" class={linkClass('/players')} aria-current={isActive('/players') ? 'page' : undefined} aria-label="Players">
          <Show when={isActive('/players')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="relative">Players</span>
        </A>
        <Show when={user()}>
          <A href="/tournaments" class={linkClass('/tournaments')} aria-current={isActive('/tournaments') ? 'page' : undefined} aria-label="Tournaments">
            <Show when={isActive('/tournaments')}>
              <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
            </Show>
            <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            <span class="relative">Tourneys</span>
          </A>
        </Show>
        <A href="/settings" class={linkClass('/settings')} aria-current={isActive('/settings') ? 'page' : undefined} aria-label="Settings">
          <Show when={isActive('/settings')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="relative">Settings</span>
        </A>
      </div>
    </nav>
  );
};

export default BottomNav;
```

Note: The "Tourneys" tab only shows when user is signed in (via `Show when={user()}`).

**Step 3: Create stub pages (so routes don't break)**

Create `src/features/tournaments/TournamentListPage.tsx`:

```typescript
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';

const TournamentListPage: Component = () => {
  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        <p class="text-on-surface-muted">Tournament list coming soon.</p>
      </div>
    </PageLayout>
  );
};

export default TournamentListPage;
```

Create `src/features/tournaments/TournamentCreatePage.tsx`:

```typescript
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';

const TournamentCreatePage: Component = () => {
  return (
    <PageLayout title="Create Tournament">
      <div class="p-4">
        <p class="text-on-surface-muted">Tournament creation form coming soon.</p>
      </div>
    </PageLayout>
  );
};

export default TournamentCreatePage;
```

Create `src/features/tournaments/TournamentDashboardPage.tsx`:

```typescript
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';

const TournamentDashboardPage: Component = () => {
  const params = useParams();
  return (
    <PageLayout title="Tournament">
      <div class="p-4">
        <p class="text-on-surface-muted">Tournament {params.id} dashboard coming soon.</p>
      </div>
    </PageLayout>
  );
};

export default TournamentDashboardPage;
```

**Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All pass. TypeScript check: `npx tsc -b --noEmit`

**Step 5: Commit**

```bash
git add src/app/router.tsx src/shared/components/BottomNav.tsx src/features/tournaments/TournamentListPage.tsx src/features/tournaments/TournamentCreatePage.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: add tournament routes, nav tab, and stub pages"
```

---

### Task 15: Tournament List Page

**Files:**
- Modify: `src/features/tournaments/TournamentListPage.tsx`
- Create: `src/features/tournaments/components/TournamentCard.tsx`

**Step 1: Create TournamentCard component**

Create `src/features/tournaments/components/TournamentCard.tsx`:

```typescript
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import type { Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
}

const statusColors: Record<string, string> = {
  setup: 'bg-yellow-500/20 text-yellow-400',
  registration: 'bg-blue-500/20 text-blue-400',
  'pool-play': 'bg-green-500/20 text-green-400',
  bracket: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-on-surface-muted/20 text-on-surface-muted',
  cancelled: 'bg-red-500/20 text-red-400',
  paused: 'bg-orange-500/20 text-orange-400',
};

const statusLabels: Record<string, string> = {
  setup: 'Setup',
  registration: 'Registration Open',
  'pool-play': 'Pool Play',
  bracket: 'Bracket',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

const formatLabels: Record<string, string> = {
  'round-robin': 'Round Robin',
  'single-elimination': 'Single Elimination',
  'pool-bracket': 'Pool Play + Bracket',
};

const TournamentCard: Component<Props> = (props) => {
  const dateStr = () => new Date(props.tournament.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <A
      href={`/tournaments/${props.tournament.id}`}
      class="block bg-surface-light rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="font-bold text-on-surface truncate">{props.tournament.name}</h3>
        <span class={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[props.tournament.status] ?? ''}`}>
          {statusLabels[props.tournament.status] ?? props.tournament.status}
        </span>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-muted">
        <span>{dateStr()}</span>
        <span>{props.tournament.location}</span>
        <span>{formatLabels[props.tournament.format] ?? props.tournament.format}</span>
      </div>
    </A>
  );
};

export default TournamentCard;
```

**Step 2: Implement TournamentListPage**

Update `src/features/tournaments/TournamentListPage.tsx`:

```typescript
import { createSignal, createResource, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import EmptyState from '../../shared/components/EmptyState';
import TournamentCard from './components/TournamentCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import type { Tournament } from '../../data/types';

const TournamentListPage: Component = () => {
  const { user } = useAuth();

  const [tournaments] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return [];
      return firestoreTournamentRepository.getByOrganizer(uid);
    },
  );

  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        <Show
          when={tournaments() && tournaments()!.length > 0}
          fallback={
            <EmptyState
              icon={
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
              title="No Tournaments"
              description="Create your first tournament and start organizing games."
              actionLabel="Create Tournament"
              actionHref="/tournaments/new"
            />
          }
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">Your Tournaments</h2>
            <A
              href="/tournaments/new"
              class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform"
            >
              + New
            </A>
          </div>
          <ul role="list" class="space-y-3 list-none p-0 m-0">
            <For each={tournaments()}>
              {(t) => <li><TournamentCard tournament={t} /></li>}
            </For>
          </ul>
        </Show>
      </div>
    </PageLayout>
  );
};

export default TournamentListPage;
```

**Step 3: Run existing tests and TypeScript check**

Run: `npx vitest run && npx tsc -b --noEmit`

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentListPage.tsx src/features/tournaments/components/TournamentCard.tsx
git commit -m "feat: implement tournament list page with TournamentCard"
```

---

### Task 16: Tournament Create Page

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Implement the creation form**

Replace `src/features/tournaments/TournamentCreatePage.tsx`:

```typescript
import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import type {
  TournamentFormat,
  GameType,
  ScoringMode,
  MatchFormat,
  Tournament,
  TournamentRules,
} from '../../data/types';

const emptyRules: TournamentRules = {
  registrationDeadline: null,
  checkInRequired: false,
  checkInOpens: null,
  checkInCloses: null,
  scoringRules: '',
  timeoutRules: '',
  conductRules: '',
  penalties: [],
  additionalNotes: '',
};

const TournamentCreatePage: Component = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = createSignal('');
  const [location, setLocation] = createSignal('');
  const [date, setDate] = createSignal('');
  const [format, setFormat] = createSignal<TournamentFormat>('round-robin');
  const [gameType, setGameType] = createSignal<GameType>('doubles');
  const [scoringMode, setScoringMode] = createSignal<ScoringMode>('sideout');
  const [matchFormat, setMatchFormat] = createSignal<MatchFormat>('single');
  const [pointsToWin, setPointsToWin] = createSignal<11 | 15 | 21>(11);
  const [poolCount, setPoolCount] = createSignal(2);
  const [teamsAdvancing, setTeamsAdvancing] = createSignal(2);
  const [maxPlayers, setMaxPlayers] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const canCreate = () => name().trim() !== '' && date() !== '' && user();

  const handleCreate = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;

    setSaving(true);
    try {
      const tournament: Tournament = {
        id: crypto.randomUUID(),
        name: name().trim(),
        date: new Date(date()).getTime(),
        location: location().trim(),
        format: format(),
        config: {
          gameType: gameType(),
          scoringMode: scoringMode(),
          matchFormat: matchFormat(),
          pointsToWin: pointsToWin(),
          poolCount: format() === 'round-robin' ? 1 : poolCount(),
          teamsPerPoolAdvancing: teamsAdvancing(),
        },
        organizerId: currentUser.uid,
        scorekeeperIds: [],
        status: 'setup',
        maxPlayers: maxPlayers() ? parseInt(maxPlayers(), 10) : null,
        minPlayers: null,
        entryFee: null,
        rules: emptyRules,
        cancellationReason: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await firestoreTournamentRepository.save(tournament);
      navigate(`/tournaments/${tournament.id}`);
    } catch (err) {
      console.error('Failed to create tournament:', err);
      alert('Failed to create tournament. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Create Tournament">
      <div class="p-4 pb-24 space-y-6">
        {/* Name */}
        <div>
          <label for="t-name" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Tournament Name
          </label>
          <input
            id="t-name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={60}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            placeholder="e.g., Spring Classic 2026"
          />
        </div>

        {/* Date & Location */}
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="t-date" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Date</label>
            <input
              id="t-date"
              type="date"
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            />
          </div>
          <div>
            <label for="t-location" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Location</label>
            <input
              id="t-location"
              type="text"
              value={location()}
              onInput={(e) => setLocation(e.currentTarget.value)}
              maxLength={60}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
              placeholder="e.g., City Park Courts"
            />
          </div>
        </div>

        {/* Format */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Format</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="Round Robin" description="Everyone plays everyone" selected={format() === 'round-robin'} onClick={() => setFormat('round-robin')} />
            <OptionCard label="Elimination" description="Single elimination" selected={format() === 'single-elimination'} onClick={() => setFormat('single-elimination')} />
            <OptionCard label="Pool + Bracket" description="Pools then bracket" selected={format() === 'pool-bracket'} onClick={() => setFormat('pool-bracket')} />
          </div>
        </fieldset>

        {/* Game Type */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
            <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
          </div>
        </fieldset>

        {/* Scoring */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Side-Out" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
            <OptionCard label="Rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
          </div>
        </fieldset>

        {/* Points to Win */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={pointsToWin() === 11} onClick={() => setPointsToWin(11)} />
            <OptionCard label="15" selected={pointsToWin() === 15} onClick={() => setPointsToWin(15)} />
            <OptionCard label="21" selected={pointsToWin() === 21} onClick={() => setPointsToWin(21)} />
          </div>
        </fieldset>

        {/* Match Format */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
            <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
            <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
          </div>
        </fieldset>

        {/* Max Players */}
        <div>
          <label for="t-max" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Max Players (optional)
          </label>
          <input
            id="t-max"
            type="number"
            min="4"
            max="128"
            value={maxPlayers()}
            onInput={(e) => setMaxPlayers(e.currentTarget.value)}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            placeholder="No limit"
          />
        </div>
      </div>

      {/* Sticky Create Button */}
      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate() || saving()}
            class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${canCreate() && !saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          >
            {saving() ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default TournamentCreatePage;
```

**Step 2: Run tests and TypeScript check**

Run: `npx vitest run && npx tsc -b --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: implement tournament creation page"
```

---

### Task 17: Tournament Dashboard Page (Hub)

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Implement the dashboard**

Replace `src/features/tournaments/TournamentDashboardPage.tsx`:

```typescript
import { createResource, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreTeamRepository } from '../../data/firebase/firestoreTeamRepository';
import { firestorePoolRepository } from '../../data/firebase/firestorePoolRepository';
import { firestoreBracketRepository } from '../../data/firebase/firestoreBracketRepository';
import { firestoreRegistrationRepository } from '../../data/firebase/firestoreRegistrationRepository';
import type { Tournament, TournamentTeam, TournamentPool, BracketSlot, TournamentRegistration } from '../../data/types';

const statusLabels: Record<string, string> = {
  setup: 'Setup',
  registration: 'Registration Open',
  'pool-play': 'Pool Play',
  bracket: 'Bracket Play',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

const TournamentDashboardPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tournament] = createResource(
    () => params.id,
    (id) => firestoreTournamentRepository.getById(id),
  );

  const [teams] = createResource(
    () => params.id,
    (id) => firestoreTeamRepository.getByTournament(id),
  );

  const [registrations] = createResource(
    () => params.id,
    (id) => firestoreRegistrationRepository.getByTournament(id),
  );

  const isOrganizer = () => {
    const t = tournament();
    const u = user();
    return t && u && t.organizerId === u.uid;
  };

  const formatLabel = (f: string) => ({
    'round-robin': 'Round Robin',
    'single-elimination': 'Single Elimination',
    'pool-bracket': 'Pool Play + Bracket',
  }[f] ?? f);

  const handleStatusAdvance = async () => {
    const t = tournament();
    if (!t) return;
    const nextStatus: Record<string, string> = {
      setup: 'registration',
      registration: 'pool-play',
      'pool-play': 'bracket',
      bracket: 'completed',
    };
    const next = nextStatus[t.status];
    if (!next) return;
    await firestoreTournamentRepository.updateStatus(t.id, next as Tournament['status']);
    // Force refetch
    navigate(`/tournaments/${t.id}`, { replace: true });
  };

  return (
    <PageLayout title={tournament()?.name ?? 'Tournament'}>
      <div class="p-4 space-y-6">
        <Show when={tournament()} fallback={<p class="text-on-surface-muted">Loading...</p>}>
          {(t) => (
            <>
              {/* Status Banner */}
              <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Status</div>
                  <div class="font-bold text-on-surface text-lg">{statusLabels[t().status] ?? t().status}</div>
                </div>
                <Show when={isOrganizer() && t().status !== 'completed' && t().status !== 'cancelled'}>
                  <button
                    type="button"
                    onClick={handleStatusAdvance}
                    class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform"
                  >
                    Advance
                  </button>
                </Show>
              </div>

              {/* Info Grid */}
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Date</div>
                  <div class="font-semibold text-on-surface">
                    {new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Location</div>
                  <div class="font-semibold text-on-surface">{t().location || 'TBD'}</div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Format</div>
                  <div class="font-semibold text-on-surface">{formatLabel(t().format)}</div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Teams</div>
                  <div class="font-semibold text-on-surface">
                    {teams()?.length ?? 0}
                    {t().maxPlayers ? ` / ${t().maxPlayers}` : ''}
                  </div>
                </div>
              </div>

              {/* Registrations */}
              <div class="bg-surface-light rounded-xl p-4">
                <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Registrations</div>
                <div class="font-semibold text-on-surface text-2xl">{registrations()?.length ?? 0}</div>
              </div>
            </>
          )}
        </Show>
      </div>
    </PageLayout>
  );
};

export default TournamentDashboardPage;
```

**Step 2: Run tests and TypeScript check**

Run: `npx vitest run && npx tsc -b --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: implement tournament dashboard page"
```

---

## Phase 2D: Pool Play & Bracket UI

### Task 18: PoolTable Component (Standings)

**Files:**
- Create: `src/features/tournaments/components/PoolTable.tsx`

**Step 1: Create the component**

```typescript
import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { PoolStanding } from '../../../data/types';

interface Props {
  poolName: string;
  standings: PoolStanding[];
  teamNames: Record<string, string>;
  advancingCount: number;
}

const PoolTable: Component<Props> = (props) => {
  return (
    <div class="bg-surface-light rounded-xl overflow-hidden">
      <div class="px-4 py-2 bg-surface-lighter">
        <h3 class="font-bold text-on-surface text-sm">{props.poolName}</h3>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-on-surface-muted text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-2">#</th>
            <th class="text-left px-4 py-2">Team</th>
            <th class="text-center px-2 py-2">W</th>
            <th class="text-center px-2 py-2">L</th>
            <th class="text-center px-2 py-2">PF</th>
            <th class="text-center px-2 py-2">PA</th>
            <th class="text-center px-2 py-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.standings}>
            {(standing, index) => (
              <tr class={`border-t border-surface-lighter ${index() < props.advancingCount ? 'bg-primary/5' : ''}`}>
                <td class="px-4 py-2 text-on-surface-muted">{index() + 1}</td>
                <td class="px-4 py-2 font-semibold text-on-surface">{props.teamNames[standing.teamId] ?? standing.teamId}</td>
                <td class="text-center px-2 py-2 text-on-surface">{standing.wins}</td>
                <td class="text-center px-2 py-2 text-on-surface">{standing.losses}</td>
                <td class="text-center px-2 py-2 text-on-surface-muted">{standing.pointsFor}</td>
                <td class="text-center px-2 py-2 text-on-surface-muted">{standing.pointsAgainst}</td>
                <td class={`text-center px-2 py-2 font-semibold ${standing.pointDiff > 0 ? 'text-green-400' : standing.pointDiff < 0 ? 'text-red-400' : 'text-on-surface-muted'}`}>
                  {standing.pointDiff > 0 ? '+' : ''}{standing.pointDiff}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

export default PoolTable;
```

**Step 2: Run TypeScript check**

Run: `npx tsc -b --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/components/PoolTable.tsx
git commit -m "feat: add PoolTable standings component"
```

---

### Task 19: BracketView Component

**Files:**
- Create: `src/features/tournaments/components/BracketView.tsx`

**Step 1: Create the bracket visualization component**

```typescript
import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { BracketSlot } from '../../../data/types';

interface Props {
  slots: BracketSlot[];
  teamNames: Record<string, string>;
}

const BracketView: Component<Props> = (props) => {
  const rounds = () => {
    const maxRound = Math.max(...props.slots.map((s) => s.round), 0);
    const result: BracketSlot[][] = [];
    for (let r = 1; r <= maxRound; r++) {
      result.push(
        props.slots
          .filter((s) => s.round === r)
          .sort((a, b) => a.position - b.position),
      );
    }
    return result;
  };

  const roundLabel = (round: number, total: number) => {
    if (round === total) return 'Final';
    if (round === total - 1) return 'Semifinals';
    if (round === total - 2) return 'Quarterfinals';
    return `Round ${round}`;
  };

  const teamDisplay = (teamId: string | null, winnerId: string | null) => {
    if (!teamId) return 'BYE';
    const name = props.teamNames[teamId] ?? teamId;
    const isWinner = winnerId === teamId;
    return { name, isWinner };
  };

  return (
    <div class="overflow-x-auto">
      <div class="flex gap-6 min-w-max p-4">
        <For each={rounds()}>
          {(roundSlots, roundIndex) => (
            <div class="flex flex-col gap-4">
              <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider text-center mb-2">
                {roundLabel(roundIndex() + 1, rounds().length)}
              </div>
              <div class="flex flex-col justify-around flex-1 gap-4">
                <For each={roundSlots}>
                  {(slot) => {
                    const team1 = teamDisplay(slot.team1Id, slot.winnerId);
                    const team2 = teamDisplay(slot.team2Id, slot.winnerId);
                    return (
                      <div class="bg-surface-light rounded-lg overflow-hidden w-48 border border-surface-lighter">
                        <div class={`flex items-center justify-between px-3 py-2 text-sm border-b border-surface-lighter ${typeof team1 === 'object' && team1.isWinner ? 'bg-primary/10 font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                          <span class="truncate">{typeof team1 === 'string' ? team1 : team1.name}</span>
                        </div>
                        <div class={`flex items-center justify-between px-3 py-2 text-sm ${typeof team2 === 'object' && team2.isWinner ? 'bg-primary/10 font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                          <span class="truncate">{typeof team2 === 'string' ? team2 : team2.name}</span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default BracketView;
```

**Step 2: Run TypeScript check**

Run: `npx tsc -b --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/components/BracketView.tsx
git commit -m "feat: add BracketView visualization component"
```

---

## Phase 2E: Player Registration & Edge Cases

### Task 20: Registration Flow

**Files:**
- Create: `src/features/tournaments/components/RegistrationForm.tsx`

**Step 1: Create the registration component**

```typescript
import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useAuth } from '../../../shared/hooks/useAuth';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
  existingRegistration: TournamentRegistration | undefined;
  onRegistered: () => void;
}

const RegistrationForm: Component<Props> = (props) => {
  const { user, signIn } = useAuth();
  const [rulesAcknowledged, setRulesAcknowledged] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  const isRegistrationOpen = () => props.tournament.status === 'registration';
  const isAlreadyRegistered = () => !!props.existingRegistration;

  const handleRegister = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;

    setSaving(true);
    try {
      const reg: TournamentRegistration = {
        id: crypto.randomUUID(),
        tournamentId: props.tournament.id,
        userId: currentUser.uid,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        rulesAcknowledged: rulesAcknowledged(),
        registeredAt: Date.now(),
      };
      await firestoreRegistrationRepository.save(reg);
      props.onRegistered();
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-4">
      <Show
        when={!isAlreadyRegistered()}
        fallback={
          <div class="text-center py-4">
            <div class="text-primary font-bold text-lg mb-1">You're Registered!</div>
            <div class="text-sm text-on-surface-muted">
              Payment: {props.existingRegistration?.paymentStatus}
            </div>
          </div>
        }
      >
        <Show
          when={user()}
          fallback={
            <div class="space-y-3">
              <p class="text-sm text-on-surface-muted">Sign in to register for this tournament.</p>
              <button
                type="button"
                onClick={() => signIn()}
                class="w-full bg-white text-gray-800 font-semibold text-sm py-3 rounded-lg active:scale-95 transition-transform"
              >
                Sign in with Google
              </button>
            </div>
          }
        >
          <Show
            when={isRegistrationOpen()}
            fallback={<p class="text-sm text-on-surface-muted text-center py-2">Registration is not open.</p>}
          >
            {/* Rules acknowledgment */}
            <Show when={props.tournament.rules.scoringRules || props.tournament.rules.conductRules}>
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAcknowledged()}
                  onChange={(e) => setRulesAcknowledged(e.currentTarget.checked)}
                  class="mt-1 accent-primary"
                />
                <span class="text-sm text-on-surface">
                  I've read and agree to the tournament rules
                </span>
              </label>
            </Show>

            <button
              type="button"
              onClick={handleRegister}
              disabled={saving() || (!rulesAcknowledged() && (!!props.tournament.rules.scoringRules || !!props.tournament.rules.conductRules))}
              class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${
                !saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {saving() ? 'Registering...' : 'Join Tournament'}
            </button>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default RegistrationForm;
```

**Step 2: Commit**

```bash
git add src/features/tournaments/components/RegistrationForm.tsx
git commit -m "feat: add tournament registration form component"
```

---

### Task 21: Entry Fee Tracking Component

**Files:**
- Create: `src/features/tournaments/components/FeeTracker.tsx`

**Step 1: Create the fee tracking component**

```typescript
import { For, Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, PaymentStatus, EntryFee } from '../../../data/types';

interface Props {
  tournamentId: string;
  entryFee: EntryFee;
  registrations: TournamentRegistration[];
  isOrganizer: boolean;
  onUpdated: () => void;
}

const FeeTracker: Component<Props> = (props) => {
  const paidCount = () => props.registrations.filter((r) => r.paymentStatus === 'paid').length;
  const totalCollected = () => paidCount() * props.entryFee.amount;
  const totalExpected = () => props.registrations.length * props.entryFee.amount;

  const handleUpdatePayment = async (regId: string, status: PaymentStatus) => {
    try {
      await firestoreRegistrationRepository.updatePayment(props.tournamentId, regId, status);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to update payment:', err);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-on-surface">Entry Fee</h3>
        <span class="text-sm text-on-surface-muted">
          {props.entryFee.currency} {props.entryFee.amount}
        </span>
      </div>

      {/* Summary bar */}
      <div class="bg-surface rounded-lg p-3">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-on-surface-muted">{paidCount()} of {props.registrations.length} paid</span>
          <span class="font-semibold text-on-surface">
            {props.entryFee.currency} {totalCollected()} / {totalExpected()}
          </span>
        </div>
        <div class="h-2 bg-surface-lighter rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all"
            style={{ width: `${props.registrations.length > 0 ? (paidCount() / props.registrations.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Payment instructions */}
      <Show when={props.entryFee.paymentInstructions}>
        <div class="text-sm text-on-surface-muted">
          <span class="font-semibold">Payment:</span> {props.entryFee.paymentInstructions}
        </div>
      </Show>

      {/* Player list (organizer only) */}
      <Show when={props.isOrganizer}>
        <div class="space-y-2">
          <For each={props.registrations}>
            {(reg) => (
              <div class="flex items-center justify-between py-2 border-t border-surface-lighter">
                <span class="text-sm text-on-surface">{reg.userId}</span>
                <select
                  value={reg.paymentStatus}
                  onChange={(e) => handleUpdatePayment(reg.id, e.currentTarget.value as PaymentStatus)}
                  class="text-sm bg-surface border border-surface-lighter rounded-lg px-2 py-1 text-on-surface"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default FeeTracker;
```

**Step 2: Commit**

```bash
git add src/features/tournaments/components/FeeTracker.tsx
git commit -m "feat: add entry fee tracking component"
```

---

### Task 22: Tournament Cancellation & Pause Controls

**Files:**
- Create: `src/features/tournaments/components/OrganizerControls.tsx`

**Step 1: Create the organizer controls component**

```typescript
import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import type { Tournament, TournamentStatus } from '../../../data/types';

interface Props {
  tournament: Tournament;
  onUpdated: () => void;
}

const OrganizerControls: Component<Props> = (props) => {
  const [showCancel, setShowCancel] = createSignal(false);
  const [cancelReason, setCancelReason] = createSignal('');

  const isPaused = () => props.tournament.status === 'paused';
  const canPause = () => ['pool-play', 'bracket'].includes(props.tournament.status);
  const canCancel = () => !['completed', 'cancelled'].includes(props.tournament.status);

  const handlePauseResume = async () => {
    const newStatus: TournamentStatus = isPaused()
      ? 'pool-play' // Resume to last active phase (simplified — could track previous)
      : 'paused';
    await firestoreTournamentRepository.updateStatus(props.tournament.id, newStatus);
    props.onUpdated();
  };

  const handleCancel = async () => {
    await firestoreTournamentRepository.updateStatus(
      props.tournament.id,
      'cancelled',
      cancelReason() || 'Cancelled by organizer',
    );
    setShowCancel(false);
    props.onUpdated();
  };

  const handleEndEarly = async () => {
    await firestoreTournamentRepository.updateStatus(props.tournament.id, 'completed');
    props.onUpdated();
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-3">
      <h3 class="font-bold text-on-surface text-sm">Organizer Controls</h3>

      <div class="flex flex-wrap gap-2">
        <Show when={canPause() || isPaused()}>
          <button
            type="button"
            onClick={handlePauseResume}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 active:scale-95 transition-transform"
          >
            {isPaused() ? 'Resume' : 'Pause'}
          </button>
        </Show>

        <Show when={canPause() || isPaused()}>
          <button
            type="button"
            onClick={handleEndEarly}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 active:scale-95 transition-transform"
          >
            End Early
          </button>
        </Show>

        <Show when={canCancel()}>
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-red-500/20 text-red-400 active:scale-95 transition-transform"
          >
            Cancel Tournament
          </button>
        </Show>
      </div>

      <ConfirmDialog
        open={showCancel()}
        title="Cancel Tournament"
        message="This will cancel the tournament and notify all participants. This cannot be undone."
        confirmLabel="Cancel Tournament"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
};

export default OrganizerControls;
```

**Step 2: Commit**

```bash
git add src/features/tournaments/components/OrganizerControls.tsx
git commit -m "feat: add organizer controls (pause, cancel, end early)"
```

---

### Task 23: Final Verification & Integration

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (55 existing + ~25 new algorithm tests).

**Step 2: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: Clean — zero errors.

**Step 3: Production build**

Run: `npx vite build`
Expected: Builds successfully.

**Step 4: Dev server smoke test**

Run: `npx vite --port 5199`
Manual checks:
- Navigate to /tournaments (should show empty state or list)
- Navigate to /tournaments/new (should show creation form)
- Bottom nav shows "Tourneys" tab only when signed in
- Settings page still works
- Scoring still works

**Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete Layer 2 tournament management foundation"
```

---

## Summary

| Phase | Tasks | What It Delivers |
|-------|-------|-----------------|
| **2A: Data Foundation** | 1-8 | Types, Dexie schema, 5 Firestore repos, security rules, cloud sync |
| **2B: Algorithms** | 9-13 | Round-robin scheduling, pool generation, bracket generation, standings, seeding |
| **2C: Core UI** | 14-17 | Routes, nav, tournament list/create/dashboard pages |
| **2D: Pool & Bracket UI** | 18-19 | PoolTable standings, BracketView visualization |
| **2E: Player Experience** | 20-22 | Registration form, fee tracking, organizer controls (pause/cancel/end early) |
| **Verification** | 23 | Full test suite, TypeScript, build, smoke test |

**Total: 23 tasks** across 5 phases. Each phase is independently shippable.
