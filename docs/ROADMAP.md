# PickleScore Roadmap

**Last updated:** 2026-02-16

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

---

## Up Next

### Layer 4: Landing Page & Branding
> First impression matters — a proper landing page, app identity, and marketing presence.

- [ ] Landing page (hero, features showcase, screenshots, CTA)
- [ ] App branding (logo, favicon, app icon, splash screen)
- [ ] PWA manifest polish (name, description, theme color, icons)
- [ ] Open Graph / social meta tags for sharing
- [ ] App Store-ready screenshots

### Layer 5: Notifications & Engagement
> Keep players in the loop without them having to check the app.

- [ ] Push notifications (FCM) — match starting, score updates, invitations received
- [ ] In-app notification center (bell icon with unread count)
- [ ] Email notifications (optional, for invitations and tournament updates)

### Layer 6: Tournament Discovery
> Let players find tournaments without needing a share link.

- [ ] Public tournament listing / browse page
- [ ] Search & filter (by location, date, format, skill level)
- [ ] Tournament categories / tags
- [ ] "Nearby tournaments" (geolocation)

### Layer 7: Player Profiles & History
> Cross-tournament identity and progression.

- [ ] Player profile page (avatar, bio, skill rating)
- [ ] Cross-tournament match history
- [ ] Win/loss stats, point differentials over time
- [ ] Skill rating tracking (ELO or similar)
- [ ] Leaderboards (per-venue, overall)

### Layer 8: Spectator Experience
> Make watching tournaments engaging.

- [ ] Live score updates on public page (already partially done via Wave B)
- [ ] Tournament bracket/pool live view for spectators
- [ ] Match timeline / play-by-play
- [ ] Spectator count indicator

### Layer 9: PWA & Offline Hardening
> Make it feel like a native app.

- [ ] Service worker caching strategy (offline-first for scoring)
- [ ] Install prompt (A2HS banner)
- [ ] Offline tournament access (cached data)
- [ ] Background sync for score uploads when reconnecting
- [ ] App update notifications

### Layer 10: Admin & Moderation
> Tools for organizers running larger events.

- [ ] Bulk player management (import/export CSV)
- [ ] Dispute resolution (flag/edit match results)
- [ ] Multi-organizer support (co-organizers)
- [ ] Tournament templates (save & reuse settings)
- [ ] Fee collection integration (Stripe/Venmo links)

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

Layers 4-10 are roughly ordered by user impact, but not strictly sequential. Some can run in parallel:
- **Layer 4 (Landing/Branding)** is next — it's the front door for new users
- **Layer 5 (Notifications)** and **Layer 9 (PWA)** are high-value quality-of-life improvements
- **Layer 6 (Discovery)** and **Layer 7 (Profiles)** are growth features
- **Layer 8 (Spectator)** and **Layer 10 (Admin)** are nice-to-haves for larger events
