# PickleScore Roadmap

**Last updated:** 2026-02-17

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

---

## Up Next (Priority Order)

### P1 — Layer 6: Tournament Discovery
> Let players find tournaments without needing a share link.

- [ ] Public tournament listing / browse page
- [ ] Search & filter (by location, date, format, skill level)
- [ ] Tournament categories / tags
- [ ] "Nearby tournaments" (geolocation)

### P2 — Layer 7: Player Profiles & History
> Cross-tournament identity and progression.

- [ ] Player profile page (avatar, bio, skill rating)
- [ ] Cross-tournament match history
- [ ] Win/loss stats, point differentials over time
- [ ] Skill rating tracking (ELO or similar)
- [ ] Leaderboards (per-venue, overall)

### P3 — Layer 5: Notifications & Engagement
> Keep players in the loop without them having to check the app.

- [ ] Push notifications (FCM) — match starting, score updates, invitations received
- [ ] In-app notification center (bell icon with unread count)
- [ ] Email notifications (optional, for invitations and tournament updates)

### P4 — Layer 9: PWA & Offline Hardening
> Make it feel like a native app.

- [ ] Service worker caching strategy (offline-first for scoring)
- [ ] Install prompt (A2HS banner)
- [ ] Offline tournament access (cached data)
- [ ] Background sync for score uploads when reconnecting
- [ ] App update notifications

### P5 — Layer 10: Admin & Moderation
> Tools for organizers running larger events.

- [ ] Bulk player management (import/export CSV)
- [ ] Dispute resolution (flag/edit match results)
- [ ] Multi-organizer support (co-organizers)
- [ ] Tournament templates (save & reuse settings)
- [ ] Fee collection integration (Stripe/Venmo links)

### P6 — Layer 8: Spectator Experience
> Make watching tournaments engaging.

- [ ] Live score updates on public page (already partially done via Wave B)
- [ ] Tournament bracket/pool live view for spectators
- [ ] Match timeline / play-by-play
- [ ] Spectator count indicator

### P7 — Layer 12: Monetization & Revenue
> Sustainable business model to fund development and hosting.

- [ ] Define pricing tiers (free vs premium features)
- [ ] Payment integration (Stripe, in-app purchases)
- [ ] Organizer subscription (advanced tournament features, analytics)
- [ ] Fee collection for tournament entry (pass-through to organizers)
- [ ] Cost analysis (Firebase usage, hosting, app store fees)
- [ ] Usage analytics and conversion tracking

### P8 — Layer 11: App Store Distribution
> Get PickleScore into users' hands via app stores.

- [ ] Wrap PWA for Android (TWA / Capacitor / similar)
- [ ] Wrap PWA for iOS (Capacitor / similar)
- [ ] App Store listing (screenshots, description, keywords)
- [ ] Play Store listing (screenshots, description, keywords)
- [ ] App review / approval process
- [ ] CI/CD pipeline for app store builds

### P9 — Layer 13: Multi-Sport Expansion
> Extend the scoring engine beyond pickleball to other sports.

- [ ] Abstract scoring engine (pluggable rules per sport)
- [ ] Table Tennis support (11-point games, best of 5/7, serve rotation)
- [ ] Box Cricket support (overs, wickets, run tracking)
- [ ] Sport selector on game setup (choose sport before scoring)
- [ ] Sport-specific tournament formats and rules
- [ ] Rebrand/umbrella brand strategy (PickleScore → broader name?)

---

## Ideas (Unscoped)

- Court assignment / scheduling
- Referee mode (neutral third-party scoring)
- Tournament chat / announcements
- Dark/light theme toggle
- Multi-language support
- Analytics dashboard for organizers
- API for third-party integrations
- Social features (follow players, share results)

---

## Prioritization Notes

Priority order: **Discovery → Profiles → Notifications → PWA → Admin → Spectator → Monetization → App Store → Multi-Sport**

Rationale (growth funnel):
1. **Discovery + Profiles** (P1-P2) — Acquire users and give them identity
2. **Notifications** (P3) — Retain users with engagement loops
3. **PWA + Admin** (P4-P5) — Polish the experience and empower organizers
4. **Spectator** (P6) — Nice-to-have engagement for larger events
5. **Monetization → App Store** (P7-P8) — Build business model, then distribute
6. **Multi-Sport** (P9) — Major architectural expansion, do last
