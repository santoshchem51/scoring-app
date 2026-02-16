# Tournament v2 — Known Gaps & Future Test Scenarios

**Created:** 2026-02-15
**Updated:** 2026-02-15 (Wave 3 complete — match re-scoring)
**Context:** Post-merge of `feature/tournament-v2` into `main` (17 commits, 164 tests → 190 tests after Wave 2 → 206 tests after Wave 3)

---

## Known Gaps

### ~~1. BYOP Manual Pairing~~ — RESOLVED (Wave 2)

**Fixed in:** commits `1cf436e`, `9c7c7b5`, `99a9f2f`, `0012a26`, `3393b07` (branch `feature/byop-manual-pairing`)

- `OrganizerPairingPanel` component: tap-to-pair UI for organizer during registration phase
- `classifyRegistrations()` detects mutually-named pre-pairs vs unmatched players
- `preparePairUpdate()` / `prepareUnpairUpdate()` / `prepareAutoPairUpdates()` pure helpers
- `updatePartnerName()` added to registration repository
- Auto-pair remaining button uses skill-rating-based algorithm
- Unpair button dissolves any team back to unmatched
- **E2E verified:** BYOP doubles tournament — 4 players added, manual pair 2, auto-pair 2, unpair/re-pair, advance to bracket, score final, champion displayed (Bob & Alice)

### ~~2. Bracket Scoring Integration~~ — RESOLVED (Wave 1)

**Fixed in:** commits `24b4df6`, `73770d0`, `19c711c`

- `advanceBracketWinner()` engine determines next-slot placement (even position → team1, odd → team2)
- `ScoringPage.saveAndFinish()` now calls `firestoreBracketRepository.updateResult()` and advances winner to next round
- `updateSlotTeam()` added to bracket repository
- **E2E verified:** Singles (4 players, 3 matches) and Doubles auto-pair (8 players, 4 teams, 3 matches) both work end-to-end

### ~~3. Tournament Completion Flow~~ — RESOLVED (Wave 1)

**Fixed in:** commits `b060807`, `e5d363b`

- `validatePoolCompletion()` — blocks completion if unplayed pool matches exist
- `validateBracketCompletion()` — blocks completion if final has no winner (error: "The final match has not been completed yet.")
- `TournamentResults` component shows "TOURNAMENT COMPLETE / Champion / [name]"
- Works for both singles and doubles team names (e.g., "Champion: Eve & Anna")
- **E2E verified:** Premature completion blocked, champion displayed correctly after all matches scored

### 4. Public vs Private Tournaments (LOW priority — future feature)

**Problem:** All tournaments are only visible to the organizer. No sharing mechanism exists.

**User's vision:**
- **Public tournaments:** Anyone can see and register; email verification for registrants
- **Private tournaments:** Invite-only via link, QR code, or email invitation

**This is a separate feature layer** (estimated 2-3 weeks), not a bug fix.

### ~~5. Match Re-scoring / Editing~~ — RESOLVED (Wave 3)

**Fixed in:** branch `feature/match-rescoring` (7 commits)

- `rescoring.ts` engine: `deriveWinnerFromGames()`, `validateGameScores()`, `checkBracketRescoreSafety()` — 16 pure logic tests
- `ScoreEditModal.tsx` component: direct number input editing, validation, error display
- "Edit" button on completed pool schedule entries and bracket slots (organizer-only)
- Pool re-scoring: match updated, standings recalculated from all completed matches
- Bracket re-scoring: winner-same allowed, winner-change allowed if next match not started, blocked if next match started
- **E2E verified:** Pool match re-scored (11-5 → 11-8, standings updated), bracket winner-same edit, bracket winner-change (Charlie→Delta, final slot updated), bracket winner-change blocked when final already played

### 6. Offline Support for Tournament Data (LOW priority)

**Problem:** Tournament data lives in Firestore only. The app's offline-first architecture (Dexie.js) only covers match scoring. If the user loses connectivity during a tournament, they can't view pools, standings, or schedule.

**Fix needed:**
- Cache tournament, pool, and team data in Dexie.js
- Sync to Firestore when online
- Show stale data indicator when offline

---

## Untested Scenarios

### Tournament Creation
- [ ] Create tournament with max players limit — verify enforcement during registration
- [x] Create single-elimination format — verify no pool play phase *(Wave 1 E2E)*
- [ ] Create pool-bracket format — verify both pool and bracket phases
- [ ] Edit tournament details after creation (name, date, location)
- [ ] Cancel tournament at each status phase — verify state transition

### Registration Phase
- [ ] Self-registration by non-organizer user (requires second test user)
- [ ] Max players enforcement during registration
- [ ] Late entry flag functionality
- [ ] Payment status tracking (paid/unpaid/waived)
- [ ] Remove a registered player

### Doubles Team Formation
- [x] BYOP: Two users mutually name each other → paired successfully *(Wave 2 E2E — classifyRegistrations detects pre-pairs)*
- [x] BYOP: Unmatched players shown clearly *(Wave 2 E2E — OrganizerPairingPanel shows unmatched grid)*
- [x] Auto-pair: Players paired by closest skill rating *(Wave 1 E2E — 8 players → 4 balanced teams)*
- [ ] Auto-pair: Odd number of players → one left unmatched
- [x] Mixed: Some BYOP pairs + auto-pair remainder *(Wave 2 E2E — manual pair 2, auto-pair remaining 2)*

### Pool Play
- [ ] Multiple pools (6+ players with 2 pools)
- [ ] Score all 6 matches in a 4-player pool — verify final standings
- [ ] Win-by-2 match scoring in tournament context
- [ ] Best-of-3 match format in tournament context
- [x] Rally scoring mode in tournament context *(Wave 1 E2E)*
- [ ] Standings tiebreaker: same W-L, different point differential
- [ ] Pause tournament during pool play
- [ ] End tournament early during pool play

### Bracket Play
- [ ] Generate bracket from pool results (pool-bracket format)
- [x] Score bracket match — winner advances *(Wave 1 E2E — singles + doubles)*
- [x] Full single-elimination tournament (4 teams, 3 matches) *(Wave 1 E2E — singles + doubles)*
- [ ] Bracket with bye (odd number of teams)
- [x] Score bracket final — tournament completes *(Wave 1 E2E)*

### Organizer Controls
- [ ] Pause and resume tournament
- [ ] End tournament early — verify status transition
- [ ] Cancel tournament — verify all data preserved
- [ ] Scorekeeper role: can score matches but not manage tournament

### Multi-User Scenarios
- [ ] Two users viewing same tournament simultaneously
- [ ] Scorekeeper scoring a match while organizer views dashboard
- [ ] Player self-registering while organizer adds players

### Edge Cases
- [ ] Tournament with exactly 2 players (minimum viable)
- [ ] Tournament with 1 player — should fail gracefully
- [ ] Very long player names (60 char max) — UI truncation
- [ ] Rapid match scoring (stress test the Save & Finish flow)
- [ ] Browser refresh during match scoring — resume from snapshot
- [ ] Navigate away from scorer without saving — confirm dialog

### Security Rules
- [ ] Non-organizer cannot advance tournament status
- [ ] Non-organizer cannot add players (organizer-only feature)
- [ ] Completed tournament blocks all writes
- [ ] Cancelled tournament blocks all writes
- [ ] Scorekeeper can only update allowed bracket fields

---

## Test Coverage Summary (current — post Wave 2)

| Area | Tests | Files |
|------|-------|-------|
| Scoring engine | 49 | 4 test files |
| Match repository | 5 | 1 |
| Player repository | 4 | 1 |
| Auth hook | 6 | 1 |
| Pool generator | 8 | 1 |
| Round robin | 9 | 1 |
| Standings | 8 | 1 |
| Bracket generator | 11 | 1 |
| Bracket seeding | 6 | 1 |
| Bracket advancement | 4 | 1 |
| Completion validation | 8 | 1 |
| Auto-pair | 6 | 1 |
| Team formation | 5 | 1 |
| Pairing helpers | 12 | 1 |
| Tournament validation | 16 | 1 |
| Firestore repos | 35 | 4 |
| Tournament lifecycle | 7 | 1 |
| Cloud sync | 4 | 1 |
| Rescoring | 16 | 1 |
| **Total** | **206** | **24** |

### Wave 1 E2E Tests Performed (manual via Playwright)
- Singles single-elimination: 4 players → bracket → 3 matches → champion (Diana)
- Doubles single-elimination with auto-pair: 8 players → 4 teams → bracket → 3 matches → champion (Eve & Anna)
- Completion validation: premature completion blocked with error message
- Champion display: correct for both singles names and doubles team names

### Wave 2 E2E Tests Performed (manual via Playwright)
- BYOP doubles single-elimination: 4 players added without partner names → all unmatched
- Tap-to-pair: Alice + Bob → paired, moved to Paired Teams (Combined: 8.0)
- Auto-pair remaining: Charlie + Diana → paired, "All players paired!" banner
- Unpair: Bob & Alice unpaired → both returned to unmatched list
- Re-pair: Bob + Alice manually re-paired
- Advance to bracket: 2 teams formed, bracket generated correctly
- Score final: Bob & Alice 11-0 Charlie & Diana → champion displayed
- Full flow: Registration → Bracket Play → Completed with BYOP pairing

### Wave 3 E2E Tests Performed (manual via Playwright)
- Pool re-scoring: Round-robin tournament, 4 players, scored Alice vs Diana 11-5
- Edit button visible next to "Completed" in pool schedule (organizer only)
- Score edit modal opens with pre-filled scores (11, 5)
- Changed Diana's score to 8, saved → standings recalculated (Alice PF=11 PA=8 +3, Diana PF=8 PA=11 -3)
- Bracket re-scoring: Single-elimination tournament, 4 players, both semifinals scored
- Test 1 — Winner stays same: Edited semi 1 from 11-5 to 11-8 (Charlie still wins) → save succeeded
- Test 2 — Winner changes, next not started: Flipped semi 1 to 5-11 (Delta wins) → save succeeded, final updated to Delta vs Alpha
- Scored final: Delta 11 - Alpha 3
- Test 3 — Winner changes, next started: Tried flipping semi 1 back → blocked with "Cannot change winner — the next round match has already started."
- Advanced to Completed: Champion = Delta (correct after re-scoring)
