# E2E Infrastructure Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden E2E test infrastructure so P1/P2 tests (131 remaining) don't repeat the 34-failure patterns from P0.

**Architecture:** Fix factory defaults to produce valid data, add Firestore path constants, build composite seeders that encapsulate correct multi-document setup, improve POMs for tournament scoring, add testUserUid fixture and test tags.

**Tech Stack:** Playwright, TypeScript, Firebase Firestore emulator REST API

---

### Task 1: Consolidate `toFirestoreFields` — delete duplicates

**Files:**
- Modify: `e2e/journeys/spectator/spectator-helpers.ts`
- Modify: `e2e/spectator/spectator.spec.ts`
- Reference: `e2e/helpers/emulator-auth.ts` (canonical — do not modify)

**Step 1: Update `spectator-helpers.ts`**

Delete the local `toFirestoreFields` function. Keep only `seedDoc`, importing `toFirestoreFields` from the canonical location. The file should become:

```typescript
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../../helpers/emulator-config';
import { seedFirestoreDocAdmin } from '../../helpers/emulator-auth';

// Re-export seedFirestoreDocAdmin as seedDoc for backward compatibility
export const seedDoc = async (path: string, data: Record<string, unknown>) => {
  const parts = path.split('/');
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join('/');
  await seedFirestoreDocAdmin(collectionPath, docId, data);
};
```

**Step 2: Update `spectator.spec.ts`**

Delete the inline `toFirestoreFields`, `seedDoc`, and `clearEmulator` functions (approximately lines 11-49). Replace with imports:

```typescript
import { seedFirestoreDocAdmin } from '../helpers/emulator-auth';
```

Update all `seedDoc(path, data)` calls in the file to use `seedFirestoreDocAdmin(collectionPath, docId, data)`.

**Step 3: Run existing P0 spectator tests to verify no regression**

Run: `npx playwright test --project=emulator e2e/journeys/spectator/ --workers=1`
Expected: All 6 spectator tests pass.

**Step 4: Commit**

```
fix(e2e): consolidate toFirestoreFields to single canonical implementation
```

---

### Task 2: Add Firestore path constants

**Files:**
- Create: `e2e/helpers/firestore-paths.ts`

**Step 1: Create the path constants file**

```typescript
// e2e/helpers/firestore-paths.ts
export const PATHS = {
  tournaments: 'tournaments',
  teams: (tournamentId: string) => `tournaments/${tournamentId}/teams`,
  pools: (tournamentId: string) => `tournaments/${tournamentId}/pools`,
  bracket: (tournamentId: string) => `tournaments/${tournamentId}/bracket`,
  matches: 'matches',
  spectatorProjection: (matchId: string) => `matches/${matchId}/public`,
  scoreEvents: (matchId: string) => `matches/${matchId}/scoreEvents`,
  buddyGroups: 'buddyGroups',
  buddyMembers: (groupId: string) => `buddyGroups/${groupId}/members`,
  gameSessions: 'gameSessions',
  rsvps: (sessionId: string) => `gameSessions/${sessionId}/rsvps`,
  users: 'users',
} as const;

/** Document ID for the spectator projection subdoc */
export const SPECTATOR_DOC_ID = 'spectator';
```

**Step 2: Commit**

```
feat(e2e): add Firestore path constants for compile-time safety
```

---

### Task 3: Fix factory defaults — status-driven `makePublicMatch`

**Files:**
- Modify: `e2e/helpers/factories.ts`
- Reference: `src/data/types.ts` (for Match, GameResult types)

**Step 1: Update `makePublicMatch`**

Add status-driven logic that auto-populates `lastSnapshot` for in-progress matches and `games`/`winningSide`/`completedAt` for completed matches. Import types where practical.

```typescript
export function makePublicMatch(ownerId: string, overrides: Record<string, unknown> = {}) {
  const status = (overrides.status as string) ?? 'in-progress';
  const team1Score = (overrides.team1Score as number) ?? 0;
  const team2Score = (overrides.team2Score as number) ?? 0;

  // Base fields
  const base = {
    id: uid('match'),
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team Alpha',
    team2Name: 'Team Beta',
    games: [] as Record<string, unknown>[],
    winningSide: null,
    status,
    startedAt: Date.now(),
    completedAt: null,
    ownerId,
    sharedWith: [],
    visibility: 'public',
    syncedAt: Date.now(),
  };

  // Status-driven co-fields
  if (status === 'in-progress') {
    base.lastSnapshot = JSON.stringify({
      team1Score,
      team2Score,
      gameNumber: 1,
    });
  } else if (status === 'completed') {
    const winScore = Math.max(team1Score, team2Score) || 11;
    const loseScore = Math.min(team1Score, team2Score) || 0;
    const winningSide = team1Score >= team2Score ? 1 : 2;
    base.games = [{
      gameNumber: 1,
      team1Score: winningSide === 1 ? winScore : loseScore,
      team2Score: winningSide === 2 ? winScore : loseScore,
      winningSide,
    }];
    base.winningSide = winningSide;
    base.completedAt = Date.now();
  }

  // Remove helper fields that aren't part of the document
  const { team1Score: _t1, team2Score: _t2, ...rest } = { ...base, ...overrides };
  return rest;
}
```

Note: `team1Score`/`team2Score` are used to compute `lastSnapshot` and `games` but are NOT stored as top-level fields on the match doc. They're extracted from overrides and removed from the final object.

**Step 2: Update `makeTournament` config defaults**

Change the `config` default from the incomplete scheduling config to include match config fields:

```typescript
config: {
  gameType: 'singles',
  scoringMode: 'rally',
  matchFormat: 'single',
  pointsToWin: 11,
  poolCount: 1,
  teamsPerPoolAdvancing: 2,
},
```

**Step 3: Update `makeMatchRefSeed` default**

Change `scoringMode: 'sideout'` to `scoringMode: 'rally'` in the data defaults.

**Step 4: Run all P0 tests to verify no regression**

Run: `npx playwright test --project=emulator e2e/journeys/ --workers=1`
Expected: All 48 tests pass.

**Step 5: Commit**

```
feat(e2e): status-driven factory defaults with correct co-fields
```

---

### Task 4: Add `testUserUid` fixture

**Files:**
- Modify: `e2e/fixtures.ts`

**Step 1: Add the fixture**

Add `testUserUid` to the `E2EFixtures` type and the `test.extend` call:

```typescript
import { signInAsTestUser, getCurrentUserUid } from './helpers/emulator-auth';

type E2EFixtures = {
  testUserEmail: string;
  authenticatedPage: Page;
  secondAuthenticatedPage: Page;
  /** The UID of the authenticated test user. */
  testUserUid: string;
};

export const test = base.extend<E2EFixtures>({
  // ... existing fixtures unchanged ...

  testUserUid: async ({ authenticatedPage }, use) => {
    const uid = await getCurrentUserUid(authenticatedPage);
    await use(uid);
  },
});
```

**Step 2: Verify one existing test still works**

Run: `npx playwright test --project=emulator "e2e/journeys/organizer/advance-guards.spec.ts:12" --workers=1`
Expected: PASS (fixture is additive, doesn't break existing tests).

**Step 3: Commit**

```
feat(e2e): add testUserUid fixture to eliminate getCurrentUserUid boilerplate
```

---

### Task 5: Build composite seeders

**Files:**
- Create: `e2e/helpers/seeders.ts`

This is the largest task. Build all 7 seeders with typed options, JSDoc routing guidance, and fixed default team names.

**Step 1: Create `e2e/helpers/seeders.ts` with all seeders**

```typescript
// e2e/helpers/seeders.ts
import { seedFirestoreDocAdmin } from './emulator-auth';
import { PATHS, SPECTATOR_DOC_ID } from './firestore-paths';
import {
  uid, shareCode,
  makeTournament, makeTeam, makePool, makeBracketSlot,
  makePublicMatch, makeSpectatorProjection, makeScoreEvent,
  makeBuddyGroup, makeGameSession,
} from './factories';

const DEFAULT_TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

// ── Types ──────────────────────────────────────────────────────────

interface PoolPlayOptions {
  teamCount?: number;
  poolCount?: number;
  teamNames?: string[];
  scoringMode?: 'rally' | 'sideout';
  gameType?: 'singles' | 'doubles';
  format?: 'round-robin' | 'pool-bracket';
  withCompletedMatch?: boolean;
  tournamentOverrides?: Record<string, unknown>;
}

interface PoolPlaySeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  pools: Record<string, unknown>[];
  teamNames: string[];
  shareCode: string;
}

interface BracketOptions {
  teamCount?: number;
  teamNames?: string[];
  tournamentOverrides?: Record<string, unknown>;
}

interface BracketSeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  slotIds: string[];
  shareCode: string;
}

interface RegistrationOptions {
  teamCount?: number;
  teamNames?: string[];
  accessMode?: 'open' | 'approval';
  tournamentOverrides?: Record<string, unknown>;
}

interface RegistrationSeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  shareCode: string;
}

interface ScorekeeperOptions extends PoolPlayOptions {
  role?: string;
}

interface ScorekeeperSeed extends PoolPlaySeed {
  role: string;
}

interface SpectatorMatchOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  team1Score?: number;
  team2Score?: number;
  withEvents?: boolean;
  matchOverrides?: Record<string, unknown>;
}

interface SpectatorMatchSeed {
  matchId: string;
  tournamentId: string;
  shareCode: string;
}

interface BuddyGroupOptions {
  name?: string;
  description?: string;
  defaultLocation?: string;
  displayName?: string;
}

interface BuddyGroupSeed {
  groupId: string;
  group: Record<string, unknown>;
  shareCode: string;
}

interface GameSessionOptions extends BuddyGroupOptions {
  sessionTitle?: string;
  sessionLocation?: string;
  status?: string;
  visibility?: string;
  spotsTotal?: number;
  rsvpStyle?: string;
  sessionOverrides?: Record<string, unknown>;
}

interface GameSessionSeed extends BuddyGroupSeed {
  sessionId: string;
  session: Record<string, unknown>;
}

// ── Seeders ────────────────────────────────────────────────────────

/**
 * Seeds a pool-play tournament with teams, pools, schedule, and standings.
 *
 * Use when: testing pool standings, match scheduling, advance-to-bracket, pool scoring.
 * NOT for: bracket-only tests (use seedBracketTournament), spectator match detail (use seedSpectatorMatch).
 */
export async function seedPoolPlayTournament(userUid: string, opts: PoolPlayOptions = {}): Promise<PoolPlaySeed> {
  const teamCount = opts.teamCount ?? 4;
  const poolCount = opts.poolCount ?? 1;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'pool-play',
    format: opts.format ?? 'round-robin',
    shareCode: code,
    config: {
      gameType: opts.gameType ?? 'singles',
      scoringMode: opts.scoringMode ?? 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount,
      teamsPerPoolAdvancing: 2,
    },
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  // Create teams
  const teams: Record<string, unknown>[] = [];
  const teamsPerPool = Math.ceil(teamCount / poolCount);

  for (let i = 0; i < teamCount; i++) {
    const poolIndex = Math.floor(i / teamsPerPool);
    const poolId = `pool-${poolIndex}`;
    const team = makeTeam({
      tournamentId,
      name: names[i],
      playerIds: [`player-${i}`],
      poolId,
    });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  // Create pools with schedule and standings
  const pools: Record<string, unknown>[] = [];
  for (let p = 0; p < poolCount; p++) {
    const poolTeams = teams.filter((t: any) => t.poolId === `pool-${p}`);
    const poolTeamIds = poolTeams.map((t: any) => t.id);

    // Build round-robin schedule
    const schedule: Record<string, unknown>[] = [];
    for (let i = 0; i < poolTeamIds.length; i++) {
      for (let j = i + 1; j < poolTeamIds.length; j++) {
        schedule.push({
          team1Id: poolTeamIds[i],
          team2Id: poolTeamIds[j],
          matchId: opts.withCompletedMatch && i === 0 && j === 1 ? uid('match') : null,
          round: schedule.length + 1,
          court: null,
        });
      }
    }

    // Build standings
    const standings = poolTeams.map((t: any) => ({
      teamId: t.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    }));

    const pool = makePool({
      id: `pool-${p}`,
      tournamentId,
      name: `Pool ${String.fromCharCode(65 + p)}`,
      teamIds: poolTeamIds,
      schedule,
      standings,
    });
    await seedFirestoreDocAdmin(PATHS.pools(tournamentId), pool.id as string, pool);
    pools.push(pool);
  }

  return { tournamentId, tournament, teams, pools, teamNames: names, shareCode: code };
}

/**
 * Seeds a bracket tournament with teams and bracket slots.
 *
 * Use when: testing bracket display, advance-to-completed, bracket scoring.
 * NOT for: pool-play tests (use seedPoolPlayTournament).
 */
export async function seedBracketTournament(userUid: string, opts: BracketOptions = {}): Promise<BracketSeed> {
  const teamCount = opts.teamCount ?? 4;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'bracket',
    format: 'single-elimination',
    shareCode: code,
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 0,
      teamsPerPoolAdvancing: 0,
    },
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  const teams: Record<string, unknown>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({ tournamentId, name: names[i], playerIds: [`player-${i}`] });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  // Create bracket slots for first round
  const slotIds: string[] = [];
  const slotCount = Math.floor(teamCount / 2);
  for (let i = 0; i < slotCount; i++) {
    const slotId = uid('slot');
    const slot = makeBracketSlot({
      id: slotId,
      tournamentId,
      round: 1,
      position: i + 1,
      team1Id: (teams[i * 2] as any).id,
      team2Id: (teams[i * 2 + 1] as any).id,
    });
    await seedFirestoreDocAdmin(PATHS.bracket(tournamentId), slotId, slot);
    slotIds.push(slotId);
  }

  return { tournamentId, tournament, teams, slotIds, shareCode: code };
}

/**
 * Seeds a tournament in registration phase with optional pre-registered teams.
 *
 * Use when: testing registration flow, join/leave, player caps, approval queue.
 * NOT for: pool-play or bracket display (use the phase-specific seeders).
 */
export async function seedRegistrationTournament(userUid: string, opts: RegistrationOptions = {}): Promise<RegistrationSeed> {
  const teamCount = opts.teamCount ?? 0;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'registration',
    format: 'round-robin',
    shareCode: code,
    accessMode: opts.accessMode ?? 'open',
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  const teams: Record<string, unknown>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({ tournamentId, name: names[i], playerIds: [`player-${i}`] });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  return { tournamentId, tournament, teams, shareCode: code };
}

/**
 * Seeds a pool-play tournament where the given user is a staff member (scorekeeper by default).
 *
 * Use when: testing scorekeeper dashboard, staff permissions, match scoring from tournament.
 * NOT for: organizer tests (organizer = the user who owns the tournament, use seedPoolPlayTournament).
 */
export async function seedScorekeeperTournament(userUid: string, opts: ScorekeeperOptions = {}): Promise<ScorekeeperSeed> {
  const role = opts.role ?? 'scorekeeper';
  const seed = await seedPoolPlayTournament('other-organizer', {
    ...opts,
    tournamentOverrides: {
      staff: { [userUid]: role },
      staffUids: [userUid],
      ...opts.tournamentOverrides,
    },
  });
  return { ...seed, role };
}

/**
 * Seeds a match with spectator projection and optional score events.
 * Auto-populates `lastSnapshot` so `extractLiveScore` reads correct scores.
 *
 * Use when: testing spectator scoreboard, play-by-play, match detail page.
 * NOT for: casual scoring tests (those create matches through UI).
 */
export async function seedSpectatorMatch(userUid: string, opts: SpectatorMatchOptions = {}): Promise<SpectatorMatchSeed> {
  const tournamentId = opts.tournamentId ?? uid('tournament');
  const matchId = uid('match');
  const code = shareCode();
  const team1Name = opts.team1Name ?? 'Alpha';
  const team2Name = opts.team2Name ?? 'Bravo';
  const team1Score = opts.team1Score ?? 0;
  const team2Score = opts.team2Score ?? 0;

  // Seed tournament if not provided
  if (!opts.tournamentId) {
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid,
      shareCode: code,
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);
  }

  // Seed match with lastSnapshot
  const match = makePublicMatch(userUid, {
    id: matchId,
    tournamentId,
    team1Name,
    team2Name,
    status: 'in-progress',
    team1Score,
    team2Score,
    ...opts.matchOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);

  // Seed spectator projection
  const projection = makeSpectatorProjection({
    publicTeam1Name: team1Name,
    publicTeam2Name: team2Name,
    team1Score,
    team2Score,
    gameNumber: 1,
    status: 'in-progress',
    visibility: 'public',
    tournamentId,
    tournamentShareCode: code,
  });
  await seedFirestoreDocAdmin(PATHS.spectatorProjection(matchId), SPECTATOR_DOC_ID, projection);

  // Seed score events if requested
  if (opts.withEvents) {
    const events = [
      makeScoreEvent(matchId, { team: 1, team1Score: 1, team2Score: 0, timestamp: Date.now() - 30000, visibility: 'public' }),
      makeScoreEvent(matchId, { team: 2, team1Score: 1, team2Score: 1, timestamp: Date.now() - 20000, visibility: 'public' }),
      makeScoreEvent(matchId, { team: 1, team1Score: 2, team2Score: 1, timestamp: Date.now() - 10000, visibility: 'public' }),
    ];
    for (const event of events) {
      await seedFirestoreDocAdmin(PATHS.scoreEvents(matchId), event.id, event);
    }
  }

  return { matchId, tournamentId, shareCode: code };
}

/**
 * Seeds a buddy group with the given user as a member.
 *
 * Use when: testing buddy group detail, member list, session creation within a group.
 * NOT for: open-visibility sessions that don't require group membership.
 */
export async function seedBuddyGroupWithMember(userUid: string, opts: BuddyGroupOptions = {}): Promise<BuddyGroupSeed> {
  const groupId = uid('group');
  const code = shareCode();

  const group = makeBuddyGroup({
    id: groupId,
    name: opts.name ?? 'Test Group',
    description: opts.description ?? '',
    defaultLocation: opts.defaultLocation ?? null,
    shareCode: code,
    createdBy: userUid,
    memberCount: 1,
  });
  await seedFirestoreDocAdmin(PATHS.buddyGroups, groupId, group);

  await seedFirestoreDocAdmin(PATHS.buddyMembers(groupId), userUid, {
    displayName: opts.displayName ?? 'Test Player',
    photoURL: null,
    role: 'admin',
    joinedAt: Date.now(),
  });

  return { groupId, group, shareCode: code };
}

/**
 * Seeds a game session with the required buddy group membership for security rule access.
 * Only creates group/member docs when visibility is not 'open'.
 *
 * Use when: testing session detail, RSVP, voting, cancelled sessions.
 * NOT for: open play listing (seed session directly with visibility: 'open').
 */
export async function seedGameSessionWithAccess(userUid: string, opts: GameSessionOptions = {}): Promise<GameSessionSeed> {
  const visibility = opts.visibility ?? 'private';
  let groupId: string;
  let group: Record<string, unknown>;
  let groupShareCode: string;

  if (visibility === 'open') {
    groupId = uid('group');
    group = {};
    groupShareCode = '';
  } else {
    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: opts.name,
      description: opts.description,
      defaultLocation: opts.defaultLocation,
      displayName: opts.displayName,
    });
    groupId = groupSeed.groupId;
    group = groupSeed.group;
    groupShareCode = groupSeed.shareCode;
  }

  const sessionId = uid('session');
  const session = makeGameSession({
    id: sessionId,
    groupId,
    title: opts.sessionTitle ?? 'Test Session',
    location: opts.sessionLocation ?? 'Test Courts',
    status: opts.status ?? 'proposed',
    visibility,
    spotsTotal: opts.spotsTotal ?? 8,
    rsvpStyle: opts.rsvpStyle ?? 'simple',
    createdBy: userUid,
    shareCode: shareCode(),
    ...opts.sessionOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.gameSessions, sessionId, session);

  return { groupId, group, shareCode: groupShareCode, sessionId, session };
}
```

**Step 2: Run all P0 tests to verify seeders module loads without errors**

Run: `npx playwright test --project=emulator e2e/journeys/ --workers=1`
Expected: All 48 tests pass (seeders aren't used yet, but import resolution must work).

**Step 3: Commit**

```
feat(e2e): add composite seeders for P1/P2 test velocity
```

---

### Task 6: POM additions

**Files:**
- Modify: `e2e/pages/ScoringPage.ts`

**Step 1: Add `getTeamNames()` and `expectMatchCompleteAndSave()`**

Add to `ScoringPage` class:

```typescript
/** Read actual team names from the scoring button aria-labels. */
async getTeamNames(): Promise<{ team1: string; team2: string }> {
  const buttons = this.page.locator('button[aria-label^="Score point for"]');
  const label1 = await buttons.nth(0).getAttribute('aria-label');
  const label2 = await buttons.nth(1).getAttribute('aria-label');
  return {
    team1: label1!.replace('Score point for ', ''),
    team2: label2!.replace('Score point for ', ''),
  };
}

/** Assert match is over and click Save & Finish. */
async expectMatchCompleteAndSave() {
  await this.expectMatchOver();
  await expect(this.saveFinishBtn).toBeEnabled({ timeout: 5000 });
  await this.saveAndFinish();
}
```

**Step 2: Run casual scorer tests to verify no regression**

Run: `npx playwright test --project=emulator e2e/journeys/casual-scorer/ --workers=1`
Expected: All 9 casual scorer tests pass.

**Step 3: Commit**

```
feat(e2e): add getTeamNames and expectMatchCompleteAndSave to ScoringPage POM
```

---

### Task 7: Global setup hardening + test tags

**Files:**
- Modify: `e2e/global-setup.ts`
- Modify: All 18 journey spec files (add `@p0` tag to describe blocks)

**Step 1: Harden global setup**

Replace the `.catch(() => warn)` pattern with a hard failure:

```typescript
import { AUTH_EMULATOR, FIRESTORE_EMULATOR, PROJECT_ID } from './helpers/emulator-config';

export default async function globalSetup() {
  console.log('[global-setup] Clearing emulators...');
  const [authRes, firestoreRes] = await Promise.all([
    fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }),
    fetch(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
  ]);
  if (!authRes.ok || !firestoreRes.ok) {
    throw new Error(
      `Emulators not reachable. Start them first:\n` +
      `  npx firebase emulators:start --only auth,firestore\n` +
      `  Auth: ${authRes.status}, Firestore: ${firestoreRes.status}`
    );
  }
  console.log('[global-setup] Emulators cleared.');
}
```

**Step 2: Add `@p0` tag to all journey spec `describe` blocks**

For each of the 18 spec files under `e2e/journeys/`, prefix the `describe` name with `@p0`:

Example: `test.describe('Casual Scorer: Core Journeys', ...)` → `test.describe('@p0 Casual Scorer: Core Journeys', ...)`

**Step 3: Verify tags work**

Run: `npx playwright test --project=emulator --grep @p0 --workers=1 --reporter=list 2>&1 | tail -5`
Expected: `48 passed`

**Step 4: Commit**

```
feat(e2e): harden global-setup failure mode and add @p0 test tags
```

---

### Task 8: Validate seeders by migrating 2 P0 tests

**Files:**
- Modify: `e2e/journeys/staff/scorekeeper.spec.ts` (migrate inline `seedScorekeeperTournament`)
- Modify: `e2e/journeys/spectator/match-detail.spec.ts` (migrate manual match seeding)

**Step 1: Migrate `scorekeeper.spec.ts`**

Replace the 40-line inline `seedScorekeeperTournament` function with a call to the composite seeder:

```typescript
import { seedScorekeeperTournament } from '../../helpers/seeders';

// In each test:
const seed = await seedScorekeeperTournament(testUserUid);
await page.goto(`/tournaments/${seed.tournamentId}`);
```

Also switch from `getCurrentUserUid(page)` to the `testUserUid` fixture.

**Step 2: Migrate `match-detail.spec.ts`**

Replace manual tournament + match + projection + events seeding with:

```typescript
import { seedSpectatorMatch } from '../../helpers/seeders';

// Test 1: scoreboard scores
const seed = await seedSpectatorMatch('org-test', {
  team1Name: 'Smashers', team2Name: 'Dinkers',
  team1Score: 7, team2Score: 4,
});

// Test 2: play-by-play
const seed = await seedSpectatorMatch('org-test', {
  team1Name: 'Aces', team2Name: 'Volleys',
  team1Score: 3, team2Score: 2,
  withEvents: true,
});
```

**Step 3: Run migrated tests**

Run: `npx playwright test --project=emulator e2e/journeys/staff/scorekeeper.spec.ts e2e/journeys/spectator/match-detail.spec.ts --workers=1`
Expected: All 7 tests pass.

**Step 4: Run full P0 suite to verify no regression**

Run: `npx playwright test --project=emulator e2e/journeys/ --workers=1`
Expected: All 48 tests pass.

**Step 5: Commit**

```
refactor(e2e): migrate scorekeeper and match-detail specs to composite seeders
```
