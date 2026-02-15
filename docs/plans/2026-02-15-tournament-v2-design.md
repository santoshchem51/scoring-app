# Layer 2 v2 — Tournament Management Redesign

**Date:** 2026-02-15
**Status:** Approved
**Approach:** Feature branch (`feature/tournament-v2`). Keep solid engine algorithms, fix/rebuild integration layer.

## Problem

Layer 2 shipped with 32 documented issues across 6 categories. Engine algorithms are well-tested and correct, but:
- 80% of repo tests are stubs (false confidence)
- Zero component tests
- Missing team creation workflow
- Matches disconnected from tournaments
- Logic bugs, security gaps, no error handling

## Scope

### 1. Data Model Changes

**Tournament** — add field:
- `teamFormation: 'byop' | 'auto-pair'` (required for doubles, hidden for singles)

**TournamentRegistration** — modify:
- Add `skillRating?: number` (2.5–5.0, optional at registration)
- Add `partnerId?: string` (BYOP mode only, optional)
- Add `partnerName?: string` (display name for partner lookup)
- Add `profileComplete: boolean` (true when rating filled + partner set if BYOP)
- Remove `rulesAcknowledged` (no friction at registration)

**Match** — add optional tournament context:
- `tournamentId?: string`
- `poolId?: string` (pool-play matches)
- `bracketSlotId?: string` (bracket matches)

### 2. Bug Fixes

| Bug | Fix |
|-----|-----|
| B1: Standings use names not IDs | Match by `team1Id`/`team2Id` in `standings.ts` |
| B3: NaN maxPlayers | Validate before submit, coerce empty to `undefined` |
| B4: Bracket seeding allows top seeds to meet early | Proper bracket placement (1v8, 4v5 top half; 2v7, 3v6 bottom half) |
| B6: FeeTracker shows raw UID | Use `userNames` map to display player names |

### 3. Tournament Creation Validations

| Field | Rule |
|-------|------|
| Name | Trim, min 3 chars, max 60 chars |
| Date | Must be today or future |
| Location | Optional, max 60 chars if provided |
| Max Players | If provided: >= 4, even for doubles, <= 128 |
| Team Formation | Required for doubles, hidden for singles |

- Inline error messages below each field (red text)
- Submit button disabled with summary of what's missing
- Errors clear reactively as user fixes them
- No `alert()` calls

### 4. Team Formation

**BYOP (Bring Your Own Partner):**
1. Player registers, optionally enters partner name/email
2. Partner registers → system auto-creates `TournamentTeam`
3. Unmatched players visible to organizer as "looking for partner"
4. Organizer can manually pair remaining unmatched players

**Auto-Pair (by skill level):**
1. Player registers, optionally selects skill rating (2.5–5.0)
2. Organizer advances → system pairs by closest rating
3. Missing ratings default to 3.0
4. Organizer sees proposed pairings, can adjust before confirming

**Singles:**
- Each registration becomes a team of 1 automatically

**Organizer Team Review step** (before advancing from registration):
- All formed teams with player names + ratings
- Incomplete registrations flagged
- Warning banner if incomplete profiles, option to proceed anyway
- Manual adjustment capability

### 5. Match-Tournament Integration

Reuse existing scoring UI with tournament metadata attached.

**Pool matches:**
1. Pool view shows schedule with matchups
2. Tap matchup → opens scoring page with teams pre-filled + `tournamentId`/`poolId`
3. Match completion → standings auto-recalculate
4. Pool view updates

**Bracket matches:**
1. Bracket view shows matchups per round
2. Tap matchup → opens scoring page with teams pre-filled + `tournamentId`/`bracketSlotId`
3. Match completion → winner advances to next bracket slot
4. Bracket view updates, next round becomes scoreable

**Not building:** separate tournament scorer, live spectator view, multi-court parallel scoring.

### 6. Security Fixes (Firestore Rules)

| Issue | Fix |
|-------|-----|
| C5: Duplicate registration | Rule: 1 registration per userId per tournament |
| C6: Scorekeepers over-privileged | Restrict to `matchId`/`winnerId` fields only |
| C7: Edits after completion | Guard: `status != 'completed' && status != 'cancelled'` on subcollection writes |
| C9: organizerId mutable | Immutability check on updates |

### 7. Error Handling

Every async operation:
```
try { setLoading(true); await op(); }
catch (err) { setError(friendlyMessage(err)); }
finally { setLoading(false); }
```

- Inline error banners, no `alert()`
- Loading states on all buttons (disabled + spinner text)
- Errors dismissible, actions re-attemptable

### 8. Testing Strategy

**Engine tests (~45 total):**
- Existing 39 tests stay
- Add: standings ID-based matching proof, bracket seeding separation, auto-pair algorithm

**Repository tests (~30 total, replacing 13 stubs):**
- Proper Firestore mocks (doc, setDoc, getDoc, getDocs, deleteDoc, query, where)
- Assert paths, data transforms, timestamps, query filters, error propagation
- ~5-6 tests per repo × 5 repos

**Component tests (~28 total, all new):**
- Using vitest + solid-testing-library
- RegistrationForm: join button, optional fields, submit variations, registered state, errors
- PoolTable: standings rows, advancing highlight, empty state
- BracketView: rounds, byes, winners, incomplete bracket
- OrganizerControls: pause/resume, cancel confirmation, disabled states, errors
- FeeTracker: payment progress, player names not UIDs, organizer dropdown
- TournamentCreatePage: all validation rules, successful creation navigates

**Integration tests (~10 total):**
- Team formation flows (BYOP, auto-pair, singles)
- Match-tournament link (pool match → standings, bracket match → advance)
- Full lifecycle: setup → registration → pool-play → bracket → completed

**Manual smoke test (final verification):**
1. Create tournament (doubles/singles, each format)
2. Register 6-8 players (BYOP + auto-pair)
3. Advance through each status, check data at each transition
4. Score 2-3 matches through real scorer
5. Complete tournament, verify final standings/bracket
6. Test as non-organizer (read-only view)
7. Test unauthenticated access (route guards)

If manual pass finds bugs → write failing test first, then fix.

**Test totals:**

| Category | Before | After |
|----------|--------|-------|
| Engine | 39 | ~45 |
| Repo (behavioral) | 5 | ~30 |
| Component | 0 | ~28 |
| Integration | 0 | ~10 |
| **Total** | **44** | **~113** |
