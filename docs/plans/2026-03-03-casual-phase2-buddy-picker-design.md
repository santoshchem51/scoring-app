# Casual Phase 2: Buddy Picker — Design Document

**Date**: 2026-03-03
**Status**: Approved
**Builds on**: Phase 1 — Casual Player Identification (2026-03-02)

## Overview

Phase 1 let the scorer identify their role and team. Phase 2 lets the scorer **assign buddy group members to teams** so that all linked players get stats and can see the match in their history.

**Key user flow**: Game setup → expand "Add Players" → tap buddy avatar → action sheet picks team → start match → all linked players get stats + silent match visibility.

---

## Section 1: Data Flow & State Management

### Fetching Buddies (Deferred Until Expand)

- Fetch only when user expands the "Add Players" section
- `getGroupsForUser(uid)` → `getMembers(groupId)` for each group
- Deduplicate by `userId` across groups
- Filter out: scorer's own UID, entries with empty/missing `userId`
- Cache for the session

### State Model

- `buddyAssignments: Record<string, 1 | 2>` — SolidJS-idiomatic (not Map), single source of truth
- On match creation, build complete rosters:
  - `team1PlayerIds` = buddies mapped to 1 **+ scorer UID** (if `scorerRole === 'player'` and `scorerTeam === 1`)
  - `team2PlayerIds` = buddies mapped to 2 **+ scorer UID** (if playing on team 2)
  - `sharedWith` = all buddy UIDs (scorer excluded — has access via `ownerId`)

### Reactive Guards

- When `scorerRole` flips to `'spectator'` → remove scorer UID from team array
- When `scorerRole` flips back to `'player'` → re-add scorer UID to `scorerTeam` array
- When `scorerTeam` changes → move scorer UID between arrays

### Capacity Enforcement

- `maxPerTeam` = 2 (doubles) or 1 (singles), **including scorer**
- UI disables full-team option in action sheet when at capacity
- Defense-in-depth: `resolveParticipantUids` rejects team arrays exceeding game-type limit

### Cloud Sync Changes

- `toCloudMatch()` — accept `sharedWith` param (1 caller, low risk)
- `syncMatchToCloud()` — add optional `sharedWith` param (6 callers, default `[]`)
- New: `firestoreMatchRepository.getBySharedWith(uid)` — query matches where user is in `sharedWith`
- `pullCloudMatchesToLocal()` — query both `getByOwner()` and `getBySharedWith()`, deduplicate by match ID

### Locking

Buddy assignments are set at match creation. ScoringPage doesn't offer the picker — implicit lock, no new field needed.

### Offline

Show "Connect to the internet to add players." Picker empty but match can still start without linked players.

### No Changes To

- `resolveParticipantUids` (except adding capacity guard)
- Firestore security rules
- Existing `pullCloudMatchesToLocal` callers (additive change)

---

## Section 2: UI & Interaction Design

### Component

`BuddyPicker` at `src/features/scoring/components/BuddyPicker.tsx` — pure presentational, parent owns state.

### State (in GameSetupPage)

- `buddyAssignments: Record<string, 1 | 2>` (not Map — SolidJS-idiomatic)
- Passed to BuddyPicker via props + `onAssign`/`onUnassign` callbacks

### Collapsed State

- No buddies: `Add Players [optional]` with chevron
- 1-3 players: `Players: Alex (T1) vs Sam, Chris (T2) [Change]`
- 4 players (full doubles): `Teams set: 2v2 [Change]` (compact form for small screens)

### Expanded State

- Header + "Done" button
- Horizontal scrollable avatar row, **sorted: assigned buddies pinned left**, unassigned after
- Each avatar: 48x48dp, photo/initials, name below, team badge ("T1"/"T2" text + team color)
- Unassigned: no badge, subtle border
- `createResource` with manual trigger for deferred loading + `<Suspense>` fallback
- No groups / offline / loading states handled inline

### Interaction — Action Sheet

- Tap avatar → bottom sheet (fixed-position overlay, follows ShareSheet/ConfirmDialog pattern)
- Options: "Team 1 (name)", "Team 2 (name)", "Remove" — full teams grayed + `aria-disabled`
- **Auto-assign shortcut**: if only one team has capacity, skip sheet and assign directly with brief toast
- Focus returns to triggering avatar on dismiss

### Capacity Indicators

Below avatar row: `Team 1: 1/2 · Team 2: 0/2`

### Accessibility

- Avatar buttons with `aria-label`: "Alex, assigned to Team 1. Tap to change."
- `aria-live="polite"` region for team change announcements
- Focus management on expand (first avatar) and sheet dismiss (triggering avatar)
- Disabled options have `aria-disabled="true"` with "(full)" label

---

## Section 3: Testing Strategy

**~45 unit tests + ~7 E2E tests across 5+ test files**

### `BuddyActionSheet.test.tsx` (~12 tests)

- Renders hidden when closed, visible when open
- Shows buddy name, "Team 1", "Team 2", "Remove" options
- Calls `onAssign(userId, team)` on team tap
- Calls `onUnassign(userId)` on Remove tap
- Disables full-team option with `aria-disabled="true"` and "(full)" label
- Auto-assigns directly when only one team has capacity
- Closes on backdrop tap
- Focus returns to triggering avatar on dismiss
- Tap already-assigned team → no-op
- Disabled option ignores tap

### `BuddyPicker.test.tsx` (~14 tests)

- Collapsed by default with "Add Players [optional]"
- Expands on tap, shows Suspense skeleton, then avatars
- Assigned buddies pinned left, unassigned after
- Team badges show "T1"/"T2" text + color; unassigned has no badge
- Collapsed summary: 1-3 players shows names, 4 players shows "Teams set: 2v2"
- "Done" collapses section
- Fetch failure → error message ("Connect to internet")
- Empty buddy list → "Create a buddy group" message
- Filters buddies with empty/null `userId`
- Filters scorer's own UID from list
- Rapid expand/collapse doesn't double-fetch
- 0, 1, and max buddies boundary tests

### `GameSetupPage.test.tsx` additions (~10 tests)

- `onAssign`/`onUnassign` update `buddyAssignments` Record
- Scorer UID in team array when `scorerRole === 'player'`
- Scorer UID removed when role flips to spectator (after buddy assignment)
- Scorer UID moves between arrays on `scorerTeam` change
- Capacity: max 2/team doubles, max 1/team singles (including scorer)
- Game type change (doubles→singles) recalculates capacity
- `startGame()` builds `team1PlayerIds`, `team2PlayerIds`, `sharedWith` correctly
- `sharedWith` deduplicated before save
- Quick Start: empty arrays, no buddies

### `cloudSync.test.ts` additions (~6 tests)

- `syncMatchToCloud()` passes `sharedWith` when provided
- `syncMatchToCloud()` defaults to `[]` when not provided (backward compat)
- `toCloudMatch()` uses provided `sharedWith`
- `getBySharedWith(uid)` returns shared matches
- `getBySharedWith(uid)` returns `[]` when none exist
- `pullCloudMatchesToLocal()` merges owned + shared, deduplicates by match ID

### `firestorePlayerStatsRepository.test.ts` additions (~5 tests)

- Scorer in team array: no double-count with fallback path
- Partial linking: 1 UID on team 1, empty team 2 → correct stats
- Capacity guard: rejects 3 UIDs on doubles team, logs warning, returns `[]`
- Boundary: exactly 2 per team (OK), exactly 3 (rejected)
- Existing Phase 1 tests pass unchanged

### E2E tests: `casual-buddy-picker.spec.ts` (~7 tests)

- Expand picker → assign buddy → start match → `team1PlayerIds` populated
- Full doubles team → action sheet disables full team option
- Start match with buddies → `sharedWith` populated in Firestore
- Quick Start → no buddy data, scorer fallback stats
- Offline → picker shows error → match starts without buddies
- Scorer flips to spectator after assigning → scorer removed, buddies stay
- Shared user pulls match → appears in their match history

---

## Section 4: Component Architecture & File Structure

### New Files

```
src/features/scoring/components/
├── BuddyPicker.tsx           — collapsible section, avatar row, deferred loading
├── BuddyActionSheet.tsx      — bottom sheet overlay for team assignment
└── BuddyAvatar.tsx           — lightweight avatar with team badge

src/features/scoring/hooks/
└── useBuddyPickerData.ts     — fetches groups + members, dedup, filter, exclude self

src/features/scoring/helpers/
└── buddyPickerHelpers.ts     — pure functions: dedup, validate, exclude self
```

### Modified Files

```
src/features/scoring/GameSetupPage.tsx              — buddyAssignments state, BuddyPicker section, scorer sync effects, startGame()
src/data/firebase/firestoreMatchRepository.ts       — toCloudMatch() sharedWith param, getBySharedWith()
src/data/firebase/cloudSync.ts                      — syncMatchToCloud() optional sharedWith, pullCloudMatchesToLocal() merged pull + dedup
src/data/firebase/firestorePlayerStatsRepository.ts — capacity guard in resolveParticipantUids
```

### Cross-Feature Coupling

No imports from `src/features/buddies/`. BuddyPicker uses `firestoreBuddyGroupRepository` from the data layer directly (no cross-feature coupling).

### Props Flow

```
GameSetupPage (owns state: buddyAssignments Record, scorerRole, scorerTeam)
  └─ BuddyPicker (props: assignments, scorer info, team names/colors, callbacks)
       └─ BuddyAvatar (props: BuddyGroupMember data, team, teamColor)
       └─ BuddyActionSheet (props: open, buddy, team names/colors, capacity, callbacks)
```

---

## Section 5: Backward Compatibility

- Old matches (`team1PlayerIds: []`, `sharedWith: []`) — scorer fallback works, verified against code
- 6 existing `syncMatchToCloud()` callers — unaffected, `sharedWith` param is optional with `[]` default
- `pullCloudMatchesToLocal()` — additive: still pulls owned + now also pulls shared, **deduplicated by match ID**
- No Firestore rule changes — rules already validate `sharedWith is list`
- No Dexie schema migration — team arrays already indexed
- **Firestore composite index required**: `matches` collection, `sharedWith array-contains + startedAt desc` (deploy before release)

---

## Section 6: Scope & Implementation Order

### In Scope

1. Buddy dedup/validation helpers (pure functions)
2. Buddy data fetching hook (`useBuddyPickerData`)
3. BuddyAvatar, BuddyActionSheet, BuddyPicker components
4. GameSetupPage integration (state, scorer sync, capacity, startGame)
5. Cloud sync changes (sharedWith param, getBySharedWith, merged pull + dedup)
6. Capacity guard in `resolveParticipantUids`
7. Firestore composite index deployment
8. Full test suite (~45 unit + ~7 E2E)

### Out of Scope

- Search/filter for large buddy lists (defer unless >15 buddies is common)
- Global user search (Phase 3)
- QR code join (Phase 4)
- Push notifications for linked players
- Consent-gating for stat attribution

### Implementation Order

1. Cloud sync + repository changes (backend first — highest risk, catch issues early)
2. Firestore composite index for `sharedWith` query
3. `resolveParticipantUids` capacity guard
4. Buddy dedup/validation helpers (pure functions, easy TDD)
5. `useBuddyPickerData` hook (fetches + dedup + filter)
6. BuddyAvatar + BuddyActionSheet components
7. BuddyPicker component
8. GameSetupPage integration
9. E2E tests

### Scope Creep Risks

- **Cloud sync merged pull** (HIGH) — dedup logic, read-only semantics for shared matches
- **Game type switch with buddies** (MEDIUM) — doubles→singles with assigned players needs overflow handling
- **BuddyActionSheet** (LOW-MEDIUM) — first bottom-sheet modal in codebase

---

## Key Design Decisions (Summary)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Picker placement | After Team Names | Natural flow — teams defined, now assign people |
| Buddy scope | All groups merged | Simpler UI, fewer taps |
| Interaction | Action sheet (not tap-to-cycle) | Prevents accidental mis-assignment, accessible |
| Collapsed default | Yes, like "Your Role" | Keeps form clean for people who don't want to link |
| Visibility | Silent (sharedWith, no notification) | Low friction, match appears in buddy's history |
| Scorer in team array | Explicit inclusion | Simpler mental model, no fallback ambiguity |
| Locking | Implicit (ScoringPage has no picker) | No new field needed |
| State type | Record<string, 1\|2> (not Map) | SolidJS-idiomatic, triggers reactivity on spread |
| State ownership | Parent (GameSetupPage) | Matches existing modal/child patterns |
