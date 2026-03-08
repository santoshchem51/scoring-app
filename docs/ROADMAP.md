# PickleScore Roadmap

**Last updated:** 2026-03-07

---

## Completed

### Layer 1: Core Scoring Engine
- [x] XState v5 scoring state machine (side-out + rally, singles + doubles)
- [x] Win-by-2 rule, configurable points to win (11/15/21)
- [x] Match formats (1 game, best of 3, best of 5)
- [x] Game history with IndexedDB persistence (Dexie.js)
- [x] Player management (local)
- [x] Settings store with smart defaults

### Phase 2: Premium Feel
- [x] Design system enhancement (colors, typography, Oswald font)
- [x] Score animations (WAAPI)
- [x] Page transitions (solid-transition-group)
- [x] Sound effects + haptic feedback
- [x] Loading skeletons + empty states
- [x] Brand identity basics

### Phase 3: Differentiate
- [x] Quick Game (one-tap start with defaults)
- [x] Custom team colors (6 presets)
- [x] Swipe gestures for scoring
- [x] Celebration animations (confetti)

### Layer 2: Tournament Management
- [x] Firebase foundation (auth, Firestore)
- [x] Tournament CRUD (create, list, dashboard)
- [x] Registration system (player sign-up, organizer management)
- [x] Round-robin pools with standings
- [x] Single-elimination brackets with advancement
- [x] Pool-to-bracket format
- [x] Team formation (singles, BYOP doubles, auto-pair)
- [x] Match scoring integration (create match from pool/bracket)
- [x] Match rescoring with bracket safety checks
- [x] BYOP manual pairing for organizers
- [x] Completion validation (pool + bracket)
- [x] Tournament results view

### Layer 3: Live Tournament Experience
- [x] **Wave A — Sharing:** Visibility toggle, share codes, QR codes, public tournament page (`/t/:shareCode`)
- [x] **Wave B — Real-time:** Firestore onSnapshot listeners, live score cards, point-by-point updates
- [x] **Wave C — Role-based dashboards:** Viewer role detection, My Matches, My Stats, Scorekeeper match list
- [x] **Wave D — In-App Invitations:** User search (typeahead), invitation model, player inbox, Accept/Decline flow, mailto fallback

### Layer 4: Landing Page & Branding
- [x] Landing page (hero, features, how-it-works, CTA, footer)
- [x] TopNav with global auth (Sign In / avatar dropdown)
- [x] App branding (pickleball logo favicon, LogoIcon component)
- [x] PWA manifest polish (name → PickleScore, updated description)
- [x] Open Graph / social meta tags for sharing
- [x] Route changes (/ → LandingPage, /new → GameSetupPage)

### Casual Play
- [x] **Phase 1 — Scorer Role:** I'm Playing vs I'm Scoring toggle, scorer team selection
- [x] **Phase 2 — Buddy Picker:** Buddy list, assign to teams, search, capacity management
- [x] **Phase 3 — Global User Search:** Search all users, add as buddy, privacy filtering

### Layer 6: Tournament Discovery
- [x] Public tournament listing / browse page
- [x] Search & filter (by location, date, format)
- [x] Browse / My Tournaments tab switcher
- [x] Tournament cards with status, player count, format
- [x] Tournament access control (open, approval, invite-only, group)

### Layer 7: Player Profiles & History
- [x] **Wave A — Stats & Tier Engine:** Glicko-inspired tier system (beginner → expert), confidence tracking, per-match stat updates
- [x] **Wave B — Profile Page:** Profile header, stats overview, recent matches, tier badge, public tier docs
- [x] **Wave C — Leaderboards:** Global + friends scoped leaderboards, timeframe filtering, podium + rank card UI
- [x] **Wave D — Achievements:** 23-badge achievement system, badge engine, trophy case, toast notifications, startup migration

### Player Buddies
- [x] Group management (create, list, members)
- [x] Game sessions with RSVP (In/Out/Maybe)
- [x] Notification badges with unread count
- [x] Public share pages (session + group invite)
- [x] Day-of status buttons for confirmed sessions

### Cloud Sync
- [x] Firestore cloud sync for matches and stats
- [x] Cloud Sync section in Settings page
- [x] Sync error banner

---

## Up Next (Priority Order)

### P1 — Sync Queue Hardening
> Core sync queue is implemented. Hardening pass to fix specialist-review findings.
>
> *Fixes applied via `docs/plans/2026-03-07-sync-hardening.md`.*

- [x] SyncJob types + Dexie schema
- [x] Retry policy + exponential backoff with jitter
- [x] Error classification (retryable, rate-limited, auth-dependent, fatal)
- [x] Sync queue enqueue + claim operations
- [x] Queue processor (Web Locks, adaptive polling, bounded parallelism)
- [x] Refactor cloudSync.ts to use queue
- [x] useSyncStatus hook + TopNav indicator
- [x] Drop legacy syncScoreEventToCloud
- [x] Startup cleanup + auth recovery
- [x] Reset sync signals on sign-out
- [x] Periodic stale job reclaim
- [x] Per-type job timeouts
- [x] Atomic resetAwaitingAuthJobs
- [x] TopNav sync indicator accessibility
- [x] Error classification hardening
- [ ] Full test suite + E2E tests

### P2 — Layer 5: Notifications & Engagement
> Keep players in the loop without them having to check the app.

- [ ] Push notifications (FCM) — match starting, score updates, invitations received
- [ ] In-app notification center (bell icon with unread count)
- [ ] Email notifications (optional, for invitations and tournament updates)

### P3 — Layer 9: PWA & Offline Hardening
> Make it feel like a native app.

- [ ] Service worker caching strategy (offline-first for scoring)
- [ ] Install prompt (A2HS banner)
- [ ] Offline tournament access (cached data)
- [ ] Background sync for score uploads when reconnecting
- [ ] App update notifications

### P4 — Layer 10: Admin & Moderation
> Tools for organizers running larger events.

- [ ] Bulk player management (import/export CSV)
- [ ] Dispute resolution (flag/edit match results)
- [ ] Multi-organizer support (co-organizers)
- [ ] Tournament templates (save & reuse settings)
- [ ] Fee collection integration (Stripe/Venmo links)

### P5 — Layer 8: Spectator Experience
> Make watching tournaments engaging.

- [ ] Live score updates on public page (partially done via Layer 3 Wave B)
- [ ] Tournament bracket/pool live view for spectators
- [ ] Match timeline / play-by-play
- [ ] Spectator count indicator

### P6 — Layer 12: Monetization & Revenue
> Sustainable business model to fund development and hosting.

- [ ] Define pricing tiers (free vs premium features)
- [ ] Payment integration (Stripe, in-app purchases)
- [ ] Organizer subscription (advanced tournament features, analytics)
- [ ] Fee collection for tournament entry (pass-through to organizers)
- [ ] Cost analysis (Firebase usage, hosting, app store fees)
- [ ] Usage analytics and conversion tracking

### P7 — Layer 11: App Store Distribution
> Get PickleScore into users' hands via app stores.

- [ ] Wrap PWA for Android (TWA / Capacitor / similar)
- [ ] Wrap PWA for iOS (Capacitor / similar)
- [ ] App Store listing (screenshots, description, keywords)
- [ ] Play Store listing (screenshots, description, keywords)
- [ ] App review / approval process
- [ ] CI/CD pipeline for app store builds

### P8 — Layer 13: Multi-Sport Expansion
> Extend the scoring engine beyond pickleball to other sports.

- [ ] Abstract scoring engine (pluggable rules per sport)
- [ ] Table Tennis support (11-point games, best of 5/7, serve rotation)
- [ ] Box Cricket support (overs, wickets, run tracking)
- [ ] Sport selector on game setup (choose sport before scoring)
- [ ] Sport-specific tournament formats and rules
- [ ] Rebrand/umbrella brand strategy (PickleScore → broader name?)

---

## Deferred / Future

- Casual Phase 4: QR code join for casual matches
- Gap #6: Offline tournament data caching in Dexie.js
- Cloud Function for server-side privacy filtering (scale concern)
- Per-venue leaderboards
- Tournament categories / tags
- Nearby tournaments (geolocation)

---

## Ideas (Unscoped)

- Court assignment / scheduling
- Referee mode (neutral third-party scoring)
- Tournament chat / announcements
- Multi-language support
- Analytics dashboard for organizers
- API for third-party integrations
- Social features (follow players, share results)

---

## Prioritization Notes

Priority order: **Sync Redesign → Notifications → PWA → Admin → Spectator → Monetization → App Store → Multi-Sport**

Rationale (growth funnel):
1. **Sync Redesign** (P1) — Foundation reliability before adding more features
2. **Notifications** (P2) — Retain users with engagement loops
3. **PWA + Admin** (P3-P4) — Polish the experience and empower organizers
4. **Spectator** (P5) — Nice-to-have engagement for larger events
5. **Monetization → App Store** (P6-P7) — Build business model, then distribute
6. **Multi-Sport** (P8) — Major architectural expansion, do last
