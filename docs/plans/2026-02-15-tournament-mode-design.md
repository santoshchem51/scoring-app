# Tournament Mode Design

**Date**: 2026-02-15
**Goal**: Reach new users by targeting tournament organizers with a real-time, multi-device tournament management system.
**Approach**: Layered Delivery — three independent, shippable layers.

---

## Layer 1: Firebase Foundation

Add Firebase to PickleScore so match scoring works in real-time across multiple devices, while preserving the offline-first experience for solo users.

### Firebase Services

| Service | Purpose |
|---------|---------|
| Firebase Auth | Google sign-in for organizers/scorekeepers. Anonymous fallback for spectators. |
| Cloud Firestore | Real-time database for matches, scores, tournaments. |
| Firebase Hosting | Deploy the PWA (optional). |

### Data Sync Strategy: Dual-Store

- **Dexie stays** for offline-first local storage (existing behavior preserved)
- **Firestore added** as cloud layer for shared/synced matches
- **Sync adapter** pushes local changes to Firestore when online, pulls remote changes down
- Solo users who never sign in get the exact same experience as today

### Auth Flow

1. App loads — user is anonymous (current behavior, no sign-in required)
2. User taps "Sign In" — Google OAuth popup — signed in
3. Signed-in users can: create shared matches, join tournaments, see data across devices
4. Sign-out returns to anonymous local-only mode

### Firestore Data Model

```
users/{userId}
  - displayName, email, photoURL, createdAt

matches/{matchId}
  - ...existing Match fields
  - ownerId (creator)
  - sharedWith[] (user IDs of scorekeepers)
  - visibility: 'private' | 'shared' | 'public'
  - syncedAt (timestamp)

matches/{matchId}/scoreEvents/{eventId}
  - ...existing ScoreEvent fields
  - recordedBy (userId)
```

### Security Rules

- Users can only read/write their own private matches
- Shared matches: owner + sharedWith users can write; public matches read-only to all
- Tournament matches follow tournament-level permissions

### Codebase Changes

| Area | Change |
|------|--------|
| New: `src/data/firebase/` | Firebase config, auth hook, Firestore repositories, sync adapter |
| Modified: `src/data/repositories/` | Cloud-aware versions that route to Dexie or Firestore based on auth state |
| Modified: `src/features/settings/` | "Account" section (sign in/out, profile) |
| New: `src/shared/hooks/useAuth.ts` | Auth state hook (user, loading, signIn, signOut) |
| Unchanged | Scoring engine, voice, celebrations, PWA — zero changes to core scoring |

---

## Layer 2: Tournament Management

Let organizers create and run tournaments from the app, with scorekeepers assigned to courts and all data syncing in real-time.

### Tournament Formats

| Format | Best For | How It Works |
|--------|----------|-------------|
| Round Robin | 4-8 teams, casual | Everyone plays everyone. Winner = most wins. No bracket. |
| Single Elimination | 8-64 teams, fast events | Bracket only, lose once and you're out. |
| Pool Play + Bracket | 8-32 teams, most popular | Round robin in pools, top teams advance to elimination bracket. |

### Tournament Lifecycle

```
setup -> registration -> pool-play -> bracket -> completed
                |             |           |
           cancelled       paused      paused
                          resumed     resumed
                         ended-early  ended-early
```

### Tournament Configuration

```
Tournament:
  name, date, location
  format: 'round-robin' | 'single-elimination' | 'pool-bracket'
  gameType: singles | doubles
  scoringMode: sideout | rally
  pointsToWin: 11 | 15 | 21
  matchFormat: single | best-of-3
  poolCount: 2-8 (auto-suggested)
  teamsPerPoolAdvancing: 1-4
  bracketType: single-elimination
  maxPlayers (optional cap)
  minPlayers (minimum threshold)
  entryFee: { amount, currency, paymentInstructions, deadline }
  rules: {
    registrationDeadline
    checkInRequired, checkInOpens, checkInCloses
    scoringRules, timeoutRules, conductRules
    penalties: [{ offense, consequence }]
    additionalNotes
  }
```

### Firestore Data Model

```
tournaments/{tournamentId}
  - name, date, location, config
  - organizerId
  - format: 'round-robin' | 'single-elimination' | 'pool-bracket'
  - status: 'setup' | 'registration' | 'pool-play' | 'bracket' | 'completed' | 'cancelled' | 'paused'
  - scorekeeperIds[]
  - cancellationReason (if cancelled)
  - createdAt, updatedAt

tournaments/{tournamentId}/teams/{teamId}
  - name, playerIds[], seed (optional)
  - poolId (assigned during registration)

tournaments/{tournamentId}/pools/{poolId}
  - name: "Pool A"
  - teamIds[]
  - schedule: [{ round, team1Id, team2Id, matchId, court }]
  - standings: [{ teamId, wins, losses, pointsFor, pointsAgainst, pointDiff }]

tournaments/{tournamentId}/bracket/{matchSlotId}
  - round, position
  - team1Id, team2Id (null until seeded)
  - matchId
  - winnerId
  - nextSlotId

tournaments/{tournamentId}/registrations/{userId}
  - teamId
  - paymentStatus: 'unpaid' | 'paid' | 'waived'
  - paymentNote
  - lateEntry: boolean
  - rulesAcknowledged: boolean
  - registeredAt

matches/{matchId}
  - ...existing fields
  - tournamentId (nullable)
  - poolId (nullable)
  - bracketSlotId (nullable)
  - court (optional)
```

### Player Joining Flow (Frictionless)

1. Organizer shares tournament link or QR code
2. Player opens link — sees tournament landing page (name, date, location, rules preview)
3. Taps "Join Tournament" — Google sign-in (one tap if already signed in)
4. App auto-fills name from Google profile — player confirms or edits
5. Doubles: join existing team or create one and invite partner
6. Player sees registration confirmation + tournament details
7. Rules acknowledgment checkbox required before registration completes

### Entry Fee Tracking

- Organizer sets fee amount, payment instructions (e.g., "Venmo @john-doe"), and deadline
- Player list shows payment status: Paid / Unpaid / Waived
- Summary bar: "8 of 16 paid ($200 of $400)"
- Nudge button sends in-app reminder with payment instructions
- After deadline: unpaid players flagged

### Rules & Deadlines

- Tournament landing page shows rules summary + deadlines prominently
- "I've read and agree to the tournament rules" checkbox required
- Full rules accessible anytime from tournament dashboard
- Visual timeline showing key deadlines
- Automated reminders before deadlines

### Edge Cases & Organizer Flexibility

**Late registration:**
- After deadline, "Join" shows "Registration Closed" to players
- Organizer can add players manually (bypasses deadline)
- Late registrants flagged as `lateEntry: true`
- If pools formed: prompt to add to smallest pool or rebalance

**Waitlist:**
- Once maxPlayers reached, new registrants land on waitlist
- Auto-promoted if someone drops out

**Organizer override powers:**
- Move players between pools
- Swap match order
- Override match results (with reason logged)
- Remove players (forfeit or clean removal)
- Extend any deadline

**Cancellation:**
- Confirmation dialog with reason (weather, low turnout, venue, other)
- All players notified with reason
- Status moves to `cancelled`, visible in history
- Refund reminder with list of paid players

**Postponement:**
- Change date without cancelling
- Players notified, can confirm or withdraw

**Minimum threshold:**
- If registration count below minPlayers at deadline: organizer prompted to cancel, extend, or proceed

**Mid-tournament disruption:**
- "Pause Tournament" freezes all scoring
- "End Early" uses current standings for final results
- Completed matches preserved regardless

### Pool Generation Algorithm

1. Teams sorted by seed (or random if unseeded)
2. Snake-draft into pools
3. Round-robin schedule per pool
4. Court assignments optional

### Bracket Seeding

1. Pool play completes — standings by wins, then point differential
2. Top N teams advance
3. Cross-pool seeding (Pool A #1 vs Pool B #2)
4. Single-elimination bracket auto-generated

### New Routes

| Route | Page | Access |
|-------|------|--------|
| `/tournaments` | Tournament list | Organizer |
| `/tournaments/new` | Create tournament | Organizer |
| `/tournaments/:id` | Tournament dashboard | All roles |
| `/tournaments/:id/setup` | Team management, pools | Organizer |
| `/tournaments/:id/bracket` | Visual bracket | All roles |

### New UI Components

- TournamentCard — list item
- PoolTable — round-robin standings
- PoolSchedule — match list with status
- BracketView — visual bracket (SVG or CSS grid)
- MatchAssignment — scorekeeper's next match card

### Scorekeeper Flow

1. Signs in with Google
2. Organizer adds as scorekeeper
3. Sees "My Assigned Matches" — upcoming matches for their court
4. Taps match — opens existing ScoringPage (unchanged)
5. Match complete — standings auto-update

---

## Layer 3: Live Tournament Experience

Real-time spectator views and player dashboards.

### Spectator Access

- No sign-in required — public link or QR code
- Read-only tournament dashboard, real-time via Firestore listeners
- Works on any browser, PWA install offered

### Spectator Dashboard Views

| View | Content |
|------|---------|
| Overview | Tournament name, status, current phase, next matches |
| Live Scores | All in-progress matches with real-time updates |
| Pool Standings | Per-pool tables, highlights advancing teams |
| Bracket | Visual bracket filling in as matches complete |
| Schedule | All matches by round with court/time/status |
| Results | Final standings, champion, match history |

### Player Dashboard (signed-in participant)

Everything spectators see, plus:
- "My Matches" — personal schedule with next match highlighted
- "My Stats" — personal tournament W/L, points, point diff
- Push notifications: "Your next match starts in 10 minutes on Court 3"

### New UI Components

- LiveScoreCard — compact real-time score (pulsing dot for live)
- BracketView — SVG/CSS bracket with teams, scores, advancing lines
- StandingsTable — sortable pool standings
- ScheduleTimeline — chronological match list
- TournamentHeader — banner with name, phase badge, QR share button

### Real-Time Performance

- Firestore listeners on active matches only
- Lazy-load completed pool data
- Bracket updates on match completion events
- ~50-100 Firestore reads per spectator per tournament (within free tier)

---

## Architecture Summary

### Scale

- Start: 4-16 players per tournament
- Architect for: 16-64 players
- Later: double elimination, Swiss system, consolation brackets

### Delivery Order

1. **Layer 1** — Firebase + Auth + real-time match sync (foundation)
2. **Layer 2** — Tournament creation, formats, pools, brackets, organizer tools
3. **Layer 3** — Spectator views, player dashboards, notifications

Each layer ships independently and delivers value on its own.
