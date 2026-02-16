# Layer 3 Wave C: Role-Based Dashboards — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add role detection and role-specific dashboard sections — players see "My Matches" + "My Stats", scorekeepers see a scoreable match list, and organizer controls remain organizer-only.

**Architecture:** Two pure engine modules (`roleDetection.ts`, `playerStats.ts`) with full test coverage, three new UI components (`MyMatchesSection`, `MyStatsCard`, `ScorekeeperMatchList`), and role-based conditional rendering in `TournamentDashboardPage`. All data derived from existing `useTournamentLive` signals — no new Firestore queries.

**Tech Stack:** SolidJS 1.9, TypeScript, Tailwind CSS v4, Vitest

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

Run:
```bash
cd "C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp"
git checkout -b feature/layer3-wave-c
```
Expected: Switched to new branch `feature/layer3-wave-c`

---

### Task 2: Create `detectViewerRole` engine + tests

**Files:**
- Create: `src/features/tournaments/engine/roleDetection.ts`
- Create: `src/features/tournaments/engine/__tests__/roleDetection.test.ts`

**Context:** Pure function that determines the viewer's role based on tournament data, userId, and registrations. Used to conditionally render sections in the dashboard.

**Step 1: Write the failing tests**

Create `src/features/tournaments/engine/__tests__/roleDetection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectViewerRole } from '../roleDetection';
import type { Tournament, TournamentRegistration } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  name: 'Test',
  date: Date.now(),
  location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'org-1',
  scorekeeperIds: ['sk-1', 'sk-2'],
  status: 'registration',
  maxPlayers: null,
  teamFormation: null,
  minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null,
  cancellationReason: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visibility: 'private',
  shareCode: null,
  ...overrides,
});

const makeReg = (userId: string): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  playerName: userId,
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
});

describe('detectViewerRole', () => {
  it('returns organizer when userId matches organizerId', () => {
    expect(detectViewerRole(makeTournament(), 'org-1', [])).toBe('organizer');
  });

  it('returns scorekeeper when userId is in scorekeeperIds', () => {
    expect(detectViewerRole(makeTournament(), 'sk-1', [])).toBe('scorekeeper');
  });

  it('returns player when userId has a registration', () => {
    const regs = [makeReg('player-1')];
    expect(detectViewerRole(makeTournament(), 'player-1', regs)).toBe('player');
  });

  it('returns spectator when userId is null', () => {
    expect(detectViewerRole(makeTournament(), null, [])).toBe('spectator');
  });

  it('returns spectator when userId has no role', () => {
    expect(detectViewerRole(makeTournament(), 'random-user', [])).toBe('spectator');
  });

  it('organizer takes priority over scorekeeper', () => {
    const t = makeTournament({ scorekeeperIds: ['org-1'] });
    expect(detectViewerRole(t, 'org-1', [])).toBe('organizer');
  });

  it('scorekeeper takes priority over player', () => {
    const regs = [makeReg('sk-1')];
    expect(detectViewerRole(makeTournament(), 'sk-1', regs)).toBe('scorekeeper');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/tournaments/engine/roleDetection.ts`:

```typescript
import type { Tournament, TournamentRegistration } from '../../../data/types';

export type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator';

export function detectViewerRole(
  tournament: Tournament,
  userId: string | null,
  registrations: TournamentRegistration[],
): ViewerRole {
  if (!userId) return 'spectator';
  if (tournament.organizerId === userId) return 'organizer';
  if (tournament.scorekeeperIds.includes(userId)) return 'scorekeeper';
  if (registrations.some((r) => r.userId === userId)) return 'player';
  return 'spectator';
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/roleDetection.ts src/features/tournaments/engine/__tests__/roleDetection.test.ts
git commit -m "feat: add detectViewerRole engine with 7 tests"
```

---

### Task 3: Create `getPlayerMatches` and `getPlayerStats` engine + tests

**Files:**
- Create: `src/features/tournaments/engine/playerStats.ts`
- Create: `src/features/tournaments/engine/__tests__/playerStats.test.ts`

**Context:** Pure functions that derive a player's match schedule and stats from existing tournament data (pools, bracket, teams, registrations). No additional Firestore queries needed — everything is derived from the `useTournamentLive` signals already available.

**Step 1: Write the failing tests**

Create `src/features/tournaments/engine/__tests__/playerStats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPlayerTeamId, getPlayerMatches, getPlayerStats } from '../playerStats';
import type { TournamentRegistration, TournamentTeam, TournamentPool, BracketSlot, PoolStanding } from '../../../../data/types';

const makeReg = (userId: string, teamId: string | null = null): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  playerName: userId,
  teamId,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
});

const makeTeam = (id: string, playerIds: string[]): TournamentTeam => ({
  id,
  tournamentId: 't1',
  name: `Team ${id}`,
  playerIds,
  seed: null,
  poolId: null,
});

const makePool = (teamIds: string[], standings: PoolStanding[], schedule: { team1Id: string; team2Id: string; matchId: string | null }[]): TournamentPool => ({
  id: 'pool-1',
  tournamentId: 't1',
  name: 'Pool A',
  teamIds,
  standings,
  schedule: schedule.map((s, i) => ({ round: i + 1, ...s, court: null })),
});

const makeSlot = (id: string, round: number, position: number, team1Id: string | null, team2Id: string | null, winnerId: string | null = null, matchId: string | null = null): BracketSlot => ({
  id,
  tournamentId: 't1',
  round,
  position,
  team1Id,
  team2Id,
  winnerId,
  matchId,
  nextSlotId: null,
});

describe('getPlayerTeamId', () => {
  it('returns teamId from registration', () => {
    const regs = [makeReg('u1', 'team-a')];
    const teams = [makeTeam('team-a', ['u1'])];
    expect(getPlayerTeamId('u1', regs, teams)).toBe('team-a');
  });

  it('finds teamId from team playerIds when registration has no teamId', () => {
    const regs = [makeReg('u1')];
    const teams = [makeTeam('team-a', ['u1', 'u2'])];
    expect(getPlayerTeamId('u1', regs, teams)).toBe('team-a');
  });

  it('returns null when player has no team', () => {
    const regs = [makeReg('u1')];
    expect(getPlayerTeamId('u1', regs, [])).toBeNull();
  });
});

describe('getPlayerMatches', () => {
  it('returns pool matches for the player team', () => {
    const pool = makePool(
      ['team-a', 'team-b', 'team-c'],
      [],
      [
        { team1Id: 'team-a', team2Id: 'team-b', matchId: 'm1' },
        { team1Id: 'team-a', team2Id: 'team-c', matchId: null },
        { team1Id: 'team-b', team2Id: 'team-c', matchId: null },
      ],
    );
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob', 'team-c': 'Charlie' };
    const result = getPlayerMatches('team-a', [pool], [], teamNames);
    expect(result).toHaveLength(2);
    expect(result[0].opponentName).toBe('Bob');
    expect(result[0].matchId).toBe('m1');
    expect(result[1].opponentName).toBe('Charlie');
    expect(result[1].matchId).toBeNull();
  });

  it('returns bracket matches for the player team', () => {
    const slots = [
      makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1'),
      makeSlot('s2', 1, 2, 'team-c', 'team-d', 'team-c', 'm2'),
      makeSlot('s3', 2, 1, 'team-a', 'team-c', null, null),
    ];
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob', 'team-c': 'Charlie', 'team-d': 'Diana' };
    const result = getPlayerMatches('team-a', [], slots, teamNames);
    expect(result).toHaveLength(2);
    expect(result[0].opponentName).toBe('Bob');
    expect(result[0].status).toBe('completed');
    expect(result[0].won).toBe(true);
    expect(result[1].opponentName).toBe('Charlie');
    expect(result[1].status).toBe('upcoming');
  });

  it('detects in-progress bracket match', () => {
    const slots = [makeSlot('s1', 1, 1, 'team-a', 'team-b', null, 'm1')];
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob' };
    const result = getPlayerMatches('team-a', [], slots, teamNames);
    expect(result[0].status).toBe('in-progress');
    expect(result[0].matchId).toBe('m1');
  });

  it('returns empty when team not in any matches', () => {
    const result = getPlayerMatches('team-x', [], [], {});
    expect(result).toHaveLength(0);
  });
});

describe('getPlayerStats', () => {
  it('returns stats from pool standings', () => {
    const standings: PoolStanding[] = [
      { teamId: 'team-a', wins: 2, losses: 1, pointsFor: 33, pointsAgainst: 25, pointDiff: 8 },
      { teamId: 'team-b', wins: 1, losses: 2, pointsFor: 25, pointsAgainst: 33, pointDiff: -8 },
    ];
    const pool = makePool(['team-a', 'team-b'], standings, []);
    const result = getPlayerStats('team-a', [pool], []);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.pointsFor).toBe(33);
    expect(result.pointsAgainst).toBe(25);
    expect(result.pointDiff).toBe(8);
  });

  it('adds bracket wins and losses', () => {
    const slots = [
      makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1'),
      makeSlot('s2', 2, 1, 'team-a', 'team-c', 'team-c', 'm2'),
    ];
    const result = getPlayerStats('team-a', [], slots);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });

  it('combines pool and bracket stats', () => {
    const standings: PoolStanding[] = [
      { teamId: 'team-a', wins: 2, losses: 0, pointsFor: 22, pointsAgainst: 10, pointDiff: 12 },
    ];
    const pool = makePool(['team-a', 'team-b'], standings, []);
    const slots = [makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1')];
    const result = getPlayerStats('team-a', [pool], slots);
    expect(result.wins).toBe(3); // 2 pool + 1 bracket
    expect(result.losses).toBe(0);
    expect(result.pointsFor).toBe(22);
  });

  it('returns zeroes when team has no matches', () => {
    const result = getPlayerStats('team-x', [], []);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.pointsFor).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/playerStats.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/tournaments/engine/playerStats.ts`:

```typescript
import type {
  TournamentRegistration,
  TournamentTeam,
  TournamentPool,
  BracketSlot,
} from '../../../data/types';

export interface PlayerMatchInfo {
  type: 'pool' | 'bracket';
  round: number;
  opponentTeamId: string;
  opponentName: string;
  status: 'upcoming' | 'in-progress' | 'completed';
  matchId: string | null;
  won: boolean | null;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export function getPlayerTeamId(
  userId: string,
  registrations: TournamentRegistration[],
  teams: TournamentTeam[],
): string | null {
  const reg = registrations.find((r) => r.userId === userId);
  if (reg?.teamId) return reg.teamId;
  const team = teams.find((t) => t.playerIds.includes(userId));
  return team?.id ?? null;
}

export function getPlayerMatches(
  teamId: string,
  pools: TournamentPool[],
  bracket: BracketSlot[],
  teamNames: Record<string, string>,
): PlayerMatchInfo[] {
  const matches: PlayerMatchInfo[] = [];

  // Pool matches
  for (const pool of pools) {
    for (const entry of pool.schedule) {
      let opponentId: string | null = null;
      if (entry.team1Id === teamId) opponentId = entry.team2Id;
      else if (entry.team2Id === teamId) opponentId = entry.team1Id;
      if (!opponentId) continue;

      let status: 'upcoming' | 'in-progress' | 'completed';
      if (!entry.matchId) status = 'upcoming';
      else status = 'completed'; // Pool schedule entries don't track in-progress

      matches.push({
        type: 'pool',
        round: entry.round,
        opponentTeamId: opponentId,
        opponentName: teamNames[opponentId] ?? opponentId,
        status,
        matchId: entry.matchId,
        won: null, // Would need match data for pool result
      });
    }
  }

  // Bracket matches
  for (const slot of bracket) {
    let opponentId: string | null = null;
    if (slot.team1Id === teamId) opponentId = slot.team2Id;
    else if (slot.team2Id === teamId) opponentId = slot.team1Id;
    if (!opponentId) continue;

    let status: 'upcoming' | 'in-progress' | 'completed';
    let won: boolean | null = null;
    if (slot.winnerId) {
      status = 'completed';
      won = slot.winnerId === teamId;
    } else if (slot.matchId) {
      status = 'in-progress';
    } else {
      status = 'upcoming';
    }

    matches.push({
      type: 'bracket',
      round: slot.round,
      opponentTeamId: opponentId,
      opponentName: teamNames[opponentId] ?? opponentId,
      status,
      matchId: slot.matchId,
      won,
    });
  }

  return matches;
}

export function getPlayerStats(
  teamId: string,
  pools: TournamentPool[],
  bracket: BracketSlot[],
): PlayerStats {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  // Pool stats from standings
  for (const pool of pools) {
    const standing = pool.standings.find((s) => s.teamId === teamId);
    if (standing) {
      wins += standing.wins;
      losses += standing.losses;
      pointsFor += standing.pointsFor;
      pointsAgainst += standing.pointsAgainst;
    }
  }

  // Bracket stats from slots
  for (const slot of bracket) {
    if (!slot.winnerId) continue;
    if (slot.team1Id !== teamId && slot.team2Id !== teamId) continue;
    if (slot.winnerId === teamId) wins++;
    else losses++;
  }

  return {
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/playerStats.test.ts`
Expected: 11 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/playerStats.ts src/features/tournaments/engine/__tests__/playerStats.test.ts
git commit -m "feat: add playerStats engine (getPlayerTeamId, getPlayerMatches, getPlayerStats) with 11 tests"
```

---

### Task 4: Create `MyMatchesSection` component

**Files:**
- Create: `src/features/tournaments/components/MyMatchesSection.tsx`

**Context:** Shows the player's personal match schedule. Lists pool and bracket matches with opponent name, status (upcoming/live/completed), and result. Uses LiveScoreCard for in-progress bracket matches.

**Step 1: Create the component**

Create `src/features/tournaments/components/MyMatchesSection.tsx`:

```typescript
import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { PlayerMatchInfo } from '../engine/playerStats';
import LiveScoreCard from './LiveScoreCard';

interface Props {
  matches: PlayerMatchInfo[];
  teamNames: Record<string, string>;
  playerTeamName: string;
}

const MyMatchesSection: Component<Props> = (props) => {
  const upcoming = () => props.matches.filter((m) => m.status === 'upcoming');
  const inProgress = () => props.matches.filter((m) => m.status === 'in-progress');
  const completed = () => props.matches.filter((m) => m.status === 'completed');

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">My Matches</h2>

      {/* In-progress matches */}
      <Show when={inProgress().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Now Playing</div>
          <For each={inProgress()}>
            {(match) => (
              <Show when={match.matchId} fallback={
                <div class="bg-surface-light rounded-xl p-3 text-sm text-on-surface">
                  vs {match.opponentName} — <span class="text-red-400 font-semibold">LIVE</span>
                </div>
              }>
                <LiveScoreCard
                  matchId={match.matchId!}
                  team1Name={props.playerTeamName}
                  team2Name={match.opponentName}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>

      {/* Upcoming matches */}
      <Show when={upcoming().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Upcoming</div>
          <For each={upcoming()}>
            {(match) => (
              <div class="bg-surface-light rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-on-surface">
                  vs {match.opponentName}
                </span>
                <span class="text-xs text-on-surface-muted">
                  {match.type === 'pool' ? `Pool R${match.round}` : `Bracket R${match.round}`}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Completed matches */}
      <Show when={completed().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Completed</div>
          <For each={completed()}>
            {(match) => (
              <div class="bg-surface-light rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-on-surface">
                  vs {match.opponentName}
                </span>
                <Show when={match.won !== null}>
                  <span class={`text-xs font-semibold ${match.won ? 'text-green-400' : 'text-red-400'}`}>
                    {match.won ? 'WIN' : 'LOSS'}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.matches.length === 0}>
        <div class="bg-surface-light rounded-xl p-4 text-center">
          <p class="text-on-surface-muted text-sm">No matches scheduled yet.</p>
        </div>
      </Show>
    </div>
  );
};

export default MyMatchesSection;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/MyMatchesSection.tsx
git commit -m "feat: add MyMatchesSection component for player match schedule"
```

---

### Task 5: Create `MyStatsCard` component

**Files:**
- Create: `src/features/tournaments/components/MyStatsCard.tsx`

**Context:** Compact stats card showing W/L record, points for/against, and point differential.

**Step 1: Create the component**

Create `src/features/tournaments/components/MyStatsCard.tsx`:

```typescript
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { PlayerStats } from '../engine/playerStats';

interface Props {
  stats: PlayerStats;
  playerTeamName: string;
}

const MyStatsCard: Component<Props> = (props) => {
  const hasPoolStats = () => props.stats.pointsFor > 0 || props.stats.pointsAgainst > 0;

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">My Stats</h2>
      <div class="bg-surface-light rounded-xl p-4 space-y-3">
        <div class="text-sm font-semibold text-on-surface">{props.playerTeamName}</div>

        {/* W/L Record */}
        <div class="flex items-center gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-400">{props.stats.wins}</div>
            <div class="text-xs text-on-surface-muted uppercase">Wins</div>
          </div>
          <div class="text-on-surface-muted text-lg">-</div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-400">{props.stats.losses}</div>
            <div class="text-xs text-on-surface-muted uppercase">Losses</div>
          </div>
        </div>

        {/* Points (only show if pool data available) */}
        <Show when={hasPoolStats()}>
          <div class="border-t border-surface-lighter pt-3">
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="text-lg font-bold text-on-surface">{props.stats.pointsFor}</div>
                <div class="text-xs text-on-surface-muted">Points For</div>
              </div>
              <div>
                <div class="text-lg font-bold text-on-surface">{props.stats.pointsAgainst}</div>
                <div class="text-xs text-on-surface-muted">Points Against</div>
              </div>
              <div>
                <div class={`text-lg font-bold ${props.stats.pointDiff > 0 ? 'text-green-400' : props.stats.pointDiff < 0 ? 'text-red-400' : 'text-on-surface-muted'}`}>
                  {props.stats.pointDiff > 0 ? '+' : ''}{props.stats.pointDiff}
                </div>
                <div class="text-xs text-on-surface-muted">Diff</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default MyStatsCard;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/MyStatsCard.tsx
git commit -m "feat: add MyStatsCard component for player W/L record and points"
```

---

### Task 6: Create `ScorekeeperMatchList` component

**Files:**
- Create: `src/features/tournaments/components/ScorekeeperMatchList.tsx`

**Context:** Lists all unscored matches that a scorekeeper can tap to start scoring. Shows pool matches (no matchId) and bracket matches (no winnerId, both teams present). MVP: any scorekeeper can score any match.

**Step 1: Create the component**

Create `src/features/tournaments/components/ScorekeeperMatchList.tsx`:

```typescript
import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentPool, BracketSlot } from '../../../data/types';

interface ScoreableMatch {
  type: 'pool' | 'bracket';
  label: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  poolId?: string;
  slotId?: string;
}

interface Props {
  pools: TournamentPool[];
  bracket: BracketSlot[];
  teamNames: Record<string, string>;
  onScorePoolMatch: (poolId: string, team1Id: string, team2Id: string) => void;
  onScoreBracketMatch: (slotId: string, team1Id: string, team2Id: string) => void;
}

const ScorekeeperMatchList: Component<Props> = (props) => {
  const scoreableMatches = () => {
    const matches: ScoreableMatch[] = [];

    // Pool matches without a matchId (not yet scored)
    for (const pool of props.pools) {
      for (const entry of pool.schedule) {
        if (!entry.matchId) {
          matches.push({
            type: 'pool',
            label: `${pool.name} R${entry.round}`,
            team1Id: entry.team1Id,
            team2Id: entry.team2Id,
            team1Name: props.teamNames[entry.team1Id] ?? entry.team1Id,
            team2Name: props.teamNames[entry.team2Id] ?? entry.team2Id,
            poolId: pool.id,
          });
        }
      }
    }

    // Bracket matches with both teams but no winner
    for (const slot of props.bracket) {
      if (slot.team1Id && slot.team2Id && !slot.winnerId && !slot.matchId) {
        const totalRounds = Math.max(...props.bracket.map((s) => s.round), 0);
        let label: string;
        if (slot.round === totalRounds) label = 'Final';
        else if (slot.round === totalRounds - 1) label = 'Semifinal';
        else label = `Round ${slot.round}`;

        matches.push({
          type: 'bracket',
          label,
          team1Id: slot.team1Id,
          team2Id: slot.team2Id,
          team1Name: props.teamNames[slot.team1Id] ?? slot.team1Id,
          team2Name: props.teamNames[slot.team2Id] ?? slot.team2Id,
          slotId: slot.id,
        });
      }
    }

    return matches;
  };

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">Matches to Score</h2>
      <Show when={scoreableMatches().length > 0} fallback={
        <div class="bg-surface-light rounded-xl p-4 text-center">
          <p class="text-on-surface-muted text-sm">No matches waiting to be scored.</p>
        </div>
      }>
        <div class="space-y-2">
          <For each={scoreableMatches()}>
            {(match) => (
              <button
                type="button"
                onClick={() => {
                  if (match.type === 'pool' && match.poolId) {
                    props.onScorePoolMatch(match.poolId, match.team1Id, match.team2Id);
                  } else if (match.type === 'bracket' && match.slotId) {
                    props.onScoreBracketMatch(match.slotId, match.team1Id, match.team2Id);
                  }
                }}
                class="w-full bg-surface-light rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div class="text-left">
                  <div class="text-sm font-semibold text-on-surface">
                    {match.team1Name} vs {match.team2Name}
                  </div>
                  <div class="text-xs text-on-surface-muted">{match.label}</div>
                </div>
                <span class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary">
                  Score
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ScorekeeperMatchList;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/ScorekeeperMatchList.tsx
git commit -m "feat: add ScorekeeperMatchList component for scoreable match list"
```

---

### Task 7: Wire role detection into TournamentDashboardPage

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Context:** Add role detection and conditionally render role-specific sections. The organizer controls already exist behind `isOrganizer()` checks — now add player and scorekeeper sections.

**Step 1: Add imports**

Add after the existing imports (line 36):
```typescript
import { detectViewerRole } from './engine/roleDetection';
import type { ViewerRole } from './engine/roleDetection';
import { getPlayerTeamId, getPlayerMatches, getPlayerStats } from './engine/playerStats';
import MyMatchesSection from './components/MyMatchesSection';
import MyStatsCard from './components/MyStatsCard';
import ScorekeeperMatchList from './components/ScorekeeperMatchList';
```

**Step 2: Add role and player derived state**

After the existing `isOrganizer` memo (line 99), add:
```typescript
  const role = createMemo<ViewerRole>(() => {
    const t = live.tournament();
    const u = user();
    if (!t) return 'spectator';
    return detectViewerRole(t, u?.uid ?? null, live.registrations());
  });

  const playerTeamId = createMemo(() => {
    const u = user();
    if (!u) return null;
    return getPlayerTeamId(u.uid, live.registrations(), live.teams());
  });

  const playerMatches = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return [];
    return getPlayerMatches(tid, live.pools(), live.bracket(), teamNames());
  });

  const playerStats = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
    return getPlayerStats(tid, live.pools(), live.bracket());
  });

  const playerTeamName = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return '';
    return teamNames()[tid] ?? '';
  });
```

**Step 3: Replace `isOrganizer()` usage**

The existing `isOrganizer()` function can stay for backward compatibility — it's equivalent to `role() === 'organizer'`. No need to change existing references.

**Step 4: Add role-specific sections in the render**

After the Registration section (after line ~608) and before the Tournament Results section, add:
```typescript
              {/* Player Dashboard (registered players only) */}
              <Show when={role() === 'player' && playerTeamId()}>
                <MyMatchesSection
                  matches={playerMatches()}
                  teamNames={teamNames()}
                  playerTeamName={playerTeamName()}
                />
                <MyStatsCard
                  stats={playerStats()}
                  playerTeamName={playerTeamName()}
                />
              </Show>

              {/* Scorekeeper Match List */}
              <Show when={role() === 'scorekeeper'}>
                <ScorekeeperMatchList
                  pools={live.pools()}
                  bracket={live.bracket()}
                  teamNames={teamNames()}
                  onScorePoolMatch={handleScorePoolMatch}
                  onScoreBracketMatch={handleScoreBracketMatch}
                />
              </Show>
```

**Step 5: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npx vitest run`
Expected: All tests pass (210 + 18 new = 228)

**Step 6: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire role detection and role-specific sections into dashboard"
```

---

### Task 8: E2E verification — role-based dashboards

**Prerequisites:** Dev server running, Firebase emulators running.

**Test scenario:**

**Phase 1: Player dashboard**
1. Sign in as organizer, create a single-elimination singles tournament
2. Add 4 players (Alice, Bob, Charlie, Diana)
3. Advance to bracket
4. Navigate to dashboard — verify organizer sees full controls (Share, Advance, etc.)
5. Score first semifinal (Alice wins)
6. Navigate back to dashboard
7. Verify "My Matches" section does NOT appear for organizer (organizer role, not player)

**Phase 2: Scorekeeper dashboard**
8. Verify scorekeeper section not visible for organizer
9. (Note: testing scorekeeper/player roles would require multi-user auth — defer to manual testing)

**Phase 3: Verify components render correctly**
10. Verify MyMatchesSection, MyStatsCard, ScorekeeperMatchList compile and render without errors via type check
11. Verify all tests pass (unit + integration)

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Create feature branch | None |
| 2 | `detectViewerRole` engine + 7 tests | Task 1 |
| 3 | `getPlayerMatches` + `getPlayerStats` engine + 11 tests | Task 1 |
| 4 | `MyMatchesSection` component | Task 3 |
| 5 | `MyStatsCard` component | Task 3 |
| 6 | `ScorekeeperMatchList` component | Task 1 |
| 7 | Wire into TournamentDashboardPage | Tasks 2-6 |
| 8 | E2E verification | Task 7 |
