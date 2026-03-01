# Layer 7 Wave B — Known v1 Limitations Backlog

> Documented during Layer 7 Wave A scenario reviews. These are design-level
> limitations that require either schema changes, additional Firestore reads,
> or UI/product decisions before they can be addressed.

## Root Cause

Issues 1–4 share a common root: **no player-to-UID mapping for casual matches**.
Tournament matches resolve UIDs via registration lookups, but casual matches
only know the scorer's UID. Fixing the casual path requires a UI flow for
players to identify themselves (account linking, player picker, or invite).

---

## Issue 1: Expert and Advanced tiers are unreachable

**Severity:** Design limitation
**Discovered:** Scenario 7 review

`opponentTier` is hardcoded to `'beginner'` in `RecentResult` (tier multiplier
0.5). The maximum achievable tier score is 0.50, but Advanced promotion requires
\> 0.53. Expert requires > 0.73. Both tiers exist in the engine but can never
be reached.

**Fix:** Look up opponent's actual tier from their `stats/summary` doc when
recording a `RecentResult`. This adds Firestore reads and has a circular
bootstrap problem (new players have no tier → defaults to beginner → same cap).

**Design decision needed:** What tier to assign unknown/new opponents —
`'beginner'` (current), `'intermediate'` (neutral seed), or skip tier weighting
until opponent has enough matches.

**Files:** `firestorePlayerStatsRepository.ts:170` (hardcoded `opponentTier`),
`tierEngine.ts` (TIER_MULTIPLIER).

---

## Issue 2: Confidence `uniqueOpponents` check never binds

**Severity:** Design limitation
**Discovered:** Scenario 10 review

`estimateUniqueOpponents` uses `Math.ceil(matchCount * 0.7)`, which always
exceeds the confidence thresholds (8 matches → 6 opponents ≥ 3; 20 matches →
14 opponents ≥ 6). The confidence gate is effectively just a match-count check.

**Fix:** Track actual unique opponent UIDs in `StatsSummary` (new field:
`uniqueOpponentUids: string[]` or `uniqueOpponentCount: number`). For
tournament matches, collect opponent UIDs from registrations. For casual
matches, blocked until player-to-UID mapping exists.

**Files:** `firestorePlayerStatsRepository.ts:181` (`estimateUniqueOpponents`),
`data/types.ts` (StatsSummary schema).

---

## Issue 3: Non-playing scorer gets phantom stats (casual)

**Severity:** Design limitation
**Discovered:** Scenario 3 review

For casual matches, the scorer is always treated as team-1 player. If someone
scores a match between two other people, the scorer incorrectly gets win/loss
credit.

**Fix:** Requires a UI change — the scorer must be able to identify who
actually played (e.g., player picker from buddy list, account linking). This
is a product design question.

**Files:** `firestorePlayerStatsRepository.ts:113-116` (casual fallback in
`resolveParticipantUids`).

---

## Issue 4: `opponentIds` and `partnerId` always empty/null

**Severity:** Low — data completeness
**Discovered:** Scenario 1 review

`MatchRef` has `opponentIds: string[]`, `partnerId: string | null`, and
`opponentNames` fields, but `opponentIds` is always `[]` and `partnerId`
is always `null`. For tournament matches this is fixable now (UIDs available
from registrations). For casual matches, blocked on player-to-UID mapping.

**Fix (tournament only):** Wire registration UIDs into `buildMatchRef` —
small effort, could be done independently.

**Files:** `firestorePlayerStatsRepository.ts:35-37` (hardcoded empty arrays
in `buildMatchRef`).

---

## Issue 5: Fire-and-forget sync race

**Severity:** Low
**Discovered:** Scenario 16 review

`syncPlayerStatsAfterMatch` runs as fire-and-forget after match completion.
If the match itself hasn't been synced to Firestore yet, the `matchRef`
document can reference a match that doesn't exist in Firestore. Stats are
supplementary data so this has low user impact.

**Fix:** Sequence match sync before stats sync, or accept eventual consistency.
Changing to sequential sync adds latency to match completion.

**Files:** `cloudSync.ts` (fire-and-forget call), `ScoringPage.tsx:204`.

---

## Suggested Wave B Approach

1. **Brainstorm** the casual player identification UX (biggest product decision)
2. **Tournament-only quick wins:** populate `opponentIds`/`partnerId`, look up
   real opponent tier for tournament matches
3. **Schema migration:** add `uniqueOpponentCount` to `StatsSummary`
4. **Casual match phase:** implement player picker UI, then wire up all the
   UID-dependent features for casual matches
