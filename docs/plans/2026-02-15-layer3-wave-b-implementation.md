# Layer 3 Wave B: Real-Time Data Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace one-shot Firestore reads with live `onSnapshot` listeners so all tournament viewers see real-time updates without refreshing — including point-by-point live scoring.

**Architecture:** Create two SolidJS hooks — `useTournamentLive(id)` subscribes to tournament doc + all sub-collections via `onSnapshot`, returning reactive signals. `useLiveMatch(matchId)` subscribes to a single match doc for live scores. Both clean up listeners via `onCleanup`. Replace `createResource` data fetching in `TournamentDashboardPage` and `PublicTournamentPage` with the live hooks. Add a `LiveScoreCard` component for in-progress match display.

**Tech Stack:** SolidJS 1.9, TypeScript, Firebase/Firestore `onSnapshot`, Tailwind CSS v4

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

Run:
```bash
cd "C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp"
git checkout -b feature/layer3-wave-b
```
Expected: Switched to new branch `feature/layer3-wave-b`

---

### Task 2: Create `useTournamentLive` hook

**Files:**
- Create: `src/features/tournaments/hooks/useTournamentLive.ts`

**Context:** This hook replaces the 5 `createResource` calls in `TournamentDashboardPage` (lines 77-136) and `PublicTournamentPage` (lines 19-62). Instead of one-shot `getDoc`/`getDocs` with manual `refetch()`, it uses Firestore `onSnapshot` to get real-time updates pushed to SolidJS signals.

**Step 1: Create the hook**

Create `src/features/tournaments/hooks/useTournamentLive.ts`:

```typescript
import { createSignal, onCleanup } from 'solid-js';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type {
  Tournament,
  TournamentTeam,
  TournamentPool,
  BracketSlot,
  TournamentRegistration,
} from '../../../data/types';

export interface TournamentLiveData {
  tournament: () => Tournament | undefined;
  teams: () => TournamentTeam[];
  pools: () => TournamentPool[];
  bracket: () => BracketSlot[];
  registrations: () => TournamentRegistration[];
  loading: () => boolean;
  error: () => string;
}

export function useTournamentLive(tournamentId: () => string | undefined): TournamentLiveData {
  const [tournament, setTournament] = createSignal<Tournament | undefined>(undefined);
  const [teams, setTeams] = createSignal<TournamentTeam[]>([]);
  const [pools, setPools] = createSignal<TournamentPool[]>([]);
  const [bracket, setBracket] = createSignal<BracketSlot[]>([]);
  const [registrations, setRegistrations] = createSignal<TournamentRegistration[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const unsubscribers: (() => void)[] = [];

  const cleanup = () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
  };

  const subscribe = (id: string) => {
    cleanup();
    setLoading(true);
    setError('');

    // Listen to tournament doc
    const tournamentRef = doc(firestore, 'tournaments', id);
    unsubscribers.push(
      onSnapshot(
        tournamentRef,
        (snap) => {
          if (snap.exists()) {
            setTournament({ id: snap.id, ...snap.data() } as Tournament);
          } else {
            setTournament(undefined);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Tournament listener error:', err);
          setError(err.message);
          setLoading(false);
        },
      ),
    );

    // Listen to teams sub-collection
    const teamsRef = collection(firestore, 'tournaments', id, 'teams');
    unsubscribers.push(
      onSnapshot(
        teamsRef,
        (snap) => {
          setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam));
        },
        (err) => console.error('Teams listener error:', err),
      ),
    );

    // Listen to pools sub-collection
    const poolsRef = collection(firestore, 'tournaments', id, 'pools');
    unsubscribers.push(
      onSnapshot(
        poolsRef,
        (snap) => {
          setPools(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool));
        },
        (err) => console.error('Pools listener error:', err),
      ),
    );

    // Listen to bracket sub-collection
    const bracketRef = collection(firestore, 'tournaments', id, 'bracket');
    unsubscribers.push(
      onSnapshot(
        bracketRef,
        (snap) => {
          setBracket(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot));
        },
        (err) => console.error('Bracket listener error:', err),
      ),
    );

    // Listen to registrations sub-collection
    const regsRef = collection(firestore, 'tournaments', id, 'registrations');
    unsubscribers.push(
      onSnapshot(
        regsRef,
        (snap) => {
          setRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration));
        },
        (err) => console.error('Registrations listener error:', err),
      ),
    );
  };

  // React to tournamentId changes
  // Use a manual effect: check if id changed
  let currentId: string | undefined;
  const checkAndSubscribe = () => {
    const id = tournamentId();
    if (id && id !== currentId) {
      currentId = id;
      subscribe(id);
    } else if (!id && currentId) {
      cleanup();
      currentId = undefined;
      setTournament(undefined);
      setTeams([]);
      setPools([]);
      setBracket([]);
      setRegistrations([]);
      setLoading(false);
    }
  };

  // Initial subscribe
  checkAndSubscribe();

  // Cleanup on component unmount
  onCleanup(cleanup);

  return {
    tournament,
    teams,
    pools,
    bracket,
    registrations,
    loading,
    error,
  };
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/hooks/useTournamentLive.ts
git commit -m "feat: add useTournamentLive hook with Firestore onSnapshot listeners"
```

---

### Task 3: Create `useLiveMatch` hook

**Files:**
- Create: `src/features/tournaments/hooks/useLiveMatch.ts`

**Context:** This hook subscribes to a single match document (`matches/{matchId}`) for point-by-point live score updates. Used by the `LiveScoreCard` component to show real-time scores during active matches.

**Step 1: Create the hook**

Create `src/features/tournaments/hooks/useLiveMatch.ts`:

```typescript
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { Match } from '../../../data/types';

export interface LiveMatchData {
  match: () => Match | undefined;
  loading: () => boolean;
}

export function useLiveMatch(matchId: () => string | null | undefined): LiveMatchData {
  const [match, setMatch] = createSignal<Match | undefined>(undefined);
  const [loading, setLoading] = createSignal(false);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const id = matchId();

    // Cleanup previous listener
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!id) {
      setMatch(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    const matchRef = doc(firestore, 'matches', id);
    unsubscribe = onSnapshot(
      matchRef,
      (snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...snap.data() } as Match);
        } else {
          setMatch(undefined);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Match listener error:', err);
        setLoading(false);
      },
    );
  });

  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return { match, loading };
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/hooks/useLiveMatch.ts
git commit -m "feat: add useLiveMatch hook for point-by-point live scoring"
```

---

### Task 4: Create `LiveScoreCard` component

**Files:**
- Create: `src/features/tournaments/components/LiveScoreCard.tsx`

**Context:** A compact card that shows a live match score with a pulsing red dot to indicate the match is in progress. Uses `useLiveMatch` to subscribe to score updates.

**Step 1: Create the component**

Create `src/features/tournaments/components/LiveScoreCard.tsx`:

```typescript
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useLiveMatch } from '../hooks/useLiveMatch';

interface Props {
  matchId: string;
  team1Name: string;
  team2Name: string;
}

const LiveScoreCard: Component<Props> = (props) => {
  const { match, loading } = useLiveMatch(() => props.matchId);

  const currentGame = () => {
    const m = match();
    if (!m || m.games.length === 0) return null;
    return m.games[m.games.length - 1];
  };

  const gameCount = () => {
    const m = match();
    if (!m) return { team1: 0, team2: 0 };
    let t1 = 0;
    let t2 = 0;
    for (const g of m.games) {
      if (g.winningSide === 1) t1++;
      else if (g.winningSide === 2) t2++;
    }
    return { team1: t1, team2: t2 };
  };

  return (
    <div class="bg-surface-light rounded-lg border border-surface-lighter overflow-hidden">
      <Show when={!loading()} fallback={
        <div class="px-3 py-2 text-xs text-on-surface-muted">Loading...</div>
      }>
        <Show when={match()}>
          {(m) => (
            <>
              {/* Header with live indicator */}
              <div class="px-3 py-1.5 flex items-center gap-2 bg-surface-lighter">
                <Show when={m().status === 'in-progress'}>
                  <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span class="text-xs font-semibold text-red-400">LIVE</span>
                </Show>
                <Show when={m().status === 'completed'}>
                  <span class="text-xs font-semibold text-green-400">FINAL</span>
                </Show>
                <Show when={m().config.matchFormat !== 'single'}>
                  <span class="text-xs text-on-surface-muted ml-auto">
                    Games: {gameCount().team1}-{gameCount().team2}
                  </span>
                </Show>
              </div>
              {/* Score display */}
              <div class="px-3 py-2 space-y-1">
                <div class="flex items-center justify-between text-sm">
                  <span class={`truncate ${m().winningSide === 1 ? 'font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                    {props.team1Name}
                  </span>
                  <span class={`font-mono font-bold ${m().winningSide === 1 ? 'text-on-surface' : 'text-on-surface-muted'}`}>
                    {currentGame()?.team1Score ?? 0}
                  </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class={`truncate ${m().winningSide === 2 ? 'font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                    {props.team2Name}
                  </span>
                  <span class={`font-mono font-bold ${m().winningSide === 2 ? 'text-on-surface' : 'text-on-surface-muted'}`}>
                    {currentGame()?.team2Score ?? 0}
                  </span>
                </div>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default LiveScoreCard;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/LiveScoreCard.tsx
git commit -m "feat: add LiveScoreCard component with real-time score display"
```

---

### Task 5: Migrate TournamentDashboardPage to useTournamentLive

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Context:** This is the biggest change. Replace the 5 `createResource` calls (lines 77-136) with a single `useTournamentLive()` call. Remove all manual `refetch*()` calls. The live hook auto-updates via `onSnapshot`, so after any write operation, the data updates automatically — no explicit refetch needed.

**Step 1: Replace data fetching imports and setup**

Replace the `createResource`-based imports and data section:

1. **Remove `createResource` from the solid-js import** (line 1) — keep `createSignal, createMemo, Show, For`

2. **Remove Firestore repository imports** that are only used for reads (keep the ones used for writes):
   - KEEP: `firestoreTournamentRepository` (used for writes: `updateStatus`, `updateVisibility`)
   - KEEP: `firestoreTeamRepository` (used for writes: `save`)
   - REMOVE: `firestoreRegistrationRepository` from the data fetching section (but KEEP if used elsewhere like `getByUser` for existing registration)
   - KEEP: `firestorePoolRepository` (used for writes: `save`, `updateStandings`, `updateScheduleAndStandings`)
   - KEEP: `firestoreBracketRepository` (used for writes: `save`, `updateResult`, `updateSlotTeam`)

3. **Add the new hook import:**
```typescript
import { useTournamentLive } from './hooks/useTournamentLive';
```

4. **Replace the 5 `createResource` blocks** (lines 77-136) with:
```typescript
  // --- Live Data (replaces createResource + refetch) ---
  const live = useTournamentLive(() => params.id);
```

5. **The existing registration fetch stays as `createResource`** because it's user-specific (not a collection listener):
```typescript
  const [existingRegistration, { refetch: refetchExistingReg }] = createResource(
    () => {
      const u = user();
      const id = params.id;
      if (!u || !id) return null;
      return { tournamentId: id, userId: u.uid };
    },
    (source) => {
      if (!source) return Promise.resolve(undefined);
      return firestoreRegistrationRepository.getByUser(source.tournamentId, source.userId);
    },
  );
```
This one still needs `createResource` because it fetches a specific user's registration, not the full collection.

6. **Update all references** from the old accessors to the new ones:
   - `tournament()` → `live.tournament()`
   - `teams()` → `live.teams()`
   - `registrations()` → `live.registrations()`
   - `pools()` → `live.pools()`
   - `bracketSlots()` → `live.bracket()`

7. **Remove ALL `refetch*()` calls** — data auto-updates now. Search for and remove:
   - `refetchTournament()` — remove every occurrence
   - `refetchTeams()` — remove every occurrence
   - `refetchRegistrations()` — remove every occurrence
   - `refetchPools()` — remove every occurrence
   - `refetchBracket()` — remove every occurrence
   - Keep `refetchExistingReg()` — this one is still `createResource`-based

8. **Update the `isOrganizer` memo:**
```typescript
  const isOrganizer = () => {
    const t = live.tournament();
    const u = user();
    return !!t && !!u && t.organizerId === u.uid;
  };
```

9. **Update the `teamNames` and `userNames` memos:**
```typescript
  const teamNames = createMemo<Record<string, string>>(() => {
    const t = live.teams();
    const map: Record<string, string> = {};
    for (const team of t) {
      map[team.id] = team.name;
    }
    return map;
  });

  const userNames = createMemo<Record<string, string>>(() => {
    const regs = live.registrations();
    const map: Record<string, string> = {};
    for (const reg of regs) {
      map[reg.userId] = reg.playerName || `Player ${reg.userId.slice(0, 6)}`;
    }
    return map;
  });
```

10. **Update `nextStatus`, `showPoolTables`, `showBracketView`** — replace `tournament()` with `live.tournament()`, `pools()` with `live.pools()`, etc.

11. **Update `handleStatusAdvance`** — replace `tournament()` with `live.tournament()`, `pools()` with `live.pools()`, `bracketSlots()` with `live.bracket()`, `registrations()` with `live.registrations()`. Remove all refetch calls at the end.

12. **Update handlers** — replace `tournament()` with `live.tournament()`, `bracketSlots()` with `live.bracket()` in `handleSaveEditedScore`, etc.

13. **Update the loading state in render** — change the outer `<Show>` from:
```typescript
<Show when={tournament()} fallback={...}>
```
to:
```typescript
<Show when={!live.loading()} fallback={<p class="text-on-surface-muted">Loading...</p>}>
  <Show when={live.tournament()} fallback={<p class="text-on-surface-muted">Tournament not found.</p>}>
```

14. **Update all JSX** that references `pools()`, `bracketSlots()`, `teams()`, `registrations()` to use `live.pools()`, `live.bracket()`, `live.teams()`, `live.registrations()`.

**Step 2: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npx vitest run`
Expected: All 210 tests pass

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: migrate TournamentDashboardPage to useTournamentLive for real-time updates"
```

---

### Task 6: Migrate PublicTournamentPage to useTournamentLive

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx`

**Context:** The public page currently uses `createResource` for data fetching. Replace with `useTournamentLive` — but there's a wrinkle: the public page first needs to resolve a share code to a tournament ID. Keep the initial `getByShareCode` call as `createResource`, then pass the resolved ID to `useTournamentLive`.

**Step 1: Replace data fetching with live hook**

1. Replace the `createResource` imports and data section. The page needs a two-step approach:
   - Step 1: Resolve share code → tournament ID (one-shot query, keeps `createResource`)
   - Step 2: Subscribe to tournament data via `useTournamentLive(resolvedId)`

```typescript
import { createResource, createMemo, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { useTournamentLive } from './hooks/useTournamentLive';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults';
import { statusLabels, statusColors, formatLabels } from './constants';

const PublicTournamentPage: Component = () => {
  const params = useParams();

  // Step 1: Resolve share code to tournament ID (one-shot)
  const [resolved] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  // Step 2: Subscribe to live updates once we have the tournament ID
  const live = useTournamentLive(() => resolved()?.id);

  // Use live data if available, fall back to resolved data
  const tournament = () => live.tournament() ?? resolved();
```

2. Replace all downstream references:
   - `teams()` → `live.teams()`
   - `pools()` → `live.pools()`
   - `bracketSlots()` → `live.bracket()`

3. Remove the individual `createResource` calls for teams, pools, and bracket (lines 24-62 in the current file).

4. Update the `teamNames` memo to use `live.teams()`.

5. Update `showPoolTables` and `showBracketView` to use `tournament()` (which falls through to `live.tournament()`).

6. Update loading/not-found logic to check `resolved.loading` for initial load, then rely on `live.loading()`.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/PublicTournamentPage.tsx
git commit -m "feat: migrate PublicTournamentPage to useTournamentLive for real-time updates"
```

---

### Task 7: Add LiveScoreCard to PoolTable schedule

**Files:**
- Modify: `src/features/tournaments/components/PoolTable.tsx`

**Context:** In the pool schedule section, matches that are in progress (have a `matchId` but aren't completed) currently show nothing useful. Add a `LiveScoreCard` for in-progress matches so spectators can see live scores.

**Step 1: Add live score display**

1. Add import:
```typescript
import LiveScoreCard from './LiveScoreCard';
```

2. Add `liveMatchIds` prop to track which matches are in progress. Actually, simpler approach: the schedule entry has a `matchId` — if it's set, the match has been created. We just need to know if it's in progress vs completed. Currently the PoolTable doesn't have this info.

Better approach: add an optional `matchStatuses` prop that maps matchId → status:

```typescript
interface Props {
  // ... existing props ...
  matchStatuses?: Record<string, 'in-progress' | 'completed'>;
}
```

3. In the schedule section, after the existing `<Show when={!entry.matchId && props.onScoreMatch}>` block, add a case for in-progress matches:

```typescript
<Show when={entry.matchId && props.matchStatuses?.[entry.matchId] === 'in-progress'}>
  <LiveScoreCard
    matchId={entry.matchId!}
    team1Name={props.teamNames[entry.team1Id] ?? entry.team1Id}
    team2Name={props.teamNames[entry.team2Id] ?? entry.team2Id}
  />
</Show>
```

Actually, re-thinking this: the `PoolTable` currently only shows "Score" (no matchId) or "Completed" (has matchId). There's no in-progress state shown. The simplest approach that works for the schedule list is:

In the schedule fallback (when matchId exists), check if the match is in progress:

Replace the schedule entry rendering to handle 3 states:
- No matchId → "Score" button (if onScoreMatch provided)
- matchId + in-progress → show `LiveScoreCard`
- matchId + completed → show "Completed" + Edit button

This requires knowing the match status. The cleanest way: pass `matchStatuses` from the parent. The parent (TournamentDashboardPage) can build this from the live data.

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/components/PoolTable.tsx
git commit -m "feat: show LiveScoreCard for in-progress pool matches"
```

---

### Task 8: Add LiveScoreCard to BracketView

**Files:**
- Modify: `src/features/tournaments/components/BracketView.tsx`

**Context:** Similar to PoolTable — show live scores for in-progress bracket matches.

**Step 1: Add live score display**

1. Add import:
```typescript
import LiveScoreCard from './LiveScoreCard';
```

2. In the bracket slot rendering, a slot has `matchId` (set when scoring starts) and `winnerId` (set when completed). If `matchId` exists but `winnerId` is null, the match is in progress.

After the team display divs and before the "Score Match" button, add:

```typescript
<Show when={slot.matchId && !slot.winnerId}>
  <LiveScoreCard
    matchId={slot.matchId!}
    team1Name={props.teamNames[slot.team1Id ?? ''] ?? 'TBD'}
    team2Name={props.teamNames[slot.team2Id ?? ''] ?? 'TBD'}
  />
</Show>
```

This is simpler than PoolTable because BracketView already has all the info it needs: `matchId` (started) + `!winnerId` (not completed) = in progress.

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/features/tournaments/components/BracketView.tsx
git commit -m "feat: show LiveScoreCard for in-progress bracket matches"
```

---

### Task 9: Wire match statuses into PoolTable from dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/PublicTournamentPage.tsx`

**Context:** PoolTable needs a `matchStatuses` prop to differentiate in-progress from completed matches. The dashboard can compute this by collecting all matchIds from pool schedules and checking their status via live match listeners — but that's expensive (one listener per match).

Simpler approach: since pool schedule entries only have `matchId` (not status), and a match being "in progress" means it has a `matchId` but the pool schedule entry doesn't have a `Completed` status... Actually, looking at the PoolTable code more carefully, it currently shows "Completed" for any entry with a `matchId`. That's not quite right — a match could be in progress.

The fix: pass the `matchStatuses` map. Build it in the dashboard by looking at which matches exist. Since matches are stored in the local Dexie DB (not in tournament sub-collections), we need another approach.

**Best approach:** Don't try to track all match statuses. Instead, check if a matchId exists in the pool schedule AND a winnerId exists for that match (from the match document). But we'd need to query each match...

**Pragmatic approach:** Since bracket slots already have `winnerId` to indicate completion, but pool schedule entries don't, let's add a simple check: if a pool schedule entry has a `matchId`, it's either in-progress or completed. We can tell which by checking the pool standings — if the entry's teams have their standings updated (W/L > 0 for this matchup), it's completed. But that's fragile.

**Simplest approach that works:** Add an optional `inProgressMatchIds` prop (a `Set<string>`) to PoolTable. The parent tracks which matches are currently being scored. Since the dashboard page creates matches and navigates to the scoring page, we won't know which are in progress from the dashboard alone.

Actually, the most practical approach: the `LiveScoreCard` already handles the "match not found" case gracefully (shows nothing). So we can simply show a `LiveScoreCard` for ANY pool schedule entry that has a `matchId`. If the match is completed, the card shows "FINAL" — and we also show "Completed" text. This is slightly redundant but works.

Even simpler: just skip this complexity for now. The LiveScoreCard on the BracketView (Task 8) already works because bracket slots have clear in-progress detection (`matchId && !winnerId`). For pool matches, the "Completed" label is sufficient for now. We can add live pool scores in a future enhancement.

**Decision: Skip Task 7's matchStatuses complexity.** Keep PoolTable as-is (no LiveScoreCard for pool matches). The bracket LiveScoreCard (Task 8) is the more impactful feature since bracket matches are the exciting part of tournaments.

**Instead, this task simply passes live data through to the components.**

In `TournamentDashboardPage.tsx`, update the PoolTable and BracketView renders to use live data (already done in Task 5). No additional changes needed.

In `PublicTournamentPage.tsx`, same — already done in Task 6.

**Mark this task as: MERGED INTO Tasks 5 and 6 — no separate work needed.**

---

### Task 9 (revised): E2E verification — Real-time updates

**Prerequisites:** Dev server running (`npx vite --port 5199`), Firebase emulators running.

**Test scenario:**

**Phase 1: Real-time tournament data updates**
1. Sign in as organizer, create a tournament
2. Open the tournament dashboard
3. In a SECOND browser context (or tab), open the same tournament (as organizer or via public share link)
4. In the first tab, advance the tournament to registration
5. Verify the SECOND tab shows the updated status WITHOUT manual refresh
6. Add a player registration in the first tab
7. Verify the registration appears in the second tab automatically

**Phase 2: Live bracket scoring**
8. Advance to bracket phase
9. Open a bracket match for scoring in the first tab
10. In the second tab, verify the LiveScoreCard appears with "LIVE" indicator on the bracket match
11. Score points in the first tab
12. Verify the second tab shows the score updating (point-by-point)
13. Complete the match
14. Verify the second tab shows the bracket updated with the winner

Use Playwright to automate this test.

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Create feature branch | None |
| 2 | Create `useTournamentLive` hook | Task 1 |
| 3 | Create `useLiveMatch` hook | Task 1 |
| 4 | Create `LiveScoreCard` component | Task 3 |
| 5 | Migrate TournamentDashboardPage to live data | Task 2 |
| 6 | Migrate PublicTournamentPage to live data | Task 2 |
| 7 | Add LiveScoreCard to PoolTable | Task 4 — **DEFERRED (not needed for MVP)** |
| 8 | Add LiveScoreCard to BracketView | Task 4 |
| 9 | E2E verification | Tasks 5, 6, 8 |
