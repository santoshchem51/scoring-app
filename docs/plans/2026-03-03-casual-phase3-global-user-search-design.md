# Casual Phase 3: Global User Search — Design Document

**Date**: 2026-03-03
**Status**: Approved
**Builds on**: Phase 2 — Buddy Picker (2026-03-03)

## Overview

Phase 2 lets the scorer assign buddy group members to teams. Phase 3 adds **global user search** inside the BuddyPicker so any PickleScore user can be found and assigned to a match — not just buddies.

**Key user flow**: Expand BuddyPicker → type 2+ characters in search → tap result → action sheet picks team → start match → searched user gets stats + silent match visibility.

---

## Section 1: UI & Interaction Design

### Search Input

- Text field with search icon below the buddy avatar row in expanded BuddyPicker
- Placeholder: "Search players..."
- 2-character minimum before searching, 300ms debounce
- Below 2 chars: hint text "Type 2+ characters to search"

### Search Results

- Vertical list below the search input
- Each result: avatar (photo or initials) + display name
- Private-visibility users: name only, no photo (photoURL nulled client-side)
- Email is **never** shown or stored in the UI layer
- "No users found" after a search with no matches
- Results exclude: scorer's own UID, users already in buddy list

### Assignment Flow

- Tap search result → same BuddyActionSheet as buddies (Team 1 / Team 2)
- Once assigned, the search user moves from the results list into the avatar row alongside buddies
- Unassigning moves them back to search results (if search is still active)

### Avatar Row Merge

The sorted avatar row combines three groups:
1. Assigned buddies (pinned left)
2. Assigned search users (after assigned buddies)
3. Unassigned buddies (after all assigned)

Unified via a derived `allAssignedPlayers()` accessor so both the avatar `<For>` loop and `assignedSummary()` use one source.

---

## Section 2: Data Flow & State

### New Hook: `useUserSearch`

Located at `src/features/scoring/hooks/useUserSearch.ts`:
- Wraps `firestoreUserRepository.searchByNamePrefix(query, 10)`
- Debounces at 300ms, minimum 2 chars
- Strips `email` from results before returning (privacy)
- Nulls `photoURL` for users with `profileVisibility === 'private'`
- Filters out: scorer's own UID, users in the buddy list
- Returns `{ results, loading, search, clear }` signals

### State Model

**GameSetupPage owns:**
- `buddyAssignments: Record<string, 1 | 2>` — unchanged, single source for ALL team assignments (buddies + search users)
- `searchUserInfo: Record<string, { displayName: string; photoURL: string | null }>` — display info for users found via search (NOT assignment state — that lives in `buddyAssignments`)

**BuddyPicker derives:**
- `allAssignedPlayers()` — merges `buddies()` + entries from `searchUserInfo` into a unified list of `{ userId, displayName, photoURL, team }` objects. Both `assignedSummary()` and the avatar row `<For>` read from this.

### On Match Creation

`buildTeamArrays` is **unchanged** — it reads `buddyAssignments` which now includes both buddy and search user IDs. `sharedWith` includes all assigned UIDs regardless of source.

### Game Type Change (Doubles → Singles) — Capacity Pruning

When `gameType` changes to `singles` and existing assignments exceed 1-per-team:
- Prune `buddyAssignments` to keep only the first assigned user per team
- This is a reactive effect in GameSetupPage that watches `gameType`

### Privacy

- Privacy filtering is **client-side only** for now (Firestore rules allow any auth user to read user docs)
- `email` is stripped from search results in the hook layer — never reaches UI
- `photoURL` nulled for private users in the hook layer
- **TODO**: Add Cloud Function for server-side privacy filtering if app scales

### No Auto-Buddy

Search users are NOT added to buddy groups. They're linked to the match only via `sharedWith`.

---

## Section 3: Component Architecture

### New Files

```
src/features/scoring/hooks/
└── useUserSearch.ts         — debounced search, privacy filtering, dedup
```

### Modified Files

```
src/features/scoring/components/BuddyPicker.tsx  — search input, results list, avatar row merge
src/features/scoring/GameSetupPage.tsx            — searchUserInfo signal, capacity pruning effect
```

### Props Flow

```
GameSetupPage (owns: buddyAssignments, searchUserInfo)
  └─ BuddyPicker (new props: searchUserInfo, onSearchAssign, onSearchUnassign)
       └─ BuddyAvatar (unchanged)
       └─ BuddyActionSheet (unchanged)
       └─ Search input + results list (inline in BuddyPicker)
```

### No New Components

Search input and results list are rendered inline in BuddyPicker. The result rows are simple enough to not warrant a separate component.

---

## Section 4: Testing Strategy

**~15 unit tests + 2 E2E tests across 3 test files**

### `useUserSearch.test.ts` (~7 tests)

- Returns empty before 2 chars typed
- Fires search after 2+ chars with 300ms debounce
- Filters out scorer's own UID
- Filters out users already in buddy list
- Sets photoURL to null for private-visibility users
- Strips email from results
- Handles search error gracefully

### `BuddyPicker.test.tsx` additions (~5 tests)

- Search input visible when expanded
- Typing 2+ chars shows search results
- Tapping search result opens action sheet
- Assigned search user appears in avatar row
- Search results exclude existing buddies

### `GameSetupPage.test.tsx` additions (~3 tests)

- `searchUserInfo` populated when search user assigned
- `searchUserInfo` entry removed on unassign
- Game type switch to singles prunes over-capacity assignments

### E2E: `buddy-picker.spec.ts` additions (~2 tests)

- Type search query → results appear → assign to team → start match → scoring page loads
- Search result that is already a buddy → not shown in search results

---

## Section 5: Scope & Implementation Order

### In Scope

1. `useUserSearch` hook (debounced, privacy-filtered, deduped)
2. Search UI in BuddyPicker (input + results list)
3. Avatar row merge (unified `allAssignedPlayers` accessor)
4. GameSetupPage integration (searchUserInfo signal + capacity pruning)
5. Tests (~15 unit + 2 E2E)

### Out of Scope

- Email search (name prefix is sufficient)
- Auto-adding search users to buddy groups
- Server-side privacy filtering (Cloud Function — future)
- Search result pagination (max 10 is enough)
- Offline search

### Implementation Order

1. `useUserSearch` hook (pure data, easy TDD)
2. BuddyPicker search UI (input + results list)
3. Avatar row merge + `allAssignedPlayers` derived accessor
4. GameSetupPage integration (searchUserInfo + capacity pruning effect)
5. E2E tests

### Scope Creep Risks

- **Avatar row merge** (MEDIUM) — combining buddies + search users into unified sorted list
- **Capacity pruning on game type change** (LOW) — simple reactive effect but new behavior
- **Privacy** (LOW) — client-side stripping is straightforward

---

## Key Design Decisions (Summary)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search placement | Inside BuddyPicker | One unified "Add Players" section |
| Search threshold | 2 chars + 300ms debounce | Balance of UX responsiveness and Firestore cost |
| Privacy filtering | Client-side, strip email | Pragmatic for small app; Cloud Function later |
| Private user display | Name only, no photo | Respects privacy intent without hiding existence |
| Auto-buddy | No | Keeps buddy system intentional |
| State for search users | Separate `searchUserInfo` Record | Display info only; assignment in shared `buddyAssignments` |
| Avatar row | Unified derived accessor | Prevents UID display in summary, single source of truth |
| Capacity pruning | Reactive effect on game type change | Prevents over-capacity assignments persisting |
