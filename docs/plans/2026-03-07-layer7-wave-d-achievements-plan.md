# Layer 7 Wave D: Achievements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 23-badge achievement system with in-game toast notifications and a Trophy Case on the Profile page.

**Architecture:** Synchronous badge evaluation outside the Firestore transaction in `processMatchCompletion`, following the same pattern as `writePublicTier`. Pure `badgeEngine.evaluate()` receives stats + match context, returns unlocked achievements. Firestore subcollection `users/{uid}/achievements/{achievementId}` with Dexie cache. Module-level SolidJS signal for toast delivery.

**Tech Stack:** SolidJS 1.9, Dexie.js v3, Firestore, Tailwind CSS v4, Vitest

**Design doc:** `docs/plans/2026-03-07-layer7-wave-d-achievements-design.md`

---

## Task 1: Achievement Types & Definitions

**Files:**
- Modify: `src/data/types.ts` (add achievement types after `LeaderboardEntry`)
- Create: `src/features/achievements/engine/badgeDefinitions.ts`

**Step 1: Add types to `src/data/types.ts`**

Add after the `LeaderboardEntry` interface (after line 168):

```typescript
// --- Achievement types (Wave D) ---

export type AchievementTier = 'bronze' | 'silver' | 'gold';
export type AchievementCategory = 'milestones' | 'streaks' | 'improvement' | 'social' | 'moments' | 'consistency';

export type AchievementTriggerContext =
  | { type: 'stats'; field: string; value: number }
  | { type: 'match'; matchScore: string; outcome: string }
  | { type: 'tier'; from: string; to: string };

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: number;
  triggerMatchId: string;
  triggerContext: AchievementTriggerContext;
}

export interface CachedAchievement extends UnlockedAchievement {
  toastShown: 0 | 1;
  syncedAt: number;
}
```

**Step 2: Create badge definitions at `src/features/achievements/engine/badgeDefinitions.ts`**

```typescript
import type { AchievementTier, AchievementCategory } from '../../../data/types';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
}

export const ACHIEVEMENT_DEFINITIONS: BadgeDefinition[] = [
  // Milestones
  { id: 'first_rally', name: 'First Rally', description: 'Play your first match', category: 'milestones', tier: 'bronze', icon: '🏓' },
  { id: 'warming_up', name: 'Warming Up', description: 'Play 10 matches', category: 'milestones', tier: 'bronze', icon: '🔥' },
  { id: 'battle_tested', name: 'Battle Tested', description: 'Play 25 matches', category: 'milestones', tier: 'silver', icon: '⚔️' },
  { id: 'half_century', name: 'Half Century', description: 'Play 50 matches', category: 'milestones', tier: 'silver', icon: '🎯' },
  { id: 'century_club', name: 'Century Club', description: 'Play 100 matches', category: 'milestones', tier: 'gold', icon: '💯' },
  // Streaks
  { id: 'hat_trick', name: 'Hat Trick', description: 'Win 3 matches in a row', category: 'streaks', tier: 'bronze', icon: '🎩' },
  { id: 'on_fire', name: 'On Fire', description: 'Win 5 matches in a row', category: 'streaks', tier: 'silver', icon: '🔥' },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Win 10 matches in a row', category: 'streaks', tier: 'gold', icon: '⚡' },
  // Improvement
  { id: 'moving_up', name: 'Moving Up', description: 'Reach Intermediate tier', category: 'improvement', tier: 'bronze', icon: '📈' },
  { id: 'level_up', name: 'Level Up', description: 'Reach Advanced tier', category: 'improvement', tier: 'silver', icon: '🚀' },
  { id: 'elite', name: 'Elite', description: 'Reach Expert tier', category: 'improvement', tier: 'gold', icon: '👑' },
  { id: 'proven', name: 'Proven', description: 'Reach high tier confidence', category: 'improvement', tier: 'silver', icon: '✅' },
  // Social
  { id: 'new_rival', name: 'New Rival', description: 'Play against 5 different opponents', category: 'social', tier: 'bronze', icon: '🤝' },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Play against 15 different opponents', category: 'social', tier: 'silver', icon: '🦋' },
  { id: 'community_pillar', name: 'Community Pillar', description: 'Play against 30 different opponents', category: 'social', tier: 'gold', icon: '🏛️' },
  // Moments
  { id: 'shutout', name: 'Shutout', description: 'Win a game without opponent scoring', category: 'moments', tier: 'silver', icon: '🛡️' },
  { id: 'comeback_kid', name: 'Comeback Kid', description: 'Lose game 1 but win the match', category: 'moments', tier: 'silver', icon: '💪' },
  { id: 'perfect_match', name: 'Perfect Match', description: 'Win every game in a best-of-3+', category: 'moments', tier: 'silver', icon: '✨' },
  { id: 'doubles_specialist', name: 'Doubles Specialist', description: 'Win 25 doubles matches', category: 'moments', tier: 'silver', icon: '👥' },
  { id: 'singles_ace', name: 'Singles Ace', description: 'Win 25 singles matches', category: 'moments', tier: 'silver', icon: '🎾' },
  // Consistency
  { id: 'first_win', name: 'First Win', description: 'Win your first match', category: 'consistency', tier: 'bronze', icon: '🏆' },
  { id: 'winning_ways', name: 'Winning Ways', description: 'Reach 60% win rate (20+ matches)', category: 'consistency', tier: 'silver', icon: '📊' },
  { id: 'dominant_force', name: 'Dominant Force', description: 'Reach 75% win rate (30+ matches)', category: 'consistency', tier: 'gold', icon: '💎' },
];

export function getDefinition(id: string): BadgeDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find(d => d.id === id);
}

export function getDefinitionsByCategory(category: AchievementCategory): BadgeDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter(d => d.category === category);
}
```

**Step 3: Commit**

```bash
git add src/data/types.ts src/features/achievements/engine/badgeDefinitions.ts
git commit -m "feat(achievements): add achievement types and 23 badge definitions"
```

---

## Task 2: Badge Engine (Pure Evaluation Logic)

**Files:**
- Create: `src/features/achievements/engine/badgeEngine.ts`
- Create: `src/features/achievements/engine/__tests__/badgeEngine.test.ts`

**Step 1: Write the failing tests at `src/features/achievements/engine/__tests__/badgeEngine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { evaluate } from '../badgeEngine';
import type { BadgeEvalContext } from '../badgeEngine';
import type { StatsSummary, Match, Tier } from '../../../../data/types';

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
    ...overrides,
  };
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1,
    status: 'completed',
    startedAt: Date.now(),
    completedAt: Date.now(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<BadgeEvalContext> = {}): BadgeEvalContext {
  return {
    stats: makeStats(),
    match: makeMatch(),
    playerTeam: 1,
    result: 'win',
    existingIds: new Set(),
    ...overrides,
  };
}

function unlockedIds(ctx: BadgeEvalContext): string[] {
  return evaluate(ctx).map(a => a.achievementId);
}

describe('badgeEngine.evaluate', () => {
  // --- Milestones ---
  describe('milestones', () => {
    it('unlocks first_rally at 1 match', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 1 }) }))).toContain('first_rally');
    });

    it('does not unlock first_rally at 0 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 0 }) }))).not.toContain('first_rally');
    });

    it('unlocks warming_up at 10 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 10 }) }))).toContain('warming_up');
    });

    it('unlocks battle_tested at 25 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 25 }) }))).toContain('battle_tested');
    });

    it('unlocks half_century at 50 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 50 }) }))).toContain('half_century');
    });

    it('unlocks century_club at 100 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 100 }) }))).toContain('century_club');
    });

    it('does not unlock century_club at 99 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 99 }) }))).not.toContain('century_club');
    });
  });

  // --- Streaks ---
  describe('streaks', () => {
    it('unlocks hat_trick at bestWinStreak 3', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 3 }) }))).toContain('hat_trick');
    });

    it('unlocks on_fire at bestWinStreak 5', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 5 }) }))).toContain('on_fire');
    });

    it('unlocks unstoppable at bestWinStreak 10', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 10 }) }))).toContain('unstoppable');
    });
  });

  // --- Improvement ---
  describe('improvement', () => {
    it('unlocks moving_up when promoted to intermediate', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'intermediate' }),
        previousTier: 'beginner',
      });
      expect(unlockedIds(ctx)).toContain('moving_up');
    });

    it('does not unlock moving_up without tier change', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'intermediate' }),
        previousTier: 'intermediate',
      });
      expect(unlockedIds(ctx)).not.toContain('moving_up');
    });

    it('unlocks level_up when promoted to advanced', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'advanced' }),
        previousTier: 'intermediate',
      });
      expect(unlockedIds(ctx)).toContain('level_up');
    });

    it('unlocks elite when promoted to expert', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'expert' }),
        previousTier: 'advanced',
      });
      expect(unlockedIds(ctx)).toContain('elite');
    });

    it('unlocks proven at high tier confidence', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ tierConfidence: 'high' }) }))).toContain('proven');
    });

    it('does not unlock proven at medium confidence', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ tierConfidence: 'medium' }) }))).not.toContain('proven');
    });
  });

  // --- Social ---
  describe('social', () => {
    it('unlocks new_rival at 5 unique opponents', () => {
      const uids = Array.from({ length: 5 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('new_rival');
    });

    it('unlocks social_butterfly at 15 unique opponents', () => {
      const uids = Array.from({ length: 15 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('social_butterfly');
    });

    it('unlocks community_pillar at 30 unique opponents', () => {
      const uids = Array.from({ length: 30 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('community_pillar');
    });
  });

  // --- Moments ---
  describe('moments', () => {
    it('unlocks shutout when opponent scores 0 in any game', () => {
      const match = makeMatch({
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 0, winningSide: 1 }],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('shutout');
    });

    it('does not unlock shutout on a loss', () => {
      const match = makeMatch({
        games: [{ gameNumber: 1, team1Score: 0, team2Score: 11, winningSide: 2 }],
        winningSide: 2,
      });
      expect(unlockedIds(makeCtx({ match, result: 'loss', playerTeam: 1 }))).not.toContain('shutout');
    });

    it('unlocks comeback_kid when lost game 1 but won match (best-of-3)', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        games: [
          { gameNumber: 1, team1Score: 5, team2Score: 11, winningSide: 2 },
          { gameNumber: 2, team1Score: 11, team2Score: 4, winningSide: 1 },
          { gameNumber: 3, team1Score: 11, team2Score: 6, winningSide: 1 },
        ],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('comeback_kid');
    });

    it('does not unlock comeback_kid in single-game match', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).not.toContain('comeback_kid');
    });

    it('unlocks perfect_match when won all games in best-of-3', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        games: [
          { gameNumber: 1, team1Score: 11, team2Score: 4, winningSide: 1 },
          { gameNumber: 2, team1Score: 11, team2Score: 6, winningSide: 1 },
        ],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('perfect_match');
    });

    it('does not unlock perfect_match in single-game match', () => {
      expect(unlockedIds(makeCtx({ result: 'win' }))).not.toContain('perfect_match');
    });

    it('unlocks doubles_specialist at 25 doubles wins', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ doubles: { matches: 30, wins: 25, losses: 5 } }),
      }))).toContain('doubles_specialist');
    });

    it('unlocks singles_ace at 25 singles wins', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ singles: { matches: 30, wins: 25, losses: 5 } }),
      }))).toContain('singles_ace');
    });
  });

  // --- Consistency ---
  describe('consistency', () => {
    it('unlocks first_win at 1 win', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ wins: 1 }) }))).toContain('first_win');
    });

    it('unlocks winning_ways at 60% win rate with 20+ matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.6, totalMatches: 20 }),
      }))).toContain('winning_ways');
    });

    it('does not unlock winning_ways below 20 matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.7, totalMatches: 19 }),
      }))).not.toContain('winning_ways');
    });

    it('unlocks dominant_force at 75% win rate with 30+ matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.75, totalMatches: 30 }),
      }))).toContain('dominant_force');
    });

    it('does not unlock dominant_force below 30 matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.8, totalMatches: 29 }),
      }))).not.toContain('dominant_force');
    });
  });

  // --- Cross-cutting ---
  describe('cross-cutting', () => {
    it('skips already-unlocked achievements', () => {
      const ctx = makeCtx({
        stats: makeStats({ totalMatches: 1, wins: 1 }),
        existingIds: new Set(['first_rally', 'first_win']),
      });
      const ids = unlockedIds(ctx);
      expect(ids).not.toContain('first_rally');
      expect(ids).not.toContain('first_win');
    });

    it('returns empty array when nothing qualifies', () => {
      const ctx = makeCtx({ stats: makeStats() });
      expect(evaluate(ctx)).toEqual([]);
    });

    it('can unlock multiple achievements at once', () => {
      const ctx = makeCtx({
        stats: makeStats({ totalMatches: 1, wins: 1 }),
      });
      const ids = unlockedIds(ctx);
      expect(ids).toContain('first_rally');
      expect(ids).toContain('first_win');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/achievements/engine/__tests__/badgeEngine.test.ts`
Expected: FAIL — cannot resolve `../badgeEngine`

**Step 3: Write the implementation at `src/features/achievements/engine/badgeEngine.ts`**

```typescript
import type { StatsSummary, Match, Tier, UnlockedAchievement, AchievementTriggerContext } from '../../../data/types';
import { ACHIEVEMENT_DEFINITIONS } from './badgeDefinitions';
import type { BadgeDefinition } from './badgeDefinitions';

export interface BadgeEvalContext {
  stats: StatsSummary;
  match: Match;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
  existingIds: Set<string>;
  previousTier?: Tier;
}

type CheckFn = (ctx: BadgeEvalContext) => boolean;

const TIER_ORDER: Record<Tier, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

const checks: Record<string, CheckFn> = {
  // Milestones
  first_rally: (ctx) => ctx.stats.totalMatches >= 1,
  warming_up: (ctx) => ctx.stats.totalMatches >= 10,
  battle_tested: (ctx) => ctx.stats.totalMatches >= 25,
  half_century: (ctx) => ctx.stats.totalMatches >= 50,
  century_club: (ctx) => ctx.stats.totalMatches >= 100,
  // Streaks
  hat_trick: (ctx) => ctx.stats.bestWinStreak >= 3,
  on_fire: (ctx) => ctx.stats.bestWinStreak >= 5,
  unstoppable: (ctx) => ctx.stats.bestWinStreak >= 10,
  // Improvement
  moving_up: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['intermediate'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['intermediate'];
  },
  level_up: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['advanced'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['advanced'];
  },
  elite: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['expert'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['expert'];
  },
  proven: (ctx) => ctx.stats.tierConfidence === 'high',
  // Social
  new_rival: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 5,
  social_butterfly: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 15,
  community_pillar: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 30,
  // Moments
  shutout: (ctx) => {
    if (ctx.result !== 'win') return false;
    return ctx.match.games.some(g => {
      const loserScore = ctx.playerTeam === 1 ? g.team2Score : g.team1Score;
      return loserScore === 0;
    });
  },
  comeback_kid: (ctx) => {
    if (ctx.result !== 'win') return false;
    if (ctx.match.games.length < 2) return false;
    const game1 = ctx.match.games[0];
    return game1.winningSide !== ctx.playerTeam;
  },
  perfect_match: (ctx) => {
    if (ctx.result !== 'win') return false;
    if (ctx.match.games.length < 2) return false;
    return ctx.match.games.every(g => g.winningSide === ctx.playerTeam);
  },
  doubles_specialist: (ctx) => ctx.stats.doubles.wins >= 25,
  singles_ace: (ctx) => ctx.stats.singles.wins >= 25,
  // Consistency
  first_win: (ctx) => ctx.stats.wins >= 1,
  winning_ways: (ctx) => ctx.stats.totalMatches >= 20 && ctx.stats.winRate >= 0.6,
  dominant_force: (ctx) => ctx.stats.totalMatches >= 30 && ctx.stats.winRate >= 0.75,
};

function buildTriggerContext(def: BadgeDefinition, ctx: BadgeEvalContext): AchievementTriggerContext {
  if (def.category === 'moments') {
    const scores = ctx.match.games.map(g => `${g.team1Score}-${g.team2Score}`).join(', ');
    return { type: 'match', matchScore: scores, outcome: ctx.result };
  }
  if (def.category === 'improvement' && ctx.previousTier) {
    return { type: 'tier', from: ctx.previousTier, to: ctx.stats.tier };
  }
  // Stats-based
  const fieldMap: Record<string, number> = {
    first_rally: ctx.stats.totalMatches,
    warming_up: ctx.stats.totalMatches,
    battle_tested: ctx.stats.totalMatches,
    half_century: ctx.stats.totalMatches,
    century_club: ctx.stats.totalMatches,
    hat_trick: ctx.stats.bestWinStreak,
    on_fire: ctx.stats.bestWinStreak,
    unstoppable: ctx.stats.bestWinStreak,
    proven: ctx.stats.totalMatches,
    new_rival: (ctx.stats.uniqueOpponentUids ?? []).length,
    social_butterfly: (ctx.stats.uniqueOpponentUids ?? []).length,
    community_pillar: (ctx.stats.uniqueOpponentUids ?? []).length,
    first_win: ctx.stats.wins,
    winning_ways: ctx.stats.winRate,
    dominant_force: ctx.stats.winRate,
    doubles_specialist: ctx.stats.doubles.wins,
    singles_ace: ctx.stats.singles.wins,
  };
  return { type: 'stats', field: def.id, value: fieldMap[def.id] ?? 0 };
}

export function evaluate(ctx: BadgeEvalContext): UnlockedAchievement[] {
  const now = Date.now();
  return ACHIEVEMENT_DEFINITIONS
    .filter(def => {
      if (ctx.existingIds.has(def.id)) return false;
      const check = checks[def.id];
      return check ? check(ctx) : false;
    })
    .map(def => ({
      achievementId: def.id,
      unlockedAt: now,
      triggerMatchId: ctx.match.id,
      triggerContext: buildTriggerContext(def, ctx),
    }));
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/achievements/engine/__tests__/badgeEngine.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/features/achievements/engine/badgeEngine.ts src/features/achievements/engine/__tests__/badgeEngine.test.ts
git commit -m "feat(achievements): add badge engine with 23 evaluation rules and tests"
```

---

## Task 3: Dexie Schema (v4) & Achievement Repository

**Files:**
- Modify: `src/data/db.ts` (add v4 with achievements table)
- Create: `src/features/achievements/repository/firestoreAchievementRepository.ts`

**Step 1: Add Dexie v4 schema to `src/data/db.ts`**

Add `CachedAchievement` to the EntityTable type union and add version 4:

```typescript
import type { Match, Player, ScoreEvent, Tournament, CachedAchievement } from './types';
import type { SyncJob } from './firebase/syncQueue.types';

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
  syncQueue: EntityTable<SyncJob, 'id'>;
  achievements: EntityTable<CachedAchievement, 'achievementId'>;
};

// ... existing v1, v2, v3 ...

db.version(4).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
  achievements: 'achievementId',
});
```

**Step 2: Create Firestore repository at `src/features/achievements/repository/firestoreAchievementRepository.ts`**

```typescript
import { doc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import { db } from '../../../data/db';
import type { UnlockedAchievement, CachedAchievement } from '../../../data/types';

export const firestoreAchievementRepository = {
  async getUnlockedIds(uid: string): Promise<Set<string>> {
    const snap = await getDocs(collection(firestore, 'users', uid, 'achievements'));
    return new Set(snap.docs.map(d => d.id));
  },

  async create(uid: string, achievement: UnlockedAchievement): Promise<void> {
    const ref = doc(firestore, 'users', uid, 'achievements', achievement.achievementId);
    await setDoc(ref, {
      achievementId: achievement.achievementId,
      unlockedAt: Timestamp.fromMillis(achievement.unlockedAt),
      triggerMatchId: achievement.triggerMatchId,
      triggerContext: achievement.triggerContext,
    });
  },

  async cacheInDexie(achievement: UnlockedAchievement): Promise<void> {
    await db.achievements.put({
      ...achievement,
      toastShown: 0,
      syncedAt: Date.now(),
    });
  },

  async refreshForUser(uid: string): Promise<void> {
    const snap = await getDocs(collection(firestore, 'users', uid, 'achievements'));
    const firestoreAchievements = snap.docs.map(d => {
      const data = d.data();
      return {
        achievementId: d.id,
        unlockedAt: data.unlockedAt?.toMillis?.() ?? data.unlockedAt,
        triggerMatchId: data.triggerMatchId ?? '',
        triggerContext: data.triggerContext ?? { type: 'stats' as const, field: '', value: 0 },
      };
    });

    // Preserve local toastShown state
    const existing = await db.achievements.toArray();
    const existingMap = new Map(existing.map(a => [a.achievementId, a]));

    const toUpsert: CachedAchievement[] = firestoreAchievements.map(fa => ({
      ...fa,
      toastShown: existingMap.get(fa.achievementId)?.toastShown ?? 0,
      syncedAt: Date.now(),
    }));

    if (toUpsert.length > 0) {
      await db.achievements.bulkPut(toUpsert);
    }
  },
};
```

**Step 3: Commit**

```bash
git add src/data/db.ts src/features/achievements/repository/firestoreAchievementRepository.ts
git commit -m "feat(achievements): add Dexie v4 schema and Firestore achievement repository"
```

---

## Task 4: Achievement Store (Toast Signal)

**Files:**
- Create: `src/features/achievements/store/achievementStore.ts`

**Step 1: Create the store at `src/features/achievements/store/achievementStore.ts`**

```typescript
import { createSignal } from 'solid-js';

export interface PendingToast {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
}

const MAX_TOAST_QUEUE = 10;

const [pendingToasts, setPendingToasts] = createSignal<PendingToast[]>([]);

export { pendingToasts };

export function enqueueToast(toast: Omit<PendingToast, 'id'>): void {
  const id = crypto.randomUUID();
  setPendingToasts(prev => {
    if (prev.length >= MAX_TOAST_QUEUE) return prev;
    return [...prev, { ...toast, id }];
  });
}

export function dismissToast(id: string): void {
  setPendingToasts(prev => prev.filter(t => t.id !== id));
}

export function clearToasts(): void {
  setPendingToasts([]);
}
```

**Step 2: Commit**

```bash
git add src/features/achievements/store/achievementStore.ts
git commit -m "feat(achievements): add toast queue signal store"
```

---

## Task 5: Integration with processMatchCompletion

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`

**Step 1: Write integration test (add to existing stats repo test or create new)**

Create `src/features/achievements/engine/__tests__/achievementIntegration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluate } from '../badgeEngine';
import type { BadgeEvalContext } from '../badgeEngine';

describe('achievement integration with stats pipeline', () => {
  it('evaluates with correct context shape', () => {
    const ctx: BadgeEvalContext = {
      stats: {
        schemaVersion: 1, totalMatches: 1, wins: 1, losses: 0, winRate: 1,
        currentStreak: { type: 'W', count: 1 }, bestWinStreak: 1,
        singles: { matches: 1, wins: 1, losses: 0 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [], tier: 'beginner', tierConfidence: 'low',
        tierUpdatedAt: Date.now(), lastPlayedAt: Date.now(),
        updatedAt: Date.now(), uniqueOpponentUids: [],
      },
      match: {
        id: 'test-match', config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1, status: 'completed', startedAt: Date.now(), completedAt: Date.now(),
      },
      playerTeam: 1,
      result: 'win',
      existingIds: new Set(),
      previousTier: 'beginner',
    };

    const unlocked = evaluate(ctx);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(unlocked.every(a => a.achievementId && a.triggerMatchId === 'test-match')).toBe(true);
  });

  it('gates on tierUpdated — returns empty when previousTier equals current', () => {
    const ctx: BadgeEvalContext = {
      stats: {
        schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
        currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
        singles: { matches: 0, wins: 0, losses: 0 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [], tier: 'beginner', tierConfidence: 'low',
        tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
      },
      match: {
        id: 'test', config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1, status: 'completed', startedAt: 0, completedAt: 0,
      },
      playerTeam: 1,
      result: 'win',
      existingIds: new Set(),
    };

    const unlocked = evaluate(ctx);
    // No improvement badges should unlock without previousTier
    expect(unlocked.map(a => a.achievementId)).not.toContain('moving_up');
  });
});
```

**Step 2: Run to verify pass**

Run: `npx vitest run src/features/achievements/engine/__tests__/achievementIntegration.test.ts`

**Step 3: Modify `src/data/firebase/firestorePlayerStatsRepository.ts`**

Add imports at the top:

```typescript
import { evaluate } from '../../features/achievements/engine/badgeEngine';
import { firestoreAchievementRepository } from '../../features/achievements/repository/firestoreAchievementRepository';
import { enqueueToast } from '../../features/achievements/store/achievementStore';
import { getDefinition } from '../../features/achievements/engine/badgeDefinitions';
import { auth } from './config';
```

In `updatePlayerStats`, add `let previousTier: Tier = 'beginner';` and `let committedStats: StatsSummary | null = null;` alongside existing `newTier`/`tierUpdated` declarations (around line 227).

Inside the transaction, capture `previousTier = stats.tier;` right after reading existing stats (before line 303 where tier is computed). Capture `committedStats = { ...stats };` right before the transaction writes (before line 321).

After the `writePublicTier` block (after line 343), add:

```typescript
    // Achievement evaluation — outside the transaction, gated on tierUpdated
    if (tierUpdated && committedStats) {
      try {
        const existingIds = await firestoreAchievementRepository.getUnlockedIds(uid);
        const unlocked = evaluate({
          stats: committedStats,
          match,
          playerTeam,
          result,
          existingIds,
          previousTier,
        });

        if (unlocked.length > 0) {
          await Promise.all(unlocked.map(a => firestoreAchievementRepository.create(uid, a)));
          await Promise.all(unlocked.map(a => firestoreAchievementRepository.cacheInDexie(a)));

          const currentUserUid = auth.currentUser?.uid ?? null;
          if (uid === currentUserUid) {
            for (const a of unlocked) {
              const def = getDefinition(a.achievementId);
              if (def) {
                enqueueToast({
                  achievementId: a.achievementId,
                  name: def.name,
                  description: def.description,
                  icon: def.icon,
                  tier: def.tier,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Achievement evaluation failed for user:', uid, err);
      }
    }
```

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (existing + new tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/features/achievements/engine/__tests__/achievementIntegration.test.ts
git commit -m "feat(achievements): integrate badge evaluation with processMatchCompletion"
```

---

## Task 6: Firestore Security Rules

**Files:**
- Modify: `firestore.rules`
- Modify: `test/rules/firestore.test.ts`

**Step 1: Add achievement rules to `firestore.rules`**

After the stats summary rules (after line 499), add:

```
    // ── Achievements (/users/{userId}/achievements/{achievementId}) ──
    match /users/{userId}/achievements/{achievementId} {
      allow read: if request.auth != null && request.auth.uid == userId;

      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.achievementId == achievementId
        && request.resource.data.achievementId is string
        && request.resource.data.unlockedAt is timestamp
        && request.resource.data.triggerMatchId is string
        && request.resource.data.keys().hasAll(
             ['achievementId', 'unlockedAt', 'triggerMatchId'])
        && request.resource.data.keys().hasOnly(
             ['achievementId', 'unlockedAt', 'triggerMatchId', 'triggerContext'])
        && (!('triggerContext' in request.resource.data)
            || request.resource.data.triggerContext is map);

      allow update, delete: if false;
    }
```

**Step 2: Add security rules tests to `test/rules/firestore.test.ts`**

Add a new `describe('achievements')` block with tests for:
- Owner can read own achievement (pass)
- Stranger cannot read another user's achievement (fail)
- Unauthenticated cannot read (fail)
- Owner can create valid achievement (pass)
- Owner can create without triggerContext (pass)
- Cross-user create fails
- Missing required fields fails
- Extra fields fails
- achievementId mismatch fails
- Update denied
- Delete denied

**Step 3: Run rules tests**

Run: `npx vitest run test/rules/`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add firestore.rules test/rules/firestore.test.ts
git commit -m "feat(achievements): add Firestore security rules with tests"
```

---

## Task 7: useAchievements Hook

**Files:**
- Create: `src/features/achievements/hooks/useAchievements.ts`

**Step 1: Create the hook**

```typescript
import { createEffect } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useLiveQuery } from '../../../data/useLiveQuery';
import { db } from '../../../data/db';
import { firestoreAchievementRepository } from '../repository/firestoreAchievementRepository';
import type { CachedAchievement } from '../../../data/types';

export function useAchievements(userId: Accessor<string | undefined>) {
  const { data: unlocked, error } = useLiveQuery<CachedAchievement[]>(
    () => db.achievements.toArray(),
    userId,
  );

  createEffect(() => {
    const uid = userId();
    if (!uid) return;
    firestoreAchievementRepository.refreshForUser(uid).catch((err) => {
      console.warn('Achievement refresh failed:', err);
    });
  });

  return { unlocked, error };
}
```

**Step 2: Commit**

```bash
git add src/features/achievements/hooks/useAchievements.ts
git commit -m "feat(achievements): add useAchievements hook with Dexie live query"
```

---

## Task 8: Achievement Toast Component

**Files:**
- Create: `src/features/achievements/components/AchievementToast.tsx`
- Modify: `src/app/App.tsx` (mount toast component)

**Step 1: Create the toast component at `src/features/achievements/components/AchievementToast.tsx`**

```typescript
import { Show, createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { pendingToasts, dismissToast } from '../store/achievementStore';
import type { PendingToast } from '../store/achievementStore';

const APPEAR_DELAY = 1500;
const VISIBLE_DURATION = 5000;
const GAP_BETWEEN = 3000;
const EXIT_ANIMATION = 300;

const TIER_BORDER: Record<string, string> = {
  bronze: 'border-l-amber-600',
  silver: 'border-l-[#c0c0c0]',
  gold: 'border-l-yellow-400',
};

const AchievementToast: Component = () => {
  const [current, setCurrent] = createSignal<PendingToast | null>(null);
  const [visible, setVisible] = createSignal(false);
  let timers: ReturnType<typeof setTimeout>[] = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function processNext() {
    const toasts = pendingToasts();
    if (toasts.length === 0 || current()) return;

    const next = toasts[0];
    setCurrent(next);

    const appearTimer = setTimeout(() => setVisible(true), APPEAR_DELAY);
    const dismissTimer = setTimeout(() => {
      handleDismiss(next.id);
    }, APPEAR_DELAY + VISIBLE_DURATION);

    timers = [appearTimer, dismissTimer];
  }

  function handleDismiss(id: string) {
    clearTimers();
    setVisible(false);
    const exitTimer = setTimeout(() => {
      dismissToast(id);
      setCurrent(null);
      const gapTimer = setTimeout(processNext, GAP_BETWEEN);
      timers = [gapTimer];
    }, EXIT_ANIMATION);
    timers = [exitTimer];
  }

  createEffect(() => {
    if (pendingToasts().length > 0 && !current()) {
      processNext();
    }
  });

  onCleanup(clearTimers);

  return (
    <>
      {/* Screen reader live region — always in DOM */}
      <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
        <Show when={current() && visible()}>
          Achievement unlocked: {current()!.name}. {current()!.description}
        </Show>
      </div>

      {/* Visual toast */}
      <Show when={current()}>
        {(toast) => (
          <div
            class={`fixed z-50 left-1/2 -translate-x-1/2 max-w-sm w-[90vw]
              bg-surface-light border-l-4 ${TIER_BORDER[toast().tier] ?? 'border-l-primary'}
              rounded-xl shadow-lg px-4 py-3 flex items-center gap-3
              transition-all duration-300
              motion-safe:${visible() ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
              motion-reduce:${visible() ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px + 8px)' }}
            aria-hidden="true"
          >
            <span class="text-2xl flex-shrink-0" aria-hidden="true">{toast().icon}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-on-surface">{toast().name}</div>
              <div class="text-xs text-on-surface-muted">{toast().description}</div>
            </div>
            <button
              type="button"
              class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-lighter transition-colors text-on-surface-muted"
              aria-label="Dismiss achievement notification"
              onClick={() => handleDismiss(toast().id)}
            >
              <span aria-hidden="true" class="text-lg">&times;</span>
            </button>
          </div>
        )}
      </Show>
    </>
  );
};

export default AchievementToast;
```

**Step 2: Mount in `src/app/App.tsx`**

Add import:
```typescript
import AchievementToast from '../features/achievements/components/AchievementToast';
```

Add `<AchievementToast />` inside the root div, before `<Suspense>`:

```tsx
<div class="min-h-screen bg-surface text-on-surface">
  <a href="#main-content" class="sr-only ...">Skip to main content</a>
  <AchievementToast />
  <Suspense fallback={...}>
    {props.children}
  </Suspense>
  <Show when={showBottomNav()}>
    <BottomNav />
  </Show>
</div>
```

**Step 3: Commit**

```bash
git add src/features/achievements/components/AchievementToast.tsx src/app/App.tsx
git commit -m "feat(achievements): add AchievementToast component mounted in App root"
```

---

## Task 9: Trophy Case & AchievementBadge Components

**Files:**
- Create: `src/features/achievements/engine/achievementHelpers.ts`
- Create: `src/features/achievements/components/AchievementBadge.tsx`
- Create: `src/features/achievements/components/TrophyCase.tsx`
- Modify: `src/features/profile/ProfilePage.tsx`

**Step 1: Create helpers at `src/features/achievements/engine/achievementHelpers.ts`**

```typescript
import type { StatsSummary } from '../../../data/types';
import type { BadgeDefinition } from './badgeDefinitions';

export interface AchievementProgress {
  current: number;
  target: number;
}

export function computeProgress(def: BadgeDefinition, stats: StatsSummary | null): AchievementProgress | undefined {
  if (!stats) return undefined;

  const progressMap: Record<string, { current: number; target: number }> = {
    first_rally: { current: stats.totalMatches, target: 1 },
    warming_up: { current: stats.totalMatches, target: 10 },
    battle_tested: { current: stats.totalMatches, target: 25 },
    half_century: { current: stats.totalMatches, target: 50 },
    century_club: { current: stats.totalMatches, target: 100 },
    hat_trick: { current: stats.bestWinStreak, target: 3 },
    on_fire: { current: stats.bestWinStreak, target: 5 },
    unstoppable: { current: stats.bestWinStreak, target: 10 },
    new_rival: { current: (stats.uniqueOpponentUids ?? []).length, target: 5 },
    social_butterfly: { current: (stats.uniqueOpponentUids ?? []).length, target: 15 },
    community_pillar: { current: (stats.uniqueOpponentUids ?? []).length, target: 30 },
    first_win: { current: stats.wins, target: 1 },
    winning_ways: { current: stats.totalMatches >= 20 ? Math.round(stats.winRate * 100) : stats.totalMatches, target: stats.totalMatches >= 20 ? 60 : 20 },
    dominant_force: { current: stats.totalMatches >= 30 ? Math.round(stats.winRate * 100) : stats.totalMatches, target: stats.totalMatches >= 30 ? 75 : 30 },
    doubles_specialist: { current: stats.doubles.wins, target: 25 },
    singles_ace: { current: stats.singles.wins, target: 25 },
  };

  return progressMap[def.id];
}
```

**Step 2: Create `AchievementBadge` at `src/features/achievements/components/AchievementBadge.tsx`**

```typescript
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { AchievementProgress } from '../engine/achievementHelpers';

export interface AchievementDisplayItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress?: AchievementProgress;
}

interface AchievementBadgeProps {
  item: AchievementDisplayItem;
}

const TIER_BORDER: Record<string, string> = {
  bronze: 'border-l-amber-600',
  silver: 'border-l-[#c0c0c0]',
  gold: 'border-l-yellow-400',
};

const TIER_LABEL_COLOR: Record<string, string> = {
  bronze: 'text-amber-600',
  silver: 'text-[#c0c0c0]',
  gold: 'text-yellow-400',
};

const AchievementBadge: Component<AchievementBadgeProps> = (props) => {
  return (
    <div
      role="listitem"
      aria-label={props.item.unlocked
        ? `${props.item.name}, ${props.item.tier} tier, unlocked. ${props.item.description}`
        : `${props.item.name}, locked. ${props.item.description}${props.item.progress ? `. Progress: ${props.item.progress.current} of ${props.item.progress.target}` : ''}`}
      aria-disabled={!props.item.unlocked}
      class={`border-l-4 rounded-xl p-3 ${
        props.item.unlocked
          ? `bg-surface-light ${TIER_BORDER[props.item.tier] ?? 'border-l-primary'}`
          : 'bg-surface-light/50 border-l-gray-600'
      }`}
    >
      <div class="flex items-start gap-2">
        <span aria-hidden="true" class={`text-xl flex-shrink-0 ${props.item.unlocked ? '' : 'grayscale opacity-50'}`}>
          {props.item.unlocked ? props.item.icon : '🔒'}
        </span>
        <div class="flex-1 min-w-0">
          <div class={`text-xs font-semibold leading-tight ${props.item.unlocked ? 'text-on-surface' : 'text-gray-400'}`}>
            {props.item.name}
          </div>
          <div class={`text-[10px] uppercase tracking-wider font-medium mt-0.5 ${TIER_LABEL_COLOR[props.item.tier] ?? 'text-on-surface-muted'}`}>
            {props.item.tier}
          </div>
        </div>
      </div>

      {/* Progress bar for locked badges */}
      <Show when={!props.item.unlocked && props.item.progress}>
        {(progress) => (
          <div class="mt-2 w-full h-1 bg-surface-lighter rounded-full overflow-hidden">
            <div
              class={`h-full rounded-full ${props.item.unlocked ? 'bg-primary' : 'bg-gray-500'}`}
              style={{ width: `${Math.min(100, (progress().current / progress().target) * 100)}%` }}
            />
          </div>
        )}
      </Show>
    </div>
  );
};

export default AchievementBadge;
```

**Step 3: Create `TrophyCase` at `src/features/achievements/components/TrophyCase.tsx`**

```typescript
import { Show, For, createSignal, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import type { StatsSummary, CachedAchievement, AchievementCategory } from '../../../data/types';
import { ACHIEVEMENT_DEFINITIONS } from '../engine/badgeDefinitions';
import { computeProgress } from '../engine/achievementHelpers';
import AchievementBadge from './AchievementBadge';
import type { AchievementDisplayItem } from './AchievementBadge';

interface TrophyCaseProps {
  unlocked: CachedAchievement[] | undefined;
  stats: StatsSummary | null;
}

const CATEGORY_ORDER: AchievementCategory[] = ['milestones', 'streaks', 'improvement', 'social', 'moments', 'consistency'];

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestones: 'Milestones',
  streaks: 'Streaks',
  improvement: 'Improvement',
  social: 'Social',
  moments: 'Moments',
  consistency: 'Consistency',
};

const TrophyCase: Component<TrophyCaseProps> = (props) => {
  const displayItems = createMemo<AchievementDisplayItem[]>(() => {
    const unlockedList = props.unlocked ?? [];
    const unlockedById = new Map(unlockedList.map(u => [u.achievementId, u]));

    return ACHIEVEMENT_DEFINITIONS.map(def => {
      const cached = unlockedById.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        category: def.category,
        unlocked: !!cached,
        unlockedAt: cached?.unlockedAt,
        progress: cached ? undefined : computeProgress(def, props.stats),
      };
    });
  });

  const itemsByCategory = createMemo(() => {
    const items = displayItems();
    const grouped = new Map<AchievementCategory, (AchievementDisplayItem & { category: AchievementCategory })[]>();
    for (const cat of CATEGORY_ORDER) {
      grouped.set(cat, items.filter(i => (i as any).category === cat));
    }
    return grouped;
  });

  const unlockedCount = createMemo(() => displayItems().filter(i => i.unlocked).length);

  return (
    <section aria-labelledby="trophycase-heading" class="space-y-4">
      <h2 id="trophycase-heading" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
        Achievements ({unlockedCount()}/{ACHIEVEMENT_DEFINITIONS.length})
      </h2>

      <For each={CATEGORY_ORDER}>
        {(category) => {
          const items = () => itemsByCategory().get(category) ?? [];
          const unlockedItems = () => items().filter(i => i.unlocked);
          const lockedItems = () => items().filter(i => !i.unlocked);
          const nextAchievable = () => lockedItems()[0];
          const [showLocked, setShowLocked] = createSignal(false);

          const visibleItems = () => {
            const unlocked = unlockedItems();
            const next = nextAchievable();
            if (showLocked()) return items();
            return next ? [...unlocked, next] : unlocked;
          };

          return (
            <Show when={items().length > 0}>
              <div class="space-y-2">
                <h3 class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div role="list" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <For each={visibleItems()}>
                    {(item) => <AchievementBadge item={item} />}
                  </For>
                </div>
                <Show when={!showLocked() && lockedItems().length > 1}>
                  <button
                    type="button"
                    class="text-xs text-on-surface-muted hover:text-on-surface transition-colors"
                    onClick={() => setShowLocked(true)}
                  >
                    Show {lockedItems().length - 1} more locked
                  </button>
                </Show>
                <Show when={showLocked() && lockedItems().length > 1}>
                  <button
                    type="button"
                    class="text-xs text-on-surface-muted hover:text-on-surface transition-colors"
                    onClick={() => setShowLocked(false)}
                  >
                    Hide locked
                  </button>
                </Show>
              </div>
            </Show>
          );
        }}
      </For>
    </section>
  );
};

export default TrophyCase;
```

**Step 4: Integrate TrophyCase into ProfilePage (`src/features/profile/ProfilePage.tsx`)**

Add imports:
```typescript
import TrophyCase from '../achievements/components/TrophyCase';
import { useAchievements } from '../achievements/hooks/useAchievements';
```

Inside the component, after `useProfileData`:
```typescript
const { unlocked } = useAchievements(() => user()?.uid);
```

In the JSX, add between `<StatsOverview>` and `<RecentMatches>`:
```tsx
<TrophyCase unlocked={unlocked()} stats={data()?.stats ?? null} />
```

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/features/achievements/engine/achievementHelpers.ts src/features/achievements/components/AchievementBadge.tsx src/features/achievements/components/TrophyCase.tsx src/features/profile/ProfilePage.tsx
git commit -m "feat(achievements): add TrophyCase section to Profile page with badge grid"
```

---

## Task 10: Component Tests

**Files:**
- Create: `src/features/achievements/components/__tests__/AchievementBadge.test.tsx`
- Create: `src/features/achievements/components/__tests__/TrophyCase.test.tsx`
- Create: `src/features/achievements/components/__tests__/AchievementToast.test.tsx`
- Create: `src/features/achievements/engine/__tests__/achievementHelpers.test.ts`

Test coverage for:
- AchievementBadge: renders unlocked state, locked state, progress bar, tier label, aria attributes
- TrophyCase: renders categories, collapse/expand locked, unlocked count
- AchievementToast: enqueue/dismiss, timing, sequential display, live region
- achievementHelpers: computeProgress for each badge type, null stats handling

**Commit after all tests pass:**

```bash
git add src/features/achievements/components/__tests__/ src/features/achievements/engine/__tests__/achievementHelpers.test.ts
git commit -m "test(achievements): add component and helper tests"
```

---

## Task 11: E2E Tests

**Files:**
- Create: `e2e/achievements.spec.ts`

Test scenarios:
1. Score a match, verify achievement toast appears with badge name
2. Navigate to profile, verify Trophy Case section shows unlocked badge
3. Verify locked badges show progress bar

**Commit:**

```bash
git add e2e/achievements.spec.ts
git commit -m "test(e2e): add achievement toast and trophy case E2E tests"
```

---

## Summary

| Task | Description | Estimated Tests |
|------|-------------|----------------|
| 1 | Types & Definitions | 0 (types only) |
| 2 | Badge Engine | ~35 |
| 3 | Dexie Schema & Repository | 0 (integration) |
| 4 | Toast Store | 0 (simple signals) |
| 5 | processMatchCompletion Integration | ~3 |
| 6 | Security Rules | ~12 |
| 7 | useAchievements Hook | 0 (integration) |
| 8 | Toast Component | 0 (tested in Task 10) |
| 9 | Trophy Case & Badge Components | 0 (tested in Task 10) |
| 10 | Component & Helper Tests | ~25 |
| 11 | E2E Tests | ~3 |
| **Total** | | **~78 new tests** |
