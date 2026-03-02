# Profile Page Test Coverage Design

## Goal

Add comprehensive test coverage for the read-only profile page: unit/component tests for rendering logic + E2E tests for real Firestore integration.

## Approach

**Approach A (selected):** Unit tests for components + E2E for integration.

- Unit tests verify rendering logic cheaply (photo validation, formatting, conditionals)
- E2E tests verify the real Firestore data flow (seeding → fetch → render)

## Specialist Review (2026-03-02)

Reviewed by 3 specialist agents (SolidJS testing, E2E architecture, coverage completeness). Key fixes applied:

1. Added `waitFor` for SolidJS reactivity with fake timers in date tests
2. Added partial failure E2E test (stats present, matches missing)
3. Added Load More disabled state assertion for accessibility
4. Added photo URL edge cases (malformed URL, empty string)
5. Added relative date boundary tests (7d, 30d, 365d)
6. Added empty state CTA href verification
7. Fixed timezone-sensitive date in member-since test

## Unit Tests

### ProfileHeader (`ProfileHeader.test.tsx`) — 12 tests

| Test | Verifies |
|------|----------|
| displays display name in heading | `<h1>` contains name |
| displays email | email text visible |
| formats "Member since" correctly | timestamp → "Mar 2024" (UTC mid-month) |
| shows initials avatar when photoURL is null | fallback div with first letter |
| shows initials avatar for non-HTTPS photo URL | `http://` rejected |
| shows initials avatar for non-Google domain | `https://evil.com/photo.jpg` rejected |
| shows initials avatar for malformed URL | `not-a-url` rejected |
| shows initials avatar for empty string URL | `""` rejected |
| shows `<img>` for valid Google photo URL | `lh3.googleusercontent.com` renders img |
| shows `?` fallback when displayName is empty | edge case |
| shows tier badge when hasStats is true | TierBadge rendered |
| hides tier badge when hasStats is false | TierBadge not rendered |

### StatsOverview (`StatsOverview.test.tsx`) — 8 tests

| Test | Verifies |
|------|----------|
| displays win rate as percentage | 0.7 → "70%" |
| displays 0% win rate | edge case |
| displays total matches count | number rendered |
| displays current win streak | "W3" format |
| displays current loss streak | "L2" format |
| displays dash for zero streak | count 0 → "—" |
| displays best win streak | "W5" format |
| displays singles/doubles breakdown | "Singles 4-2 · Doubles 3-1" |

### RecentMatches (`RecentMatches.test.tsx`) — 8 tests

| Test | Verifies |
|------|----------|
| renders match rows with W/L badges | win → "W", loss → "L" |
| displays opponent names | "vs Bob" |
| displays scores | "11-7, 11-4" |
| joins multiple opponent names with & | doubles: "vs Bob & Carol" |
| shows Load More button when hasMore is true | button visible via aria-label |
| hides Load More button when hasMore is false | button absent (SolidJS Show removes from DOM) |
| shows Loading... and disables button when loadingMore | text + disabled state |
| formats relative dates correctly | today, 1d, 3d, 1w, 2w, 1mo, 3mo, 1y (with boundaries) |

## E2E Tests

### Profile spec (`e2e/profile/profile.spec.ts`) — 5 tests

Uses Firestore emulator seeding via `seedFirestoreDocAdmin`.

| Test | Setup | Verifies |
|------|-------|----------|
| displays user info and stats | Seed profile + stats + 2 match refs | Header, stats cards, recent matches |
| shows empty state for new user | Sign in only (no stats) | "No matches recorded yet" + CTA href="/new" |
| shows stats but handles missing matches | Seed profile + stats, no match refs | Stats visible, match list absent |
| requires authentication | Visit `/profile` unauthenticated | "Sign in required" prompt |
| Load More fetches additional matches | Seed 12 match refs | Load More button works, shows all 12 after click |

### Page object: `e2e/pages/ProfilePage.ts`

### Seeding paths

- `users/{uid}` → profile doc
- `users/{uid}/stats/summary` → stats summary
- `users/{uid}/matchRefs/{matchId}` → match ref docs
