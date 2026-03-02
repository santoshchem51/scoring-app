# Casual Player Identification — Design

> Addresses the root cause of casual match stats gaps: no player-to-UID mapping.
> Tournament matches already resolved (Wave B backlog). This covers casual matches only.

## Problem

Casual matches only capture team names as strings. The `Match` interface has `team1PlayerIds` / `team2PlayerIds`, but the game setup UI never populates them. Consequences:

- **Issue #3**: Non-playing scorers get phantom stats (scorer always assigned to team 1)
- Opponents never get stats from casual matches (no UID = no way to update)
- `opponentTier` hardcoded to `'beginner'` for all casual matches
- `uniqueOpponentUids` never updated for casual matches

## Approach: Player Slot Model

Each match position is a "slot" that can be:
- **Linked**: A UID string from a PickleScore account
- **Unlinked**: Only a team name string (no stats for that player)

**Phased rollout** — design all, build incrementally:

| Phase | Feature | Status |
|-------|---------|--------|
| **1** | Scorer Role Fix | This design |
| **2** | Buddy List Picker | Future |
| **3** | Global User Search | Future |
| **4** | QR Code / Share Link Join | Future |

## Phase 1 Scope: Scorer Role Fix

**Goal**: Fix phantom stats (Issue #3) and scorer team assignment. No player picker yet.

### Schema Changes

Two optional fields on `Match` (backward compatible — `undefined` treated as defaults):

```typescript
scorerRole?: 'player' | 'spectator'  // undefined = 'player'
scorerTeam?: 1 | 2                    // undefined = 1
```

**Backward compatibility invariant**: `scorerRole === undefined` MUST be treated as `'player'`, never as a third state. Guard with `=== 'spectator'`, not `!== 'player'`.

### Stats Processing Changes

#### `resolveParticipantUids` — revised casual path

```typescript
// Early guard: no stats for abandoned matches
if (match.winningSide === null) return [];

if (!isTournamentMatch) {
  const team1Uids = match.team1PlayerIds ?? [];
  const team2Uids = match.team2PlayerIds ?? [];

  // Phase 2+: if player IDs populated, give all linked players stats
  for (const uid of team1Uids) {
    const result = match.winningSide === 1 ? 'win' : 'loss';
    participants.push({ uid, playerTeam: 1, result });
  }
  for (const uid of team2Uids) {
    const result = match.winningSide === 2 ? 'win' : 'loss';
    participants.push({ uid, playerTeam: 2, result });
  }

  // Fallback: scorer gets stats if no playerIds and not spectating
  if (participants.length === 0 && match.scorerRole !== 'spectator') {
    const team = match.scorerTeam ?? 1;
    const result = match.winningSide === team ? 'win' : 'loss';
    participants.push({ uid: scorerUid, playerTeam: team, result });
  }
}
```

#### Extract dedup guard (shared by both paths)

Move the duplicate UID guard from the tournament path to run at the end of the function for all participants, regardless of source:

```typescript
// Bottom of resolveParticipantUids, before return:
const seen = new Set<string>();
const deduped: typeof participants = [];
for (const p of participants) {
  if (seen.has(p.uid)) {
    console.warn('Duplicate UID across teams, skipping:', p.uid);
    continue;
  }
  seen.add(p.uid);
  deduped.push(p);
}
return deduped;
```

### UI Changes — GameSetupPage

#### "Your Role" section

**Placement**: After team names and colors, before the Start Game button.

**Progressive disclosure**: Renders as a single-line collapsed display by default:

```
Your Role:  I'm Playing  [Change]
```

Tapping "Change" expands to show:
- Two OptionCards: **"I'm Playing"** (default) / **"Scoring for Others"**
- When "I'm Playing" selected: compact horizontal team selector with team color dots
- When "Scoring for Others": team selector hidden

**Labels**: "I'm Playing" / "Scoring for Others"

**Quick Start**: Silently defaults to `scorerRole: 'player'`, `scorerTeam: 1`. No extra friction.

#### Scoring screen indicator

Add a persistent small indicator on the scoring screen: "You're on Team 1" (with team color accent). Allows the scorer to notice if they selected the wrong team.

#### Mid-game correction

Allow changing `scorerTeam` from the in-game settings/pause menu. Stats are reattributed at match completion time, not during scoring, so changing mid-game is safe.

### Cloud Sync Changes

Add `scorerRole` and `scorerTeam` to the explicit field mapping in `cloudSync.pullCloudMatchesToLocal`. The `toCloudMatch` function uses spread, so new fields propagate automatically to Firestore.

### What Phase 1 Fixes
- **Issue #3 (phantom stats)**: Spectator scorers no longer get false win/loss records
- **Scorer on wrong team**: Scorer can select Team 2 if that's their side
- **winningSide null bug**: Pre-existing bug fixed (both teams getting 'loss')
- **Dedup guard**: Extracted to cover both tournament and casual paths

### What Phase 1 Does NOT Fix
- Opponents still get no stats (no way to identify them yet — Phase 2)
- `opponentTier` still `'beginner'` for casual matches
- `uniqueOpponentUids` not updated for casual matches

## Phase 2+ Architecture (Reference)

### Phase 2: Buddy List Picker

- Add a `CasualPlayerPicker` component to GameSetupPage
- Pick players from buddy group members (`firestoreBuddyGroupRepository.getMembers()`)
- Populate `team1PlayerIds` / `team2PlayerIds` with linked UIDs
- Auto-add linked UIDs to `sharedWith[]` for match doc read access
- Allow partial linking in doubles (process whatever UIDs exist)
- Enable enrichment (tier lookups, `uniqueOpponentUids`) for casual linked players

### Phase 3: Global User Search

- Add search-by-name/email to the player picker
- Adapt from existing `firestoreUserRepository.searchByNamePrefix/searchByEmailPrefix`
- Reuse `mergeAndDeduplicate` from `invitationHelpers.ts`

### Phase 4: QR Code / Share Link Join

- Generate match invite share code / QR
- Opponent scans to "join" the match, UID auto-linked
- Requires opponent to have the app open

### Doubles Mixed Linking

Partial linking is valid — process whatever UIDs exist:
- `team1PlayerIds: ['uid-A']` in doubles = Alice gets stats, partner doesn't
- `partnerId` populated from other UIDs in the same team array; `null` if only 1 entry
- `partnerName` falls back to team name when partner UID unavailable

### Security (UID Injection)

The trust model for casual matches matches the existing tournament model: any scorer can write stats for linked UIDs. This is acceptable for a recreational app. Future mitigation options:
- Consent-based linking (linked player accepts before stats update)
- Rate limiting / anomaly detection via Cloud Functions

Design the `matchRef` write path so consent-gating can be added later without schema changes.

## Key Implementation Notes

- `scorerRole === undefined` treated as `'player'` (CRITICAL for backward compat)
- `winningSide === null` → early return with no stats (pre-existing bug fix)
- Dedup guard extracted to bottom of `resolveParticipantUids` (shared by all paths)
- `team1PlayerIds` / `team2PlayerIds` hold Firebase Auth UIDs (not local `Player.id`)
- The old local player feature (`src/features/players/`) is effectively dead for casual matches
- `pullCloudMatchesToLocal` must explicitly map `scorerRole` and `scorerTeam`
- Quick Start: silent defaults, zero extra friction
