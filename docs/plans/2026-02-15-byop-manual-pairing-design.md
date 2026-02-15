# BYOP Manual Pairing — Design

**Created:** 2026-02-15
**Status:** Approved
**Gap ref:** Gap #1 in `2026-02-15-tournament-v2-gaps-and-testing.md`

---

## Problem

When an organizer adds players to a doubles/BYOP tournament, there's no way to manually pair unmatched players into teams. Auto-matching only works when both players mutually name each other as partners. Organizer-added players default to no `partnerName`, so advancing to bracket/pool play fails with "0 teams could be formed, N players unmatched."

**Impact:** Doubles BYOP tournaments are unusable for organizer-managed registration.

## Solution

Add a tap-to-pair UI in the registration phase that lets the organizer manually pair unmatched players.

## Component Architecture

Two new sections appear in the registration phase for BYOP tournaments:

1. **Unmatched Players** — player cards not yet paired
2. **Paired Teams** — formed team cards with unpair buttons

A new `OrganizerPairingPanel` component sits below `OrganizerPlayerManager` and handles pairing. It replaces the bare registrations list for BYOP tournaments.

**Data flow:**
- Reads `registrations()` signal (already on dashboard)
- Runs `createByopTeams()` to separate pre-paired vs unmatched on every registration change
- Stores `selectedPlayerId` as local state for the tap interaction
- On pair: updates both registrations' `partnerName` fields in Firestore
- On unpair: clears both registrations' `partnerName` fields

**Key insight:** No `TournamentTeam` records are created during pairing. We set `partnerName` on registrations. The existing advance flow already calls `createTeamsFromRegistrations()` which reads `partnerName` — so the pairing UI prepares data for the existing pipeline. No changes to the advance logic, team formation engine, or data model.

## Tap-to-Pair Interaction

1. Organizer sees unmatched players as cards (name + skill rating)
2. Tap a player → card highlights with primary-color border, "Select a partner" hint appears
3. Tap a second player → both animate out of unmatched list, appear as a team card in Paired Teams
4. Tap the same player again → deselects (toggle)

**Paired Teams section:**
- Each team card shows both names, combined skill rating
- Small "X" button to unpair → both players return to unmatched list

**Auto-pair button:**
- Shown when 2+ unmatched players remain
- Uses existing `createAutoPairTeams()` algorithm (skill-rating-based)
- All remaining players paired at once

**Odd player count:**
- If 1 player remains after pairing, show warning: "1 player unmatched — add another player or remove this one"
- Advance flow already blocks with "need at least 2 teams"

**Self-registered pre-pairs:**
- Players who mutually named each other appear in Paired Teams automatically
- Organizer can unpair and re-pair them if needed

## Data Strategy

No data model changes. Works entirely through existing `TournamentRegistration.partnerName`.

| Action | Effect |
|--------|--------|
| Manual pair (A, B) | Set A.partnerName = B.playerName, B.partnerName = A.playerName |
| Unpair team | Clear both partnerName to null |
| Auto-pair remaining | Run skill-rating algorithm, set mutual partnerName fields |

## File Plan

**New files:**
- `src/features/tournaments/components/OrganizerPairingPanel.tsx` — tap-to-pair UI
- `src/features/tournaments/engine/pairingHelpers.ts` — pure pair/unpair/detect logic
- `src/features/tournaments/engine/__tests__/pairingHelpers.test.ts` — unit tests

**Modified files:**
- `src/features/tournaments/TournamentDashboardPage.tsx` — swap in panel for BYOP registration
- `src/data/firebase/firestoreRegistrationRepository.ts` — add `updatePartnerName()` method

**Unchanged:**
- `types.ts` — `TournamentRegistration` already has `partnerName`
- `teamFormation.ts` — existing BYOP matching logic untouched
- Advance flow — already reads `partnerName` via `createTeamsFromRegistrations()`

## Testing

**Pure logic tests:** pair/unpair helpers, auto-pair remaining, odd-player edge case, pre-paired detection

**E2E (Playwright):** Create BYOP tournament → add 4 players → manually pair 2 → auto-pair remaining 2 → advance to bracket → score and complete
