# Firebase Foundation (Layer 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Firebase (Auth + Firestore) to PickleScore so matches sync to the cloud when signed in, while keeping the offline-first experience identical for anonymous users.

**Architecture:** Dual-store — Dexie stays as primary local store, Firestore added as cloud mirror. When signed in, match saves write to both. On sign-in, cloud matches sync down to Dexie. All reads stay from Dexie (existing queries unchanged). Solo users who never sign in get zero changes.

**Tech Stack:** Firebase 11 (Auth + Firestore), SolidJS 1.9 signals for auth state, Vite env vars for config.

**SolidJS Rules:** `import type` for type-only imports, `class` not `className`, never destructure props, use `createSignal`/`createEffect`/`on()`.

---

## Prerequisites (Manual — Do Before Starting)

1. Go to [Firebase Console](https://console.firebase.google.com) and create project "PickleScore"
2. Add a **Web app** — copy the config object
3. Enable **Authentication** > Sign-in method > **Google**
4. Create **Firestore Database** > Start in **test mode**
5. Create `.env.local` in project root with your config values:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

---

### Task 1: Install Firebase SDK & Environment Setup

**Files:**
- Modify: `package.json` (via npm install)
- Create: `.env.example`
- Create: `src/data/firebase/config.ts`

**Step 1: Install Firebase**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npm install firebase`

Expected: firebase added to dependencies in package.json.

**Step 2: Create `.env.example`**

Create file at `C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp/.env.example`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**Step 3: Verify `.env.local` is gitignored**

The existing `.gitignore` already has `*.local` on line 14 — no change needed. Verify:

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && grep '*.local' .gitignore`

Expected: `*.local`

**Step 4: Create Firebase config module**

Create file at `src/data/firebase/config.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
```

**Step 5: Run existing tests to verify no regression**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All 45 tests pass. Firebase module is imported nowhere yet, so zero impact.

**Step 6: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add package.json package-lock.json .env.example src/data/firebase/config.ts && git commit -m "feat: add Firebase SDK and config module"
```

---

### Task 2: Add Cloud Types

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Add cloud-specific types**

Add the following to the END of `src/data/types.ts` (after the existing `ScoreEvent` interface):

```typescript
// --- Cloud types (Layer 1) ---

export type MatchVisibility = 'private' | 'shared' | 'public';

export interface CloudMatch extends Match {
  ownerId: string;
  sharedWith: string[];
  visibility: MatchVisibility;
  syncedAt: number;
}

export interface CloudScoreEvent extends ScoreEvent {
  recordedBy: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
}
```

**Step 2: Run existing tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All 45 tests pass. New types are additive, no existing code affected.

**Step 3: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/data/types.ts && git commit -m "feat: add cloud match, score event, and user profile types"
```

---

### Task 3: Create useAuth Hook

**Files:**
- Create: `src/shared/hooks/useAuth.ts`
- Create: `src/shared/hooks/__tests__/useAuth.test.ts`

**Step 1: Write the failing test**

Create file at `src/shared/hooks/__tests__/useAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock firebase before imports
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: null },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should export useAuth function', async () => {
    const mod = await import('../useAuth');
    expect(mod.useAuth).toBeDefined();
    expect(typeof mod.useAuth).toBe('function');
  });

  it('should provide signIn and signOut functions', async () => {
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    expect(typeof authState.signIn).toBe('function');
    expect(typeof authState.signOut).toBe('function');
  });

  it('should provide user and loading signals', async () => {
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    expect(typeof authState.user).toBe('function');
    expect(typeof authState.loading).toBe('function');
  });

  it('should call signInWithPopup on signIn', async () => {
    const firebaseAuth = await import('firebase/auth');
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    await authState.signIn();
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
  });

  it('should call firebase signOut on signOut', async () => {
    const firebaseAuth = await import('firebase/auth');
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    await authState.signOut();
    expect(firebaseAuth.signOut).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/hooks/__tests__/useAuth.test.ts`

Expected: FAIL — `../useAuth` module not found.

**Step 3: Implement useAuth hook**

Create file at `src/shared/hooks/useAuth.ts`:

```typescript
import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);

let listenerInitialized = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(false);
  });
}

export function useAuth() {
  initAuthListener();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, signIn, signOut };
}
```

**Step 4: Run test to verify it passes**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/hooks/__tests__/useAuth.test.ts`

Expected: All 5 tests PASS.

**Step 5: Run all tests to verify no regression**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass (45 existing + 5 new = 50).

**Step 6: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/hooks/useAuth.ts src/shared/hooks/__tests__/useAuth.test.ts && git commit -m "feat: add useAuth hook with Google sign-in"
```

---

### Task 4: Create Firestore User Repository

**Files:**
- Create: `src/data/firebase/firestoreUserRepository.ts`

**Step 1: Create user repository**

Create file at `src/data/firebase/firestoreUserRepository.ts`:

```typescript
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { UserProfile } from '../types';

export const firestoreUserRepository = {
  async saveProfile(user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): Promise<void> {
    const ref = doc(firestore, 'users', user.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        id: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    const ref = doc(firestore, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      displayName: data.displayName ?? '',
      email: data.email ?? '',
      photoURL: data.photoURL ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    };
  },
};
```

**Step 2: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/data/firebase/firestoreUserRepository.ts && git commit -m "feat: add Firestore user profile repository"
```

---

### Task 5: Create Firestore Match Repository

**Files:**
- Create: `src/data/firebase/firestoreMatchRepository.ts`

**Step 1: Create match repository**

Create file at `src/data/firebase/firestoreMatchRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { Match, CloudMatch, MatchVisibility } from '../types';

function toCloudMatch(match: Match, ownerId: string, visibility: MatchVisibility = 'private'): CloudMatch {
  return {
    ...match,
    ownerId,
    sharedWith: [],
    visibility,
    syncedAt: Date.now(),
  };
}

export const firestoreMatchRepository = {
  async save(match: Match, ownerId: string): Promise<void> {
    const ref = doc(firestore, 'matches', match.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      // Update — preserve ownerId, sharedWith, visibility from existing
      const data = existing.data();
      await setDoc(ref, {
        ...match,
        ownerId: data.ownerId,
        sharedWith: data.sharedWith ?? [],
        visibility: data.visibility ?? 'private',
        syncedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new
      const cloudMatch = toCloudMatch(match, ownerId);
      await setDoc(ref, {
        ...cloudMatch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  async getById(id: string): Promise<CloudMatch | undefined> {
    const ref = doc(firestore, 'matches', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return { id: snap.id, ...snap.data() } as CloudMatch;
  },

  async getByOwner(ownerId: string): Promise<CloudMatch[]> {
    const q = query(
      collection(firestore, 'matches'),
      where('ownerId', '==', ownerId),
      orderBy('startedAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CloudMatch);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'matches', id));
  },
};
```

**Step 2: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/data/firebase/firestoreMatchRepository.ts && git commit -m "feat: add Firestore match repository"
```

---

### Task 6: Create Firestore ScoreEvent Repository

**Files:**
- Create: `src/data/firebase/firestoreScoreEventRepository.ts`

**Step 1: Create score event repository**

Create file at `src/data/firebase/firestoreScoreEventRepository.ts`:

```typescript
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { firestore } from './config';
import type { ScoreEvent, CloudScoreEvent } from '../types';

export const firestoreScoreEventRepository = {
  async save(event: ScoreEvent, recordedBy: string): Promise<void> {
    const ref = doc(firestore, 'matches', event.matchId, 'scoreEvents', event.id);
    const cloudEvent: CloudScoreEvent = { ...event, recordedBy };
    await setDoc(ref, cloudEvent);
  },

  async getByMatchId(matchId: string): Promise<ScoreEvent[]> {
    const q = query(
      collection(firestore, 'matches', matchId, 'scoreEvents'),
      orderBy('timestamp'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ScoreEvent);
  },
};
```

**Step 2: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/data/firebase/firestoreScoreEventRepository.ts && git commit -m "feat: add Firestore score event repository"
```

---

### Task 7: Create Cloud Sync Service

This is the core dual-write and sync-on-signin logic. It coordinates between Dexie and Firestore.

**Files:**
- Create: `src/data/firebase/cloudSync.ts`
- Create: `src/data/firebase/__tests__/cloudSync.test.ts`

**Step 1: Write the failing test**

Create file at `src/data/firebase/__tests__/cloudSync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all Firebase modules
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(() => ({ exists: () => false })),
  getDocs: vi.fn(() => ({ docs: [] })),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('../../firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    save: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: {
    save: vi.fn(),
    getByOwner: vi.fn(() => []),
  },
}));

describe('cloudSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export cloudSync object', async () => {
    const mod = await import('../cloudSync');
    expect(mod.cloudSync).toBeDefined();
  });

  it('should have syncMatchToCloud method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.syncMatchToCloud).toBe('function');
  });

  it('should have syncScoreEventToCloud method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.syncScoreEventToCloud).toBe('function');
  });

  it('should have pullCloudMatchesToLocal method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.pullCloudMatchesToLocal).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/cloudSync.test.ts`

Expected: FAIL — module not found.

**Step 3: Implement cloudSync service**

Create file at `src/data/firebase/cloudSync.ts`:

```typescript
import { auth } from './config';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreScoreEventRepository } from './firestoreScoreEventRepository';
import { firestoreUserRepository } from './firestoreUserRepository';
import { matchRepository } from '../repositories/matchRepository';
import type { Match, ScoreEvent } from '../types';

export const cloudSync = {
  /**
   * Save a match to Firestore if user is signed in.
   * Fire-and-forget — failures are logged, never block the UI.
   */
  syncMatchToCloud(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreMatchRepository.save(match, user.uid).catch((err) => {
      console.warn('Cloud sync failed for match:', match.id, err);
    });
  },

  /**
   * Save a score event to Firestore if user is signed in.
   * Fire-and-forget.
   */
  syncScoreEventToCloud(event: ScoreEvent): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreScoreEventRepository.save(event, user.uid).catch((err) => {
      console.warn('Cloud sync failed for score event:', event.id, err);
    });
  },

  /**
   * Pull all cloud matches into local Dexie.
   * Called on sign-in to hydrate local DB with cloud data.
   */
  async pullCloudMatchesToLocal(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const cloudMatches = await firestoreMatchRepository.getByOwner(user.uid);
      let synced = 0;
      for (const cloudMatch of cloudMatches) {
        // Convert CloudMatch to Match (strip cloud fields for local storage)
        const localMatch: Match = {
          id: cloudMatch.id,
          config: cloudMatch.config,
          team1PlayerIds: cloudMatch.team1PlayerIds,
          team2PlayerIds: cloudMatch.team2PlayerIds,
          team1Name: cloudMatch.team1Name,
          team2Name: cloudMatch.team2Name,
          team1Color: cloudMatch.team1Color,
          team2Color: cloudMatch.team2Color,
          games: cloudMatch.games,
          winningSide: cloudMatch.winningSide,
          status: cloudMatch.status,
          startedAt: cloudMatch.startedAt,
          completedAt: cloudMatch.completedAt,
          lastSnapshot: cloudMatch.lastSnapshot,
        };
        await matchRepository.save(localMatch);
        synced++;
      }
      return synced;
    } catch (err) {
      console.warn('Failed to pull cloud matches:', err);
      return 0;
    }
  },

  /**
   * Save user profile to Firestore on sign-in.
   */
  async syncUserProfile(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await firestoreUserRepository.saveProfile(user);
    } catch (err) {
      console.warn('Failed to sync user profile:', err);
    }
  },

  /**
   * Push all local matches to cloud.
   * Called on first sign-in to backup existing local matches.
   */
  async pushLocalMatchesToCloud(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const localMatches = await matchRepository.getAll();
      let pushed = 0;
      for (const match of localMatches) {
        await firestoreMatchRepository.save(match, user.uid);
        pushed++;
      }
      return pushed;
    } catch (err) {
      console.warn('Failed to push local matches:', err);
      return 0;
    }
  },
};
```

**Step 4: Run test to verify it passes**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/cloudSync.test.ts`

Expected: All 4 tests PASS.

**Step 5: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass.

**Step 6: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/data/firebase/cloudSync.ts src/data/firebase/__tests__/cloudSync.test.ts && git commit -m "feat: add cloud sync service for dual-write and sync-on-signin"
```

---

### Task 8: Wire Cloud Sync Into useScoringActor

Add cloud write-through to the scoring hook. Every match save and score event now also writes to Firestore (fire-and-forget) when the user is signed in.

**Files:**
- Modify: `src/features/scoring/hooks/useScoringActor.ts`

**Step 1: Add cloudSync import**

Add this import at the top of `src/features/scoring/hooks/useScoringActor.ts`, after the existing imports:

```typescript
import { cloudSync } from '../../../data/firebase/cloudSync';
```

**Step 2: Add cloud sync to persistSnapshot**

In the `persistSnapshot` function (line 18-33), after `matchRepository.save(...)`, add cloud sync. Replace the entire `persistSnapshot` function:

```typescript
function persistSnapshot(matchId: string, context: { team1Score: number; team2Score: number; servingTeam: 1 | 2; serverNumber: 1 | 2; gameNumber: number; gamesWon: [number, number]; config: { gameType: string; scoringMode: string; matchFormat: string; pointsToWin: number }; gamesToWin: number }) {
  const snapshot: ResumeState = {
    team1Score: context.team1Score,
    team2Score: context.team2Score,
    servingTeam: context.servingTeam,
    serverNumber: context.serverNumber,
    gameNumber: context.gameNumber,
    gamesWon: [context.gamesWon[0], context.gamesWon[1]],
  };
  // Fire and forget - don't block the UI on DB write
  matchRepository.getById(matchId).then((match) => {
    if (match) {
      const updated = { ...match, lastSnapshot: JSON.stringify(snapshot) };
      matchRepository.save(updated);
      cloudSync.syncMatchToCloud(updated);
    }
  });
}
```

**Step 3: Add cloud sync to saveCompletedGame**

In the `saveCompletedGame` function (line 39-56), after `matchRepository.save(...)`, add cloud sync. Replace the entire function:

```typescript
function saveCompletedGame(matchId: string, context: { team1Score: number; team2Score: number; gameNumber: number; config: { pointsToWin: number } }) {
  const winningSide: 1 | 2 = hasWonGame(context.team1Score, context.team2Score, context.config.pointsToWin) ? 1 : 2;
  const gameResult: GameResult = {
    gameNumber: context.gameNumber,
    team1Score: context.team1Score,
    team2Score: context.team2Score,
    winningSide,
  };
  matchRepository.getById(matchId).then((match) => {
    if (match) {
      const alreadySaved = match.games.some((g) => g.gameNumber === gameResult.gameNumber);
      if (!alreadySaved) {
        const updated = { ...match, games: [...match.games, gameResult] };
        matchRepository.save(updated);
        cloudSync.syncMatchToCloud(updated);
      }
    }
  });
}
```

**Step 4: Add cloud sync to scoreEvent saves**

In the `scorePoint` function, after `scoreEventRepository.save(event)` (around line 114-118), add:

```typescript
      try {
        await scoreEventRepository.save(event);
        cloudSync.syncScoreEventToCloud(event);
      } catch (err) {
        console.error('Failed to save score event:', err);
      }
```

Apply the same pattern in `sideOut` (around line 142-146):

```typescript
    try {
      await scoreEventRepository.save(event);
      cloudSync.syncScoreEventToCloud(event);
    } catch (err) {
      console.error('Failed to save score event:', err);
    }
```

And in `undo` (around line 163-167):

```typescript
      try {
        await scoreEventRepository.save(event);
        cloudSync.syncScoreEventToCloud(event);
      } catch (err) {
        console.error('Failed to save score event:', err);
      }
```

**Step 5: Run existing tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass. The `cloudSync` calls are fire-and-forget and won't affect existing test behavior (Firestore is not initialized in test environment, so `auth.currentUser` is null and sync is a no-op).

Note: If tests fail because the `cloudSync` import triggers Firebase initialization, add a mock to the test setup. Create `src/data/firebase/__mocks__/config.ts` or add to `src/test-setup.ts`:

```typescript
vi.mock('./data/firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));
```

**Step 6: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/hooks/useScoringActor.ts && git commit -m "feat: add cloud write-through to scoring actor"
```

---

### Task 9: Handle Firebase Mock in Test Setup

The existing engine and repository tests don't use Firebase. But now that `useScoringActor` imports `cloudSync` (which imports Firebase), tests may fail if Firebase isn't mocked globally.

**Files:**
- Modify: `src/test-setup.ts`

**Step 1: Read current test setup**

Read `src/test-setup.ts` to see what's already there.

**Step 2: Add Firebase mock**

Add the following to `src/test-setup.ts`:

```typescript
// Mock Firebase for tests that don't use it
vi.mock('./data/firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

vi.mock('./data/firebase/cloudSync', () => ({
  cloudSync: {
    syncMatchToCloud: vi.fn(),
    syncScoreEventToCloud: vi.fn(),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncUserProfile: vi.fn(() => Promise.resolve()),
    pushLocalMatchesToCloud: vi.fn(() => Promise.resolve(0)),
  },
}));
```

Note: The mock paths must match the import paths used in the source. If tests use different relative paths, adjust accordingly. The `vi.mock` calls in `test-setup.ts` use paths relative to the setup file's location.

**Step 3: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass. If mock paths are wrong, you'll get import errors — adjust the paths to match.

**Step 4: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/test-setup.ts && git commit -m "test: add Firebase mocks to test setup"
```

---

### Task 10: Wire Sync-on-SignIn to useAuth

When a user signs in, automatically sync their profile and pull cloud matches into local Dexie.

**Files:**
- Modify: `src/shared/hooks/useAuth.ts`

**Step 1: Add sync-on-signin logic**

Update `src/shared/hooks/useAuth.ts` to call cloudSync when the user signs in:

```typescript
import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';
import { cloudSync } from '../../data/firebase/cloudSync';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);
const [syncing, setSyncing] = createSignal(false);

let listenerInitialized = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, async (firebaseUser) => {
    const wasSignedOut = user() === null;
    setUser(firebaseUser);
    setLoading(false);

    // Sync on sign-in
    if (firebaseUser && wasSignedOut) {
      setSyncing(true);
      try {
        await cloudSync.syncUserProfile();
        await cloudSync.pushLocalMatchesToCloud();
        await cloudSync.pullCloudMatchesToLocal();
      } catch (err) {
        console.warn('Sync on sign-in failed:', err);
      } finally {
        setSyncing(false);
      }
    }
  });
}

export function useAuth() {
  initAuthListener();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, syncing, signIn, signOut };
}
```

**Step 2: Update useAuth test**

Update `src/shared/hooks/__tests__/useAuth.test.ts` to also mock cloudSync:

Add this mock at the top (after the existing mocks):

```typescript
vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: {
    syncUserProfile: vi.fn(() => Promise.resolve()),
    pushLocalMatchesToCloud: vi.fn(() => Promise.resolve(0)),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncMatchToCloud: vi.fn(),
    syncScoreEventToCloud: vi.fn(),
  },
}));
```

Add a test for the syncing signal:

```typescript
  it('should provide syncing signal', async () => {
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    expect(typeof authState.syncing).toBe('function');
  });
```

**Step 3: Run tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass.

**Step 4: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/hooks/useAuth.ts src/shared/hooks/__tests__/useAuth.test.ts && git commit -m "feat: add sync-on-signin to useAuth hook"
```

---

### Task 11: Add Account Section to Settings Page

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`

**Step 1: Add auth imports**

Add this import at the top of `src/features/settings/SettingsPage.tsx`:

```typescript
import { useAuth } from '../../shared/hooks/useAuth';
```

**Step 2: Add auth state inside the component**

At the start of the component function (after `const [voices, setVoices] = ...`), add:

```typescript
  const { user, loading: authLoading, syncing, signIn, signOut } = useAuth();
```

**Step 3: Add Account section at the top of the left column**

Insert the Account fieldset as the FIRST child inside the left column `<div class="space-y-6">` (before the Display fieldset):

```tsx
            {/* Account */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                Account
              </legend>
              <div class="bg-surface-light rounded-xl p-4">
                <Show
                  when={!authLoading()}
                  fallback={
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-surface-lighter animate-pulse" />
                      <div class="skeleton h-4 w-24" />
                    </div>
                  }
                >
                  <Show
                    when={user()}
                    fallback={
                      <div class="flex flex-col gap-3">
                        <p class="text-sm text-on-surface-muted">
                          Sign in to sync matches across devices and join tournaments.
                        </p>
                        <button
                          type="button"
                          onClick={() => signIn()}
                          class="w-full flex items-center justify-center gap-2 bg-white text-gray-800 font-semibold text-sm py-3 rounded-lg active:scale-95 transition-transform shadow-sm"
                        >
                          <svg class="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Sign in with Google
                        </button>
                      </div>
                    }
                  >
                    <div class="flex items-center gap-3">
                      <Show
                        when={user()?.photoURL}
                        fallback={
                          <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-lg">
                            {user()?.displayName?.charAt(0) ?? '?'}
                          </div>
                        }
                      >
                        <img
                          src={user()!.photoURL!}
                          alt=""
                          class="w-10 h-10 rounded-full"
                          referrerpolicy="no-referrer"
                        />
                      </Show>
                      <div class="flex-1 min-w-0">
                        <div class="font-semibold text-on-surface truncate">{user()?.displayName}</div>
                        <div class="text-xs text-on-surface-muted truncate">{user()?.email}</div>
                        <Show when={syncing()}>
                          <div class="text-xs text-primary mt-0.5">Syncing matches...</div>
                        </Show>
                      </div>
                      <button
                        type="button"
                        onClick={() => signOut()}
                        class="text-sm text-on-surface-muted hover:text-on-surface px-3 py-1.5 rounded-lg bg-surface-lighter active:scale-95 transition-transform"
                      >
                        Sign out
                      </button>
                    </div>
                  </Show>
                </Show>
              </div>
            </fieldset>
```

**Step 4: Add `Show` to imports**

The component already imports `Show` from solid-js (line 1). Verify it's there.

**Step 5: Run the dev server and manually test**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite --port 5199`

Manual test checklist:
- [ ] Navigate to Settings — Account section appears at top-left
- [ ] Shows "Sign in with Google" button when not signed in
- [ ] Clicking Sign in opens Google OAuth popup
- [ ] After sign-in, shows profile photo, name, email, and "Sign out" button
- [ ] "Syncing matches..." text appears briefly after sign-in
- [ ] Clicking Sign out returns to the sign-in button
- [ ] All existing settings below still work

**Step 6: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass.

**Step 7: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/settings/SettingsPage.tsx && git commit -m "feat: add Account section to Settings page with sign-in/out"
```

---

### Task 12: Wire Cloud Sync to Match Creation

When a new match is created on the GameSetupPage, it should also sync to Firestore.

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Step 1: Read GameSetupPage to find where matches are created**

Read `src/features/scoring/GameSetupPage.tsx` and find the `matchRepository.save(...)` call.

**Step 2: Add cloudSync import**

Add after existing imports:

```typescript
import { cloudSync } from '../../data/firebase/cloudSync';
```

**Step 3: Add cloud sync after match save**

Find every `matchRepository.save(match)` call and add `cloudSync.syncMatchToCloud(match)` right after it:

```typescript
await matchRepository.save(match);
cloudSync.syncMatchToCloud(match);
```

**Step 4: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass.

**Step 5: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/GameSetupPage.tsx && git commit -m "feat: sync new match creation to cloud"
```

---

### Task 13: Wire Cloud Sync to Match Completion

When a match is completed on the ScoringPage, sync the final state to cloud.

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx`

**Step 1: Read ScoringPage to find where match completion is handled**

Read `src/features/scoring/ScoringPage.tsx` and find where match status is set to `'completed'` or where `matchRepository.save(...)` is called with a completed match.

**Step 2: Add cloudSync import and sync calls**

Same pattern as Task 12 — add `cloudSync.syncMatchToCloud(match)` after every `matchRepository.save(...)` call.

**Step 3: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass.

**Step 4: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/ScoringPage.tsx && git commit -m "feat: sync match completion to cloud"
```

---

### Task 14: Create Firestore Security Rules

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`

**Step 1: Create security rules**

Create file at project root `firestore.rules`:

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
      // Owner can read/write
      allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerId;

      // Create: any authenticated user
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;

      // Shared users can read and write
      allow read, write: if request.auth != null && request.auth.uid in resource.data.sharedWith;

      // Public matches: anyone can read
      allow read: if resource.data.visibility == 'public';

      // Score events sub-collection
      match /scoreEvents/{eventId} {
        // Same permissions as parent match
        allow read, write: if request.auth != null && (
          get(/databases/$(database)/documents/matches/$(matchId)).data.ownerId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.sharedWith
        );
        allow read: if get(/databases/$(database)/documents/matches/$(matchId)).data.visibility == 'public';
      }
    }
  }
}
```

**Step 2: Create Firebase config**

Create file at project root `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

**Step 3: Commit**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add firestore.rules firebase.json && git commit -m "feat: add Firestore security rules"
```

---

### Task 15: Final Verification & Cleanup

**Step 1: Run all tests**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run`

Expected: All tests pass (50+ total: 45 existing + new useAuth and cloudSync tests).

**Step 2: Run TypeScript type check**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc -b --noEmit`

Expected: No type errors.

**Step 3: Run build**

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npm run build`

Expected: Clean build, no errors.

**Step 4: Manual smoke test**

Start dev server:

Run: `cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite --port 5199`

Test checklist:
- [ ] App loads normally without Firebase config (env vars empty) — no crashes
- [ ] Settings > Account shows sign-in button
- [ ] Can start and score a match as normal (offline-first behavior unchanged)
- [ ] Match history still works
- [ ] Player management still works
- [ ] With valid `.env.local` config: sign-in works, matches sync to Firestore (check Firebase Console > Firestore)

**Step 5: Final commit (if any fixes needed)**

```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add -A && git commit -m "fix: final Layer 1 adjustments"
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for Firebase env vars |
| `firebase.json` | Firebase project config |
| `firestore.rules` | Firestore security rules |
| `src/data/firebase/config.ts` | Firebase app initialization |
| `src/data/firebase/cloudSync.ts` | Dual-write orchestrator |
| `src/data/firebase/firestoreMatchRepository.ts` | Firestore match CRUD |
| `src/data/firebase/firestoreScoreEventRepository.ts` | Firestore score event CRUD |
| `src/data/firebase/firestoreUserRepository.ts` | Firestore user profile CRUD |
| `src/data/firebase/__tests__/cloudSync.test.ts` | Cloud sync tests |
| `src/shared/hooks/useAuth.ts` | Auth state hook |
| `src/shared/hooks/__tests__/useAuth.test.ts` | Auth hook tests |

## Summary of Modified Files

| File | Change |
|------|--------|
| `src/data/types.ts` | Added CloudMatch, CloudScoreEvent, UserProfile, MatchVisibility |
| `src/features/settings/SettingsPage.tsx` | Added Account section (sign in/out UI) |
| `src/features/scoring/hooks/useScoringActor.ts` | Added cloud write-through via cloudSync |
| `src/features/scoring/GameSetupPage.tsx` | Added cloud sync on match creation |
| `src/features/scoring/ScoringPage.tsx` | Added cloud sync on match completion |
| `src/test-setup.ts` | Added Firebase mocks |
