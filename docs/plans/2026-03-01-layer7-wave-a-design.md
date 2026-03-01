# Layer 7 Wave A: Player Stats + Match History + Tier Engine — Design

**Date:** 2026-03-01
**Status:** Approved
**Depends on:** Nothing (foundation wave)
**Unlocks:** Wave B (Profile UI), Wave C (Leaderboards), Wave D (Achievements)

---

## Overview

Wave A establishes the data foundation for player profiles. No UI changes — just data flowing and ratings computing. When a match completes, the system writes match references for each signed-in participant and updates their stats summary with a tier calculation.

### Design Principles

- **Signed-in only** — stats and profiles are a Firebase Auth feature. Non-signed-in casual play stays local-only.
- **Honest about limitations** — we only see games played in PickleScore. The tier is "your PickleScore tier," not a universal pickleball rating.
- **Subtle, not intimidating** — tier labels (Beginner/Intermediate/Advanced/Expert) instead of decimal ratings. Progress-focused, not ranking-focused.
- **Pluggable** — when enough data exists, the tier function can be swapped for Glicko-2 without changing the data model or UI.
- **Fire-and-forget** — stats sync never blocks match completion or navigation.

---

## 1. Data Model

### 1.1 Expanded UserProfile (`users/{uid}`)

```typescript
interface UserProfile {
  // Existing fields (unchanged)
  id: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;

  // New fields (optional for backward compat)
  bio?: string;                                  // max 200 chars
  profileVisibility?: 'public' | 'private';      // default 'public'
  updatedAt?: number;
}
```

**Migration:** Zero breaking changes. Existing docs work as-is. Read code handles missing fields with defaults (`bio ?? ''`, `profileVisibility ?? 'public'`).

### 1.2 Match Reference (`users/{uid}/matchRefs/{matchId}`)

A lightweight doc written for each signed-in participant when a match completes. Immutable once written.

```typescript
interface MatchRef {
  matchId: string;
  startedAt: number;
  completedAt: number;
  gameType: 'singles' | 'doubles';
  scoringMode: 'sideout' | 'rally';
  result: 'win' | 'loss';
  scores: string;                       // display: "11-7, 11-4"
  gameScores: number[][];               // structured: [[11,7],[11,4]]
  playerTeam: 1 | 2;                    // which side this player was on
  opponentNames: string[];              // ["John", "Sarah"]
  opponentIds: string[];                // Firebase UIDs (when available)
  partnerName: string | null;           // doubles only
  partnerId: string | null;             // doubles only, if signed-in
  ownerId: string;                      // who scored/recorded the match
  tournamentId: string | null;
  tournamentName: string | null;
}
```

**Denormalization rationale:** Each field supports a specific UI need (match cards, filtering, stats). Opponent names are snapshot-at-time (not kept in sync if they rename — this is intentional for historical accuracy).

### 1.3 Stats Summary (`users/{uid}/stats/summary`)

Single doc, updated after each match. Contains both aggregate counters and the ring buffer for tier computation.

```typescript
type Tier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type TierConfidence = 'low' | 'medium' | 'high';

interface RecentResult {
  result: 'win' | 'loss';
  opponentTier: Tier;
  completedAt: number;
  gameType: 'singles' | 'doubles';
}

interface StatsSummary {
  schemaVersion: number;                           // start at 1
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;                                 // 0.0–1.0
  currentStreak: { type: 'W' | 'L'; count: number };
  bestWinStreak: number;
  singles: { matches: number; wins: number; losses: number };
  doubles: { matches: number; wins: number; losses: number };
  recentResults: RecentResult[];                   // ring buffer, last 50
  tier: Tier;
  tierConfidence: TierConfidence;
  tierUpdatedAt: number;
  lastPlayedAt: number;
  updatedAt: number;
}
```

**Why a subcollection (`stats/summary`) instead of fields on the user doc:** Separates read/write permissions (stats can be written by match scorers; user profile only by the owner) and avoids growing the user doc with volatile data.

### 1.4 Firestore Paths

```
/users/{uid}                          ← UserProfile (existing, extended)
/users/{uid}/matchRefs/{matchId}      ← MatchRef (new, immutable)
/users/{uid}/stats/summary            ← StatsSummary (new, updated per match)
```

---

## 2. Tier Engine

### 2.1 Algorithm: Multiplicative Weighted Win Rate

A pure function that takes the `recentResults` ring buffer and returns a tier. No external dependencies.

```typescript
// Opponent tier scales each win's contribution
const TIER_MULTIPLIER = {
  beginner:     0.5,    // wins vs beginners count half
  intermediate: 0.8,
  advanced:     1.0,
  expert:       1.3,
};

// Recent matches weighted more heavily
const RECENCY_WEIGHTS = {
  recent: 1.0,   // last 10 matches
  middle: 0.8,   // matches 11-25
  older:  0.6,   // matches 26-50
};
```

**Score computation:**
1. Each match gets a recency weight based on its position in the buffer
2. Each win's contribution is scaled by the opponent's tier multiplier
3. Raw score = weighted wins / total weight (0.0–1.0)
4. Apply Bayesian damping for small samples (regress toward 0.25 prior)
5. Clamp to 0.0–1.0

**Bayesian damping (cold start fix):**
```
dampingFactor = min(matchCount / 15, 1.0)
score = 0.25 + (rawScore - 0.25) * dampingFactor
```
- 3 matches: damping = 0.2 → score pulled toward Beginner
- 15+ matches: damping = 1.0 → real score dominates

**Tier thresholds with hysteresis (prevents single-match oscillation):**

| Tier | Promote above | Demote below |
|------|--------------|-------------|
| Beginner | 0.33 | — |
| Intermediate | 0.53 | 0.27 |
| Advanced | 0.73 | 0.47 |
| Expert | — | 0.67 |

The 0.06 gap between promote/demote thresholds means a player must meaningfully improve or decline to change tiers. `computeTier()` takes `currentTier` as input to apply hysteresis.

**Confidence:**
```typescript
function computeTierConfidence(
  matchCount: number,
  uniqueOpponents: number
): TierConfidence {
  if (matchCount >= 20 && uniqueOpponents >= 6) return 'high';
  if (matchCount >= 8 && uniqueOpponents >= 3) return 'medium';
  return 'low';
}
```

### 2.2 Properties

- **Pure function** — takes `recentResults[]` + `matchCount` + `currentTier`, returns `{ tier, tierConfidence, score }`. Fully testable, no side effects.
- **Pluggable** — replace `computeTierScore()` with Glicko-2 later; tier labels and hysteresis stay the same.
- **Circular but self-correcting** — opponent tiers depend on their own results. Converges over 2-3 months of play. Acceptable for v1.
- **No score margins** — uses win/loss only. Simpler, matches Glicko-2 migration path.
- **Single tier (not split by format)** — `gameType` is stored in `RecentResult` for future per-format tiers, but v1 computes one unified tier.

### 2.3 Glicko-2 Migration Path

The `matchRefs` subcollection stores full match history with opponent IDs — everything Glicko-2 needs. The ring buffer is for the v1 tier engine only. When migrating:
- Read all `matchRefs` (not just last 50) to bootstrap Glicko-2 ratings
- Add `glickoRating`, `glickoRD`, `glickoVolatility` fields to `StatsSummary`
- Replace `computeTierScore()` — tier labels stay the same

---

## 3. Match Completion Integration

### 3.1 Flow

```
saveAndFinish() in ScoringPage.tsx
  │
  ├─ matchRepository.save(updatedMatch)              // Dexie (existing)
  ├─ cloudSync.syncMatchToCloud(updatedMatch)         // Firestore (existing)
  ├─ cloudSync.syncPlayerStatsAfterMatch(match)       // NEW — fire-and-forget
  │   │
  │   ├─ Resolve participant UIDs:
  │   │   ├─ Tournament? → TournamentRegistration.userId
  │   │   │   (via firestoreRegistrationRepository.getByTournament)
  │   │   │   (filter by reg.teamId === tournamentTeam1Id/2Id)
  │   │   └─ Casual? → auth.currentUser.uid only
  │   │
  │   └─ For each UID (independent, Promise.all):
  │       ├─ Read stats/summary doc (getDoc)
  │       ├─ Skip if matchRef already exists (idempotency)
  │       ├─ Build RecentResult, push to recentResults, slice(-50)
  │       ├─ computeTierScore() → computeTier() → computeTierConfidence()
  │       ├─ Write matchRef doc (setDoc)
  │       └─ Write stats/summary (setDoc with merge: true)
  │
  ├─ Tournament pool/bracket updates                  // (existing)
  └─ Navigate away                                    // (existing)
```

### 3.2 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync pattern | Fire-and-forget | Matches existing `cloudSync` pattern. Never blocks navigation. |
| Write strategy | Simple read-then-write | No `runTransaction` (codebase has zero uses). Follows `firestoreUserRepository.saveProfile()` precedent. |
| Ring buffer management | Client-side `[...existing, newResult].slice(-50)` | No `arrayUnion()` needed. Part of the read-then-write. |
| Per-user independence | `Promise.all(uids.map(...))` | One user's failure doesn't block others. No cross-user transaction coupling. |
| Idempotency | Check if matchRef doc exists before writing | Prevents double-counting on retry/resync. |
| Tournament UID resolution | `firestoreRegistrationRepository.getByTournament()` | One Firestore read. `TournamentRegistration.userId` is a required string field. |
| Casual match limitation | Owner/scorer only | `team1PlayerIds`/`team2PlayerIds` are local Dexie UUIDs, not Firebase UIDs. No mapping infrastructure exists for casual matches yet. |

### 3.3 `syncPlayerStatsAfterMatch` — Internal Structure

The function in `cloudSync.ts` is a **thin orchestrator**. Domain logic lives in `firestorePlayerStatsRepository`:

```typescript
// cloudSync.ts — public API (1 line in saveAndFinish)
syncPlayerStatsAfterMatch(match: Match): void {
  const user = auth.currentUser;
  if (!user) return;
  firestorePlayerStatsRepository
    .processMatchCompletion(match, user.uid)
    .catch((err) => console.warn('Stats sync failed:', match.id, err));
}

// firestorePlayerStatsRepository.ts — domain logic
async processMatchCompletion(match: Match, scorerUid: string): Promise<void> {
  const uids = await resolveParticipantUids(match, scorerUid);
  await Promise.all(uids.map(uid => updatePlayerStats(uid, match)));
}
```

---

## 4. Security Rules

### 4.1 New Subcollection Rules

```javascript
// Nested inside existing match /users/{userId} block

// Match references — immutable, scorer writes for all participants
match /matchRefs/{refId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.matchId is string
    && request.resource.data.completedAt is number
    && request.resource.data.result in ['win', 'loss'];
  allow update, delete: if false;
}

// Stats summary — scorer updates for all participants
match /stats/{docId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
}
```

**Precedent:** `buddyNotifications` subcollection already allows any authenticated user to create docs in another user's subcollection. Same trust model.

### 4.2 UserProfile Update Rule

Existing update rule on `/users/{userId}` already validates `displayName` and `email` on merged result. New optional fields (`bio`, `profileVisibility`) are accepted by `merge: true` semantics — no rule change needed for the user doc itself.

---

## 5. Dual Stats Systems

| System | Source | Purpose | When used |
|--------|--------|---------|-----------|
| `statsRepository.ts` (existing) | Local Dexie | Offline stats, Players tab | Unchanged, local-only |
| `StatsSummary` in Firestore (new) | Cloud | Profile pages, tier, leaderboards | Signed-in users, cloud-synced |

These are intentionally separate. Local stats work offline for the device owner. Cloud stats enable public profiles and cross-device consistency. If they disagree (e.g., user plays on two devices), cloud stats are authoritative for the profile display.

---

## 6. File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/shared/utils/tierEngine.ts` | Pure functions: `computeTierScore()`, `computeTier()`, `computeTierConfidence()` |
| `src/shared/utils/__tests__/tierEngine.test.ts` | Tier engine unit tests |
| `src/data/firebase/firestorePlayerStatsRepository.ts` | `processMatchCompletion()`, `resolveParticipantUids()`, `updatePlayerStats()`, matchRef/stats CRUD |
| `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts` | Repository tests (follows existing `vi.hoisted` mock pattern) |

### Modified Files

| File | Change | Risk |
|------|--------|------|
| `src/data/types.ts` | Add `MatchRef`, `StatsSummary`, `RecentResult`, `Tier`, `TierConfidence` under new section | Low (additive) |
| `src/data/firebase/firestoreUserRepository.ts` | Add defaults in create path; update `getProfile()` to return new fields | Medium (audit all `UserProfile` consumers first) |
| `src/data/firebase/cloudSync.ts` | Add `syncPlayerStatsAfterMatch()` method | Low (additive) |
| `src/features/scoring/ScoringPage.tsx` | One fire-and-forget line after line 203 | Low |
| `firestore.rules` | Add `matchRefs` and `stats` subcollection rules | Low (additive, follows existing pattern) |

### Implementation Order (each step keeps all tests green)

1. `src/data/types.ts` — additive types only
2. `src/shared/utils/tierEngine.ts` + tests — pure functions, zero risk
3. `src/data/firebase/firestorePlayerStatsRepository.ts` + tests — new file
4. `firestore.rules` — additive subcollection rules
5. `src/data/firebase/cloudSync.ts` — add new method + tests
6. `src/data/firebase/firestoreUserRepository.ts` — optional fields (audit consumers first)
7. `src/features/scoring/ScoringPage.tsx` — one line, last step

---

## 7. Testing Strategy

### Tier Engine (pure function tests)
- 100% win rate vs beginners → capped around Intermediate (multiplier prevents Expert)
- 3 matches → damped toward Beginner (low confidence)
- 50% win rate vs mixed → Intermediate
- Hysteresis: player at 0.51 loses one match → stays Advanced (doesn't drop)
- Closed friend group (4 players, only play each other) → correct behavior
- Empty results → Beginner, low confidence
- Ring buffer at exactly 50 entries, then 51

### Repository (mocked Firestore tests)
- `processMatchCompletion()` with tournament match → resolves UIDs, writes matchRefs for all participants
- `processMatchCompletion()` with casual match → writes matchRef for scorer only
- Idempotency: same match processed twice → second call is a no-op
- Stats summary creation (first match for a new user)
- Stats summary update (increments, ring buffer rotation, tier recomputation)

### Integration
- `cloudSync.syncPlayerStatsAfterMatch()` → verifies fire-and-forget pattern, auth guard, error swallowing
- ScoringPage call site → verifies the call is made with correct match data

---

## 8. Known Limitations (v1)

| Limitation | Impact | Future Fix |
|------------|--------|------------|
| Casual matches: only scorer gets matchRef | Other participants don't see it in their history | Extend GameSetupPage to tag signed-in participants |
| Concurrent tournament matches may cause stale recentResults | One entry could be lost in a race condition; self-corrects on next match | Upgrade to `runTransaction` or Cloud Function |
| Circularity in opponent tier | New player base is all "beginner"; signal strengthens over 2-3 months | Converges naturally; Glicko-2 migration eliminates it |
| No backfill of historical matches | Stats start from deployment forward | Optional migration script later |
| `TournamentRegistration.teamId` may be null | Verify during implementation that team assignment writes teamId back | Add fallback resolution path if needed |
| Single tier (not split by format) | Singles and doubles combined | Data supports split; compute separately in a later wave |

---

## 9. What's NOT in Wave A

- Profile page UI (Wave B)
- Leaderboard queries and page (Wave C)
- Achievement badges (Wave D)
- Casual match participant linking
- Self-assessment onboarding
- Score margin in tier computation
- Separate singles/doubles tiers
- Inactivity decay
