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

**Backoff formula**: `delay = min(base * multiplier^retryCount, maxDelay) * jitter(0.8-1.2)`

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
