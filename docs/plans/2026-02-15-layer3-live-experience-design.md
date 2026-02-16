# Layer 3: Live Tournament Experience — Design

**Created:** 2026-02-15
**Status:** Approved
**Context:** Follows Layer 2 (tournament management, 206 tests, 24 files). Addresses deferred Gap #4 (Public vs Private Tournaments).

---

## Problem

Tournaments are organizer-only. No one else — spectators, players, or scorekeepers — can see tournament data. There's no sharing mechanism, no real-time updates, and no role-based views. The organizer must manually refresh to see changes made by scorekeepers.

## Solution

Add public tournament sharing, real-time Firestore listeners, and role-based dashboards. Deliver in four independent waves:

- **Wave A:** Tournament sharing & public access
- **Wave B:** Real-time data layer (point-by-point live scoring)
- **Wave C:** Role-based dashboards (player stats, scorekeeper match list)
- **Wave D:** Email invitations

## Key Decisions

| Decision | Choice |
|----------|--------|
| Spectator auth | No sign-in needed — public link access |
| Sharing mechanisms | Link + QR code + email invitation |
| Liveness | Point-by-point real-time via Firestore onSnapshot |
| Visibility model | Private by default, organizer toggles public |
| Push notifications | Deferred — not in Layer 3 scope |
| Player dashboard | My Matches + My Stats (full) |

---

## Data Model Changes

```typescript
interface Tournament {
  // ... existing fields ...
  visibility: 'private' | 'public'   // NEW — default 'private'
  shareCode: string | null            // NEW — 6-char alphanumeric (e.g., "X7K9M")
}
```

- `visibility` controls Firestore read access (public = unauthenticated reads allowed)
- `shareCode` generated on first publish, used in shareable URL `/t/{shareCode}`
- 6-char code from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no ambiguous chars), ~729M combinations

---

## Routing & Role Detection

### New Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/t/:shareCode` | None | Public spectator view |
| `/tournaments/:id` | Required | Existing dashboard, now role-aware |

### Role Detection

```typescript
type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator'

function detectViewerRole(
  tournament: Tournament,
  userId: string | null,
  registrations: TournamentRegistration[],
): ViewerRole {
  if (!userId) return 'spectator'
  if (tournament.organizerId === userId) return 'organizer'
  if (tournament.scorekeeperIds.includes(userId)) return 'scorekeeper'
  if (registrations.some(r => r.userId === userId)) return 'player'
  return 'spectator'
}
```

### `/t/:shareCode` Flow

1. Visitor hits `/t/X7K9M`
2. `PublicTournamentPage` queries Firestore: `where('shareCode', '==', 'X7K9M')` + `where('visibility', '==', 'public')`
3. Found → render tournament dashboard in role-appropriate mode
4. Not found → "Tournament not found" message

---

## Real-Time Data Layer

### Current: One-shot reads with manual refresh

```typescript
const [tournament] = createResource(id, (id) => repo.getById(id));
// Must call refetchTournament() after every change
```

### New: Live listeners via SolidJS signals

```typescript
const live = useTournamentLive(tournamentId);
// live.tournament()    — auto-updates via onSnapshot
// live.pools()         — auto-updates
// live.bracket()       — auto-updates
// live.teams()         — auto-updates
// live.registrations() — auto-updates
```

### Listener Architecture

- `useTournamentLive(tournamentId)` — subscribes to tournament doc + all sub-collections
- `useLiveMatch(matchId)` — subscribes to a single match doc for point-by-point scoring
- All listeners wrapped in SolidJS `createSignal`, cleaned up via `onCleanup`
- Scoped to one tournament — no global state

### Live Match Scoring

- Active matches already sync to Firestore via `cloudSync.ts`
- `useLiveMatch(matchId)` listens to `matches/{matchId}` for score changes
- `LiveScoreCard` component shows current score with pulsing indicator
- Spectators see points update in real-time as scorekeeper scores

### Performance

- Only subscribe to active match docs (not all matches)
- Detach listeners on component unmount
- Firestore built-in caching reduces redundant reads
- ~50-100 reads per spectator per tournament session (within free tier)

---

## Role-Based Views

### Spectator (unauthenticated or non-participant)

Read-only tournament dashboard: header, pool standings, bracket, schedule, live scores, results/champion. No edit buttons, organizer controls, or registration form.

### Player (signed-in, registered)

Everything spectators see, plus:
- **"My Matches"** — personal schedule with next match highlighted, past results, live score if in progress
- **"My Stats"** — W/L record, points scored/allowed, point differential

Implementation: `getPlayerMatches(pools, bracket, teams, playerUserId)` and `getPlayerStats(matches)` pure functions.

### Scorekeeper (signed-in, assigned)

Everything spectators see, plus:
- **"My Assigned Matches"** — unscored matches they can tap to open ScoringPage
- MVP: any scorekeeper can score any match in their tournament (no court assignment UI)

### Organizer (unchanged)

Full dashboard with all controls, edit buttons, status transitions.

### UI Branching

```typescript
const role = createMemo(() => detectViewerRole(tournament(), user()?.uid ?? null, registrations()));

<Show when={role() === 'player'}>
  <MyMatchesSection ... />
  <MyStatsCard ... />
</Show>
<Show when={role() === 'scorekeeper'}>
  <ScorekeeperMatchList ... />
</Show>
<Show when={role() === 'organizer'}>
  <OrganizerControls ... />
</Show>
```

---

## Sharing UI

### ShareTournamentModal

Opened via "Share" button on tournament dashboard header (organizer only).

**Section 1 — Visibility Toggle:**
- Switch between Private / Public
- First toggle to public generates `shareCode`
- Warning: "Anyone with the link can view this tournament"

**Section 2 — Shareable Link:**
- Displays URL: `https://{host}/t/{shareCode}`
- "Copy Link" button with clipboard confirmation toast

**Section 3 — QR Code:**
- Generated client-side using `qrcode` library (~30KB)
- Displayed inline, "Download QR" saves as PNG

**Section 4 — Email Invite (Wave D):**
- Text input for email + "Send" button
- Uses `mailto:` link with pre-filled subject/body containing tournament URL
- No backend email service needed

---

## Firestore Rules Changes

```
// Public tournament reads (unauthenticated)
match /tournaments/{tournamentId} {
  allow read: if resource.data.visibility == 'public';
  // ... existing auth rules unchanged for writes

  match /teams/{teamId} {
    allow read: if get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.visibility == 'public';
  }
  // Same pattern for /pools, /bracket, /registrations
}
```

---

## Wave Breakdown

### Wave A: Tournament Sharing & Public Access

**New files:**
- `src/features/tournaments/components/ShareTournamentModal.tsx`
- `src/features/tournaments/engine/shareCode.ts`
- `src/features/tournaments/PublicTournamentPage.tsx`

**Modified files:**
- `src/data/types.ts` — add `visibility`, `shareCode` to Tournament
- `src/app/router.tsx` — add `/t/:shareCode` public route
- `src/features/tournaments/TournamentDashboardPage.tsx` — Share button, role branching
- `firestore.rules` — public read rules
- `src/data/firebase/firestoreTournamentRepository.ts` — `getByShareCode()` query

**New dependency:** `qrcode`

### Wave B: Real-Time Data Layer

**New files:**
- `src/features/tournaments/hooks/useTournamentLive.ts`
- `src/features/tournaments/hooks/useLiveMatch.ts`
- `src/features/tournaments/components/LiveScoreCard.tsx`

**Modified files:**
- `src/features/tournaments/TournamentDashboardPage.tsx` — replace createResource with useTournamentLive
- `src/features/tournaments/components/PoolTable.tsx` — live score display
- `src/features/tournaments/components/BracketView.tsx` — live score display

### Wave C: Role-Based Dashboards

**New files:**
- `src/features/tournaments/engine/roleDetection.ts`
- `src/features/tournaments/engine/playerStats.ts`
- `src/features/tournaments/engine/__tests__/roleDetection.test.ts`
- `src/features/tournaments/engine/__tests__/playerStats.test.ts`
- `src/features/tournaments/components/MyMatchesSection.tsx`
- `src/features/tournaments/components/MyStatsCard.tsx`
- `src/features/tournaments/components/ScorekeeperMatchList.tsx`

**Modified files:**
- `src/features/tournaments/TournamentDashboardPage.tsx` — render role-specific sections

### Wave D: Email Invitations

**Modified files:**
- `src/features/tournaments/components/ShareTournamentModal.tsx` — add email section

### Estimated Tests Per Wave

| Wave | New tests |
|------|-----------|
| A: Sharing & Public Access | ~15 |
| B: Real-Time Layer | ~8 |
| C: Role Dashboards | ~20 |
| D: Email Invitations | ~3 |

---

## Out of Scope

- Push notifications (FCM, service workers) — deferred
- Court assignment UI for scorekeepers — MVP: any scorekeeper scores any match
- Tournament discovery/search (browsing public tournaments) — future feature
- Offline caching of tournament data (Gap #6) — deferred
