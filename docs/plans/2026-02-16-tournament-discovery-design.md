# P1 Tournament Discovery — Design

**Created:** 2026-02-16
**Status:** Approved
**Context:** P1 priority. PickleScore has working tournament management (create, register, pool play, brackets, sharing) but no way to discover public tournaments without a share link. This is the growth funnel — let people find tournaments, browse upcoming events, and join.

---

## Problem

Tournaments currently live behind authentication. The only way to find a public tournament is to receive a share link (`/t/:code`). There is no browse, search, or discovery experience. Users who hear about PickleScore can't explore what's happening without someone sending them a direct link.

Additionally, the "My Tournaments" page (`/tournaments`) only shows tournaments the user organizes. Tournaments they've registered for as a player or been assigned to as a scorekeeper are invisible — they must navigate via share links or bookmarks.

## Solution

**Browse feed + unified "My Tournaments" list**, implemented as two sub-tabs within the existing Tournaments bottom nav tab. No navigation changes, no new dependencies, Firestore-only queries with client-side filtering.

Two sub-tabs:
1. **Browse** — public tournament feed with inline filters (search, status, format). No auth required.
2. **My Tournaments** — all tournaments the user is involved with (organizer, participant, scorekeeper) in a single list with role badges and a role filter.

Landing page gets a preview section (top 3-5 upcoming public tournaments) to drive discovery from the front door.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Discovery UX pattern? | Browse feed (scrollable list) | Simplest, effective at current scale. Map-based or search-first deferred. |
| Auth required to browse? | No | Maximizes discovery funnel. Sign-in only for registration. |
| Search approach? | Client-side filtering | Firestore has no full-text search. Client-side works for ~500 tournaments. Algolia deferred to P2. |
| Navigation changes? | None — sub-tabs inside existing Tournaments tab | Keeps 6-tab bottom nav. No restructuring needed. |
| My Tournaments scope? | All roles (organizer + player + scorekeeper) | Single list with role badges. Role filter dropdown for narrowing. |
| Participant query? | Firestore collection group query on registrations | Same pattern as buddy groups (`getGroupsForUser`). Already proven in codebase. |
| Filter UI? | Inline dropdowns | Simple for v1. Bottom sheet pattern deferred if inline feels cramped. |
| Pagination? | Cursor-based, 50 per page, "Load More" button | No infinite scroll. Explicit user control. |

---

## Navigation

**Bottom nav:** "Tournaments" tab — unchanged name, icon, position.

**New:** Notification badge on Tournaments icon showing pending invitation count (same pattern as Buddies unread count).

**Sub-tab switcher:** Segmented control at top of page (Browse | My Tournaments).

**Smart default logic:**

| User State | Default Tab | Tab Switcher Visible? |
|------------|-------------|----------------------|
| Logged out | Browse | No (Browse only) |
| Logged in, has pending invitations | My Tournaments | Yes |
| Logged in, has tournaments (any role) | My Tournaments | Yes |
| Logged in, no tournaments | Browse | Yes |

---

## Browse Tab

### Filter Bar

Inline, always visible. Three controls:

| Control | Type | Options | Default |
|---------|------|---------|---------|
| Search | Text input | Free text (name/location) | Empty |
| Status | Dropdown | All, Upcoming, In Progress, Completed | Upcoming |
| Format | Dropdown | All, Round Robin, Single Elimination, Pool → Bracket | All |

Mobile: Search input full width, dropdowns side by side below.
Desktop: All three inline in a row.

### Tournament Feed

Vertical list of public tournament cards, sorted by date descending.

**Browse Card shows:**
- Tournament name (bold, 1-line truncated)
- Date (formatted) + Location
- Format badge
- Status badge (icon + color for accessibility)
- Player/team count (e.g., "8/16 registered")
- Tap → `/t/:shareCode` (existing public tournament page)

**Status badge colors + icons:**

| Status | Color | Icon |
|--------|-------|------|
| Registration open | Blue | Calendar |
| In Progress | Orange | Play/Activity |
| Completed | Green | Trophy |
| Cancelled | Gray | X |

**Pagination:** "Load More" button at bottom. Cursor-based (Firestore `startAfter` with last document), 50 per page.

**Empty states:**
- No public tournaments: "No tournaments yet. Be the first to create one!" with "Create Tournament" CTA.
- No filter matches: "No tournaments found. Try adjusting your filters." with "Clear Filters" button.

**Desktop responsive:** 2-column card grid on `md:`, 3-column on `lg:`.

---

## My Tournaments Tab

Requires authentication.

### Invitation Inbox

Existing InvitationInbox component at top, unchanged.

### Role Filter

Dropdown: All | Organizing | Playing | Scorekeeping. Defaults to "All".

### Tournament List

Single list of all tournaments the user is involved with, sorted by date descending. Deduplicated by tournament ID.

**My Tournament Card shows:**
- Tournament name, date, location
- Status badge (icon + color)
- Role badge: "Organizer" (green), "Player" (blue), "Scorekeeper" (orange)
- Tap → `/tournaments/:id` dashboard (existing)

If a user has multiple roles on the same tournament, show highest priority: Organizer > Scorekeeper > Player.

**"Create Tournament" button** at top-right of section header.

**Empty state:** "No tournaments yet. Create one or browse public tournaments!" with "Create Tournament" and "Browse" CTAs.

---

## Landing Page Preview

New section on the landing page: "Upcoming Tournaments".

- Shows top 3-5 public tournaments with status = registration/setup (upcoming)
- Same card style as Browse tab but compact
- "Browse All" link → navigates to Tournaments page, Browse sub-tab
- Hidden if no public tournaments exist

---

## Join Flow

```
Browse → Tap card → /t/:shareCode (public page) → "Register" CTA → Sign-in (if needed) → RegistrationForm
```

Reuses existing PublicTournamentPage and RegistrationForm. No new components for the join flow.

**Auth context preservation:** Store intended tournament URL in sessionStorage before auth redirect. After sign-in, redirect back to `/t/:shareCode`.

---

## Data Layer

### New Firestore Queries

| Query | Implementation | Index Required |
|-------|---------------|----------------|
| Public tournaments | `WHERE visibility == 'public' ORDER BY date DESC LIMIT 50` with cursor pagination | Composite: `(visibility ASC, date DESC)` |
| By participant | Collection group query on `registrations` subcollection: `WHERE userId == uid`. Extract tournament IDs from `doc.ref.parent.parent.id`. Fetch tournament docs in batches of 10. | Collection group index: `registrations.userId ASC` |
| By scorekeeper | `WHERE scorekeeperIds array-contains userId ORDER BY date DESC` | None (single field) |

**Existing queries (unchanged):**
- `getByOrganizer(userId)` — `WHERE organizerId == uid ORDER BY date DESC`
- `getByShareCode(code)` — `WHERE visibility == 'public' AND shareCode == code`

### Client-Side Processing

**Filtering (Browse tab):**
- Status: enum equality match
- Format: enum equality match
- Text search: case-insensitive `includes()` on `name` and `location`

**Merge (My Tournaments tab):**
1. Fire organizer, participant, scorekeeper queries
2. Collect all tournament objects
3. Deduplicate by tournament ID
4. Assign role from which query returned it (priority: Organizer > Scorekeeper > Player)
5. Sort by date descending

### Lazy Loading

- Browse tab: queries fire on mount
- My Tournaments tab: queries fire only when tab is activated
- Prevents unnecessary reads when user only uses one tab

### Landing Page Preview

Same query as Browse: `getPublicTournaments(limit: 5)` filtered client-side for status = registration/setup.

---

## Security

Existing Firestore rules already cover all needed access:

| Rule | Covers |
|------|--------|
| `allow read: if resource.data.visibility == 'public'` | Browse tab (unauthenticated reads of public tournaments) |
| `allow read: if request.auth != null` | My Tournaments tab (authenticated reads) |
| Registration subcollection reads | Already permitted for authenticated users and public tournaments |

No security rule changes needed.

---

## Scalability & Known Limitations

| Concern | Status | Mitigation |
|---------|--------|------------|
| Client-side text search | Works to ~500 tournaments | Defer Algolia to P2 |
| Pagination + client filter = sparse results | Acceptable for P1 | Show "Showing X matching from Y fetched" if filtered |
| Collection group query cost | ~10-50 reads per user | Acceptable; add time bounds in P2 if needed |
| Offline browse | Not supported (online-only) | Firestore persistence caches previously fetched docs |
| Total reads per page load | 50-75 reads worst case | Well within Firestore free tier (50k/day) |

---

## What's Deferred

| Item | When | Why |
|------|------|-----|
| Location/geo filter | P2 | Requires geocoding `location` field (currently free text) |
| Algolia text search | P2 | When tournament count exceeds ~1000 |
| Filter bottom sheet (mobile) | Post-P1 polish | If inline dropdowns feel cramped on small screens |
| Pull-to-refresh | Post-P1 | Quick follow-up |
| Sort options (date, relevance) | Post-P1 | Date DESC is sufficient default |
| Offline Dexie cache for browse | Post-P1 | Online-only acceptable for discovery |
| Server-side status/format filters | P2 | Add composite indexes when client-side filtering becomes slow |
| Date range filter | P2 | Status filter (Upcoming/In Progress/Completed) covers this adequately |

---

## New Dependencies

None. All changes use existing Firestore SDK, SolidJS, and Tailwind CSS.

---

## Testing

- **Unit tests:** New Firestore repository methods (getPublicTournaments, getByParticipant, getByScorekeeper), client-side filter logic, merge/dedup logic, role priority logic, smart default tab logic
- **Component tests:** Browse tab rendering, My Tournaments tab rendering, filter interactions, empty states, loading states, tab switching
- **Existing tests:** Should all pass (no changes to existing components or APIs)
- **Manual verification:** Mobile (390px) + desktop (1280px), logged-out browse, logged-in both tabs, filter combinations

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Collection group query returns stale data offline | Medium | Low | Online-only for browse; My Tournaments uses Firestore persistence |
| Sparse results after client-side filtering | Medium | Low | Show result count messaging; accept for P1 |
| Text search misses due to case/typo | Low | Low | Case-insensitive includes covers most cases; Algolia in P2 |
| Composite index deployment issues | Low | Medium | Test in emulator first; indexes deploy via firebase CLI |
| Smart default tab feels unpredictable | Low | Low | Clear tab switcher always visible for logged-in users |

**Overall risk: Low.** Core infrastructure (visibility, share codes, public page, collection group queries) already exists. This is primarily new UI + new Firestore queries using proven patterns.

---

## File Changes Summary

### Data Layer
- Modify: `src/data/firebase/firestoreTournamentRepository.ts` (add 3 new query methods)
- Modify: `firestore.indexes.json` (add 2 composite indexes)
- Create: `src/features/tournaments/engine/discoveryFilters.ts` (client-side filter + merge logic)

### Components
- Create: `src/features/tournaments/DiscoverPage.tsx` (new page with sub-tabs)
- Create: `src/features/tournaments/components/BrowseTab.tsx` (browse feed + filters)
- Create: `src/features/tournaments/components/BrowseCard.tsx` (public tournament card)
- Modify: `src/features/tournaments/TournamentListPage.tsx` (becomes content of My Tournaments tab)
- Modify: `src/features/tournaments/components/TournamentCard.tsx` (add role badge)
- Modify: `src/features/landing/LandingPage.tsx` (add upcoming tournaments preview section)
- Modify: `src/shared/components/BottomNav.tsx` (add invitation badge on Tournaments icon)

### Routing
- Modify: `src/app/router.tsx` (update `/tournaments` route to use DiscoverPage, allow unauthenticated access for Browse tab)
