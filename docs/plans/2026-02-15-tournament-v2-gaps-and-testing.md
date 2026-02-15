# Tournament v2 — Known Gaps & Future Test Scenarios

**Created:** 2026-02-15
**Updated:** 2026-02-15 (Wave 1 complete — bracket scoring + completion flow)
**Context:** Post-merge of `feature/tournament-v2` into `main` (17 commits, 164 tests → 178 tests after Wave 1)

---

## Known Gaps

### 1. BYOP Manual Pairing (HIGH priority)

**Problem:** When organizer adds players to a doubles/BYOP tournament, there's no UI to manually pair unmatched players into teams. The auto-matching only works when both players name each other as partners. Organizer-added players have no way to specify mutual partnerships.

**Impact:** Doubles BYOP tournaments are effectively unusable for organizer-managed registration. Advancing to pool play fails with "0 teams could be formed, N players unmatched."

**Fix needed:**
- Add organizer pairing UI in the registration phase
- Show unmatched players with drag-to-pair or checkbox-to-pair interaction
- Allow organizer to manually create teams from unmatched players
- Consider a "pair remaining" auto-pair fallback button

**Files:** `TournamentDashboardPage.tsx`, new `OrganizerPairingUI.tsx` component

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

### 5. Match Re-scoring / Editing (LOW priority)

**Problem:** Once a pool match is marked "Completed" in the schedule, there's no way to re-score it or edit the result. If a score was entered incorrectly, there's no correction path.

**Fix needed:**
- Add "Edit Score" option on completed matches
- Allow re-opening a completed match for correction
- Recalculate standings after edit

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
- [ ] BYOP: Two users mutually name each other → paired successfully
- [ ] BYOP: Unmatched players shown clearly
- [x] Auto-pair: Players paired by closest skill rating *(Wave 1 E2E — 8 players → 4 balanced teams)*
- [ ] Auto-pair: Odd number of players → one left unmatched
- [ ] Mixed: Some BYOP pairs + auto-pair remainder

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

## Test Coverage Summary (current — post Wave 1)

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
| Tournament validation | 16 | 1 |
| Firestore repos | 35 | 4 |
| Tournament lifecycle | 7 | 1 |
| Cloud sync | 4 | 1 |
| **Total** | **178** | **22** |

### Wave 1 E2E Tests Performed (manual via Playwright)
- Singles single-elimination: 4 players → bracket → 3 matches → champion (Diana)
- Doubles single-elimination with auto-pair: 8 players → 4 teams → bracket → 3 matches → champion (Eve & Anna)
- Completion validation: premature completion blocked with error message
- Champion display: correct for both singles names and doubles team names
