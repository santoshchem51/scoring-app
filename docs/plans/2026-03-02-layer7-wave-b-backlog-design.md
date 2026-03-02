# Layer 7 Wave B Backlog — Tournament Quick Wins Design

> Addresses Issues 1, 2, 4 from the Wave B backlog (tournament matches only).
> Casual match fixes deferred to a separate brainstorm.

## Scope

| Issue | Summary | Fix |
|-------|---------|-----|
| #1 | Expert/Advanced tiers unreachable (hardcoded beginner opponent tier) | Look up real opponent tier from `public/tier` doc |
| #2 | `uniqueOpponents` confidence check never binds (estimated at 70%) | Track actual `uniqueOpponentUids: string[]` in StatsSummary |
| #4 | `opponentIds`/`partnerId` always empty/null | Populate from tournament registration UIDs |

**Out of scope:** Issue #3 (phantom stats for casual scorer), Issue #5 (fire-and-forget sync race), casual player identification, tier threshold recalibration.

## Schema Changes

### `StatsSummary` — new field

```typescript
uniqueOpponentUids: string[]  // accumulated set of opponent UIDs faced
```

- Initialized to `[]` for new/existing players
- Grows as player faces new opponents in tournament matches
- Realistic upper bound ~150 UIDs = ~3-5 KB (well under Firestore 1MB limit)
- Used by confidence calculation instead of `estimateUniqueOpponents()`

### `TournamentConfig` — new field

```typescript
defaultTier?: Tier  // 'beginner' | 'intermediate' | 'advanced' | 'expert'
```

- Set by organizer during tournament creation via "Default Skill Level" dropdown
- Used as fallback tier when an opponent has no stats yet
- Optional for backward compatibility — defaults to `'beginner'` if absent
- Validated in Firestore rules on create/update

### New document: `users/{uid}/public/tier`

```typescript
{ tier: Tier }  // just the tier value, nothing else
```

- Readable by any authenticated user (needed for opponent tier lookups)
- Written by the tier owner after each tier recalculation
- Keeps `stats/summary` private (win rates, streaks, match history stay owner-only)
- Minimal doc — no sensitive data exposed

## Data Flow

### Tournament `processMatchCompletion` — revised flow

1. **Resolve participant UIDs** from tournament registrations *(unchanged)*
2. **Guard:** validate no UID appears on both teams (log warning + deduplicate if corrupted data)
3. **Batch-read opponent `public/tier` docs** via `Promise.all` (2-3 Firestore reads, outside transaction — point-in-time snapshot, acceptable staleness for a recreational app)
4. **Per participant:**
   - `buildMatchRef` → populate `opponentIds` and `partnerId` from resolved UIDs
   - Determine opponent tier:
     - **Singles:** opponent's real tier from `public/tier` doc
     - **Doubles:** nearest tier to the average of both opponents' tier multipliers (see mapping table below)
     - **Fallback:** `tournament.defaultTier ?? 'beginner'` if opponent has no `public/tier` doc
   - Create `RecentResult` with real opponent tier
5. **In transaction:** read existing `uniqueOpponentUids`, merge new opponent UIDs via JS `Set`, write back. (`arrayUnion()` cannot be used inside Firestore transactions — manual merge is required.)
6. **After tier recalculation:** write updated tier to `users/{uid}/public/tier` doc

### Doubles tier averaging — nearest tier mapping

When two opponents have different tiers, average their multipliers and map to the nearest tier:

| Opponent combo | Avg multiplier | Nearest tier |
|---|---|---|
| beginner + beginner | 0.50 | beginner |
| beginner + intermediate | 0.65 | intermediate |
| beginner + advanced | 0.75 | intermediate |
| beginner + expert | 0.90 | advanced |
| intermediate + intermediate | 0.80 | intermediate |
| intermediate + advanced | 0.90 | advanced |
| intermediate + expert | 1.05 | advanced |
| advanced + advanced | 1.00 | advanced |
| advanced + expert | 1.15 | advanced |
| expert + expert | 1.30 | expert |

**Singles:** no averaging — use opponent's actual tier directly.

### Casual matches

Completely untouched. Same behavior as today:
- Only scorer gets stats
- `opponentTier` stays hardcoded to `'beginner'`
- `opponentIds`/`partnerId` stay empty/null
- `uniqueOpponentUids` not updated

## Firestore Rules Changes

### 1. New public tier doc — any authenticated user can read

```
match /users/{userId}/public/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### 2. `stats/*` stays owner-only (no change)

```
match /users/{userId}/stats/{docId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  // write rules unchanged
}
```

### 3. Validate `defaultTier` on tournament create/update

```
// Optional field — allow absence or valid tier value
!('defaultTier' in request.resource.data.config)
  || request.resource.data.config.defaultTier in ['beginner', 'intermediate', 'advanced', 'expert']
```

## UI Changes

### Tournament creation form

- Add "Default Skill Level" dropdown to tournament config section
- Options: Beginner, Intermediate, Advanced, Expert
- Default selection: Beginner
- Helper text: "Used for rating players without match history"
- Placement: alongside existing settings (format, points to win, etc.)
- Maps to `TournamentConfig.defaultTier`

No other UI changes — all other work is backend data wiring.

## Backward Compatibility

| Field | Old data | Handling |
|-------|----------|---------|
| `StatsSummary.uniqueOpponentUids` | Missing on old docs | Initialize to `[]` on read |
| `TournamentConfig.defaultTier` | Missing on old tournaments | `config.defaultTier ?? 'beginner'` |
| `RecentResult.opponentTier` | Existing matches stored `'beginner'` | Immutable snapshots — no backfill needed |
| `MatchRef.opponentIds`/`partnerId` | `[]` and `null` | Only new matches get populated |
| `users/{uid}/public/tier` | Doesn't exist for old users | Created on next tier recalculation |

## Key Implementation Notes

- `arrayUnion()` does NOT work inside Firestore transactions — use manual JS `Set` merge
- Opponent tier reads happen outside the transaction (point-in-time snapshot, acceptable staleness)
- `public/tier` doc must be written after every tier recalculation in `updatePlayerStats`
- Batch opponent reads use `Promise.all` (existing codebase pattern)
- `processMatchCompletion` signature does NOT change — tournament data accessed via `match.tournamentId`
