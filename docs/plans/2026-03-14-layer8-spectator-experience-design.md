# Layer 8: Spectator Experience — Design Document

> Make watching tournaments engaging for courtside and remote spectators.

**Date**: 2026-03-14
**Status**: Approved
**Approach**: Enhance existing pages (Approach A) with specialist-recommended modifications

## Context & Goals

**Primary use cases**:
- **Courtside spectator**: at the venue, phone in hand, shared link from organizer ("follow along at picklescore.com/t/abc123")
- **Remote friend**: not at venue, following someone's tournament in real-time

**What exists today**:
- Public tournament page (`/t/:code`) with live Firestore streaming via `useTournamentLive`
- `LiveScoreCard` with LIVE pulse indicator
- `BracketView` and `PoolTable` (read-only for spectators)
- `ScoreEvent` subcollection storing point-by-point history (no spectator UI)
- Role detection engine (organizer/scorekeeper/player/spectator)
- Security rules allowing public reads for public tournaments

**What's missing**:
- Polished spectator match view with live scoreboard
- Play-by-play timeline from ScoreEvent data
- Match analytics (momentum, streaks, point distribution)
- "Live Now" section on tournament hub highlighting active matches
- Privacy controls for player name display
- Spectator count indicator

---

## Section 1: Architecture & Routing

**New route**: `/t/:code/match/:matchId` → `PublicMatchPage` (lazy-loaded, code-split)

**Component locations** (all under `src/features/tournaments/`):
- `PublicMatchPage.tsx` — new page (lazy-loaded route)
- `components/SpectatorScoreboard.tsx` — scoreboard, GPU-composited, outside scroll container
- `components/PlayByPlayFeed.tsx` — scrolling event timeline, auto-scroll with "Jump to live" pill
- `components/MatchAnalytics.tsx` — CSS momentum bar, inline SVG point distribution (no chart library)
- `components/LiveNowSection.tsx` — tournament hub banner showing in-progress matches with inline scores
- `engine/matchAnalytics.ts` — pure functions (momentum, streaks, distribution)
- `engine/scoreExtraction.ts` — extracted from LiveScoreCard for reuse
- `engine/matchFiltering.ts` — `getInProgressMatches(pools, bracket)` pure function

**Data flow**:
- Tournament hub: `useTournamentLive` with `{ skipRegistrations: true }` for spectators
- Match page: `useLiveMatch` (unchanged) + new `useScoreEventStream` (single `onSnapshot` on full subcollection, no hybrid pattern)
- Spectator count: `spectatorCount` field on `/matches/{id}/public/spectator` subdoc (incremented via Cloud Function, no RTDB SDK)
- Visibility-aware listeners: `useVisibilityAwareListener` hook with 500ms debounce + generation counter

**Privacy model**:
- Reuse existing `profileVisibility` field on `UserProfile`
- Write-time sanitization: organizer client checks player profiles at match creation, writes sanitized names to public projection subdoc
- Non-consenting players → "Player A" / "Player B" baked into public-readable data
- Client-side validation: `PublicMatchPage` verifies `match.tournamentId === tournament.id`

**Security prerequisites** (before launch):
- `database.rules.json` created (deny-all placeholder)
- Share codes switched to `crypto.getRandomValues()`, 8-char minimum
- Firebase App Check enabled (Monitor mode → Enforce)
- Tournament match creation ensures `visibility: 'public'` on match doc and scoreEvent docs
- Privacy policy link on all spectator pages

---

## Section 2: Spectator Scoreboard & Match Page

### Layout (portrait-first, flex column, `100dvh`)

```
┌─────────────────────────────────┐
│ ← Summer Slam 2026              │  nav bar (back + tournament name)
├─────────────────────────────────┤
│ Sarah M. / Jake R.  ● srv  11  │  flex: 0 0 auto (NOT sticky)
│ Mike T. / Lisa K.            7  │  120px singles / 148px doubles
│ G2 · 11-7 | 9-11    ~15 👁     │  game pills + spectator count
│ Pool B · R3 · LIVE · 8 min     │  contextual info (muted #4B5563)
│ ┌Play-by-Play┐┌Stats┐          │  segmented control (merged in header)
├─────────────────────────────────┤
│                                 │  flex: 1 1 0, overflow-y: auto
│  [scrolling content area]       │
│                                 │
│        ┌──────────────┐         │  position: fixed, bottom: 16px
│        │↓ Jump to live (3)│     │  IntersectionObserver-driven
│        └──────────────┘         │  min 48px height, 120px width
└─────────────────────────────────┘
```

### Scoreboard

- **Height**: 120px singles / 148px doubles
- **Score digits**: `font-variant-numeric: tabular-nums`, `clamp(48px, 10vw, 64px)`, font-weight 700+, color `#111` on `#fff`
- **Min-width**: `1.2ch` on score digits (prevents layout shift on 1→2 digit transition)
- **CSS containment**: `contain: layout style paint` on scoreboard (no `position: sticky` — header is outside scroll container, flex layout pins it)
- **No `will-change: transform`** — containment provides sufficient isolation
- **LIVE indicator**: visible "LIVE" text + red dot with `opacity` pulse animation, `animation: none` under `prefers-reduced-motion`
- **Serving indicator**: `●` dot inline with player name + sr-only "(serving)" text
- **Doubles**: "Sarah M. / Jake R." with `/` separator, bold server's name, 14px names, scores stay 48px

### Score Change Signal (multi-channel, colorblind-safe)

- Pseudo-element `::after` with `opacity` transition (200ms, compositor-only) — NOT `background-color` transition
- **Blue (#2563EB)** flash for scoring team, no flash for other team (asymmetric)
- Brief ▲ arrow next to score that increased (fades after 1.5s)
- `@media (prefers-reduced-motion: reduce)`: instant swap, no animation

### Play-by-Play Feed

- `<For each={events()}>` with `contain: content` per row — no virtualization (60-140 events max)
- Format: `2:34  Sarah M. scores (serve)  11-7` — relative timestamps, player names, running score right-aligned
- Side-outs in muted text (#4B5563), undos in italic
- Auto-scrolls on new events via `requestAnimationFrame` — if updates arrive <400ms apart, use `behavior: 'instant'` (avoids smooth-scroll pile-up)
- Pauses on touch/wheel/focus
- "Jump to live (N new)" pill: `position: fixed`, `bottom: calc(16px + env(safe-area-inset-bottom))`, IntersectionObserver on sentinel element
- Semantic: `role="log"`, `aria-relevant="additions"`

### Stats Segment

- **Momentum bar**: pure CSS flexbox, team colors + % labels, `transition: flex-basis 300ms`
- **Run of play**: last 10-15 points as ● (circle, Team 1) and ■ (square, Team 2) — shape + color (14px min diameter)
- **Streak highlights**: "Team 1 on a 4-0 run" text
- **Point distribution**: inline SVG bar chart with `scaleY` transitions. SVG is `aria-hidden="true"` + hidden `<table>` for screen readers
- All computed via `createMemo` from ScoreEvents in `engine/matchAnalytics.ts`
- Stats update staggered: scoreboard first frame, play-by-play next frame, stats third frame

### Contextual Info (remote spectators)

- Fourth row of scoreboard, muted: "Pool B · Round 3 of 4 · LIVE · 12 min"
- Tournament name in nav bar as back button: "← Summer Slam 2026"
- Match elapsed time as relative ("Started 12 min ago")

### Accessibility

- Scoreboard: `role="region"`, dedicated sr-only `aria-live="polite"` announcer div, 3s debounce, `aria-atomic="true"`
- Game/match end: `aria-live="assertive"` (no debounce) — "Sarah wins Game 2, 11-9"
- Segmented control: `role="tablist"` / `role="tab"` / `role="tabpanel"`, arrow key navigation, proper `tabindex` management
- All animations: `prefers-reduced-motion` overrides (0.01ms duration, not 0ms — avoids event-firing bugs)
- Muted text: #4B5563 (6.4:1 contrast ratio at 12px)
- Page height: `100dvh` (avoids iOS address bar jank)

---

## Section 3: Tournament Hub — "Live Now" Enhancement

### Layout (capped at 3 visible cards)

```
┌─────────────────────────────────┐
│ ← Summer Slam 2026        🔗   │  nav bar
├─────────────────────────────────┤
│ Pool Play · Round 3 of 4 · 8 live │ tournament phase indicator
├─────────────────────────────────┤
│ 🔴 LIVE NOW                    │  LiveNowSection
│ ┌─────────────────────────────┐ │
│ │ Ct 1: Sarah vs Mike  11-7  →│  <a> tag, full aria-label
│ │ G2  LIVE                    │ │
│ ├─────────────────────────────┤ │
│ │ Ct 3: Alex vs Pat    5-5   →│  max 3 visible vertically
│ │ G1  LIVE                    │ │
│ ├─────────────────────────────┤ │
│ │ Ct 2: Kim vs Jordan  8-6   →│
│ │ G1  LIVE                    │ │
│ └─────────────────────────────┘ │
│        5 more live →            │  overflow indicator
├─────────────────────────────────┤
│  [pools / bracket / results]    │  existing content
└─────────────────────────────────┘
```

### Data Flow

- `useTournamentLive` (with `skipRegistrations: true`) provides pools + bracket + teams
- `getInProgressMatches(pools, bracket)` extracts matches with `matchId` set
- Each card renders `<LiveScoreCard>` which independently calls `useLiveMatch(matchId)` for live scores (1 Firestore listener per card)
- Team names from `teamNames` memo (already computed from teams subcollection)
- Match status verified from match doc `status` field

### States

- **LIVE NOW**: 1+ in-progress matches. Cards show LIVE badge + amber left border
- **Up Next**: no live matches. Show next 2-3 scheduled matches with team names, relative time ("Starts in ~15 min"), court, UPCOMING badge
- **Completed match retention**: finished match stays visible for 5 min with FINAL badge + green border
- **Transition**: cross-fade between Up Next and Live Now headers (300ms)

### Overflow Handling (4+ matches)

- First 3 cards shown vertically, sorted by: closest score → most recently updated
- "N more live →" link expands to horizontal carousel or full list
- Conditional sticky: section is sticky when ≤3 matches. When 4+, section scrolls normally and a floating FAB appears in bottom-right with live count badge

### Accessibility

- Match cards: `<a>` elements in `<ul>` list, comprehensive `aria-label` ("Court 1: Sarah M. versus Mike T., score 11 to 7, game 2, live")
- Inner spans: `aria-hidden="true"` (visual only, label covers everything)
- Dedicated announcer: always-present sr-only `role="status"` div, 3s debounced summaries
- Score updates: silent by default, updated in `aria-label` for on-demand reading
- Status badges: visible text for ALL states (LIVE, FINAL, UPCOMING) — not color-only
- Focus: visible `:focus-visible` outlines, `scroll-margin: 8px`, focus restoration on state transitions
- Keyboard: native `<a>` behavior, Enter to activate, logical tab order

---

## Section 4: Data Model Changes & Security

### Public Projection Pattern

Firestore has NO field-level access control. Raw `team1Name`/`team2Name` and `playerIds` on the same document as `publicTeamXName` defeats the privacy model. Instead:

- **`/matches/{matchId}`** — auth-required reads (existing rules, unchanged). Contains all match data including real names, playerIds, sharedWith
- **`/matches/{matchId}/public/spectator`** — new subdoc, `allow read: if true`. Contains ONLY:
  - `publicTeam1Name`, `publicTeam2Name` (sanitized)
  - `team1Score`, `team2Score`, `gameNumber`, `gamesWon` (live score mirror)
  - `status`, `visibility`, `tournamentId`, `tournamentShareCode`
  - `spectatorCount`
  - NO playerIds, NO real names, NO sharedWith, NO ownerUid
- Written by organizer client at match creation, updated by scoring actor alongside `lastSnapshot`

### Match Doc Field Protection (security rules)

```
allow update: if isMatchOwner()
  && !request.resource.data.diff(resource.data)
      .affectedKeys()
      .hasAny(['spectatorCount', 'tournamentShareCode',
               'publicTeam1Name', 'publicTeam2Name',
               'tournamentId', 'visibility']);
```

### Visibility Propagation

- Add `visibility?: MatchVisibility` param to `cloudSync.syncMatchToCloud()`
- Tournament match creation passes `visibility: 'public'`
- Stamp `visibility: 'public'` on each ScoreEvent doc at creation for tournament matches

### Public Tier Doc (`/users/{uid}/public/tier`)

- Expand with `displayName` and `profileVisibility` fields
- Security rule: `allow read: if resource.data.profileVisibility == 'public'` (NOT blanket `if true`)
- Expand `writePublicTier()` signature, use `setDoc` with `merge: true`

### Share Code Hardening

- `crypto.getRandomValues()`, 8-char default
- Existing 29-char alphabet (no ambiguous chars) is fine
- Existing 6-char codes remain valid (backward compatible)

### Privacy Sanitization Flow (client-side for v1)

1. Organizer creates tournament match
2. Client reads participating players' `/users/{uid}/public/tier` docs
3. If `profileVisibility === 'public'`: use real team name
4. If `profileVisibility === 'private'` or doc missing: use "Team A" / "Team B"
5. Writes sanitized names to `/matches/{matchId}/public/spectator` subdoc
6. No race condition — real names never written to public-readable location

### Spectator Count (v1: simplified)

- Field on `/matches/{matchId}/public/spectator` doc
- For v1: client calls a thin HTTPS Cloud Function to increment (rate-limited by IP)
- If Cloud Functions aren't ready: defer spectator count entirely (nice-to-have)

### Registration Privacy

- Remove `isTournamentPublic()` from registration read rules
- Tournament hub gets team names from `teams` subcollection (already planned)

### RTDB Rules (`database.rules.json`)

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

### Pre-Launch Requirements

- Firebase App Check (reCAPTCHA Enterprise, Monitor mode first)
- Privacy policy link in footer of all spectator pages
- Don't load Firebase Analytics on spectator pages (or add consent banner)
- Consent disclosure text on `profileVisibility` toggle must enumerate: name on scoreboards, match scores, play-by-play timing data

### Deferred to Post-v1

- Cloud Function `deleteUserData(uid)` for right-to-erasure cascade
- Cloud Function cascade for mid-tournament `profileVisibility` changes (accept staleness for tournament duration in v1)
- Cookie consent banner (only needed if Analytics loaded on spectator pages)
- Player pin/follow feature (localStorage-based)

---

## Section 5: Testing Strategy

### Unit Tests (~25 tests, pure functions in `engine/`)

- `matchAnalytics.ts` — momentum, streaks, point distribution, edge cases (empty events, single event)
- `scoreExtraction.ts` — live score from `lastSnapshot`, fallback to completed games, null/undefined match, malformed JSON
- `matchFiltering.ts` — `getInProgressMatches(pools, bracket)` with various states, empty pools, no bracket
- `shareCode.ts` — 8-char length, charset validation, crypto randomness
- `sortAndDeduplicateEvents()` — chronological ordering, duplicate removal on reconnect

### Component Tests (~30 tests, Vitest + `@solidjs/testing-library`)

- `SpectatorScoreboard` — renders scores, serving indicator, game pills, doubles layout (4 names), privacy anonymization, loading/error/null states, `aria-live` attribute
- `PlayByPlayFeed` — renders event list, auto-scroll, pause on touch, "Jump to live" visibility, `role="log"`, empty events state
- `MatchAnalytics` — momentum bar, streak text, SVG chart, hidden data table for a11y
- `LiveNowSection` — shows/hides based on in-progress matches, cap at 3, overflow indicator, "Up Next" state, status badges
- `PublicMatchPage` — tournament-to-match validation, lazy loading, skeleton, error states
- Segmented control — `role="tablist"` / `role="tab"`, arrow keys, `aria-selected`

### Hook Tests (~15 tests)

- `useScoreEventStream` — `onSnapshot` subscription, cleanup, visibility-change detach/reattach with generation counter, duplicate deduplication
- `useTournamentLive` with `skipRegistrations: true` — registrations listener not created
- `useVisibilityAwareListener` — debounce timing, rapid tab switches, stale generation rejection

### Security Rules Tests (~35 tests, Firebase emulator)

**Spectator subdoc reads**: readable without auth. Main match doc NOT readable without auth.

**Spectator subdoc writes** (all must DENY): unauthenticated create/update/delete, non-owner create/update/delete, arbitrary docs under `/matches/{id}/public/{anything}`.

**Field deny-list**: each protected field individually → DENIED, legitimate + smuggled → DENIED, only legitimate → ALLOWED, no-op write → verify behavior.

**ScoreEvents**: public event readable without auth, unfiltered collection query → DENIED, private event → DENIED, filtered query `where('visibility', '==', 'public')` → ALLOWED.

**Public tier**: conditional read edge cases (public → allowed, private → denied, missing/null/wrong case → denied).

**Auth edge cases**: anonymous auth vs unauthenticated documented, registrations NOT readable without auth.

### E2E Tests (~11 tests, Playwright)

- Hub navigation: `/t/:code` → sees Live Now section
- Match navigation: tap card → `/t/:code/match/:matchId` → scoreboard
- Cross-tab real-time: scorer scores in context 1, spectator sees update in context 2 (auto-retrying `toHaveText`, 10s timeout)
- Play-by-play touch pause: `dispatchEvent('touchstart')`, verify no auto-scroll, "Jump to live" works
- Privacy: private-profile player shows as "Player A", real name absent
- Match completion: match transitions to completed, scoreboard shows FINAL
- Doubles layout: 4 names, truncation, privacy with 2 private players
- Hub overflow: 8+ live matches, verify 3 visible + overflow indicator
- Reduced motion: `browser.newContext({ reducedMotion: 'reduce' })`, verify no animations via `getComputedStyle`
- Segmented control: arrow key navigation
- Unauthenticated access: full spectator experience without sign-in

**Test infrastructure**: factories (`makeScoreEvent`, `makePublicMatch`, `makeSpectatorSubdoc`), `clearFirestoreEmulator()` per file, unique IDs per test, auto-retrying assertions only, `trace: 'on-first-retry'`.

**Estimated total: ~115 tests** (25 unit + 30 component + 15 hook + 35 security rules + 11 E2E)

---

## Specialist Reviews Conducted

This design was reviewed across 8 rounds of parallel specialist agent reviews:

1. **Round 1** (Architecture approaches): Firestore scalability, Mobile UX, Security & Privacy, Codebase Fit
2. **Round 2** (Section 1 — Architecture): Firestore modeling, SolidJS reactivity, Security architecture, Performance & PWA
3. **Round 3** (Section 2 — Scoreboard): Mobile UX, CSS performance, Accessibility
4. **Round 4** (Section 3 — Tournament Hub): Mobile UX, SolidJS data flow, Accessibility
5. **Round 5** (Section 4 — Data Model): Firebase security rules, Data model consistency, Privacy/GDPR compliance

6. **Round 6** (Section 5 — Testing): Test coverage gaps, Security rules tests, E2E test feasibility

Key findings incorporated:
- Public projection pattern (Firestore has no field-level access control)
- Registration privacy gap (real names + skill ratings leaked to anonymous users)
- Match field deny-list (prevent client writes to server-managed fields)
- Colorblind-safe score change signals (blue/amber, not green/red)
- 120px/148px scoreboard height (80px was too cramped)
- Compositor-only animations (pseudo-element opacity, not background-color)
- 3-card cap on Live Now section with overflow handling
- Conditional public tier reads (`profileVisibility == 'public'`, not blanket `if true`)
- Privacy policy + consent disclosure requirements (GDPR/CCPA)
