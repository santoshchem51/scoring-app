# Layer 10: Admin & Moderation — Design

**Date:** 2026-03-09
**Status:** Approved

---

## Scope

Four features for empowering tournament organizers running larger events:

1. **Tiered Role System** — Owner > Admin > Moderator > Scorekeeper
2. **Dispute Resolution** — Flag, review, and resolve contested match results
3. **Quick Add Players + CSV Export** — Pre-populate rosters, export registrations
4. **Tournament Templates** — Save and reuse tournament settings

**Deferred:** Fee collection (Stripe/Venmo), email-based invitations, CSV import.

---

## 1. Tiered Role System

### Data Model

```typescript
type TournamentRole = 'admin' | 'moderator' | 'scorekeeper';

interface Tournament {
  // ... existing fields ...
  organizerId: string;        // Owner tier — immutable except for ownership transfer
  staff: Record<string, TournamentRole>;  // { uid: role }
  staffUids: string[];        // denormalized for array-contains queries
  // REMOVED: scorekeeperIds  // migrated into staff map
}
```

### Role Hierarchy

```
Owner (organizerId)     — level 4
  └─ Admin              — level 3
       └─ Moderator     — level 2
            └─ Scorekeeper — level 1
```

- Owner is always `organizerId` — never stored in the `staff` map
- Admins can only be promoted by the Owner
- No self-promotion allowed
- `staffUids` always kept in sync with `Object.keys(staff)` atomically

### Permission Matrix

| Action                          | Owner | Admin | Mod | SK |
|---------------------------------|:-----:|:-----:|:---:|:--:|
| Delete tournament               |   x   |       |     |    |
| Transfer ownership              |   x   |       |     |    |
| Remove admins                   |   x   |       |     |    |
| Edit settings                   |   x   |   x   |     |    |
| Pause/Cancel/End                |   x   |   x   |     |    |
| Add/remove mod+SK               |   x   |   x   |     |    |
| Quick Add / CSV export          |   x   |   x   |     |    |
| Save templates                  |   x   |   x   |     |    |
| Approve/decline registrations   |   x   |   x   |  x  |    |
| Withdraw players                |   x   |   x   |  x  |    |
| Flag/resolve disputes           |   x   |   x   |  x  |    |
| Edit match results              |   x   |   x   |  x  |    |
| Score assigned matches          |   x   |   x   |  x  | x  |
| View dashboard                  |   x   |   x   |  x  | x  |

### Client-Side Helpers

```typescript
function getTournamentRole(tournament: Tournament, uid: string): TournamentRole | 'owner' | null {
  if (tournament.organizerId === uid) return 'owner';
  return tournament.staff[uid] ?? null;
}

function hasMinRole(tournament: Tournament, uid: string, minimum: TournamentRole | 'owner'): boolean {
  const levels: Record<string, number> = { scorekeeper: 1, moderator: 2, admin: 3, owner: 4 };
  const role = getTournamentRole(tournament, uid);
  if (!role) return false;
  return levels[role] >= levels[minimum];
}
```

### Architecture Decision

**Approach A (Role Map on Tournament Document)** was selected over subcollection and custom claims approaches after specialist reviews from Firestore modeling, security, and codebase integration perspectives.

Key reasoning:
- Zero extra Firestore reads for permission checks (staff data rides along with tournament doc)
- `array-contains` query on `staffUids` enables "my tournaments as staff" queries
- 8-12 files changed (vs 15-20 for subcollection approach)
- No Dexie schema migration needed (existing `cachedTournaments` table handles the new field)
- No Cloud Functions infrastructure required
- Full atomicity on staff changes (single document write)
- No staleness window (unlike custom claims' 60-min token refresh delay)

### Staff Management UI

New "Staff" tab on tournament dashboard (owner/admin only):
- List current staff with role badges
- "Add Staff" button: search users by name/email (reuses existing user search), pick role
- Remove/change role via action menu on each staff row
- Owner transfer button (owner only, transfers to an existing admin)

---

## 2. Dispute Resolution

### Data Model

```typescript
type DisputeStatus = 'open' | 'resolved-edited' | 'resolved-dismissed';

interface MatchDispute {
  id: string;
  matchId: string;
  tournamentId: string;
  flaggedBy: string;          // uid of person who flagged
  flaggedByName: string;      // display name snapshot
  reason: string;             // required text explaining the dispute
  status: DisputeStatus;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolution: string | null;  // explanation of resolution
  createdAt: number;          // serverTimestamp()
  resolvedAt: number | null;
}
```

**Collection:** `tournaments/{id}/disputes/{disputeId}`

### Match Document Change

```typescript
// Added to match-level data
disputed?: boolean;  // true when an open dispute exists
```

### Dispute Flow

1. **Flag:** Any match participant OR moderator+ flags a completed match as disputed. Creates a `MatchDispute` doc + sets `disputed: true` on the match. Warning badge appears on match card.

2. **Review:** Moderator+ opens the dispute panel, sees original scores, who flagged, and reason. Can:
   - Edit scores via existing `ScoreEditModal` (creates audit log entry)
   - Dismiss the dispute (no score change)

3. **Resolve:** Status becomes `resolved-edited` or `resolved-dismissed`. `disputed` flag on match cleared. Notification sent to flagged-by user and match participants.

### UI Changes

- **Match card:** Warning badge when `disputed === true`
- **Dispute button:** On match detail (visible to participants + moderator+)
- **Dispute panel:** In tournament dashboard — list of open disputes for moderator+
- **Dispute count badge:** On dashboard nav for moderator+

---

## 3. Quick Add Players + CSV Export

### Quick Add Placeholder Players

**UI:** "Quick Add" button in tournament dashboard player list (Admin+ only). Opens a text area for typing/pasting names, one per line.

**Data:** Each name creates a `TournamentRegistration` with:

```typescript
{
  id: string,
  tournamentId: string,
  userId: null,                  // no auth account
  playerName: 'John Smith',
  status: 'placeholder',        // new RegistrationStatus value
  claimedBy: null,              // filled when a real user claims this spot
  source: 'quick-add',
  registeredAt: number,
  // all other fields null/default
}
```

### Claiming a Placeholder Spot

When a player joins a tournament with placeholder entries:
1. After registration, prompt: "Are you one of these players?" with unclaimed placeholder names
2. Player taps their name → placeholder linked to their account (`claimedBy: uid`, `userId: uid`)
3. Alternatively, organizer manually links from player management panel

### CSV Export

"Export CSV" button in tournament dashboard player list (Admin+ only).

Columns: `Name, Email, Skill Rating, Status, Team, Payment Status, Registered At`

Client-side CSV generation using `Blob` + download link. CSV injection prevention: prefix values starting with `=`, `+`, `-`, `@` with a single quote.

### Validation

- Names: 1-100 characters, trimmed, no empty lines
- Duplicate detection within batch (warn, don't block)
- Max 100 names per batch
- Duplicate detection against existing registrations (warn by name match)

### Design Decision

CSV import with email invitations was considered and rejected after specialist reviews. Key reasons:
- Casual pickleball organizers don't typically have spreadsheets
- Email is the wrong channel (organizers use group texts/WhatsApp)
- Firebase email extension requires Blaze plan upgrade (billing risk)
- Existing share codes + in-app invitations cover 80% of the need
- Quick Add solves the real pain point: pre-populate roster before everyone signs up

---

## 4. Tournament Templates

### Data Model

```typescript
interface TournamentTemplate {
  id: string;
  name: string;                          // "Weekly Doubles Night"
  description?: string;
  // Snapshot of tournament settings:
  format: TournamentFormat;
  gameType: GameType;
  config: TournamentConfig;
  teamFormation: TeamFormation | null;
  maxPlayers: number | null;
  accessMode: TournamentAccessMode;
  rules: TournamentRules;
  defaultTier: TierName;
  // Meta
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}
```

**Collection:** `users/{uid}/templates/{id}` — private to the user, syncs across devices.

### Security Rules

```javascript
match /users/{userId}/templates/{templateId} {
  allow read, write: if request.auth.uid == userId;
}
```

### UI: Saving a Template

"Save as Template" button on tournament dashboard (Admin+ only):
1. Dialog with template name + optional description
2. Snapshots current tournament settings (format, config, rules, etc.)
3. Saves to `users/{uid}/templates/{id}`

Does NOT save: tournament name, date, location, registrations, share code.

### UI: Creating from Template

"From Template" dropdown on tournament creation page:
1. Lists user's templates (sorted by usage count, then name)
2. Selecting a template pre-fills all form fields
3. User edits name, date, location as needed
4. Template `usageCount` incremented on creation

### Limits

- Max 20 templates per user (client-side enforced)
- Template names: 1-50 characters, unique per user

---

## 5. Audit Log

### Data Model

```typescript
type AuditAction =
  | 'score_edit'
  | 'dispute_flag'
  | 'dispute_resolve'
  | 'role_change'
  | 'player_withdraw'
  | 'registration_approve'
  | 'registration_decline'
  | 'settings_change'
  | 'status_change'
  | 'player_quick_add'
  | 'player_claim';

// Discriminated union for type-safe details
type AuditDetails =
  | { action: 'score_edit'; matchId: string; oldScores: number[][]; newScores: number[][]; oldWinner: number | null; newWinner: number | null }
  | { action: 'dispute_flag'; matchId: string; reason: string }
  | { action: 'dispute_resolve'; matchId: string; disputeId: string; resolution: string; type: 'edited' | 'dismissed' }
  | { action: 'role_change'; targetUid: string; targetName: string; oldRole: TournamentRole | null; newRole: TournamentRole | null }
  | { action: 'player_withdraw'; registrationId: string; playerName: string; reason?: string }
  | { action: 'registration_approve'; registrationId: string; playerName: string }
  | { action: 'registration_decline'; registrationId: string; playerName: string; reason?: string }
  | { action: 'settings_change'; changedFields: string[] }
  | { action: 'status_change'; oldStatus: TournamentStatus; newStatus: TournamentStatus; reason?: string }
  | { action: 'player_quick_add'; count: number; names: string[] }
  | { action: 'player_claim'; registrationId: string; placeholderName: string; claimedByUid: string };

interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;                       // who did it (enforced == request.auth.uid)
  actorName: string;                     // display name snapshot
  actorRole: TournamentRole | 'owner';   // their role at the time
  targetType: 'match' | 'registration' | 'tournament' | 'staff';
  targetId: string;
  details: AuditDetails;                 // typed per action
  timestamp: number;                     // serverTimestamp() enforced by rules
}
```

**Collection:** `tournaments/{id}/auditLog/{logId}`

### Security Rules

```javascript
match /tournaments/{tournamentId}/auditLog/{logId} {
  allow create: if request.auth != null
    && request.resource.data.actorId == request.auth.uid
    && request.resource.data.timestamp == request.time
    && request.resource.data.keys().hasAll([
         'action', 'actorId', 'actorName', 'actorRole',
         'targetType', 'targetId', 'details', 'timestamp'
       ]);
  allow read: if /* staff check via parent tournament get() */;
  allow update, delete: if false;
}
```

### Write Pattern

Audit entries written in the same `writeBatch` as the action they record:

```typescript
const batch = writeBatch(db);
batch.update(matchRef, { scores: newScores });
batch.set(auditLogRef, {
  action: 'score_edit',
  actorId: uid,
  actorName: displayName,
  actorRole: role,
  targetType: 'match',
  targetId: matchId,
  details: { action: 'score_edit', matchId, oldScores, newScores, oldWinner, newWinner },
  timestamp: serverTimestamp(),
});
await batch.commit();
```

### Query Strategy

Fetch all entries with `orderBy('timestamp', 'desc')`, filter client-side. No composite index needed (~100 docs per tournament max).

### UI

"Activity Log" tab/section in tournament dashboard (visible to all staff). Chronological list with actor name, action description, timestamp. Filterable by action type (client-side).

### Retention

Keep forever. ~40KB per tournament — negligible storage cost.

### Acknowledged Limitation

A malicious client could skip the audit entry write. Closing this gap requires Cloud Functions (`onWrite` triggers), which requires the Blaze plan. Accepted as proportionate for a pickleball tournament app.

---

## 6. Security Rules & Migration

### Firestore Rules Approach

**New helper functions:**
```javascript
function roleLevel(role) {
  return role == 'admin' ? 3 : role == 'moderator' ? 2 : role == 'scorekeeper' ? 1 : 0;
}

function callerRole(tournamentData) {
  return request.auth.uid == tournamentData.organizerId ? 'owner'
       : (request.auth.uid in tournamentData.staff) ? tournamentData.staff[request.auth.uid]
       : 'none';
}

function hasMinRole(tournamentData, minimum) {
  // Returns true if caller's role level >= minimum's level
}
```

**Tournament document rules:**
- Create: `organizerId == request.auth.uid`, empty `staff` and `staffUids`
- Update settings: requires `admin+`
- Update status (pause/cancel): requires `admin+`
- Update staff map: requires `admin+`, no `'owner'` value allowed, admin promotion only by owner, no self-promotion
- Delete: `owner` only
- `organizerId` immutable except for ownership transfer (owner to existing admin)

**Subcollection rules:**
- One `get()` call per evaluation to load parent tournament doc (Firestore caches within request)
- Registrations: moderator+ approve/decline; player self-withdraw
- Matches: moderator+ create/update; scorekeeper scoring fields only
- Disputes: auth'd participant or moderator+ can create; moderator+ resolves
- Audit log: staff create (with field validation), staff read, no update/delete

**Templates:**
- `users/{uid}/templates/{id}`: `request.auth.uid == userId` for read/write

### Migration Strategy

**Phase 1 — Add new fields (backward compatible):**
- Add `staff: {}` and `staffUids: []` to existing tournaments via migration function
- Migrate `scorekeeperIds` entries into `staff` map as `'scorekeeper'`
- Security rules accept both old and new patterns

**Phase 2 — Update client code:**
- Switch `roleDetection.ts` to use `staff` map
- Update components checking `organizerId`/`scorekeeperIds` to use `hasMinRole()`
- Update tournament creation to initialize `staff: {}` and `staffUids: []`

**Phase 3 — Remove legacy:**
- Remove `scorekeeperIds` from Tournament interface
- Remove backward-compat from security rules
- Drop `scorekeeperIds` from new writes

---

## Implementation Order

Suggested wave structure:

1. **Wave A — Role System:** Types, helpers, migration, security rules, Staff Management UI
2. **Wave B — Audit Log:** Types, write helpers, security rules, Activity Log UI
3. **Wave C — Dispute Resolution:** Types, dispute flow, ScoreEditModal integration, UI
4. **Wave D — Quick Add + Export:** Placeholder registration, claim flow, CSV export
5. **Wave E — Templates:** Types, save/load flow, creation page integration

Waves are ordered by dependency: roles are foundational (everything depends on the permission model), audit log is needed by disputes, and the remaining features are independent.
