# Pickleball Scoring App - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a PWA for live pickleball scoring with match history, player profiles, and statistics.

**Architecture:** SolidJS SPA with feature-based modules. XState v5 manages the scoring state machine, Zustand handles CRUD/UI state, Dexie.js provides IndexedDB persistence. Event sourcing captures every scoring action for undo/redo and crash recovery.

**Tech Stack:** SolidJS, TypeScript, Vite 6, Tailwind CSS v4, XState v5, Zustand, Dexie.js, vite-plugin-pwa, @solidjs/router, Vitest

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/index.tsx`, `src/app/App.tsx`
- Create: `tailwind.css`, `postcss.config.js`

**Step 1: Scaffold Vite + SolidJS project**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp
npm create vite@latest . -- --template solid-ts
```

Select: SolidJS, TypeScript when prompted. If the directory is not empty, confirm overwrite.

**Step 2: Install core dependencies**

```bash
npm install
npm install @solidjs/router dexie xstate @xstate/solid zustand lucide-solid
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa vitest @solidjs/testing-library jsdom @testing-library/jest-dom
```

**Step 3: Configure Tailwind CSS v4**

Replace `src/index.css` (or `src/App.css` — whichever Vite created) with a single `src/styles.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary: #22c55e;
  --color-primary-dark: #16a34a;
  --color-accent: #f97316;
  --color-surface: #1e1e2e;
  --color-surface-light: #2a2a3e;
  --color-surface-lighter: #363650;
  --color-on-surface: #e2e8f0;
  --color-on-surface-muted: #94a3b8;
  --color-score: #facc15;
  --color-error: #ef4444;
}
```

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pickle Score',
        short_name: 'PickleScore',
        description: 'Live pickleball scoring and match tracking',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
});
```

**Step 4: Configure Vitest**

Add to `vite.config.ts` (merge with existing):

```typescript
// Add at top:
/// <reference types="vitest/config" />

// Add to defineConfig:
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    deps: {
      optimizer: {
        web: {
          include: ['solid-js', '@solidjs/router'],
        },
      },
    },
  },
```

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Update `tsconfig.json` — add to `compilerOptions`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**Step 5: Create app entry point**

Update `src/index.tsx`:

```tsx
import { render } from 'solid-js/web';
import './styles.css';
import App from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => <App />, root);
```

Create `src/app/App.tsx`:

```tsx
import { Component } from 'solid-js';

const App: Component = () => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <h1 class="text-4xl font-bold text-center py-8 text-primary">
        Pickle Score
      </h1>
      <p class="text-center text-on-surface-muted">
        Live pickleball scoring
      </p>
    </div>
  );
};

export default App;
```

**Step 6: Verify everything works**

```bash
npm run dev
```

Expected: Dark-themed page with green "Pickle Score" heading at `http://localhost:5173`.

```bash
npx vitest run
```

Expected: Test runner works (0 tests found is fine).

**Step 7: Initialize git and commit**

```bash
git init
git add .
git commit -m "feat: scaffold SolidJS + Vite + Tailwind + PWA project"
```

---

## Task 2: Database Schema & Repositories

**Files:**
- Create: `src/data/db.ts`
- Create: `src/data/types.ts`
- Create: `src/data/repositories/matchRepository.ts`
- Create: `src/data/repositories/playerRepository.ts`
- Create: `src/data/repositories/scoreEventRepository.ts`
- Test: `src/data/repositories/__tests__/matchRepository.test.ts`
- Test: `src/data/repositories/__tests__/playerRepository.test.ts`

**Step 1: Define data types**

Create `src/data/types.ts`:

```typescript
export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameType = 'singles' | 'doubles';

export interface Player {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface MatchConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: 11 | 15 | 21;
}

export interface GameResult {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
  winningSide: 1 | 2;
}

export interface Match {
  id: string;
  config: MatchConfig;
  team1PlayerIds: string[];   // empty array for anonymous
  team2PlayerIds: string[];
  team1Name: string;
  team2Name: string;
  games: GameResult[];
  winningSide: 1 | 2 | null;  // null if in-progress/abandoned
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
}

export interface ScoreEvent {
  id: string;
  matchId: string;
  gameNumber: number;
  timestamp: number;
  type: 'POINT_SCORED' | 'SIDE_OUT' | 'FAULT' | 'UNDO';
  team: 1 | 2;
  serverNumber?: 1 | 2;
  team1Score: number;        // score AFTER this event
  team2Score: number;
  metadata?: Record<string, unknown>;  // for detailed mode: point type, error type, etc.
}
```

**Step 2: Define Dexie database**

Create `src/data/db.ts`:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { Match, Player, ScoreEvent } from './types';

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
};

db.version(1).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
});

export { db };
```

**Step 3: Write failing tests for matchRepository**

Create `src/data/repositories/__tests__/matchRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { matchRepository } from '../matchRepository';
import { db } from '../../db';
import type { Match, MatchConfig } from '../../types';

const testConfig: MatchConfig = {
  gameType: 'singles',
  scoringMode: 'rally',
  matchFormat: 'single',
  pointsToWin: 11,
};

function createTestMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: crypto.randomUUID(),
    config: testConfig,
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe('matchRepository', () => {
  beforeEach(async () => {
    await db.matches.clear();
  });

  it('saves and retrieves a match by id', async () => {
    const match = createTestMatch();
    await matchRepository.save(match);
    const result = await matchRepository.getById(match.id);
    expect(result).toEqual(match);
  });

  it('returns undefined for non-existent match', async () => {
    const result = await matchRepository.getById('non-existent');
    expect(result).toBeUndefined();
  });

  it('lists all matches ordered by startedAt descending', async () => {
    const older = createTestMatch({ startedAt: 1000 });
    const newer = createTestMatch({ startedAt: 2000 });
    await matchRepository.save(older);
    await matchRepository.save(newer);

    const all = await matchRepository.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].startedAt).toBe(2000);
    expect(all[1].startedAt).toBe(1000);
  });

  it('lists completed matches only', async () => {
    const inProgress = createTestMatch({ status: 'in-progress' });
    const completed = createTestMatch({ status: 'completed' });
    await matchRepository.save(inProgress);
    await matchRepository.save(completed);

    const result = await matchRepository.getCompleted();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(completed.id);
  });

  it('deletes a match', async () => {
    const match = createTestMatch();
    await matchRepository.save(match);
    await matchRepository.delete(match.id);
    const result = await matchRepository.getById(match.id);
    expect(result).toBeUndefined();
  });
});
```

**Step 4: Run tests to verify they fail**

```bash
npx vitest run src/data/repositories/__tests__/matchRepository.test.ts
```

Expected: FAIL — module not found.

**Step 5: Implement matchRepository**

Create `src/data/repositories/matchRepository.ts`:

```typescript
import { db } from '../db';
import type { Match } from '../types';

export const matchRepository = {
  async save(match: Match): Promise<void> {
    await db.matches.put(match);
  },

  async getById(id: string): Promise<Match | undefined> {
    return db.matches.get(id);
  },

  async getAll(): Promise<Match[]> {
    return db.matches.orderBy('startedAt').reverse().toArray();
  },

  async getCompleted(): Promise<Match[]> {
    return db.matches
      .where('status')
      .equals('completed')
      .reverse()
      .sortBy('startedAt');
  },

  async getByPlayerId(playerId: string): Promise<Match[]> {
    const t1 = await db.matches.where('team1PlayerIds').equals(playerId).toArray();
    const t2 = await db.matches.where('team2PlayerIds').equals(playerId).toArray();
    const merged = [...t1, ...t2];
    merged.sort((a, b) => b.startedAt - a.startedAt);
    return merged;
  },

  async delete(id: string): Promise<void> {
    await db.matches.delete(id);
  },
};
```

**Step 6: Run tests to verify they pass**

```bash
npx vitest run src/data/repositories/__tests__/matchRepository.test.ts
```

Expected: All 5 tests PASS.

**Step 7: Write failing tests for playerRepository**

Create `src/data/repositories/__tests__/playerRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { playerRepository } from '../playerRepository';
import { db } from '../../db';

describe('playerRepository', () => {
  beforeEach(async () => {
    await db.players.clear();
  });

  it('creates and retrieves a player', async () => {
    const player = await playerRepository.create('Alice');
    expect(player.name).toBe('Alice');
    expect(player.id).toBeTruthy();

    const result = await playerRepository.getById(player.id);
    expect(result?.name).toBe('Alice');
  });

  it('lists all players alphabetically', async () => {
    await playerRepository.create('Charlie');
    await playerRepository.create('Alice');
    await playerRepository.create('Bob');

    const all = await playerRepository.getAll();
    expect(all.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('updates a player name', async () => {
    const player = await playerRepository.create('Alice');
    await playerRepository.update(player.id, { name: 'Alicia' });
    const updated = await playerRepository.getById(player.id);
    expect(updated?.name).toBe('Alicia');
  });

  it('deletes a player', async () => {
    const player = await playerRepository.create('Alice');
    await playerRepository.delete(player.id);
    const result = await playerRepository.getById(player.id);
    expect(result).toBeUndefined();
  });
});
```

**Step 8: Run tests to verify they fail**

```bash
npx vitest run src/data/repositories/__tests__/playerRepository.test.ts
```

Expected: FAIL.

**Step 9: Implement playerRepository**

Create `src/data/repositories/playerRepository.ts`:

```typescript
import { db } from '../db';
import type { Player } from '../types';

export const playerRepository = {
  async create(name: string): Promise<Player> {
    const player: Player = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.players.add(player);
    return player;
  },

  async getById(id: string): Promise<Player | undefined> {
    return db.players.get(id);
  },

  async getAll(): Promise<Player[]> {
    return db.players.orderBy('name').toArray();
  },

  async update(id: string, changes: Partial<Pick<Player, 'name'>>): Promise<void> {
    await db.players.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.players.delete(id);
  },
};
```

**Step 10: Implement scoreEventRepository**

Create `src/data/repositories/scoreEventRepository.ts`:

```typescript
import { db } from '../db';
import type { ScoreEvent } from '../types';

export const scoreEventRepository = {
  async save(event: ScoreEvent): Promise<void> {
    await db.scoreEvents.add(event);
  },

  async getByMatchId(matchId: string): Promise<ScoreEvent[]> {
    return db.scoreEvents
      .where('matchId')
      .equals(matchId)
      .sortBy('timestamp');
  },

  async deleteByMatchId(matchId: string): Promise<void> {
    await db.scoreEvents.where('matchId').equals(matchId).delete();
  },
};
```

**Step 11: Run all tests, then commit**

```bash
npx vitest run
git add .
git commit -m "feat: add Dexie database schema and repositories"
```

---

## Task 3: Pickleball Scoring Engine (XState)

This is the core of the app. Build incrementally: rally scoring first (simpler), then side-out scoring.

**Files:**
- Create: `src/features/scoring/engine/types.ts`
- Create: `src/features/scoring/engine/pickleballMachine.ts`
- Test: `src/features/scoring/engine/__tests__/pickleballMachine.test.ts`

**Step 1: Define scoring engine types**

Create `src/features/scoring/engine/types.ts`:

```typescript
import type { ScoringMode, MatchFormat, GameType } from '../../../data/types';

export interface ScoringContext {
  config: {
    gameType: GameType;
    scoringMode: ScoringMode;
    matchFormat: MatchFormat;
    pointsToWin: number;
  };
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;        // for doubles: which player on the team is serving
  gameNumber: number;
  gamesWon: [number, number];  // [team1Wins, team2Wins]
  gamesToWin: number;           // 1 for single, 2 for bo3, 3 for bo5
  history: ScoringSnapshot[];   // for undo
}

export interface ScoringSnapshot {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
}

export type ScoringEvent =
  | { type: 'START_GAME' }
  | { type: 'SCORE_POINT'; team: 1 | 2 }
  | { type: 'SIDE_OUT' }
  | { type: 'UNDO' }
  | { type: 'START_NEXT_GAME' };
```

**Step 2: Write failing tests — rally scoring basics**

Create `src/features/scoring/engine/__tests__/pickleballMachine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pickleballMachine } from '../pickleballMachine';

function createScoringActor(overrides = {}) {
  return createActor(pickleballMachine, {
    input: {
      gameType: 'singles' as const,
      scoringMode: 'rally' as const,
      matchFormat: 'single' as const,
      pointsToWin: 11,
      ...overrides,
    },
  });
}

describe('Pickleball Scoring Machine', () => {
  describe('Rally Scoring - Singles', () => {
    it('starts in pregame state', () => {
      const actor = createScoringActor();
      actor.start();
      expect(actor.getSnapshot().value).toBe('pregame');
      actor.stop();
    });

    it('transitions to serving on START_GAME', () => {
      const actor = createScoringActor();
      actor.start();
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().value).toBe('serving');
      actor.stop();
    });

    it('increments score when point is scored', () => {
      const actor = createScoringActor();
      actor.start();
      actor.send({ type: 'START_GAME' });
      actor.send({ type: 'SCORE_POINT', team: 1 });

      const ctx = actor.getSnapshot().context;
      expect(ctx.team1Score).toBe(1);
      expect(ctx.team2Score).toBe(0);
      actor.stop();
    });

    it('either team can score in rally mode', () => {
      const actor = createScoringActor();
      actor.start();
      actor.send({ type: 'START_GAME' });
      actor.send({ type: 'SCORE_POINT', team: 2 });

      const ctx = actor.getSnapshot().context;
      expect(ctx.team1Score).toBe(0);
      expect(ctx.team2Score).toBe(1);
      actor.stop();
    });

    it('switches serve when non-serving team scores in rally mode', () => {
      const actor = createScoringActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Team 1 starts serving. Team 2 scores.
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      actor.stop();
    });

    it('ends game at pointsToWin with 2-point lead', () => {
      const actor = createScoringActor({ pointsToWin: 11 });
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Score to 10-0
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      expect(actor.getSnapshot().value).toBe('serving');

      // 11-0 wins
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.team1Score).toBe(11);
      actor.stop();
    });

    it('requires win by 2', () => {
      const actor = createScoringActor({ pointsToWin: 11 });
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Score to 10-10
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }

      const ctx1 = actor.getSnapshot().context;
      expect(ctx1.team1Score).toBe(10);
      expect(ctx1.team2Score).toBe(10);

      // 11-10 does NOT win
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 11-11 still going
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 12-11 still not enough
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 12-12
      actor.send({ type: 'SCORE_POINT', team: 2 });

      // 13-12
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 14-12 — now we have a 2-point lead, game over
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('matchOver');
      actor.stop();
    });

    it('supports undo', () => {
      const actor = createScoringActor();
      actor.start();
      actor.send({ type: 'START_GAME' });
      actor.send({ type: 'SCORE_POINT', team: 1 });
      actor.send({ type: 'SCORE_POINT', team: 1 });

      expect(actor.getSnapshot().context.team1Score).toBe(2);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.team1Score).toBe(1);
      actor.stop();
    });
  });

  describe('Side-Out Scoring - Doubles', () => {
    function createSideOutActor(overrides = {}) {
      return createScoringActor({
        gameType: 'doubles',
        scoringMode: 'sideout',
        ...overrides,
      });
    }

    it('only serving team can score in side-out mode', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Team 1 starts serving. Team 2 tries to score — handled via SIDE_OUT instead.
      // In side-out mode, SCORE_POINT with non-serving team is ignored.
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.team2Score).toBe(0);
      actor.stop();
    });

    it('serving team scores a point', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(1);
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      actor.stop();
    });

    it('first serving team starts with server 2 (one-serve rule)', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      expect(actor.getSnapshot().context.serverNumber).toBe(2);
      actor.stop();
    });

    it('side-out from server 2 on first team goes to other team server 1', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Server 2 on team 1 (first serve rule). Side out.
      actor.send({ type: 'SIDE_OUT' });
      const ctx = actor.getSnapshot().context;
      expect(ctx.servingTeam).toBe(2);
      expect(ctx.serverNumber).toBe(1);
      actor.stop();
    });

    it('side-out from server 1 goes to server 2 on same team', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Side out to team 2 server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);

      // Side out stays on team 2 but goes to server 2
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
      actor.stop();
    });

    it('side-out from server 2 switches to other team server 1', () => {
      const actor = createSideOutActor();
      actor.start();
      actor.send({ type: 'START_GAME' });

      // team1 server2 -> side out -> team2 server1
      actor.send({ type: 'SIDE_OUT' });
      // team2 server1 -> side out -> team2 server2
      actor.send({ type: 'SIDE_OUT' });
      // team2 server2 -> side out -> team1 server1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);
      actor.stop();
    });
  });

  describe('Best of 3 Match', () => {
    it('starts next game after a game is won', () => {
      const actor = createScoringActor({
        matchFormat: 'best-of-3',
        pointsToWin: 11,
        scoringMode: 'rally',
      });
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1: score to 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('betweenGames');
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);
      actor.stop();
    });

    it('resets scores for next game', () => {
      const actor = createScoringActor({
        matchFormat: 'best-of-3',
        pointsToWin: 11,
        scoringMode: 'rally',
      });
      actor.start();
      actor.send({ type: 'START_GAME' });

      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      actor.send({ type: 'START_NEXT_GAME' });
      const ctx = actor.getSnapshot().context;
      expect(ctx.team1Score).toBe(0);
      expect(ctx.team2Score).toBe(0);
      expect(ctx.gameNumber).toBe(2);
      expect(actor.getSnapshot().value).toBe('serving');
      actor.stop();
    });

    it('ends match when a team wins enough games', () => {
      const actor = createScoringActor({
        matchFormat: 'best-of-3',
        pointsToWin: 11,
        scoringMode: 'rally',
      });
      actor.start();
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      actor.send({ type: 'START_NEXT_GAME' });

      // Team 1 wins game 2
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([2, 0]);
      actor.stop();
    });
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npx vitest run src/features/scoring/engine/__tests__/pickleballMachine.test.ts
```

Expected: FAIL — module not found.

**Step 4: Implement the XState machine**

Create `src/features/scoring/engine/pickleballMachine.ts`:

```typescript
import { setup, assign } from 'xstate';
import type { ScoringContext, ScoringSnapshot, ScoringEvent } from './types';
import type { ScoringMode, MatchFormat, GameType } from '../../../data/types';

function takeSnapshot(ctx: ScoringContext): ScoringSnapshot {
  return {
    team1Score: ctx.team1Score,
    team2Score: ctx.team2Score,
    servingTeam: ctx.servingTeam,
    serverNumber: ctx.serverNumber,
    gameNumber: ctx.gameNumber,
    gamesWon: [...ctx.gamesWon] as [number, number],
  };
}

function gamesToWin(format: MatchFormat): number {
  switch (format) {
    case 'single': return 1;
    case 'best-of-3': return 2;
    case 'best-of-5': return 3;
  }
}

export const pickleballMachine = setup({
  types: {
    context: {} as ScoringContext,
    events: {} as ScoringEvent,
    input: {} as {
      gameType: GameType;
      scoringMode: ScoringMode;
      matchFormat: MatchFormat;
      pointsToWin: number;
    },
  },
  guards: {
    isGameWon: ({ context }) => {
      const { team1Score, team2Score, config } = context;
      const maxScore = Math.max(team1Score, team2Score);
      const minScore = Math.min(team1Score, team2Score);
      return maxScore >= config.pointsToWin && maxScore - minScore >= 2;
    },
    isMatchWon: ({ context }) => {
      const [t1, t2] = context.gamesWon;
      return t1 >= context.gamesToWin || t2 >= context.gamesToWin;
    },
    canScore: ({ context, event }) => {
      if (context.config.scoringMode === 'rally') return true;
      // Side-out: only serving team can score
      return (event as { team: 1 | 2 }).team === context.servingTeam;
    },
  },
  actions: {
    scorePoint: assign(({ context, event }) => {
      const team = (event as { team: 1 | 2 }).team;
      const snapshot = takeSnapshot(context);
      const newCtx = {
        history: [...context.history, snapshot],
        team1Score: team === 1 ? context.team1Score + 1 : context.team1Score,
        team2Score: team === 2 ? context.team2Score + 1 : context.team2Score,
      };

      // In rally mode, serve switches when non-serving team scores
      if (context.config.scoringMode === 'rally' && team !== context.servingTeam) {
        return { ...newCtx, servingTeam: team as 1 | 2 };
      }

      return newCtx;
    }),
    handleSideOut: assign(({ context }) => {
      const snapshot = takeSnapshot(context);
      const { servingTeam, serverNumber, config } = context;

      if (config.gameType === 'doubles') {
        if (serverNumber === 1) {
          // Server 1 -> Server 2 (same team)
          return { history: [...context.history, snapshot], serverNumber: 2 as const };
        }
        // Server 2 -> other team, server 1
        return {
          history: [...context.history, snapshot],
          servingTeam: (servingTeam === 1 ? 2 : 1) as 1 | 2,
          serverNumber: 1 as const,
        };
      }

      // Singles: just switch serving team
      return {
        history: [...context.history, snapshot],
        servingTeam: (servingTeam === 1 ? 2 : 1) as 1 | 2,
      };
    }),
    recordGameWon: assign(({ context }) => {
      const winner: 1 | 2 = context.team1Score > context.team2Score ? 1 : 2;
      const newGamesWon = [...context.gamesWon] as [number, number];
      newGamesWon[winner - 1]++;
      return { gamesWon: newGamesWon };
    }),
    resetForNextGame: assign(({ context }) => ({
      team1Score: 0,
      team2Score: 0,
      gameNumber: context.gameNumber + 1,
      servingTeam: (context.gameNumber % 2 === 0 ? 1 : 2) as 1 | 2, // alternate first serve
      serverNumber: 2 as const, // first serve rule applies each game
    })),
    undoLastAction: assign(({ context }) => {
      if (context.history.length === 0) return {};
      const prev = context.history[context.history.length - 1];
      return {
        ...prev,
        history: context.history.slice(0, -1),
      };
    }),
  },
}).createMachine({
  id: 'pickleball',
  context: ({ input }) => ({
    config: {
      gameType: input.gameType,
      scoringMode: input.scoringMode,
      matchFormat: input.matchFormat,
      pointsToWin: input.pointsToWin,
    },
    team1Score: 0,
    team2Score: 0,
    servingTeam: 1 as const,
    serverNumber: 2 as const, // first-serve rule: starting team gets one serve
    gameNumber: 1,
    gamesWon: [0, 0] as [number, number],
    gamesToWin: gamesToWin(input.matchFormat),
    history: [],
  }),
  initial: 'pregame',
  states: {
    pregame: {
      on: { START_GAME: 'serving' },
    },
    serving: {
      on: {
        SCORE_POINT: {
          guard: 'canScore',
          actions: 'scorePoint',
          target: 'checkWin',
        },
        SIDE_OUT: {
          actions: 'handleSideOut',
          target: 'serving',
          reenter: true,
        },
        UNDO: {
          actions: 'undoLastAction',
          target: 'serving',
          reenter: true,
        },
      },
    },
    checkWin: {
      always: [
        {
          guard: 'isGameWon',
          actions: 'recordGameWon',
          target: 'checkMatchWin',
        },
        { target: 'serving' },
      ],
    },
    checkMatchWin: {
      always: [
        { guard: 'isMatchWon', target: 'matchOver' },
        { target: 'betweenGames' },
      ],
    },
    betweenGames: {
      on: {
        START_NEXT_GAME: {
          actions: 'resetForNextGame',
          target: 'serving',
        },
      },
    },
    matchOver: {
      type: 'final',
    },
  },
});
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/features/scoring/engine/__tests__/pickleballMachine.test.ts
```

Expected: All tests PASS. Debug and fix any failures — the scoring logic is nuanced.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add XState pickleball scoring engine with rally and side-out modes"
```

---

## Task 4: Zustand App Stores

**Files:**
- Create: `src/stores/matchHistoryStore.ts`
- Create: `src/stores/playerStore.ts`
- Create: `src/stores/settingsStore.ts`

Note: Zustand is designed for React. For SolidJS, we use `zustand/vanilla` stores and wrap them with SolidJS signals. Alternatively, use SolidJS `createStore` directly. Since SolidJS has its own fine-grained reactivity, we should use SolidJS primitives instead of Zustand for simplicity.

**Decision: Use SolidJS `createStore` + Dexie `liveQuery` instead of Zustand.** Zustand's React-specific hooks do not work with SolidJS. The design doc specified Zustand but the framework choice (SolidJS) makes SolidJS-native reactivity the better fit. Dexie's `liveQuery` can be wrapped with `createResource` or `createEffect` for reactive database queries.

**Step 1: Create a Dexie-SolidJS reactive helper**

Create `src/data/useLiveQuery.ts`:

```typescript
import { createSignal, onCleanup, createEffect } from 'solid-js';
import { liveQuery, type Observable } from 'dexie';

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: () => unknown,
): () => T | undefined {
  const [result, setResult] = createSignal<T | undefined>(undefined);

  createEffect(() => {
    // Touch deps to make this reactive to dependency changes
    deps?.();

    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => setResult(() => value),
      error: (err) => console.error('liveQuery error:', err),
    });

    onCleanup(() => subscription.unsubscribe());
  });

  return result;
}
```

**Step 2: Create settings store using SolidJS primitives**

Create `src/stores/settingsStore.ts`:

```typescript
import { createSignal } from 'solid-js';

export type ScoringUIMode = 'simple' | 'detailed';

interface Settings {
  defaultScoringMode: 'sideout' | 'rally';
  defaultPointsToWin: 11 | 15 | 21;
  defaultMatchFormat: 'single' | 'best-of-3' | 'best-of-5';
  scoringUIMode: ScoringUIMode;
  keepScreenAwake: boolean;
}

const SETTINGS_KEY = 'pickle-score-settings';

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    defaultScoringMode: 'sideout',
    defaultPointsToWin: 11,
    defaultMatchFormat: 'single',
    scoringUIMode: 'simple',
    keepScreenAwake: true,
  };
}

const [settings, setSettingsInternal] = createSignal<Settings>(loadSettings());

function setSettings(update: Partial<Settings>) {
  setSettingsInternal((prev) => {
    const next = { ...prev, ...update };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  });
}

export { settings, setSettings };
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add SolidJS-native stores and Dexie liveQuery helper"
```

---

## Task 5: Routing & App Shell

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/shared/components/BottomNav.tsx`
- Create: `src/features/scoring/ScoringPage.tsx` (placeholder)
- Create: `src/features/scoring/GameSetupPage.tsx` (placeholder)
- Create: `src/features/history/HistoryPage.tsx` (placeholder)
- Create: `src/features/players/PlayersPage.tsx` (placeholder)
- Create: `src/shared/components/PageLayout.tsx`

**Step 1: Create page layout component**

Create `src/shared/components/PageLayout.tsx`:

```tsx
import { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
      </header>
      <main class="flex-1 overflow-y-auto pb-20">
        {props.children}
      </main>
    </div>
  );
};

export default PageLayout;
```

**Step 2: Create placeholder pages**

Create `src/features/scoring/GameSetupPage.tsx`:

```tsx
import { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';

const GameSetupPage: Component = () => {
  return (
    <PageLayout title="New Game">
      <div class="p-4 text-on-surface-muted text-center">
        Game setup coming soon
      </div>
    </PageLayout>
  );
};

export default GameSetupPage;
```

Create `src/features/scoring/ScoringPage.tsx`:

```tsx
import { Component } from 'solid-js';

const ScoringPage: Component = () => {
  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-surface text-on-surface">
      <p class="text-on-surface-muted">Scoring view coming soon</p>
    </div>
  );
};

export default ScoringPage;
```

Create `src/features/history/HistoryPage.tsx`:

```tsx
import { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';

const HistoryPage: Component = () => {
  return (
    <PageLayout title="Match History">
      <div class="p-4 text-on-surface-muted text-center">
        Match history coming soon
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
```

Create `src/features/players/PlayersPage.tsx`:

```tsx
import { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';

const PlayersPage: Component = () => {
  return (
    <PageLayout title="Players">
      <div class="p-4 text-on-surface-muted text-center">
        Player profiles coming soon
      </div>
    </PageLayout>
  );
};

export default PlayersPage;
```

**Step 3: Create bottom navigation**

Create `src/shared/components/BottomNav.tsx`:

```tsx
import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';

const BottomNav: Component = () => {
  const location = useLocation();

  const linkClass = (path: string) => {
    const active = location.pathname === path || location.pathname.startsWith(path + '/');
    return `flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
      active ? 'text-primary' : 'text-on-surface-muted'
    }`;
  };

  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter flex justify-around py-1 safe-bottom">
      <A href="/" class={linkClass('/')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>New Game</span>
      </A>
      <A href="/history" class={linkClass('/history')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>History</span>
      </A>
      <A href="/players" class={linkClass('/players')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Players</span>
      </A>
    </nav>
  );
};

export default BottomNav;
```

**Step 4: Set up router**

Create `src/app/router.tsx`:

```tsx
import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));

export default function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
    </Router>
  );
}
```

**Step 5: Update App.tsx to be the layout shell**

Update `src/app/App.tsx`:

```tsx
import { Component, JSX, Suspense } from 'solid-js';
import BottomNav from '../shared/components/BottomNav';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <Suspense fallback={<div class="flex items-center justify-center min-h-screen text-on-surface-muted">Loading...</div>}>
        {props.children}
      </Suspense>
      <BottomNav />
    </div>
  );
};

export default App;
```

**Step 6: Update index.tsx to use router**

Update `src/index.tsx`:

```tsx
import { render } from 'solid-js/web';
import './styles.css';
import AppRouter from './app/router';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => <AppRouter />, root);
```

**Step 7: Verify navigation works**

```bash
npm run dev
```

Expected: Dark themed app with bottom nav. Tapping "New Game", "History", "Players" navigates between pages.

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add routing, app shell, and bottom navigation"
```

---

## Task 6: Game Setup Page

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`
- Create: `src/features/scoring/components/GameTypeSelector.tsx`
- Create: `src/features/scoring/components/ScoringModeSelector.tsx`
- Create: `src/features/scoring/components/MatchFormatSelector.tsx`
- Create: `src/features/scoring/components/PlayerSelector.tsx`
- Create: `src/shared/components/OptionCard.tsx`

**Step 1: Create reusable OptionCard component**

Create `src/shared/components/OptionCard.tsx`:

```tsx
import { Component, JSX } from 'solid-js';

interface Props {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: JSX.Element;
}

const OptionCard: Component<Props> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={`w-full p-4 rounded-xl text-left transition-all active:scale-95 ${
        props.selected
          ? 'bg-primary/20 border-2 border-primary text-on-surface'
          : 'bg-surface-light border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
      }`}
    >
      <div class="flex items-center gap-3">
        {props.icon && <span class="text-2xl">{props.icon}</span>}
        <div>
          <div class="font-semibold">{props.label}</div>
          {props.description && (
            <div class="text-sm text-on-surface-muted mt-0.5">{props.description}</div>
          )}
        </div>
      </div>
    </button>
  );
};

export default OptionCard;
```

**Step 2: Build the full GameSetupPage**

Update `src/features/scoring/GameSetupPage.tsx`:

```tsx
import { Component, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { GameType, ScoringMode, MatchFormat, Match, MatchConfig } from '../../data/types';

const GameSetupPage: Component = () => {
  const navigate = useNavigate();

  const [gameType, setGameType] = createSignal<GameType>('doubles');
  const [scoringMode, setScoringMode] = createSignal<ScoringMode>('sideout');
  const [matchFormat, setMatchFormat] = createSignal<MatchFormat>('single');
  const [pointsToWin, setPointsToWin] = createSignal<11 | 15 | 21>(11);
  const [team1Name, setTeam1Name] = createSignal('Team 1');
  const [team2Name, setTeam2Name] = createSignal('Team 2');

  const startGame = async () => {
    const config: MatchConfig = {
      gameType: gameType(),
      scoringMode: scoringMode(),
      matchFormat: matchFormat(),
      pointsToWin: pointsToWin(),
    };

    const match: Match = {
      id: crypto.randomUUID(),
      config,
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: team1Name(),
      team2Name: team2Name(),
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: Date.now(),
      completedAt: null,
    };

    await matchRepository.save(match);
    navigate(`/score/${match.id}`);
  };

  return (
    <PageLayout title="New Game">
      <div class="p-4 space-y-6">
        {/* Game Type */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</h2>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
            <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
          </div>
        </section>

        {/* Scoring Mode */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</h2>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Side-Out" description="Serving team scores" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
            <OptionCard label="Rally" description="Point every rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
          </div>
        </section>

        {/* Points to Win */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</h2>
          <div class="grid grid-cols-3 gap-3">
            {([11, 15, 21] as const).map((pts) => (
              <OptionCard label={`${pts}`} selected={pointsToWin() === pts} onClick={() => setPointsToWin(pts)} />
            ))}
          </div>
        </section>

        {/* Match Format */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</h2>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
            <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
            <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
          </div>
        </section>

        {/* Team Names */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Teams</h2>
          <div class="space-y-3">
            <input
              type="text"
              value={team1Name()}
              onInput={(e) => setTeam1Name(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              placeholder="Team 1 name"
            />
            <input
              type="text"
              value={team2Name()}
              onInput={(e) => setTeam2Name(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              placeholder="Team 2 name"
            />
          </div>
        </section>

        {/* Start Button */}
        <button
          type="button"
          onClick={startGame}
          class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Start Game
        </button>
      </div>
    </PageLayout>
  );
};

export default GameSetupPage;
```

**Step 3: Verify setup page works**

```bash
npm run dev
```

Expected: Game setup page with selectable options for game type, scoring, points, format, and team names. Tapping "Start Game" navigates to `/score/<id>`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add game setup page with all configuration options"
```

---

## Task 7: Live Scoring Page (Simple Mode)

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx`
- Create: `src/features/scoring/components/Scoreboard.tsx`
- Create: `src/features/scoring/components/ScoreControls.tsx`
- Create: `src/features/scoring/components/ServeIndicator.tsx`
- Create: `src/features/scoring/components/MatchHeader.tsx`
- Create: `src/features/scoring/hooks/useScoringActor.ts`

**Step 1: Create the XState-SolidJS hook**

Create `src/features/scoring/hooks/useScoringActor.ts`:

```typescript
import { createSignal, onCleanup } from 'solid-js';
import { createActor, type SnapshotFrom } from 'xstate';
import { pickleballMachine } from '../engine/pickleballMachine';
import { scoreEventRepository } from '../../../data/repositories/scoreEventRepository';
import type { MatchConfig, ScoreEvent } from '../../../data/types';

export function useScoringActor(matchId: string, config: MatchConfig) {
  const actor = createActor(pickleballMachine, {
    input: {
      gameType: config.gameType,
      scoringMode: config.scoringMode,
      matchFormat: config.matchFormat,
      pointsToWin: config.pointsToWin,
    },
  });

  const [state, setState] = createSignal<SnapshotFrom<typeof pickleballMachine>>(
    actor.getSnapshot()
  );

  actor.subscribe((snapshot) => {
    setState(snapshot);
  });

  actor.start();
  actor.send({ type: 'START_GAME' });

  onCleanup(() => actor.stop());

  const scorePoint = async (team: 1 | 2) => {
    const before = actor.getSnapshot().context;
    actor.send({ type: 'SCORE_POINT', team });
    const after = actor.getSnapshot().context;

    // Persist event to IndexedDB
    if (before.team1Score !== after.team1Score || before.team2Score !== after.team2Score) {
      const event: ScoreEvent = {
        id: crypto.randomUUID(),
        matchId,
        gameNumber: after.gameNumber,
        timestamp: Date.now(),
        type: 'POINT_SCORED',
        team,
        serverNumber: before.serverNumber,
        team1Score: after.team1Score,
        team2Score: after.team2Score,
      };
      await scoreEventRepository.save(event);
    }
  };

  const sideOut = async () => {
    actor.send({ type: 'SIDE_OUT' });
    const after = actor.getSnapshot().context;

    const event: ScoreEvent = {
      id: crypto.randomUUID(),
      matchId,
      gameNumber: after.gameNumber,
      timestamp: Date.now(),
      type: 'SIDE_OUT',
      team: after.servingTeam,
      team1Score: after.team1Score,
      team2Score: after.team2Score,
    };
    await scoreEventRepository.save(event);
  };

  const undo = () => {
    actor.send({ type: 'UNDO' });
  };

  const startNextGame = () => {
    actor.send({ type: 'START_NEXT_GAME' });
  };

  return {
    state,
    scorePoint,
    sideOut,
    undo,
    startNextGame,
  };
}
```

**Step 2: Create Scoreboard component**

Create `src/features/scoring/components/Scoreboard.tsx`:

```tsx
import { Component } from 'solid-js';

interface Props {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  scoringMode: 'sideout' | 'rally';
  gameType: 'singles' | 'doubles';
}

const Scoreboard: Component<Props> = (props) => {
  const serveLabel = () => {
    if (props.scoringMode === 'rally') return '';
    if (props.gameType === 'doubles') {
      return `Server ${props.serverNumber}`;
    }
    return 'Serving';
  };

  return (
    <div class="grid grid-cols-2 gap-4 px-4">
      {/* Team 1 */}
      <div class={`flex flex-col items-center p-4 rounded-2xl ${
        props.servingTeam === 1 ? 'bg-primary/15 ring-2 ring-primary' : 'bg-surface-light'
      }`}>
        <span class="text-sm font-medium text-on-surface-muted truncate max-w-full">
          {props.team1Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums mt-2">
          {props.team1Score}
        </span>
        {props.servingTeam === 1 && (
          <span class="text-xs text-primary mt-1 font-semibold">{serveLabel()}</span>
        )}
      </div>

      {/* Team 2 */}
      <div class={`flex flex-col items-center p-4 rounded-2xl ${
        props.servingTeam === 2 ? 'bg-primary/15 ring-2 ring-primary' : 'bg-surface-light'
      }`}>
        <span class="text-sm font-medium text-on-surface-muted truncate max-w-full">
          {props.team2Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums mt-2">
          {props.team2Score}
        </span>
        {props.servingTeam === 2 && (
          <span class="text-xs text-primary mt-1 font-semibold">{serveLabel()}</span>
        )}
      </div>
    </div>
  );
};

export default Scoreboard;
```

**Step 3: Create ScoreControls component**

Create `src/features/scoring/components/ScoreControls.tsx`:

```tsx
import { Component, Show } from 'solid-js';

interface Props {
  team1Name: string;
  team2Name: string;
  scoringMode: 'sideout' | 'rally';
  onScorePoint: (team: 1 | 2) => void;
  onSideOut: () => void;
  onUndo: () => void;
}

const ScoreControls: Component<Props> = (props) => {
  return (
    <div class="px-4 space-y-4">
      {/* Score buttons */}
      <div class="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => props.onScorePoint(1)}
          class="bg-primary text-surface font-bold text-xl py-6 rounded-2xl active:scale-95 transition-transform"
        >
          +1 {props.team1Name}
        </button>
        <button
          type="button"
          onClick={() => props.onScorePoint(2)}
          class="bg-accent text-surface font-bold text-xl py-6 rounded-2xl active:scale-95 transition-transform"
        >
          +1 {props.team2Name}
        </button>
      </div>

      {/* Side-out button (only for side-out scoring) */}
      <Show when={props.scoringMode === 'sideout'}>
        <button
          type="button"
          onClick={props.onSideOut}
          class="w-full bg-surface-lighter text-on-surface font-semibold py-4 rounded-xl active:scale-95 transition-transform"
        >
          Side Out
        </button>
      </Show>

      {/* Undo button */}
      <button
        type="button"
        onClick={props.onUndo}
        class="w-full bg-surface-light text-on-surface-muted font-medium py-3 rounded-xl active:scale-95 transition-transform border border-surface-lighter"
      >
        Undo Last
      </button>
    </div>
  );
};

export default ScoreControls;
```

**Step 4: Build the ScoringPage**

Update `src/features/scoring/ScoringPage.tsx`:

```tsx
import { Component, Show, createResource, Switch, Match } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { matchRepository } from '../../data/repositories/matchRepository';
import { useScoringActor } from './hooks/useScoringActor';
import Scoreboard from './components/Scoreboard';
import ScoreControls from './components/ScoreControls';
import type { Match as MatchType } from '../../data/types';

const ScoringPage: Component = () => {
  const params = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [match] = createResource(() => params.matchId, (id) => matchRepository.getById(id));

  return (
    <Show when={match()} fallback={<div class="min-h-screen bg-surface flex items-center justify-center text-on-surface-muted">Loading match...</div>}>
      {(m) => <ScoringView match={m()} />}
    </Show>
  );
};

const ScoringView: Component<{ match: MatchType }> = (props) => {
  const navigate = useNavigate();
  const { state, scorePoint, sideOut, undo, startNextGame } = useScoringActor(
    props.match.id,
    props.match.config,
  );

  const ctx = () => state().context;
  const machineState = () => state().value;

  const handleMatchComplete = async () => {
    const winner: 1 | 2 = ctx().gamesWon[0] > ctx().gamesWon[1] ? 1 : 2;
    await matchRepository.save({
      ...props.match,
      winningSide: winner,
      status: 'completed',
      completedAt: Date.now(),
      games: Array.from({ length: ctx().gameNumber }, (_, i) => ({
        gameNumber: i + 1,
        team1Score: i + 1 === ctx().gameNumber ? ctx().team1Score : 0,
        team2Score: i + 1 === ctx().gameNumber ? ctx().team2Score : 0,
        winningSide: winner,
      })),
    });
    navigate('/history');
  };

  return (
    <div class="flex flex-col min-h-screen bg-surface">
      {/* Match info header */}
      <div class="bg-surface-light px-4 py-3 flex items-center justify-between">
        <div>
          <span class="text-sm text-on-surface-muted">
            Game {ctx().gameNumber}
            {ctx().config.matchFormat !== 'single' && (
              <span> &middot; {ctx().gamesWon[0]}-{ctx().gamesWon[1]}</span>
            )}
          </span>
        </div>
        <span class="text-xs text-on-surface-muted uppercase">
          {ctx().config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally'} &middot; To {ctx().config.pointsToWin}
        </span>
      </div>

      {/* Scoreboard */}
      <div class="flex-1 flex flex-col justify-center space-y-8 py-6">
        <Scoreboard
          team1Name={props.match.team1Name}
          team2Name={props.match.team2Name}
          team1Score={ctx().team1Score}
          team2Score={ctx().team2Score}
          servingTeam={ctx().servingTeam}
          serverNumber={ctx().serverNumber}
          scoringMode={ctx().config.scoringMode}
          gameType={ctx().config.gameType}
        />

        <Switch>
          <Match when={machineState() === 'serving'}>
            <ScoreControls
              team1Name={props.match.team1Name}
              team2Name={props.match.team2Name}
              scoringMode={ctx().config.scoringMode}
              onScorePoint={scorePoint}
              onSideOut={sideOut}
              onUndo={undo}
            />
          </Match>

          <Match when={machineState() === 'betweenGames'}>
            <div class="px-4 space-y-4 text-center">
              <p class="text-2xl font-bold text-primary">Game {ctx().gameNumber} Complete!</p>
              <p class="text-on-surface-muted">
                {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
              </p>
              <button
                type="button"
                onClick={startNextGame}
                class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
              >
                Start Game {ctx().gameNumber + 1}
              </button>
            </div>
          </Match>

          <Match when={machineState() === 'matchOver'}>
            <div class="px-4 space-y-4 text-center">
              <p class="text-3xl font-black text-score">Match Over!</p>
              <p class="text-xl text-on-surface">
                {ctx().gamesWon[0] > ctx().gamesWon[1] ? props.match.team1Name : props.match.team2Name} Wins!
              </p>
              <button
                type="button"
                onClick={handleMatchComplete}
                class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
              >
                Save & Finish
              </button>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
};

export default ScoringPage;
```

**Step 5: Verify scoring works end-to-end**

```bash
npm run dev
```

Expected: Set up a game, tap Start Game, see the scoreboard. Tap score buttons to score points. Serve indicator moves. Game ends at win condition. Match over screen shows.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add live scoring page with XState engine integration"
```

---

## Task 8: Match History Page

**Files:**
- Modify: `src/features/history/HistoryPage.tsx`
- Create: `src/features/history/components/MatchCard.tsx`

**Step 1: Create MatchCard component**

Create `src/features/history/components/MatchCard.tsx`:

```tsx
import { Component } from 'solid-js';
import type { Match } from '../../../data/types';

interface Props {
  match: Match;
}

const MatchCard: Component<Props> = (props) => {
  const m = () => props.match;
  const date = () => new Date(m().startedAt).toLocaleDateString();
  const time = () => new Date(m().startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const winner = () => m().winningSide === 1 ? m().team1Name : m().team2Name;

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs text-on-surface-muted">{date()} {time()}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
          {m().config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally'}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex-1">
          <span class={`font-semibold ${m().winningSide === 1 ? 'text-primary' : 'text-on-surface'}`}>
            {m().team1Name}
          </span>
        </div>
        <div class="px-4 text-2xl font-black text-score tabular-nums">
          {m().games.map((g) => g.team1Score).join(' / ') || '-'}
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex-1">
          <span class={`font-semibold ${m().winningSide === 2 ? 'text-primary' : 'text-on-surface'}`}>
            {m().team2Name}
          </span>
        </div>
        <div class="px-4 text-2xl font-black text-score tabular-nums">
          {m().games.map((g) => g.team2Score).join(' / ') || '-'}
        </div>
      </div>

      <div class="text-xs text-on-surface-muted">
        {m().config.gameType === 'doubles' ? 'Doubles' : 'Singles'} &middot; To {m().config.pointsToWin}
        {m().config.matchFormat !== 'single' && ` &middot; ${m().config.matchFormat.replace('-', ' ')}`}
      </div>
    </div>
  );
};

export default MatchCard;
```

**Step 2: Update HistoryPage**

Update `src/features/history/HistoryPage.tsx`:

```tsx
import { Component, For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import MatchCard from './components/MatchCard';
import { useLiveQuery } from '../../data/useLiveQuery';
import { matchRepository } from '../../data/repositories/matchRepository';

const HistoryPage: Component = () => {
  const matches = useLiveQuery(() => matchRepository.getCompleted());

  return (
    <PageLayout title="Match History">
      <div class="p-4 space-y-3">
        <Show
          when={matches() && matches()!.length > 0}
          fallback={
            <div class="text-center text-on-surface-muted py-12">
              <p class="text-lg">No matches yet</p>
              <p class="text-sm mt-1">Start a game to see history here</p>
            </div>
          }
        >
          <For each={matches()}>
            {(match) => <MatchCard match={match} />}
          </For>
        </Show>
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
```

**Step 3: Verify and commit**

```bash
npm run dev
```

Expected: After completing a match, it appears in the History tab with scores displayed.

```bash
git add .
git commit -m "feat: add match history page with live query"
```

---

## Task 9: Players Page

**Files:**
- Modify: `src/features/players/PlayersPage.tsx`
- Create: `src/features/players/components/PlayerCard.tsx`
- Create: `src/features/players/components/AddPlayerForm.tsx`

**Step 1: Create AddPlayerForm**

Create `src/features/players/components/AddPlayerForm.tsx`:

```tsx
import { Component, createSignal } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';

const AddPlayerForm: Component = () => {
  const [name, setName] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) return;
    await playerRepository.create(trimmed);
    setName('');
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-2">
      <input
        type="text"
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
        class="flex-1 bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
        placeholder="Player name"
      />
      <button
        type="submit"
        class="bg-primary text-surface font-semibold px-6 rounded-xl active:scale-95 transition-transform"
      >
        Add
      </button>
    </form>
  );
};

export default AddPlayerForm;
```

**Step 2: Create PlayerCard**

Create `src/features/players/components/PlayerCard.tsx`:

```tsx
import { Component } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';
import type { Player } from '../../../data/types';

interface Props {
  player: Player;
}

const PlayerCard: Component<Props> = (props) => {
  const joinDate = () => new Date(props.player.createdAt).toLocaleDateString();

  const handleDelete = async () => {
    if (confirm(`Delete ${props.player.name}?`)) {
      await playerRepository.delete(props.player.id);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
      <div>
        <div class="font-semibold text-on-surface">{props.player.name}</div>
        <div class="text-xs text-on-surface-muted">Joined {joinDate()}</div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        class="text-error text-sm px-3 py-1 rounded-lg hover:bg-error/10 transition-colors"
      >
        Delete
      </button>
    </div>
  );
};

export default PlayerCard;
```

**Step 3: Update PlayersPage**

Update `src/features/players/PlayersPage.tsx`:

```tsx
import { Component, For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';

const PlayersPage: Component = () => {
  const players = useLiveQuery(() => playerRepository.getAll());

  return (
    <PageLayout title="Players">
      <div class="p-4 space-y-4">
        <AddPlayerForm />

        <Show
          when={players() && players()!.length > 0}
          fallback={
            <div class="text-center text-on-surface-muted py-8">
              <p>No players yet</p>
              <p class="text-sm mt-1">Add players to track their stats</p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={players()}>
              {(player) => <PlayerCard player={player} />}
            </For>
          </div>
        </Show>
      </div>
    </PageLayout>
  );
};

export default PlayersPage;
```

**Step 4: Verify and commit**

```bash
npm run dev
git add .
git commit -m "feat: add players page with CRUD operations"
```

---

## Task 10: Statistics

**Files:**
- Create: `src/features/history/StatsPage.tsx`
- Create: `src/features/history/components/StatCard.tsx`
- Create: `src/data/repositories/statsRepository.ts`
- Modify: `src/app/router.tsx` (add stats route)
- Modify: `src/shared/components/BottomNav.tsx` (add stats tab or integrate into players)

**Step 1: Create stats computation repository**

Create `src/data/repositories/statsRepository.ts`:

```typescript
import { db } from '../db';
import type { Match } from '../types';

export interface PlayerStats {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  bestWinStreak: number;
}

export interface HeadToHeadRecord {
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  matches: Match[];
}

export const statsRepository = {
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const player = await db.players.get(playerId);
    if (!player) return null;

    const t1Matches = await db.matches
      .where('team1PlayerIds').equals(playerId)
      .and((m) => m.status === 'completed')
      .toArray();
    const t2Matches = await db.matches
      .where('team2PlayerIds').equals(playerId)
      .and((m) => m.status === 'completed')
      .toArray();

    const allMatches = [...t1Matches, ...t2Matches].sort((a, b) => a.startedAt - b.startedAt);
    const matchesPlayed = allMatches.length;

    if (matchesPlayed === 0) {
      return {
        playerId, playerName: player.name,
        matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
        currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
      };
    }

    let wins = 0;
    let currentStreak = { type: 'W' as 'W' | 'L', count: 0 };
    let bestWinStreak = 0;
    let tempWinStreak = 0;

    for (const match of allMatches) {
      const isTeam1 = match.team1PlayerIds.includes(playerId);
      const won = (isTeam1 && match.winningSide === 1) || (!isTeam1 && match.winningSide === 2);

      if (won) {
        wins++;
        tempWinStreak++;
        bestWinStreak = Math.max(bestWinStreak, tempWinStreak);
        if (currentStreak.type === 'W') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'W', count: 1 };
        }
      } else {
        tempWinStreak = 0;
        if (currentStreak.type === 'L') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'L', count: 1 };
        }
      }
    }

    return {
      playerId,
      playerName: player.name,
      matchesPlayed,
      wins,
      losses: matchesPlayed - wins,
      winRate: Math.round((wins / matchesPlayed) * 100),
      currentStreak,
      bestWinStreak,
    };
  },

  async getHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadRecord> {
    const allMatches = await db.matches
      .where('status').equals('completed')
      .toArray();

    const h2hMatches = allMatches.filter((m) => {
      const hasP1 = m.team1PlayerIds.includes(player1Id) || m.team2PlayerIds.includes(player1Id);
      const hasP2 = m.team1PlayerIds.includes(player2Id) || m.team2PlayerIds.includes(player2Id);
      // They must be on opposite teams
      const p1Team1 = m.team1PlayerIds.includes(player1Id);
      const p2Team1 = m.team1PlayerIds.includes(player2Id);
      return hasP1 && hasP2 && p1Team1 !== p2Team1;
    });

    let player1Wins = 0;
    let player2Wins = 0;

    for (const m of h2hMatches) {
      const p1IsTeam1 = m.team1PlayerIds.includes(player1Id);
      if ((p1IsTeam1 && m.winningSide === 1) || (!p1IsTeam1 && m.winningSide === 2)) {
        player1Wins++;
      } else {
        player2Wins++;
      }
    }

    return { player1Id, player2Id, player1Wins, player2Wins, matches: h2hMatches };
  },
};
```

**Step 2: Build stats into the Players page**

This keeps the navigation simple — player stats are shown when you tap a player. For now, add a basic stats summary to `PlayerCard`.

Modify `src/features/players/components/PlayerCard.tsx` to show a stats summary (or create a dedicated PlayerDetailPage — defer to Task 11 for polish).

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add stats computation repository with win/loss tracking and head-to-head"
```

---

## Task 11: PWA Polish & Wake Lock

**Files:**
- Modify: `vite.config.ts` (already has PWA config)
- Create: `src/shared/hooks/useWakeLock.ts`
- Create: `public/pwa-192x192.png` (placeholder)
- Create: `public/pwa-512x512.png` (placeholder)
- Modify: `index.html` (add meta tags)

**Step 1: Create Wake Lock hook**

Create `src/shared/hooks/useWakeLock.ts`:

```typescript
import { onCleanup } from 'solid-js';

export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null;

  const request = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const release = async () => {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  };

  onCleanup(() => {
    release();
  });

  return { request, release };
}
```

**Step 2: Add iOS-specific meta tags to index.html**

Update `index.html` `<head>` section to include:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="PickleScore" />
<meta name="theme-color" content="#1e1e2e" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**Step 3: Add safe area styling to `src/styles.css`**

```css
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

**Step 4: Use Wake Lock in ScoringPage**

Add to `ScoringView` component in `ScoringPage.tsx`:

```typescript
import { useWakeLock } from '../../shared/hooks/useWakeLock';

// Inside ScoringView component:
const { request: requestWakeLock } = useWakeLock();
requestWakeLock();
```

**Step 5: Generate placeholder PWA icons**

Create simple placeholder icons (these should be replaced with real branding later):

```bash
# For now, create simple colored squares as placeholders
# You can generate proper icons later using a tool like pwa-asset-generator
```

Create minimal placeholder files in `public/` — even a simple colored PNG will suffice for development.

**Step 6: Verify PWA installability**

```bash
npm run build
npm run preview
```

Open Chrome DevTools > Application > Manifest. Verify the manifest is valid and the "Install" prompt appears.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add PWA meta tags, wake lock, and safe area styling"
```

---

## Task 12: Integration Testing & Final Polish

**Files:**
- Create: `src/features/scoring/engine/__tests__/integration.test.ts`
- Run: full test suite

**Step 1: Write integration test for a full match**

Create `src/features/scoring/engine/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pickleballMachine } from '../pickleballMachine';

describe('Full Match Integration', () => {
  it('plays a complete best-of-3 rally scoring match', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'doubles',
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // Game 1: Team 1 wins 11-5
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 1 });
    // Team 2 gets some points interleaved (but we already scored 11, so game is over)
    expect(actor.getSnapshot().value).toBe('betweenGames');
    expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);

    // Start game 2
    actor.send({ type: 'START_NEXT_GAME' });
    expect(actor.getSnapshot().context.team1Score).toBe(0);
    expect(actor.getSnapshot().context.gameNumber).toBe(2);

    // Game 2: Team 1 wins 11-0
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 1 });

    expect(actor.getSnapshot().value).toBe('matchOver');
    expect(actor.getSnapshot().context.gamesWon).toEqual([2, 0]);
    actor.stop();
  });

  it('plays a side-out doubles match with serve rotation', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'doubles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // First serve: team 1, server 2 (one-serve rule)
    expect(actor.getSnapshot().context.servingTeam).toBe(1);
    expect(actor.getSnapshot().context.serverNumber).toBe(2);

    // Team 1 scores a point
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().context.team1Score).toBe(1);

    // Side out: team 1 server 2 -> team 2 server 1
    actor.send({ type: 'SIDE_OUT' });
    expect(actor.getSnapshot().context.servingTeam).toBe(2);
    expect(actor.getSnapshot().context.serverNumber).toBe(1);

    // Team 2 scores
    actor.send({ type: 'SCORE_POINT', team: 2 });
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    // Non-serving team cannot score in side-out mode
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().context.team1Score).toBe(1); // unchanged

    actor.stop();
  });

  it('undo works across multiple actions', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'singles',
        scoringMode: 'rally',
        matchFormat: 'single',
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    actor.send({ type: 'SCORE_POINT', team: 1 });
    actor.send({ type: 'SCORE_POINT', team: 2 });
    actor.send({ type: 'SCORE_POINT', team: 1 });

    expect(actor.getSnapshot().context.team1Score).toBe(2);
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.team1Score).toBe(1);
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.team1Score).toBe(1);
    expect(actor.getSnapshot().context.team2Score).toBe(0);

    actor.stop();
  });
});
```

**Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 3: Build and verify no errors**

```bash
npm run build
```

Expected: Clean build with no TypeScript or bundling errors.

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: add integration tests for scoring engine"
```

---

## Summary: Task Order and Dependencies

```
Task 1:  Project Scaffolding          (foundation)
Task 2:  Database & Repositories      (depends on 1)
Task 3:  Scoring Engine (XState)      (depends on 1)
Task 4:  App Stores (SolidJS native)  (depends on 2)
Task 5:  Routing & App Shell          (depends on 1)
Task 6:  Game Setup Page              (depends on 2, 5)
Task 7:  Live Scoring Page            (depends on 2, 3, 5, 6)
Task 8:  Match History Page           (depends on 2, 4, 5)
Task 9:  Players Page                 (depends on 2, 4, 5)
Task 10: Statistics                   (depends on 2, 8, 9)
Task 11: PWA Polish & Wake Lock       (depends on 7)
Task 12: Integration Testing          (depends on 3, 7)
```

Parallelizable: Tasks 3 and 4 can be built simultaneously. Tasks 8 and 9 can be built simultaneously. Everything else is sequential.
