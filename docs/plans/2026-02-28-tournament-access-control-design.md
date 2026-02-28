# Tournament Access Control — Design Document

**Date:** 2026-02-28
**Status:** Approved
**Context:** P1 enhancement to Tournament Discovery. PickleScore currently has binary tournament visibility (private/public). This design adds rich access control: approval-gated, invite-only, and buddy-group-restricted tournaments.

---

## Problem

Tournaments are either fully private (organizer-only) or fully public (anyone can see and register). There is no middle ground. Real-world pickleball organizers need:

- **Approval-gated tournaments** — visible to all, but the organizer vets each player before confirming
- **Invite-only tournaments** — only explicitly invited players can register
- **Buddy-group-restricted tournaments** — limited to members of a specific group (e.g., "Tuesday Night Pickleball")

The current binary model forces organizers to choose between total obscurity and zero gatekeeping.

---

## Solution

**Two-dimensional access control model:**

1. **`accessMode`** — controls WHO can register: `open | approval | invite-only | group`
2. **`listed`** — controls WHO can discover the tournament (appears in Browse feed): `boolean`

These are independent axes. `accessMode` governs registration eligibility. `listed` governs discoverability. The existing `visibility` field is kept as a denormalized derivative of `listed` for backward compatibility with existing Firestore queries and security rules.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access model dimensionality | Two axes (accessMode + listed) | Clean separation of "who joins" vs "who discovers". Avoids combinatorial enum explosion. |
| Listed default for open/approval | Forced `true` | An open tournament that nobody can find is incoherent. |
| Listed default for invite-only | `false` | Privacy-respecting default. Organizer opts in to Browse visibility. |
| Listed default for group | `false` | Group members find it via My Tournaments. Organizer opts in to Browse. |
| Registration doc ID | userId (not UUID) | Natural re-registration prevention, O(1) lookups, simpler security rules. One registration per user per tournament. |
| Invitation doc ID | userId (not UUID) | Enables `exists()` in security rules. Prevents duplicate invitations. Breaking change — lazy backfill. |
| Registration counts | Denormalized on tournament doc | Avoids N+1 queries in Browse feed. Updated via `increment()` in `writeBatch`. |
| Group name on BrowseCard | Denormalized `buddyGroupName` on tournament doc | Avoids N+1 reads. Rare staleness on group rename is acceptable. |
| Auto-expire mechanism | Lazy client-side (no Cloud Functions) | Codebase has no Cloud Functions infrastructure. Process expirations when approval queue loads. |
| Non-eligible player CTA (restricted tournaments) | Info message only, no registration button | "Ask to Join" request flow deferred to later iteration. Keeps scope manageable. |
| Backward compatibility | Runtime defaults in repository layer + lazy backfill on edit | No bulk migration. Existing tournaments work unchanged. |

---

## Access Mode Behavior Matrix

| | **Open** | **Approval Required** | **Invite Only** | **Buddy Group** |
|---|---|---|---|---|
| Listed (organizer choice) | Always `true` | Always `true` | Organizer picks (default: off) | Organizer picks (default: off) |
| Browse feed | Yes | Yes | If listed | If listed |
| Share link works | Yes | Yes | Yes (always) | Yes (always) |
| Non-eligible player sees | "Join Tournament" button | "Ask to Join" button (→ pending) | Info: "This tournament is invite only. Organized by [Name]." | Info: "Open to members of [Group Name]. Organized by [Name]." |
| Who registers instantly | Anyone | Nobody (all pending) | Invited users only | Group members + invited users |
| shareCode generated | On create | On create | On create (always) | On create (always) |
| Full tournament state | "This tournament is full" (no CTA) | "This tournament is full" (no CTA) | Same | Same |

---

## Data Model

### New/Modified Fields on Tournament

```typescript
export type TournamentAccessMode = 'open' | 'approval' | 'invite-only' | 'group';

// NEW fields on Tournament interface:
accessMode: TournamentAccessMode;           // replaces visibility as source of truth
listed: boolean;                            // appears in Browse feed?
buddyGroupId: string | null;                // linked group (for 'group' mode)
buddyGroupName: string | null;              // denormalized for BrowseCard badge
registrationCounts: {                       // denormalized, updated via increment()
  confirmed: number;
  pending: number;
};

// KEEP existing fields:
visibility: TournamentVisibility;           // derived: listed ? 'public' : 'private'
shareCode: string | null;                   // always generated on create
```

### New/Modified Fields on TournamentRegistration

```typescript
export type RegistrationStatus = 'confirmed' | 'pending' | 'declined' | 'withdrawn' | 'expired';

// NEW fields:
status: RegistrationStatus;                 // default 'confirmed' for backward compat
declineReason: string | null;               // optional organizer reason on decline
statusUpdatedAt: number | null;             // timestamp of last status change
```

**Registration doc ID = userId** (not UUID). One registration per user per tournament.

### New Subcollection

`tournaments/{id}/invitations/{userId}` — invitation doc ID is the invited user's UID. Enables `exists()` checks in Firestore security rules.

**Breaking change:** Existing invitations use UUID doc IDs. Lazy backfill on tournament edit (re-write with userId-keyed docs).

### Backward Compatibility

Runtime defaults in the repository read path (single normalization function):

```
accessMode = tournament.accessMode ?? 'open'
listed = tournament.listed ?? (tournament.visibility === 'public')
status (registration) = registration.status ?? 'confirmed'
```

Lazy backfill: editing any old tournament writes all new fields on save (`setDoc` already does full-doc writes).

---

## Organizer Setup Flow

### Create/Edit Page: "Who Can Join?" Fieldset

**Position:** #4 in the form (after Location, before Format).

**Form sections** (new visual grouping with labeled dividers):

| Section | Fieldsets |
|---------|-----------|
| **Basics** | Name, Date, Location |
| **Access** | Who Can Join (+ conditionals) |
| **Game Rules** | Format, Game Type, Team Formation, Scoring, Points, Match Format |
| **Logistics** | Max Players, Entry Fee |

**2x2 `OptionCard` grid:**

| Card | Title | Subtitle | Icon |
|------|-------|----------|------|
| *(pre-selected)* | **Open** | Anyone can join | unlock |
| | **Approval Required** | You approve each player | shield-check |
| | **Invite Only** | Only players you invite | ticket |
| | **Buddy Group** | Open to a specific group | users |

**Conditional reveals** (slide-in animation, matching existing `teamFormation` pattern):

1. **Buddy Group selected** → Group dropdown appears first (primary action):
   ```
   Select Group
   [dropdown: organizer's buddy groups]
   Helper: "Members of 'Tuesday Crew' can join."
   ```
   Empty state: inline mini-form ("Name your group" + "Create" button). Never navigate away. Uses `writeBatch` for atomicity (group + member + tournament = 3 ops).

2. **Invite Only or Buddy Group selected** → Listed toggle appears second:
   ```
   Let players find this              [toggle: OFF by default]
   Your tournament will appear in search results
   ```

**Inline validation:** "Select a group before continuing" if Buddy Group mode but no group selected at submit.

### Mode Changes After Creation

- Allowed during `setup` and `registration` status only. Greyed out (not hidden) with current values visible after that.
- Existing confirmed registrations grandfathered in all cases.
- **Approval → Open:** Prompt "X players are waiting for approval. Approve all now?" Batch-approve via `writeBatch`.
- **Open → Invite Only/Group:** Warn "X registered players are not invited/in group. They will keep their spots."
- **Open (listed=true) → Invite Only:** `listed` preserves current value (stays true), toggle becomes editable.
- **Deleted/empty group on edit:** Inline warning: "This group no longer exists. Select another or change the access mode." Block save until resolved.

---

## Browse Feed & Card Changes

### BrowseCard Modifications

**Access mode badge** (after format badge, before status badge):

| Mode | Badge Label | Color |
|------|------------|-------|
| Open | *(no badge)* | — |
| Approval Required | "Approval Required" | `bg-amber-500/20 text-amber-400` |
| Invite Only (listed) | "Invite Only" | `bg-purple-500/20 text-purple-400` |
| Buddy Group (listed) | Group name (max 18 chars, truncate with ellipsis) | `bg-blue-500/20 text-blue-400` |

Access mode badge is visually quieter than status/format badges (smaller text or muted treatment).

**Registration count copy:**
- Open: "12 registered"
- Approval: "12 registered, 3 pending"
- Invite Only: "8 invited"
- Group: "12 registered"

Browse cards show only `registrationCounts.confirmed` as the primary count. Pending count is shown only for approval mode. Organizer-facing surfaces show full breakdown.

**Backward compat:** Missing `accessMode` on old docs → no badge (treated as open). Count falls back to "X registered".

**No query changes.** Browse query (`WHERE visibility == 'public'`) unchanged. Listed invite-only/group tournaments have `visibility: 'public'` (denormalized from `listed: true`).

---

## Player Registration Flow

### CTA Buttons Per Situation

| Situation | Button | Result |
|-----------|--------|--------|
| Open | "Join Tournament" | Instant `confirmed` |
| Approval Required | "Ask to Join" | Creates `pending` registration |
| Invite Only (invited user) | "Join Tournament" | Instant `confirmed` |
| Invite Only (non-invited, listed) | *(no button)* | Info: "This tournament is invite only. Organized by [Name]." |
| Invite Only (non-invited, unlisted via link) | *(no button)* | Info: "This tournament is invite only. Organized by [Name]." |
| Group (member) | "Join Tournament" | Instant `confirmed` |
| Group (non-member, listed) | *(no button)* | Info: "Open to members of [Group Name]. Organized by [Name]." |
| Group (non-member, unlisted via link) | *(no button)* | Same info message |
| Any mode, tournament full | *(no button)* | "This tournament is full." |

### Success States in RegistrationForm

- **Confirmed:** Green — "You're In!" with payment status if applicable
- **Pending:** Amber — "Request Submitted" / "Check back here for updates from the organizer." + "Withdraw Request" link

### Registration Lifecycle (Player Perspective)

| State | What Player Sees | Actions Available |
|-------|-----------------|-------------------|
| Pending | Amber "Request Pending" + submission time | "Withdraw Request" |
| Approved | Green "You're In!" | Tournament participation |
| Declined | "Your request was not approved." + optional reason | None (no re-request button) |
| Withdrawn | "You withdrew your request." | "Ask to Join" (can re-request) |
| Expired (14 days) | "Your request expired. You can ask to join again." | "Ask to Join" (can re-request) |

### Notification Surface

Registration status changes surface in **InvitationInbox** (reuses existing notification component):
- "Your request to join [Tournament] was approved!"
- "Your request to join [Tournament] was not approved."
- "Your request to join [Tournament] will expire in 2 days." (day 12 warning)
- "Your request to join [Tournament] expired."

Player's "My Tournaments" list shows pending tournaments with amber "Pending" badge.

---

## Organizer Approval Queue

### Location

Segmented section within existing `OrganizerPlayerManager` — NOT a separate tab.

### Layout

**"Pending Requests (N)"** section at TOP (only when pending registrations exist):
- Left amber border accent (`border-l-4 border-amber-400`) on each row
- Each row: player name, request timestamp ("Requested 2h ago"), Approve button (green), Decline button (ghost)
- Cap visible list at **10 items** with "Show all X" expand
- **"Approve All"** link next to section header (shown when 5+ pending)
- **"Decline All"** link alongside (shown when 5+ pending)

Below: **"Registered Players (N)"** — existing list, count = confirmed only.

### Decline Flow

Bottom sheet (mobile) / small modal (desktop):
- Title: "Decline [Player Name]?"
- Optional text field: "Reason (optional, visible to player)" (100 char max)
- Buttons: "Decline" (destructive) / "Cancel"

### Dashboard Indicators

- **Status card pill:** Amber "X pending" next to status badge when pending requests exist
- **Stale nudge (48h):** "You have X unanswered requests (oldest: Y days)"
- **Escalated nudge (day 12):** "X requests will expire in 2 days"
- **Pending badges** in organizer's tournament list (My Tournaments)

### Auto-Expire

- Requests expire after **14 days** with no organizer action
- **Lazy client-side expiry:** When approval queue loads, check `registeredAt + 14 days < now`. Batch-update expired registrations to `status: 'expired'` with counter decrements.
- Player notified via InvitationInbox at day 12 (warning) and on expiration
- Player can re-request after expiration

### Implicit Approval via Invitation

When organizer invites a user who already has a pending registration → treat as implicit approval. Batch-update: registration `pending → confirmed` + counter adjustments + invitation doc creation, all in one `writeBatch`.

When organizer invites a previously declined player → creates invitation doc. Player sees invitation in InvitationInbox, accepts → registration `declined → confirmed` (security rule permits this transition when invitation exists).

---

## Share Tournament Modal

### Changes from Current

- **Remove** the public/private visibility toggle (access settings now on edit page)
- **Always show** share link + QR code (shareCode always generated)
- **Always show** PlayerSearch invite section
- **Add** contextual help text per mode (visually prominent info block):

| Mode | Help Text |
|------|-----------|
| Open | "Anyone with this link can join immediately." |
| Approval Required | "Anyone with this link can request to join. You'll approve each one." |
| Invite Only | "Only players you invite can join. Others will see this is invite-only." |
| Buddy Group | "Only members of [Group Name] can join." |

- **Add** "Change access settings →" link at bottom of modal

---

## Firestore Security Rules

### Tournament Document Reads

- `visibility == 'public'` → readable by anyone (unchanged)
- `visibility == 'private'` → readable by authenticated organizer/participant only (unchanged)

### Denormalization Invariant (enforced on every write)

- `listed == true` requires `visibility == 'public'`
- `listed == false` requires `visibility == 'private'`
- `accessMode in ['open', 'approval']` requires `listed == true`
- `accessMode == 'group'` requires `buddyGroupId` is a string AND group exists AND organizer is a member (2 `exists()` calls, conditional)

### Registration Create Rules

Use `tournamentData()` helper function (Firestore caches the `get()` result within a single evaluation).

| Mode | Who Can Create | Required Status | Rule Reads |
|------|---------------|-----------------|------------|
| Open | Any authenticated user | `confirmed` | 1 (tournament doc) |
| Approval | Any authenticated user | `pending` | 1 (tournament doc) |
| Invite Only | Only if `exists(invitations/{uid})` | `confirmed` | 2 (tournament + invitation) |
| Group | Only if `exists(buddyGroups/{groupId}/members/{uid})` | `confirmed` | 2 (tournament + group membership) |
| Legacy (no accessMode) | Fallback to `visibility == 'public'` | `confirmed` | 1 (tournament doc) |

All creates additionally require:
- `request.auth != null`
- Doc ID == `request.auth.uid` (user can only register themselves)
- Tournament status in `['setup', 'registration']`

### Registration Update Rules

| Transition | Who | Additional Check |
|-----------|-----|-----------------|
| pending → confirmed | Organizer only | — |
| pending → declined | Organizer only | — |
| any → withdrawn | Registration owner OR organizer | — |
| declined → confirmed | Registration owner | `exists(invitations/{uid})` (re-invitation) |

All updates must use `writeBatch` with corresponding `registrationCounts` adjustments.

### Registration Deletes

**Disallowed.** Use `withdrawn` or `expired` status instead. Preserves audit trail.

### Rule Complexity Budget

Worst-case per registration create: **2 reads** (tournament doc + invitation or group membership). Tournament doc read is cached by Firestore across rule clauses. Well within the 10-call limit.

---

## Firestore Indexes

### New Indexes

```json
[
  {
    "collectionGroup": "registrations",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "registeredAt", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "registrations",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "tournaments",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "listed", "order": "ASCENDING" },
      { "fieldPath": "date", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "invitations",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "invitedUserId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  }
]
```

Existing `registrations` collection group index (userId single-field) is superseded by the new composite index.

---

## Testing Strategy

### Unit Tests
- Discovery filter engine: access mode filtering, merge logic with new modes
- Registration status transitions: all valid/invalid transitions per mode
- Registration count increment/decrement logic for each transition
- Lazy expiry logic (date comparison, batch identification)
- Backward compatibility: runtime defaults for missing fields

### Component Tests
- AccessModeSelector: card selection, conditional reveals, inline group creation
- RegistrationForm: CTA labels per mode, success states (confirmed/pending), restriction messages
- BrowseCard: access mode badges, registration count copy per mode, group name truncation
- ApprovalQueue: pending section rendering, approve/decline actions, "Approve All", capacity warning
- ShareTournamentModal: contextual help text per mode, no visibility toggle
- DiscoverPage: pending badges in My Tournaments list

### Firestore Rule Tests (Emulator)
- Registration create: all mode combinations (open/approval/invite-only/group × eligible/ineligible)
- Registration update: all status transitions × actor (organizer/player/unauthorized)
- Re-invitation flow: declined → confirmed with invitation exists
- Denormalization invariant: listed ↔ visibility consistency
- Legacy documents: missing accessMode handled correctly
- buddyGroupId validation: group exists, organizer is member

### Manual Verification
- Mobile (390px) + desktop (1280px)
- Organizer flow: create with each mode, share, receive requests, approve/decline
- Player flow: browse, tap restricted tournament, register (each mode), withdraw, re-request
- Mode change: each transition with existing registrations
- Backward compat: old tournament in Browse, old tournament edit + save

---

## File Changes Summary

### Data Layer
- Modify: `src/data/types.ts` (new types, new fields on Tournament + Registration)
- Modify: `src/data/firebase/firestoreTournamentRepository.ts` (access mode on create/update, registration count helpers)
- Modify: `src/data/firebase/firestoreRegistrationRepository.ts` (userId-keyed docs, status field, writeBatch transitions)
- Modify: `src/data/firebase/firestoreInvitationRepository.ts` (userId-keyed docs, implicit approval logic)
- Modify: `firestore.rules` (access-mode-aware registration rules, denormalization invariant, re-invitation branch)
- Modify: `firestore.indexes.json` (4 new composite indexes)

### Components — New
- Create: `src/features/tournaments/components/AccessModeSelector.tsx` (2x2 grid + conditionals)
- Create: `src/features/tournaments/components/AccessModeBadge.tsx` (badge for BrowseCard)
- Create: `src/features/tournaments/components/ApprovalQueue.tsx` (pending section with approve/decline)
- Create: `src/features/tournaments/components/DeclineModal.tsx` (bottom sheet for decline with optional reason)

### Components — Modified
- Modify: `src/features/tournaments/TournamentCreatePage.tsx` (add AccessModeSelector, form sections)
- Modify: `src/features/tournaments/components/RegistrationForm.tsx` (CTA per mode, pending/confirmed states, restriction messages, full-tournament state)
- Modify: `src/features/tournaments/components/BrowseCard.tsx` (access mode badge, adapted count copy)
- Modify: `src/features/tournaments/components/ShareTournamentModal.tsx` (remove toggle, contextual help, always show invite)
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx` (integrate ApprovalQueue)
- Modify: `src/features/tournaments/components/MyTournamentsTab.tsx` (pending badges)
- Modify: `src/features/tournaments/components/InvitationInbox.tsx` (registration status notifications)
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx` (pending pill on status card)

### Engine
- Modify: `src/features/tournaments/engine/discoveryFilters.ts` (access mode in filter/merge logic)

---

## Deferred Items

| Item | When | Why |
|------|------|-----|
| "Ask to Join" for non-eligible players on restricted tournaments | Post-P1 | Adds request queue + organizer notification flow. Info-only message is sufficient for v1. |
| Push notifications for registration status changes | P3 (Notifications layer) | InvitationInbox + badge indicators cover the gap until then. |
| Cloud Function for auto-expire | Post-P1 | Lazy client-side expiry is sufficient at current scale. |
| Inline group member management during tournament creation | Post-P1 | Create empty group inline, add members later. |
| Multiple buddy groups per tournament | Post-P1 | Single group + individual invites covers the main use case. |
| "Request to join group" from Browse card | Post-P1 | Requires buddy group join-request flow that doesn't exist yet. |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking change: userId-keyed registration/invitation docs | Certain | Medium | Lazy backfill on edit. Runtime defaults for old docs. |
| Registration count drift (lazy expiry staleness) | Medium | Low | Browse shows confirmed only. Process expirations when queue loads. |
| Firestore rule complexity growth | Low | Medium | Helper function caches tournament doc. 2 reads worst case. Monitor. |
| Organizer confusion about listed toggle | Medium | Low | Clear label "Let players find this" with helper text. Defaults to off for restricted modes. |
| Player frustration at restricted tournament dead-ends | Medium | Low | Organizer name shown. "Ask to Join" flow deferred but planned. |
| Inline group creation scope creep | Low | Medium | Minimal: name + create only. Members added later. |

**Overall risk: Medium.** The breaking changes to doc ID schemes are the biggest concern but are mitigated by lazy backfill and runtime defaults. The feature itself builds on proven patterns (existing invitations, buddy groups, registration forms).
