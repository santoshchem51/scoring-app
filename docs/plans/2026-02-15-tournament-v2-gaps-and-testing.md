# Tournament v2 — Known Gaps & Future Test Scenarios

**Created:** 2026-02-15
**Context:** Post-merge of `feature/tournament-v2` into `main` (17 commits, 164 tests)

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

### 2. Bracket Scoring Integration (MEDIUM priority)

**Problem:** Bracket matches use the same `createAndNavigateToMatch` flow as pool matches, but the bracket slot update on match completion is not implemented. After scoring a bracket match, the bracket slot's `winnerId` and `matchId` won't be updated.

**Impact:** Single-elimination and pool-bracket formats don't advance winners through the bracket after matches are scored.

**Fix needed:**
- In `ScoringPage.saveAndFinish()`, handle `bracketSlotId` case
- Update bracket slot with `winnerId` and `matchId` after match completion
- Auto-populate next round's bracket slot with the winner

**Files:** `ScoringPage.tsx`, `firestoreBracketRepository.ts`

### 3. Tournament Completion Flow (MEDIUM priority)

**Problem:** The "Advance to Completed" button exists but the completion flow hasn't been end-to-end tested. Unknown if final standings are persisted, if all matches must be completed first, or if any summary view is shown.

**Impact:** Organizers can't formally close a tournament and see final results.

**Fix needed:**
- Validate all pool matches are completed before allowing advancement
- Show final standings summary on completed tournament
- Prevent further match scoring after completion

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
- [ ] Create single-elimination format — verify no pool play phase
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
- [ ] Auto-pair: Players paired by closest skill rating
- [ ] Auto-pair: Odd number of players → one left unmatched
- [ ] Mixed: Some BYOP pairs + auto-pair remainder

### Pool Play
- [ ] Multiple pools (6+ players with 2 pools)
- [ ] Score all 6 matches in a 4-player pool — verify final standings
- [ ] Win-by-2 match scoring in tournament context
- [ ] Best-of-3 match format in tournament context
- [ ] Rally scoring mode in tournament context
- [ ] Standings tiebreaker: same W-L, different point differential
- [ ] Pause tournament during pool play
- [ ] End tournament early during pool play

### Bracket Play
- [ ] Generate bracket from pool results (pool-bracket format)
- [ ] Score bracket match — winner advances
- [ ] Full single-elimination tournament (4 teams, 3 matches)
- [ ] Bracket with bye (odd number of teams)
- [ ] Score bracket final — tournament completes

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

## Test Coverage Summary (current)

| Area | Tests | Files |
|------|-------|-------|
| Scoring engine | 49 | 4 test files |
| Match repository | 5 | 1 |
| Player repository | 4 | 1 |
| Auth hook | 6 | 1 |
| Pool generator | 8 | 1 |
| Round robin | 8 | 1 |
| Standings | 8 | 1 |
| Bracket generator | 15 | 1 |
| Bracket seeding | 6 | 1 |
| Auto-pair | 6 | 1 |
| Team formation | 5 | 1 |
| Tournament validation | 16 | 1 |
| Firestore repos | 33 | 4 |
| Tournament lifecycle | 7 | 1 |
| **Total** | **164** | **20** |
