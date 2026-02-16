# In-App Tournament Invitations — Design

**Created:** 2026-02-16
**Status:** Approved
**Context:** Follows Layer 3 (Waves A-C complete: sharing, real-time data, role-based dashboards). Replaces the mailto-only Wave D with a proper in-app invitation system.

---

## Problem

Organizers have no way to invite existing app users to tournaments. The only sharing mechanisms are public links, QR codes, and a `mailto:` fallback that opens the user's email client with no tracking. Players must either know the tournament URL or stumble upon it — there's no in-app invitation or notification flow.

## Solution

Let organizers search for existing PickleScore users by name or email, send in-app invitations, and give invited players a visible inbox on the tournaments page with one-tap Accept/Decline. Non-users fall back to `mailto:`.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Invite action | Notify only — player still registers themselves via RegistrationForm |
| User search | Unified typeahead searching both name and email simultaneously |
| Invitation storage | Firestore sub-collection: `tournaments/{id}/invitations/{invId}` |
| Player inbox | Collection group query, displayed as section on `/tournaments` page |
| Non-user handling | Fall back to `mailto:` link if email doesn't match an existing user |
| Auto-registration | No — accepting navigates to dashboard, player fills registration form |

---

## Data Model

```typescript
interface TournamentInvitation {
  id: string;
  tournamentId: string;
  invitedUserId: string;       // Firebase Auth UID of invited player
  invitedEmail: string;        // For display
  invitedName: string;         // Snapshot of display name at invite time
  invitedByUserId: string;     // Organizer who sent it
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}
```

Stored at: `tournaments/{tournamentId}/invitations/{invitationId}`

- Only in-app users get invitation docs (non-users fall back to `mailto:`)
- No expiration field — invitation is valid while tournament is in `registration` status
- No delete — invitations are permanent records with status-based lifecycle

### UserProfile Change

Add `displayNameLower: string` to enable case-insensitive name search. Set on `saveProfile()`, backfilled on next sign-in.

---

## User Search — Instant Typeahead

Single text input in ShareTournamentModal. As the organizer types (debounced 300ms), two parallel Firestore queries fire:

1. `users` where `displayNameLower` prefix match (`>=` input.toLowerCase(), `<=` input.toLowerCase() + '\uf8ff'`), limit 5
2. `users` where `email` prefix match (same range pattern), limit 5

Results are merged, deduplicated by `uid`, limited to 8 total.

**Result item shows:**
- Avatar (photoURL or initial), display name, email (dimmed)
- "Invite" button — or "Invited" / "Registered" badge if already invited/registered

**States:**
- < 2 chars → "Type to search..."
- Loading → spinner
- No results → "No users found" + "Send email invite instead" (opens `mailto:`)

**Filtering:** Exclude organizer, already-invited users, already-registered users.

**Performance:** ~10 reads per search interaction, well within free tier.

---

## Invitation Flow

### Sending (organizer side)

1. Organizer taps "Invite" on a search result
2. Creates `TournamentInvitation` doc with status `pending`
3. Button changes to "Invited" badge immediately (optimistic)
4. Organizer can invite multiple players in one session

### Receiving (player side)

On `/tournaments` page load, run collection group query: `collectionGroup('invitations')` where `invitedUserId == uid` and `status == 'pending'`.

Display as cards above "My Tournaments" list:

```
+-------------------------------------------+
|  Tournament Name                          |
|  Feb 16 · Recreation Center               |
|  Invited by John Smith                    |
|                                           |
|  [Accept]              [Decline]          |
+-------------------------------------------+
```

### Accept flow

1. Player taps "Accept"
2. Update invitation status to `accepted` + `respondedAt`
3. Navigate to `/tournaments/{id}` — dashboard shows RegistrationForm
4. Player fills in skill rating, partner, etc. and registers normally

### Decline flow

1. Player taps "Decline"
2. Update invitation status to `declined` + `respondedAt`
3. Card disappears from list

### Edge cases

- Tournament no longer in `registration` → show card with "Registration closed" instead of buttons
- Player already registered via public link → don't show the invite card
- Tournament deleted → sub-collection auto-cleaned by Firestore

---

## Firestore Security Rules

```
// Invitations sub-collection
match /tournaments/{tournamentId}/invitations/{invitationId} {
  allow create: if request.auth != null
    && get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid;

  allow read: if request.auth != null
    && (
      get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid
      || resource.data.invitedUserId == request.auth.uid
    );

  allow update: if request.auth != null
    && resource.data.invitedUserId == request.auth.uid
    && request.resource.data.status in ['accepted', 'declined']
    && resource.data.status == 'pending';
}

// Collection group query rule (player inbox)
match /{path=**}/invitations/{invitationId} {
  allow read: if request.auth != null
    && resource.data.invitedUserId == request.auth.uid;
}
```

**Index needed:** Collection group index on `invitations` for `invitedUserId` + `status`.

---

## Component Architecture

### New files

| File | Purpose |
|------|---------|
| `src/data/firebase/firestoreInvitationRepository.ts` | CRUD: create, getByTournament, getByUser (collection group), updateStatus |
| `src/features/tournaments/components/PlayerSearch.tsx` | Debounced typeahead with instant results dropdown |
| `src/features/tournaments/components/InvitationInbox.tsx` | Pending invitation cards with Accept/Decline |
| `src/features/tournaments/engine/__tests__/invitations.test.ts` | Tests for search filtering and invitation logic |

### Modified files

| File | Change |
|------|--------|
| `src/data/types.ts` | Add `TournamentInvitation` type, add `displayNameLower` to `UserProfile` |
| `src/data/firebase/firestoreUserRepository.ts` | Add `searchByNamePrefix()`, `searchByEmail()`, write `displayNameLower` on `saveProfile` |
| `src/features/tournaments/components/ShareTournamentModal.tsx` | Add "Invite Player" section with PlayerSearch |
| `src/features/tournaments/TournamentListPage.tsx` | Add InvitationInbox section above "My Tournaments" |
| `firestore.rules` | Add invitation rules + collection group rule |

No new dependencies.

---

## Testing Strategy

### Unit tests (~12 tests)

**invitations.test.ts:**
- `filterSearchResults` — excludes organizer, already-invited, already-registered (3 tests)
- `mergeAndDeduplicate` — merges name + email results, deduplicates by uid (2 tests)
- `canAcceptInvitation` — true when pending + tournament in registration (3 tests)
- `canAcceptInvitation` — false when registration closed or already responded (2 tests)

**firestoreUserRepository search:**
- `searchByNamePrefix` — returns matching users with limit (1 test)
- `searchByEmail` — returns exact match or null (1 test)

### E2E verification

1. Open ShareTournamentModal → type a name → see search results
2. Tap "Invite" → button changes to "Invited" badge
3. Navigate to `/tournaments` → see invitation card
4. Accept → navigates to tournament dashboard
