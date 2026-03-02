# Profile Page Test Coverage Design

## Goal

Add comprehensive test coverage for the read-only profile page: unit/component tests for rendering logic + E2E tests for real Firestore integration.

## Approach

**Approach A (selected):** Unit tests for components + E2E for integration.

- Unit tests verify rendering logic cheaply (photo validation, formatting, conditionals)
- E2E tests verify the real Firestore data flow (seeding → fetch → render)

## Unit Tests

### ProfileHeader (`ProfileHeader.test.tsx`)

| Test | Verifies |
|------|----------|
| displays display name in heading | `<h1>` contains name |
| displays email | email text visible |
| formats "Member since" correctly | timestamp → "Mar 2024" |
| shows initials avatar when photoURL is null | fallback div with first letter |
| shows initials avatar for non-HTTPS photo URL | `http://` rejected |
| shows initials avatar for non-Google domain | `https://evil.com/photo.jpg` rejected |
| shows `<img>` for valid Google photo URL | `lh3.googleusercontent.com` renders img |
| shows `?` fallback when displayName is empty | edge case |
| shows tier badge when hasStats is true | TierBadge rendered |
| hides tier badge when hasStats is false | TierBadge not rendered |

### StatsOverview (`StatsOverview.test.tsx`)

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

### RecentMatches (`RecentMatches.test.tsx`)

| Test | Verifies |
|------|----------|
| renders match rows with W/L badges | win → "W", loss → "L" |
| displays opponent names | "vs Bob" |
| displays scores | "11-7, 11-4" |
| joins multiple opponent names with & | doubles: "vs Bob & Carol" |
| shows Load More button when hasMore is true | button visible |
| hides Load More button when hasMore is false | button absent |
| shows Loading... when loadingMore | button text changes |
| formats relative dates correctly | today, 1d, 3d, 2w, 3mo, 1y |

## E2E Tests

### Profile spec (`e2e/profile/profile.spec.ts`)

Uses Firestore emulator seeding via `seedFirestoreDocAdmin`.

| Test | Setup | Verifies |
|------|-------|----------|
| displays user info and stats | Seed profile + stats + 2 match refs | Header, stats cards, recent matches |
| shows empty state for new user | Sign in only (no stats) | "No matches recorded yet" + CTA |
| shows loading skeleton | Navigate to `/profile` | Skeleton with aria-label="Loading profile" |
| requires authentication | Visit `/profile` unauthenticated | Redirected away |
| navigates via bottom nav | Sign in, click Profile tab | Lands on `/profile` |
| Load More fetches additional matches | Seed 11+ match refs | Load More button works |

### Page object: `e2e/pages/ProfilePage.ts`

### Seeding paths

- `users/{uid}` → profile doc
- `users/{uid}/stats/summary` → stats summary
- `users/{uid}/matchRefs/{matchId}` → match ref docs
