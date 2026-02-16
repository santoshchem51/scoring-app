# Match Re-scoring — Design

**Created:** 2026-02-15
**Status:** Approved
**Gap ref:** Gap #5 in `2026-02-15-tournament-v2-gaps-and-testing.md`

---

## Problem

Once a match is marked "Completed," there's no way to correct an incorrect score. Organizers have no edit path — pool standings and bracket results are locked in.

## Solution

Add a score edit modal accessible from the tournament dashboard. Organizer taps "Edit" on any completed pool or bracket match, corrects game scores via direct number inputs, and saves. Pool standings recalculate automatically. Bracket re-scoring is allowed if the winner stays the same, or if the winner changes but the next round match hasn't started yet.

## User Flow

**Pool matches:**
1. "Edit" button appears next to "Completed" in pool schedule (organizer only)
2. Tap → score edit modal opens with current game scores pre-filled
3. Correct scores, tap "Save"
4. Match updates, standings recalculate from all completed matches

**Bracket matches:**
1. "Edit" button appears on completed bracket slots (organizer only)
2. Tap → same score edit modal
3. If winner stays the same: save succeeds
4. If winner changes: check if next round match started. If yes, block with error. If no, allow and update next slot's team assignment.

## Score Edit Modal

- Header: "Edit Score — [Team 1] vs [Team 2]"
- Per game: two number inputs side by side, pre-filled with current scores
- Best-of-3/5: show all played games as rows
- Validation: each game needs a clear winner (no ties), match winner derived from game majority
- Buttons: "Cancel" and "Save"
- Inline error display for validation failures or blocked bracket changes

New `ScoreEditModal` component receives match data, renders editable scores, validates, and calls back with corrected data.

## Data Flow

**On save:**

1. Update match record: new `games` array, recalculate `winningSide`, save to local DB + Firestore

2. Pool match: fetch all completed matches for the pool, call `calculateStandings()` (already recalculates from scratch), save via `updateScheduleAndStandings()`

3. Bracket match:
   - Winner unchanged → just update match record
   - Winner changed, next slot has no matchId → update current slot `winnerId`, swap team in next slot
   - Winner changed, next slot has matchId → block with error message

## File Plan

**New files:**
- `src/features/tournaments/components/ScoreEditModal.tsx` — edit modal UI
- `src/features/tournaments/engine/rescoring.ts` — pure functions: derive winner from games, validate re-score, check bracket cascade safety
- `src/features/tournaments/engine/__tests__/rescoring.test.ts` — unit tests

**Modified files:**
- `src/features/tournaments/components/PoolTable.tsx` — add "Edit" button next to "Completed"
- `src/features/tournaments/components/BracketView.tsx` — add "Edit" button on completed slots
- `src/features/tournaments/TournamentDashboardPage.tsx` — wire modal state, handle save with standings recalc and bracket update

**Unchanged:**
- `standings.ts` — already recalculates from matches
- `bracketAdvancement.ts` — reuse for next slot placement
- `types.ts` — no model changes
- `firestorePoolRepository.ts` — `updateScheduleAndStandings()` already exists

## Testing

**Pure logic tests:** derive winner from games (single/best-of-3/5), validate scores (no ties, at least one game), check bracket re-score safety (winner same, winner changed + no next match, winner changed + next match started)

**E2E (Playwright):** Create tournament, score pool/bracket matches, edit scores via modal, verify standings recalculate, verify bracket winner change blocked when appropriate
