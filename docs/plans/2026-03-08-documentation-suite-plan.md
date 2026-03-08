# Documentation Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a 12-file developer documentation suite + GitHub templates for PickleScore.

**Architecture:** Each doc is an independent file with cross-references. README and docs/index.md are written last since they link to everything else. CLAUDE.md is canonical for commands/workflow — human docs reference it, not duplicate.

**Tech Stack:** Markdown only — no code changes, no tests needed. Each task creates one file and commits.

**Design doc:** `docs/plans/2026-03-08-documentation-suite-design.md`

---

### Task 1: LICENSE (MIT)

**Files:**
- Create: `LICENSE`

**Step 1: Create LICENSE file**

```
MIT License

Copyright (c) 2026 PickleScore Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "Add MIT license"
```

---

### Task 2: CODE_OF_CONDUCT.md

**Files:**
- Create: `CODE_OF_CONDUCT.md`

**Step 1: Create CODE_OF_CONDUCT.md**

Use the Contributor Covenant v2.1 template. Content:

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, caste, color, religion, or sexual
identity and orientation.

## Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- The use of sexualized language or imagery, and sexual attention or advances
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project maintainers. All complaints will be reviewed and
investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org),
version 2.1, available at
[https://www.contributor-covenant.org/version/2/1/code_of_conduct.html](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).
```

**Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "Add Contributor Covenant code of conduct"
```

---

### Task 3: SECURITY.md

**Files:**
- Create: `SECURITY.md`

**Step 1: Create SECURITY.md**

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in PickleScore, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly or use GitHub's private vulnerability reporting feature (Security tab > "Report a vulnerability").

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Best effort, depending on severity

## Scope

This policy applies to:

- The PickleScore web application
- Firebase security rules (`firestore.rules`)
- Authentication flows (Firebase Auth + Google Sign-In)
- Data stored in Firestore and IndexedDB

## Supported Versions

Only the latest version on the `main` branch is supported with security updates.
```

**Step 2: Commit**

```bash
git add SECURITY.md
git commit -m "Add security policy"
```

---

### Task 4: GitHub Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Step 1: Create bug report template**

`.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug in PickleScore
title: "[Bug] "
labels: bug
---

## Description

A clear description of what the bug is.

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Environment

- Browser: [e.g., Chrome 120]
- Device: [e.g., iPhone 15, Desktop]
- Offline/Online: [e.g., Online]
- Firebase Emulator: [Yes/No]

## Screenshots

If applicable, add screenshots.
```

**Step 2: Create feature request template**

`.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature Request
about: Suggest a new feature for PickleScore
title: "[Feature] "
labels: enhancement
---

## Problem

What problem does this feature solve?

## Proposed Solution

Describe the solution you'd like.

## Alternatives Considered

Any alternative solutions or features you've considered.

## Additional Context

Add any other context, mockups, or examples.
```

**Step 3: Create issue template config**

`.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions & Discussion
    url: https://github.com/santoshchem51/scoring-app/discussions
    about: Ask questions and discuss ideas
```

**Step 4: Create PR template**

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

Brief description of what this PR does.

## Changes

- [ ] Change 1
- [ ] Change 2

## Checklist

- [ ] Tests written (failing test first, then implementation)
- [ ] All tests pass (`npx vitest run`)
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] Verified behavior manually (if UI change)
- [ ] No console errors in browser
- [ ] Follows SolidJS conventions (no prop destructuring, `class` not `className`, `import type`)
```

**Step 5: Commit**

```bash
git add .github/
git commit -m "Add GitHub issue and PR templates"
```

---

### Task 5: docs/setup.md

**Files:**
- Create: `docs/setup.md`

**Step 1: Create docs/setup.md**

```markdown
# Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Comes with Node.js |
| Java | 11+ | Required for Firebase emulators |
| Firebase CLI | 13+ | `npm install -g firebase-tools` |

> **Java check**: Run `java -version`. Firebase emulators will fail silently without it.

## Initial Setup

```bash
# Clone the repository
git clone https://github.com/santoshchem51/scoring-app.git
cd scoring-app

# Install dependencies
npm install

# Install Playwright browsers (for E2E tests)
npx playwright install

# Copy environment template
cp .env.example .env.local
```

## Environment Variables

Edit `.env.local` with your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

For local development with emulators, the values above are only needed for production builds. The app auto-connects to emulators in dev mode unless `VITE_USE_EMULATORS=false`.

## Running the App

```bash
# Start dev server (port 5199)
npx vite --port 5199

# Start Firebase emulators (Firestore on 8180, Auth on 9099)
npm run emulator:start
```

The Firebase emulator UI is available at http://localhost:4000.

## Firebase Emulator Setup

The app uses two Firebase emulators:

| Service | Port | Purpose |
|---------|------|---------|
| Firestore | 8180 | Cloud database |
| Auth | 9099 | Authentication |
| Emulator UI | 4000 | Admin dashboard |

**Port conflicts**: If another Firebase project uses the same ports, edit `firebase.json` to change them. Update `src/data/firebase/config.ts` emulator connection to match.

## Build

```bash
# Type check
npx tsc --noEmit

# Production build
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Firebase emulators won't start
- Ensure Java 11+ is installed: `java -version`
- Check port availability: `lsof -i :8180` (macOS/Linux) or `netstat -ano | findstr 8180` (Windows)
- Kill orphaned emulator processes if ports are occupied

### `VITE_FIREBASE_*` errors on startup
- Ensure `.env.local` exists with all required variables
- Restart the dev server after changing env vars (Vite doesn't hot-reload env)

### Tests fail with "Firebase not initialized"
- Start emulators first: `npm run emulator:start`
- For E2E tests, the Playwright config auto-starts emulators

### SolidJS reactivity issues in development
- Never destructure props — always use `props.foo`
- Use `class` not `className`
- Check the [SolidJS rules in CLAUDE.md](../CLAUDE.md) for the full list

## Related Docs

- [README](../README.md) — Project overview and quick reference
- [Contributing](../CONTRIBUTING.md) — Workflow and code conventions
- [Testing Guide](testing-guide.md) — How to run and write tests
```

**Step 2: Commit**

```bash
git add docs/setup.md
git commit -m "Add developer setup guide"
```

---

### Task 6: docs/architecture.md

**Files:**
- Create: `docs/architecture.md`

**Step 1: Create docs/architecture.md**

```markdown
# Architecture

## System Overview

PickleScore is an offline-first PWA for pickleball scoring and tournament management. The app works entirely offline using IndexedDB (via Dexie.js) and syncs to Firebase Firestore when online.

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │ SolidJS  │──▶│  Stores  │──▶│   Dexie.js   │ │
│  │   UI     │   │ (Signals)│   │  (IndexedDB) │ │
│  └──────────┘   └──────────┘   └──────┬───────┘ │
│       │                               │          │
│       │         ┌──────────┐          │          │
│       └────────▶│  XState  │          │          │
│                 │ (Scoring)│   ┌──────▼───────┐  │
│                 └──────────┘   │  Sync Queue  │  │
│                                │  (Dexie tbl) │  │
│                                └──────┬───────┘  │
│                                       │          │
└───────────────────────────────────────┼──────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Firebase Cloud    │
                              │  ┌─────────────┐   │
                              │  │  Firestore   │   │
                              │  └─────────────┘   │
                              │  ┌─────────────┐   │
                              │  │    Auth      │   │
                              │  └─────────────┘   │
                              └────────────────────┘
```

## Feature Module Pattern

All features live under `src/features/`. Each feature is a self-contained module:

```
src/features/{feature}/
├── components/     UI components specific to this feature
├── engine/         Pure logic (state machines, calculations)
├── hooks/          SolidJS hooks (data fetching, reactive state)
├── helpers/        Utility functions
├── repository/     Data access (if feature-specific)
├── store/          Feature-level stores (signals)
└── {Feature}Page.tsx   Page-level entry component
```

Not every feature has every subdirectory — only what it needs.

The 11 feature modules are: `scoring`, `tournaments`, `players`, `buddies`, `history`, `leaderboard`, `notifications`, `achievements`, `profile`, `settings`, `landing`.

## State Management

PickleScore uses three state management approaches, each for a different purpose:

| Approach | Used For | Location |
|----------|----------|----------|
| **XState v5** | Scoring state machine (game flow, serving, win detection) | `src/features/scoring/engine/pickleballMachine.ts` |
| **SolidJS signals** | All other reactive state (settings, notifications, achievements, UI state) | `src/stores/`, feature `store/` dirs |
| **Dexie.js live queries** | Reactive database reads (match lists, player lists) | Via `useLiveQuery` hook |

> **Note**: `zustand` appears in `package.json` but is not imported anywhere. All stores use SolidJS signals directly.

### XState Scoring Machine

The scoring engine (`pickleballMachine.ts`) manages the full game lifecycle:

- **Input config**: game type (singles/doubles), scoring mode (rally/sideout), match format (single/best-of-3/best-of-5), points to win
- **Guards**: `canScore` (sideout: only serving team), `isGameWon` (win-by-2 rule), `isMatchWon`
- **State flow**: `idle` → `playing` → `gameOver` → `matchOver`

### Settings Store Pattern

The settings store (`src/stores/settingsStore.ts`) merges defaults with localStorage:

```typescript
// DEFAULTS has every field. localStorage may have only some.
const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('settings')) }
```

**Critical rule**: Always add new settings fields to `DEFAULTS`. Existing users' localStorage won't have them.

## Data Layer: Offline-First with Cloud Sync

### Local Database (Dexie.js / IndexedDB)

All data is stored locally first. See [Data Model](data-model.md) for full schema.

### Sync Queue

The sync queue bridges local and cloud data. When data changes:

1. A `SyncJob` is enqueued in the `syncQueue` Dexie table
2. The sync processor polls for pending jobs
3. Jobs are executed against Firestore with retry logic
4. Completed jobs are pruned after 24 hours

Key properties:
- **Deterministic IDs**: `${type}:${entityId}` — re-enqueueing the same entity updates the existing job
- **Dependency tracking**: `playerStats` jobs wait for their `match` job to complete
- **Error classification**: retryable, rate-limited, auth-dependent, fatal (see [Data Model](data-model.md#sync-queue))
- **Exponential backoff with jitter**: prevents thundering herd on recovery

### Cloud Sync Orchestration

`src/data/firebase/cloudSync.ts` coordinates bidirectional sync:

- **Push**: `syncMatchToCloud()` enqueues match for sync (fire-and-forget)
- **Pull on sign-in**: `pullCloudMatchesToLocal()` hydrates Dexie from Firestore
- **Conflict resolution**: In-progress local matches are never overwritten; owned matches take precedence over shared

## Auth Flow

1. User clicks "Sign in with Google" on Settings page
2. Firebase Auth handles OAuth flow
3. `useAuth` hook (global singleton) updates reactive signals: `user`, `loading`, `syncing`
4. On successful sign-in, `pullCloudMatchesToLocal()` runs
5. All subsequent data writes enqueue sync jobs
6. On sign-out, sync stops but local data persists

Auth state is shared app-wide via `src/shared/hooks/useAuth.ts` (module-level signals, not a provider).

## PWA Architecture

- **Service worker**: Generated by `vite-plugin-pwa` (Workbox)
- **Manifest**: Auto-generated with app icons
- **Offline**: Full offline support via IndexedDB (Dexie) — the app works without network
- **Install prompt**: Standard PWA install banner

## Related Docs

- [Data Model](data-model.md) — Dexie tables, Firestore collections, sync queue schema
- [Features](features.md) — Detailed guide to each feature module
- [Testing Guide](testing-guide.md) — How to run tests against this architecture
- [Debugging](debugging.md) — How to inspect state, sync queue, and IndexedDB at runtime
```

**Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "Add architecture documentation"
```

---

### Task 7: docs/data-model.md

**Files:**
- Create: `docs/data-model.md`

**Step 1: Create docs/data-model.md**

```markdown
# Data Model

## Dexie.js Tables (Local / IndexedDB)

Source: `src/data/db.ts`

### matches

| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key |
| config | object | `{ gameType, scoringMode, matchFormat, pointsToWin }` |
| team1PlayerIds | string[] | Multi-entry index |
| team2PlayerIds | string[] | Multi-entry index |
| team1Name | string | Display name |
| team2Name | string | Display name |
| games | GameResult[] | Score history per game |
| winningSide | 1 \| 2 \| null | Match winner |
| status | 'in-progress' \| 'completed' \| 'abandoned' | |
| startedAt | Date | |
| completedAt | Date? | |
| tournamentId | string? | Links to tournament |
| poolId | string? | Links to pool |
| bracketSlotId | string? | Links to bracket slot |
| scorerRole | 'player' \| 'spectator'? | Who scored this match |
| scorerTeam | 1 \| 2? | Which team the scorer is on |
| ownerUid | string? | Firebase user ID |

Indexes: `id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId`

### players

| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key |
| name | string | Display name |
| createdAt | Date | |
| updatedAt | Date | |

Indexes: `id, name, createdAt`

### scoreEvents

| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key |
| matchId | string | Foreign key to matches |
| gameNumber | number | Which game in the match |
| timestamp | Date | When the event occurred |
| type | string | Event type (score, sideout, etc.) |
| team | 1 \| 2 | Which team |

Indexes: `id, matchId, gameNumber, timestamp`

### tournaments

| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key |
| organizerId | string | Creator's user ID |
| status | string | Tournament status |
| date | Date | Tournament date |

Indexes: `id, organizerId, status, date`

### syncQueue

| Field | Type | Description |
|-------|------|-------------|
| id | string | Deterministic: `${type}:${entityId}` |
| status | string | `pending \| processing \| completed \| failed \| awaitingAuth` |
| nextRetryAt | number | Timestamp for next retry |
| createdAt | Date | |
| retryCount | number | Current retry attempt |
| type | string | `match \| tournament \| playerStats` |
| entityId | string | ID of the entity to sync |
| dependsOn | string[]? | Job IDs that must complete first |

Indexes: `id, [status+nextRetryAt], createdAt`

The compound index `[status+nextRetryAt]` enables efficient polling: query for `status='pending' AND nextRetryAt <= now`.

### achievements

| Field | Type | Description |
|-------|------|-------------|
| achievementId | string | Primary key |

Indexes: `achievementId`

## Firestore Collections (Cloud)

### Top-Level Collections

| Collection | Repository | Key Fields |
|------------|-----------|------------|
| `matches` | `firestoreMatchRepository` | ownerId, sharedWith[], visibility, config, games, status |
| `tournaments` | `firestoreTournamentRepository` | organizerId, name, date, status, format, config |
| `users` | `firestoreUserRepository` | displayName, email, photoURL, createdAt |
| `playerStats` | `firestorePlayerStatsRepository` | uid, wins, losses, tier, matchesPlayed |
| `leaderboard` | `firestoreLeaderboardRepository` | uid, compositeScore, tier, winRate |
| `gameSessions` | `firestoreGameSessionRepository` | hostUid, status, participants |
| `buddyGroups` | `firestoreBuddyGroupRepository` | name, memberUids, createdBy |
| `buddyNotifications` | `firestoreBuddyNotificationRepository` | targetUid, type, groupId |
| `invitations` | `firestoreInvitationRepository` | tournamentId, inviteeUid, status |
| `scoreEvents` | `firestoreScoreEventRepository` | matchId, gameNumber, type, team |

### Tournament Subcollections

Under `tournaments/{tournamentId}/`:

| Subcollection | Repository | Purpose |
|---------------|-----------|---------|
| `pools` | `firestorePoolRepository` | Round-robin pool play |
| `brackets` | `firestoreBracketRepository` | Elimination brackets |
| `teams` | `firestoreTeamRepository` | Tournament team registrations |
| `registrations` | `firestoreRegistrationRepository` | Player signups |

### User Subcollections

Under `users/{userId}/`:

| Subcollection | Purpose |
|---------------|---------|
| `notifications` | In-app notification feed |
| `public/tier` | Publicly readable tier document (for opponent lookups) |

## Sync Queue Mechanics

### Job Types

| Type | Deterministic ID | Timeout | Use Case |
|------|-----------------|---------|----------|
| `match` | `match:${matchId}` | 15s | Single `setDoc` to Firestore |
| `tournament` | `tournament:${tournamentId}` | 15s | Tournament save |
| `playerStats` | `playerStats:${playerId}` | 45s | 12-15 Firestore round-trips |

### Error Classification

| Category | Firestore Codes | Action |
|----------|----------------|--------|
| **retryable** | unavailable, deadline-exceeded, internal, cancelled, aborted | Exponential backoff |
| **rate-limited** | resource-exhausted | Long backoff (60s base, 10min cap, no retry limit) |
| **auth-dependent** | unauthenticated, permission-denied (stale token) | Pause until re-auth |
| **fatal** | invalid-argument, not-found (match/tournament), failed-precondition | Mark failed, don't retry |
| **staleJob** | not-found (playerStats only) | Silently remove job |

### Retry Policy

| Job Type | Base Delay | Multiplier | Max Delay | Max Retries |
|----------|-----------|-----------|----------|------------|
| match | 3s | 2x | 5min | 7 |
| tournament | 3s | 2x | 5min | 7 |
| playerStats | 15s | 3x | 30min | 5 |
| rate-limit | 60s | 2x | 10min | unlimited |

**Backoff formula**: `delay = min(base × multiplier^retryCount, maxDelay) × jitter(0.8–1.2)`

### Lifecycle Features

- **Deterministic upsert**: Same `type:entityId` always maps to one job; re-enqueueing updates it
- **Dependency cascade**: If a dependency fails, dependent jobs auto-fail
- **Stale reclamation**: Jobs stuck in `processing` > 10 minutes are reset to `pending`
- **TTL pruning**: Completed jobs deleted after 24h, failed jobs after 30 days

## Security Rules

Source: `firestore.rules`

### Access Patterns

| Collection | Read | Write | Delete |
|------------|------|-------|--------|
| `matches` | Owner + `sharedWith[]` | Owner only | Owner only |
| `tournaments` | Organizer + participants | Organizer only | Organizer only |
| `users` | Own document only | Own document only | - |
| `playerStats` | Any authenticated | Own stats only | - |
| `leaderboard` | Any authenticated | Any authenticated (cross-user tournament writes) | - |

Tournament subcollections follow hierarchical ownership — the tournament organizer controls pools, brackets, teams, and registrations.

### Key Validation Rules

- `ownerId` / `organizerId` are immutable after creation
- `createdAt` is immutable after creation
- Match `config` fields are validated (valid `gameType`, `scoringMode`, `matchFormat`, `pointsToWin`)
- Leaderboard entries validate field types and enforce `createdAt` immutability

## Related Docs

- [Architecture](architecture.md) — System overview and sync flow
- [Debugging](debugging.md) — How to inspect Dexie tables and sync queue at runtime
- [Testing Guide](testing-guide.md) — How to test security rules
```

**Step 2: Commit**

```bash
git add docs/data-model.md
git commit -m "Add data model documentation"
```

---

### Task 8: docs/testing-guide.md

**Files:**
- Create: `docs/testing-guide.md`

**Step 1: Create docs/testing-guide.md**

```markdown
# Testing Guide

PickleScore has ~1160 tests across three test runners.

## Test Runners Overview

| Runner | Config | Purpose | Count |
|--------|--------|---------|-------|
| **Vitest** | `vitest.config.ts` (via vite.config) | Unit + component tests | ~110 files |
| **Playwright** | `playwright.config.ts` | End-to-end browser tests | ~38 suites |
| **Vitest (rules)** | `vitest.rules.config.ts` | Firestore security rules | ~60 tests |

## Running Tests

### Unit & Component Tests

```bash
# Run all unit/component tests
npx vitest run

# Run in watch mode
npx vitest

# Run a specific test file
npx vitest run src/features/scoring/engine/__tests__/pickleballMachine.test.ts

# Run tests matching a pattern
npx vitest run -t "win-by-2"
```

Config: jsdom environment, `src/test-setup.ts` for globals. Excludes `e2e/`, `test/rules/`, `.worktrees/`.

### E2E Tests (Playwright)

```bash
# Run all E2E tests (auto-starts emulators + dev server)
npm run test:e2e

# Run in headed mode (see the browser)
npm run test:e2e:headed

# Run buddy-specific E2E tests
npm run test:e2e:buddies

# Run a specific test file
npx playwright test e2e/scoring.spec.ts
```

Playwright auto-starts:
- Firebase emulators (Auth on 9099, Firestore on 8180)
- Vite dev server on port 5199

Test device: Pixel 5 emulation.

### Firestore Security Rules Tests

```bash
# Run rules tests (starts emulator, runs tests, stops emulator)
npm run test:rules
```

This uses `firebase emulators:exec` to start the Firestore emulator, run the tests, and stop. Config: Node.js environment (not jsdom), 30s timeout, no file parallelism.

Test location: `test/rules/**/*.test.ts`

## Writing Tests

### File Placement

Tests go next to the code they test:

```
src/features/scoring/engine/pickleballMachine.ts
src/features/scoring/engine/__tests__/pickleballMachine.test.ts

src/shared/hooks/useAuth.ts
src/shared/hooks/__tests__/useAuth.test.ts
```

Security rules tests are separate:

```
firestore.rules
test/rules/*.test.ts
```

### SolidJS Testing Patterns

**Rendering components** (use `@solidjs/testing-library`):

```typescript
import { render, screen } from '@solidjs/testing-library';

test('shows score', () => {
  render(() => <Scoreboard score={5} />);
  expect(screen.getByText('5')).toBeInTheDocument();
});
```

**Important SolidJS gotchas:**
- Props are not destructured in components, so pass them as object properties
- Use `render(() => <Component />)` (note the arrow function wrapper)
- SolidJS signals only update inside reactive contexts — `createRoot` may be needed in some tests
- Use `import type` for type imports (enforced by `verbatimModuleSyntax`)

### E2E Auth in Playwright

Firebase auth in E2E tests uses the app's own Firebase config, not a separate auth instance:

```typescript
// Import from the Vite-resolved Firebase path
import { signInWithEmailAndPassword } from '/node_modules/firebase/auth/dist/esm/index.esm.js';
```

SolidJS input reactivity in Playwright requires using the property descriptor pattern:

```typescript
// Standard fill doesn't trigger SolidJS reactivity
// Use this instead:
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
setter.call(input, 'new value');
input.dispatchEvent(new Event('input', { bubbles: true }));
```

### Dexie (IndexedDB) in Tests

Unit tests use `fake-indexeddb` (see `src/test-setup.ts`). No real browser IndexedDB needed.

## Type Checking

```bash
npx tsc --noEmit
```

Run this before committing. TypeScript is strict with `verbatimModuleSyntax: true`.

## Related Docs

- [Setup](setup.md) — Installing prerequisites (Firebase CLI, Java, Playwright browsers)
- [Architecture](architecture.md) — Understanding what you're testing
- [Data Model](data-model.md) — Schema reference for rules tests
- [Contributing](../CONTRIBUTING.md) — TDD workflow and commit conventions
```

**Step 2: Commit**

```bash
git add docs/testing-guide.md
git commit -m "Add testing guide"
```

---

### Task 9: docs/features.md

**Files:**
- Create: `docs/features.md`

**Step 1: Create docs/features.md**

```markdown
# Feature Modules

> This doc describes what each feature IS (structure, key files, how it works). For feature status and priorities, see [ROADMAP.md](../ROADMAP.md).

## Module Index

| Module | Path | Purpose |
|--------|------|---------|
| [scoring](#scoring) | `src/features/scoring/` | Core match scoring (XState engine) |
| [tournaments](#tournaments) | `src/features/tournaments/` | Tournament creation, pools, brackets |
| [players](#players) | `src/features/players/` | Local player management |
| [buddies](#buddies) | `src/features/buddies/` | Casual play groups and game sessions |
| [history](#history) | `src/features/history/` | Match history browsing |
| [leaderboard](#leaderboard) | `src/features/leaderboard/` | Global + friends rankings |
| [notifications](#notifications) | `src/features/notifications/` | In-app notification center |
| [achievements](#achievements) | `src/features/achievements/` | Badge/achievement system |
| [profile](#profile) | `src/features/profile/` | User profile with stats dashboard |
| [settings](#settings) | `src/features/settings/` | App preferences |
| [landing](#landing) | `src/features/landing/` | Public marketing page |

## Inter-Feature Dependencies

```
scoring ◀── tournaments (uses scoring engine for match play)
scoring ◀── buddies (casual scoring with buddy picker)
scoring ──▶ achievements (triggers badge evaluation after match)
scoring ──▶ leaderboard (updates leaderboard entry after match)
scoring ──▶ profile (updates player stats after match)
buddies ──▶ notifications (sends buddy invites/RSVP notifications)
tournaments ──▶ notifications (sends tournament updates)
achievements ──▶ notifications (sends achievement unlocked)
```

## Feature Anatomy

Most features follow this pattern (not every feature has every subdirectory):

```
src/features/{feature}/
├── components/     ← UI components (SolidJS)
├── engine/         ← Pure logic (no framework deps, easy to test)
├── hooks/          ← SolidJS hooks (data fetching, reactive state)
├── helpers/        ← Utility functions
├── repository/     ← Feature-specific data access
├── store/          ← Module-level stores (SolidJS signals)
└── {Feature}Page.tsx  ← Page entry point (routed via @solidjs/router)
```

---

## scoring

**Path**: `src/features/scoring/`

The core of the app. Manages match flow from setup to completion.

**Key files:**
- `engine/pickleballMachine.ts` — XState v5 state machine (game flow, sideout/rally, win-by-2, best-of-N)
- `engine/types.ts` — `ScoringContext`, `ScoringEvent` types
- `GameSetupPage.tsx` — Match configuration (game type, format, teams, buddy picker)
- `ScoringPage.tsx` — Live scoring UI with team indicators
- `components/` — ScoreControls, Scoreboard
- `hooks/useScoreAnimation.ts` — Score change animations

**State**: XState machine (the only feature using XState).

## tournaments

**Path**: `src/features/tournaments/`

Full tournament lifecycle: create, configure pools/brackets, run matches, track standings.

**Key files:**
- `engine/poolGenerator.ts` — Round-robin pool generation
- `engine/bracketGenerator.ts` — Single/double elimination brackets
- `engine/standings.ts` — `calculateStandings()` from completed matches
- `engine/rescoring.ts` — Safe re-scoring with bracket safety checks
- `engine/bracketSeeding.ts` — Pool-to-bracket advancement
- `components/BracketView.tsx`, `PoolTable.tsx`, `LiveScoreCard.tsx`
- `TournamentCreatePage.tsx`, `TournamentDetailPage.tsx`, `DiscoverPage.tsx`

**Data**: Firestore subcollections under `tournaments/{id}/` (pools, brackets, teams, registrations).

## players

**Path**: `src/features/players/`

Local player management (name, creation).

**Key files:**
- `PlayersPage.tsx` — Player list with tabs (Players | Leaderboard)
- `components/AddPlayerForm.tsx`, `PlayerCard.tsx`

**Data**: Dexie `players` table.

## buddies

**Path**: `src/features/buddies/`

Casual play: create buddy groups, start game sessions, invite friends, RSVP.

**Key files:**
- `engine/groupHelpers.ts`, `sessionHelpers.ts`, `notificationHelpers.ts`
- `hooks/useGameSession.ts`, `useBuddyGroups.ts`
- `BuddiesPage.tsx`, `CreateGroupPage.tsx`, `GroupDetailPage.tsx`, `OpenPlayPage.tsx`

**Data**: Firestore `buddyGroups`, `gameSessions`, `buddyNotifications` collections.

## history

**Path**: `src/features/history/`

Browse completed matches with score cards.

**Key files:**
- `HistoryPage.tsx` — Match list
- `components/MatchCard.tsx` — Individual match display

**Data**: Dexie `matches` table (filtered by status).

## leaderboard

**Path**: `src/features/leaderboard/`

Global and friends-scoped leaderboards with composite scoring.

**Key files:**
- `components/` — Podium (top 3), RankingsList (4-25), UserRankCard
- `hooks/useLeaderboard.ts` — 5-minute cache + in-flight dedup

**Scoring**: 40% tier + 35% winRate + 25% activity (computed in `src/shared/utils/leaderboardScoring.ts`).

**Data**: Firestore `leaderboard` collection with atomic writes.

## notifications

**Path**: `src/features/notifications/`

Unified in-app notification center (12 notification types).

**Key files:**
- `store/` — Module-level store using SolidJS signals + Firestore `onSnapshot`
- `components/NotificationRow.tsx`, `NotificationPanel.tsx`
- `engine/` — Notification type definitions, helper factories

**Data**: Firestore `users/{uid}/notifications/{id}` subcollection. Client-side only (no FCM).

## achievements

**Path**: `src/features/achievements/`

Badge system with tier-based progression.

**Key files:**
- `engine/badgeEngine.ts` — Badge evaluation logic
- `engine/badgeDefinitions.ts` — Badge catalog
- `engine/achievementHelpers.ts` — Unlock checks
- `store/` — Toast queue for achievement popups
- `repository/` — Local achievement cache (Dexie)

**Data**: Dexie `achievements` table + Firestore cache.

## profile

**Path**: `src/features/profile/`

User profile page with stats dashboard and match history.

**Key files:**
- `ProfilePage.tsx` — Auth-gated profile at `/profile`
- `hooks/` — Stats aggregation

**Data**: Firestore `playerStats`, `users/{uid}/public/tier`.

## settings

**Path**: `src/features/settings/`

App preferences (scoring defaults, display, sound, haptics, voice, notifications).

**Key files:**
- `SettingsPage.tsx` — Settings UI
- `components/` — Setting toggles and selectors

**State**: `src/stores/settingsStore.ts` (DEFAULTS + localStorage merge pattern).

## landing

**Path**: `src/features/landing/`

Public marketing page with animations and scroll effects.

**Key files:**
- `LandingPage.tsx` — Marketing content
- `animations/` — heroAnimations, scrollAnimations, initLenis (smooth scroll), cursorEffects

**Dependencies**: GSAP, Lenis, canvas-confetti, open-simplex-noise.

## Related Docs

- [Architecture](architecture.md) — System-level view of how features interconnect
- [Data Model](data-model.md) — Schema for each feature's data
- [Testing Guide](testing-guide.md) — Where to find and how to write tests for each feature
```

**Step 2: Commit**

```bash
git add docs/features.md
git commit -m "Add feature modules documentation"
```

---

### Task 10: docs/debugging.md

**Files:**
- Create: `docs/debugging.md`

**Step 1: Create docs/debugging.md**

```markdown
# Debugging Guide

## Inspecting Local Data (Dexie / IndexedDB)

Open browser DevTools → **Application** tab → **IndexedDB** → **PickleScoreDB**.

You'll see tables: `matches`, `players`, `scoreEvents`, `tournaments`, `syncQueue`, `achievements`.

**Useful queries in the browser console:**

```javascript
// Import the db instance
const { db } = await import('/src/data/db.ts');

// List all matches
await db.matches.toArray();

// Find a specific match
await db.matches.get('match-id');

// Check sync queue status
await db.syncQueue.toArray();

// Count pending sync jobs
await db.syncQueue.where('status').equals('pending').count();
```

### Clearing Local Data for a Fresh Start

```javascript
// Clear all IndexedDB data
indexedDB.deleteDatabase('PickleScoreDB');
```

Then reload the page. Dexie will recreate the tables from the schema.

To also clear the service worker cache:
1. DevTools → Application → Service Workers → Unregister
2. DevTools → Application → Cache Storage → Delete all
3. Hard refresh (Ctrl+Shift+R)

## Inspecting Sync Queue

The sync queue is the most common source of data sync issues.

### Diagnosing a Stuck Queue

```javascript
const { db } = await import('/src/data/db.ts');

// See all jobs and their status
const jobs = await db.syncQueue.toArray();
console.table(jobs.map(j => ({
  id: j.id,
  status: j.status,
  retryCount: j.retryCount,
  nextRetryAt: new Date(j.nextRetryAt).toLocaleString(),
  error: j.lastError,
})));
```

**Common stuck states:**

| Status | Meaning | Fix |
|--------|---------|-----|
| `awaitingAuth` | User signed out or token expired | Sign back in |
| `failed` | Max retries exceeded | Check `lastError`, fix root cause, delete job to retry |
| `processing` (>10 min) | Processor crashed | Will auto-reclaim after 10 min |

### Manually Retrying a Failed Job

```javascript
// Reset a failed job to pending
await db.syncQueue.update('match:some-id', {
  status: 'pending',
  retryCount: 0,
  nextRetryAt: Date.now(),
});
```

### Clearing the Sync Queue

```javascript
// Nuclear option: clear all sync jobs
await db.syncQueue.clear();
```

## Inspecting XState (Scoring Machine)

The scoring state machine doesn't have built-in DevTools integration. To inspect state during a match:

1. Open the ScoringPage
2. In the console, access the machine snapshot through SolidJS component state
3. The machine context contains: `team1Score`, `team2Score`, `servingTeam`, `serverNumber`, `gameNumber`, `gamesWon`

**Common scoring issues:**

| Symptom | Likely Cause |
|---------|-------------|
| Score won't increment | Sideout mode: wrong team serving (only serving team scores) |
| Game won't end | Win-by-2: teams trading points near `pointsToWin` |
| Match ends early | `matchFormat` set to 'single' instead of 'best-of-3' |

## Firebase Emulator UI

Available at **http://localhost:4000** when emulators are running.

### Firestore Emulator (port 8180)

- Browse collections and documents
- Edit data directly
- View real-time listener subscriptions
- Clear all data between test runs

### Auth Emulator (port 9099)

- View created accounts
- Generate sign-in tokens
- Clear all auth state

## Service Worker Issues

### Stale Content After Deploy

Symptoms: UI shows old version after deploying new code.

Fix:
1. DevTools → Application → Service Workers
2. Click "Update" or check "Update on reload"
3. Hard refresh (Ctrl+Shift+R)

### Disabling Service Worker for Development

The service worker is generated by `vite-plugin-pwa`. In development (`npm run dev`), the service worker is typically not active. If it is:

1. DevTools → Application → Service Workers → Unregister
2. Or add `?__WB_DISABLE_DEV_LOGS` to the URL

## Common Issues

### "Firebase not initialized" error
- Emulators not running: `npm run emulator:start`
- Wrong ports: check `firebase.json` matches `src/data/firebase/config.ts`

### Match data not syncing
1. Check if signed in (Settings page shows account)
2. Check sync queue for stuck jobs (see above)
3. Check browser console for Firestore errors

### Tests pass locally but fail in CI
- Ensure Firebase emulators start before tests
- Check for port conflicts (8180, 9099)
- E2E: ensure Playwright browsers are installed (`npx playwright install`)

### SolidJS reactivity not updating
- Did you destructure props? (Don't — use `props.foo`)
- Is the signal being read outside a reactive context?
- Is `import type` used for type-only imports?

## Related Docs

- [Architecture](architecture.md) — Understanding the system you're debugging
- [Data Model](data-model.md) — Schema reference for sync queue and Firestore
- [Testing Guide](testing-guide.md) — Running tests to verify fixes
- [Setup](setup.md) — Environment configuration
```

**Step 2: Commit**

```bash
git add docs/debugging.md
git commit -m "Add debugging guide"
```

---

### Task 11: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Create CONTRIBUTING.md**

```markdown
# Contributing to PickleScore

## Development Workflow

PickleScore follows a disciplined development workflow enforced by the Superpowers plugin. Every change — feature, bugfix, or refactor — follows these steps:

1. **Brainstorm** — Explore the design before writing code
2. **Plan** — Break work into bite-sized tasks with full code examples
3. **Implement with TDD** — Failing test first, then minimal implementation
4. **Verify** — Run tests, check output, then claim done

No exceptions. Simple changes get simple brainstorms and short plans, but every change goes through the process.

## Code Conventions

### SolidJS Rules (Critical)

These rules are enforced project-wide. Breaking them causes silent bugs that TypeScript won't catch.

**Never destructure props:**
```typescript
// WRONG — destroys reactivity
function Score({ score, player }: Props) {
  return <div>{score}</div>;
}

// CORRECT — preserves reactivity
function Score(props: Props) {
  return <div>{props.score}</div>;
}
```

**Use `class`, not `className`:**
```typescript
// WRONG
<div className="text-lg">

// CORRECT
<div class="text-lg">
```

**Use `import type` for type-only imports:**
```typescript
// WRONG — will cause build errors (verbatimModuleSyntax)
import { Match } from '../data/types';

// CORRECT
import type { Match } from '../data/types';
```

**SolidJS control flow:**
```typescript
// Use Show, For, Switch/Match — not ternaries or .map()
<Show when={props.isVisible}>
  <For each={props.items}>
    {(item) => <ItemCard item={item} />}
  </For>
</Show>
```

### TypeScript

- Strict mode enabled
- `verbatimModuleSyntax: true` — must use `import type` for types
- Run `npx tsc --noEmit` before committing

### Settings Store

When adding new settings fields, always add to `DEFAULTS` in `src/stores/settingsStore.ts`. Existing users' localStorage won't have the new field — the default bridges the gap.

## Commit Messages

Use conventional style:

```
feat: add buddy picker to game setup
fix: prevent phantom achievement toasts
refactor: extract tier engine to shared utils
test: add leaderboard security rules tests
docs: add architecture documentation
```

## Pull Request Process

1. Create a feature branch from `main`
2. Follow the TDD workflow (failing test → implementation → verify)
3. Ensure all tests pass: `npx vitest run`
4. Ensure types check: `npx tsc --noEmit`
5. Fill out the PR template (tests written, verified, conventions followed)
6. Request review

## Branch Strategy

- `main` — stable, deployable
- `feature/<name>` — feature branches (short-lived)
- Worktrees available via `.worktrees/` for isolated feature work

## Related Docs

- [Setup](docs/setup.md) — Getting your development environment running
- [Testing Guide](docs/testing-guide.md) — How to run and write tests
- [Architecture](docs/architecture.md) — Understanding the system
- [CLAUDE.md](CLAUDE.md) — Canonical reference for commands and conventions
```

**Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "Add contributing guide"
```

---

### Task 12: docs/index.md

**Files:**
- Create: `docs/index.md`

**Step 1: Create docs/index.md**

```markdown
# Documentation Index

Developer documentation for PickleScore.

## Document Guide

| Document | Purpose | Audience |
|----------|---------|----------|
| [README](../README.md) | Project overview, quick start | Everyone |
| [Setup](setup.md) | Prerequisites, env config, troubleshooting | New developers |
| [Architecture](architecture.md) | System design, data flow, state management | Developers understanding the system |
| [Data Model](data-model.md) | Dexie tables, Firestore collections, sync queue schema | Developers touching data or sync |
| [Features](features.md) | Feature module index, dependencies, key files | Developers finding where to work |
| [Testing Guide](testing-guide.md) | Running tests, writing tests, SolidJS gotchas | Developers writing or running tests |
| [Debugging](debugging.md) | Inspecting state, sync queue, common issues | Developers troubleshooting |
| [Contributing](../CONTRIBUTING.md) | Workflow, code conventions, PR process | Contributors |

## Not in docs/

| File | Location | Purpose |
|------|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | Root | Canonical command reference and SolidJS rules (for AI and developers) |
| [ROADMAP.md](../ROADMAP.md) | Root | Feature status and priority tracking |
| [Design plans](plans/) | `docs/plans/` | Historical design documents from brainstorming sessions |
| [Reviews](reviews/) | `docs/reviews/` | Specialist reviews of design decisions |
| [Manual Test Plan](MANUAL_TEST_PLAN.md) | `docs/` | Manual test cases for critical workflows |

## Reading Paths

### New developer (first day)

1. [README](../README.md) — What is this project?
2. [Setup](setup.md) — Get it running locally
3. [Architecture](architecture.md) — Understand the system
4. [Features](features.md) — Find the module you'll work on
5. [Contributing](../CONTRIBUTING.md) — Learn the workflow

### Picking up a task

1. [Features](features.md) — Find the relevant module
2. [Design plans](plans/) — Check if there's a plan for the feature
3. [Testing Guide](testing-guide.md) — Write the failing test first
4. [Contributing](../CONTRIBUTING.md) — Follow the TDD workflow

### Debugging a data issue

1. [Debugging](debugging.md) — Inspect sync queue, IndexedDB, Firestore
2. [Data Model](data-model.md) — Understand the schema
3. [Architecture](architecture.md) — Understand the sync flow

### Reviewing a PR

1. [Contributing](../CONTRIBUTING.md) — PR checklist and conventions
2. [Testing Guide](testing-guide.md) — Verify test coverage
```

**Step 2: Commit**

```bash
git add docs/index.md
git commit -m "Add documentation index with reading paths"
```

---

### Task 13: README.md

**Files:**
- Modify: `README.md` (replace entirely)

**Step 1: Replace README.md**

```markdown
# PickleScore

Offline-first pickleball scoring and tournament management PWA. Score matches courtside (even without internet), run tournaments with pools and brackets, track player stats, and compete on leaderboards.

## Features

- **Match Scoring** — Sideout and rally scoring, singles and doubles, configurable points, win-by-2, best-of-N
- **Tournaments** — Create tournaments with round-robin pools, single/double elimination brackets, live scoring
- **Buddy Groups** — Organize casual play sessions, invite friends, track who's playing
- **Leaderboards** — Global and friends rankings with tier-based composite scoring
- **Achievements** — Badge system with progression tiers
- **Player Profiles** — Stats dashboard, match history, tier ratings
- **Offline-First** — Full functionality without internet; syncs to cloud when online
- **PWA** — Installable on any device, works like a native app

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | SolidJS 1.9 + TypeScript 5.9 |
| Build | Vite 7.3 |
| Styling | Tailwind CSS v4 |
| State | XState v5 (scoring engine), SolidJS signals (everything else) |
| Local DB | Dexie.js (IndexedDB) |
| Cloud | Firebase (Firestore + Auth) |
| Testing | Vitest, Playwright, Firebase Rules Testing |
| PWA | vite-plugin-pwa |

## Quick Start

```bash
git clone https://github.com/santoshchem51/scoring-app.git
cd scoring-app
npm install
cp .env.example .env.local   # Add your Firebase credentials (optional for local dev)
npm run dev                   # Starts on http://localhost:5173
```

For full setup including Firebase emulators, see [docs/setup.md](docs/setup.md).

## Development Commands

| Command | Purpose |
|---------|---------|
| `npx vite --port 5199` | Dev server |
| `npx vitest run` | Unit & component tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:rules` | Firestore security rules tests |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Production build |
| `npm run emulator:start` | Firebase emulators |

## Project Structure

```
src/
├── features/          11 feature modules (scoring, tournaments, buddies, ...)
├── data/              Dexie DB, Firebase repos, sync queue, types
├── shared/            Reusable components, hooks, utils
├── stores/            App-level stores (settings, achievements, notifications)
└── app/               Root App component
```

## Documentation

Start here based on what you need:

| I want to... | Read |
|--------------|------|
| Set up my dev environment | [Setup Guide](docs/setup.md) |
| Understand the architecture | [Architecture](docs/architecture.md) |
| Find a feature's code | [Feature Modules](docs/features.md) |
| Run or write tests | [Testing Guide](docs/testing-guide.md) |
| Debug a data/sync issue | [Debugging Guide](docs/debugging.md) |
| Contribute code | [Contributing](CONTRIBUTING.md) |
| See all docs | [Documentation Index](docs/index.md) |

## License

[MIT](LICENSE)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "Replace generic README with project documentation"
```

---

## Summary

| Task | File(s) | Type |
|------|---------|------|
| 1 | `LICENSE` | Create |
| 2 | `CODE_OF_CONDUCT.md` | Create |
| 3 | `SECURITY.md` | Create |
| 4 | `.github/` (4 files) | Create |
| 5 | `docs/setup.md` | Create |
| 6 | `docs/architecture.md` | Create |
| 7 | `docs/data-model.md` | Create |
| 8 | `docs/testing-guide.md` | Create |
| 9 | `docs/features.md` | Create |
| 10 | `docs/debugging.md` | Create |
| 11 | `CONTRIBUTING.md` | Create |
| 12 | `docs/index.md` | Create |
| 13 | `README.md` | Replace |

13 tasks, each with exact content and a commit step. No code changes, no tests needed.
