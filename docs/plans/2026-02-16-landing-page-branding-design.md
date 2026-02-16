# Landing Page & Branding — Design

**Created:** 2026-02-16
**Status:** Approved
**Context:** Layer 4. All scoring, tournament management, real-time, and invitation features are complete. The app needs a public face.

---

## Problem

PickleScore has no landing page — `/` goes straight to the scoring form. There's no branding beyond a placeholder favicon, no social sharing meta tags, inconsistent naming ("Pickle Score" vs "PickleScore"), and no global sign-in. New visitors have no way to understand what the app does before being dropped into a game setup screen.

## Solution

Add a single-scroll landing page at `/`, a proper logo and brand identity, a global top nav with auth, and Open Graph meta tags. Move the scoring form to `/new`. Remove auth from Settings (replaced by global TopNav).

## Key Decisions

| Decision | Choice |
|----------|--------|
| Approach | Integrated SolidJS component (not separate site) |
| Root URL | Landing page for all visitors |
| Audience | Both players and organizers (tournament-leaning) |
| Brand style | Bold & sporty (matches existing dark/green/orange palette) |
| Logo | Pickleball + scoring icon (SVG, scales from favicon to hero) |
| Auth | Global TopNav with Sign In / avatar (replaces Settings account section) |
| Landing layout | Single scroll: hero → features → how it works → CTA → footer |
| Name | Standardized to "PickleScore" (one word) everywhere |

---

## Routing Changes

| Route | Before | After |
|-------|--------|-------|
| `/` | GameSetupPage | **LandingPage** |
| `/new` | (didn't exist) | **GameSetupPage** |
| All other routes | No change | No change |

- Landing page renders outside `App` layout (no BottomNav)
- BottomNav "New" tab updates from `/` to `/new`

---

## TopNav Component

Global top navigation bar replacing the current `PageLayout` title bar. Visible on all pages.

**Layout:**
- **Left:** Logo icon (links to `/`). On app pages, page title appears next to it.
- **Right (signed out):** "Sign In" button — calls `signIn()` from `useAuth()`
- **Right (signed in):** User avatar (or initial circle). Tap opens dropdown: name, email, "Sign out".

**Landing page variant:** Logo + wordmark on left (no page title).

**Settings page:** Account fieldset removed entirely. Auth handled by TopNav.

---

## Logo & Branding

**Logo:** Stylized pickleball combined with a score/number element. SVG for perfect scaling.

**Variants:**

| Variant | Usage |
|---------|-------|
| Icon only (square) | Favicon, PWA icons, app icon |
| Icon + wordmark (horizontal) | TopNav, landing page hero |
| Wordmark only | Footer, minimal contexts |

**Color palette:** Unchanged — primary green (`#22c55e`), accent orange (`#f97316`), score yellow (`#facc15`), dark surface (`#1e1e2e`).

**Name:** Standardized to **"PickleScore"** (one word, camelCase) everywhere.

**PWA manifest updates:**
- `name`: "PickleScore"
- `short_name`: "PickleScore"
- `description`: "Pickleball scoring, tournament management, and live results"
- New icons at 192px and 512px

---

## Landing Page Sections

### 1. Hero

- Large logo (icon + wordmark)
- Tagline (e.g., "Score. Organize. Compete.")
- Subtitle: One sentence explaining the app
- Two CTAs: **"Start Scoring"** (primary, → `/new`) and **"Manage Tournaments"** (outlined, → `/tournaments`)
- Dark background with subtle gradient/glow using existing tokens

### 2. Features (6 cards)

| Feature | Focus | Description |
|---------|-------|-------------|
| Quick Scoring | Personal | One-tap start, swipe to score, works offline court-side |
| Match History & Stats | Personal | Every game saved, win/loss tracking |
| Tournament Management | Organizer | Round-robin, elimination, pool-to-bracket formats |
| Live Real-Time Scores | Both | Point-by-point updates, live standings, spectator views |
| Sharing & QR Codes | Both | Public links, QR codes, instant tournament access |
| Player Invitations | Organizer | Search users, send in-app invites, one-tap accept |

2x3 grid on mobile, 3x2 on desktop. Cards use `bg-surface-light` with icon, title, description.

### 3. How It Works (3 steps)

1. **Score** — "Tap to score, swipe to undo. Works offline."
2. **Organize** — "Create tournaments, invite players, manage brackets."
3. **Share** — "QR codes, live links, real-time spectator views."

Horizontal layout with numbered steps.

### 4. Final CTA

- "Ready to play?" heading
- "Get Started" button (→ `/new`)

### 5. Footer

- "PickleScore" wordmark
- "Built for pickleball players and organizers"
- PWA install hint

---

## Open Graph & SEO

**Meta tags in `index.html`:**
- `og:title`: "PickleScore — Pickleball Scoring & Tournament Management"
- `og:description`: "Score games court-side, organize tournaments, share live results. Free, offline-first, no download required."
- `og:image`: `public/og-image.png` (1200x630 — logo + tagline on dark background)
- `og:type`: "website"
- `twitter:card`: "summary_large_image"

**Title:** "PickleScore — Pickleball Scoring & Tournaments"

---

## File Changes

### New files

| File | Purpose |
|------|---------|
| `src/features/landing/LandingPage.tsx` | Landing page component |
| `src/shared/components/TopNav.tsx` | Global top nav with auth |
| `public/og-image.png` | Social preview image (1200x630) |
| `public/logo.svg` | New logo SVG |

### Modified files

| File | Change |
|------|--------|
| `src/app/router.tsx` | Add `/` → LandingPage, move GameSetupPage to `/new` |
| `src/shared/components/PageLayout.tsx` | Use TopNav instead of current title bar |
| `src/shared/components/BottomNav.tsx` | "New" tab links to `/new` |
| `src/features/settings/SettingsPage.tsx` | Remove Account fieldset |
| `public/favicon.svg` | Replace with new logo |
| `public/pwa-192x192.png` | Replace with new logo at 192px |
| `public/pwa-512x512.png` | Replace with new logo at 512px |
| `public/apple-touch-icon.png` | Replace with new logo |
| `vite.config.ts` | Update PWA manifest name/description |
| `index.html` | Update title, add OG meta tags |

No new dependencies.

---

## Testing

No unit tests needed — all presentational. E2E verification:

1. `/` → landing page renders with all sections
2. "Start Scoring" → navigates to `/new` (GameSetupPage)
3. "Manage Tournaments" → navigates to `/tournaments`
4. TopNav Sign In → Google popup, avatar appears
5. App pages → TopNav consistent with avatar
6. TopNav Sign Out → reverts to "Sign In"
7. BottomNav "New" → goes to `/new`
8. OG meta tags present in page source
