# Layer 8 Deferred Items — Design Document

**Date:** 2026-03-15
**Status:** Approved
**Scope:** 7 deferred items from Layer 8 (Spectator Experience) review

## Summary

Resolves all 7 remaining deferred items from the Layer 8 review. Two must-fix security/data issues are addressed with Cloud Functions infrastructure. Five accepted trade-offs are reassessed — three upgraded to "fix now" (client-side), two remain deferred.

## Design Decisions

### Items Being Fixed

| # | Item | Approach |
|---|------|----------|
| 1 | Spectator projection not updated during scoring | Client-side: piggyback on `syncProcessor.ts` |
| 2 | Public tier write permissions (+ 3 additional scorer-pattern vulnerabilities) | Cloud Function: HTTPS callable `processMatchCompletion` |
| 4 | Spectator subdoc persists after match goes private | Update projection status via Cloud Function (not delete) |
| 5 | Pool match filtering includes completed matches | Single Firestore query with `where('status', '==', 'in-progress')` |
| 6 | "+N more" is dead text | Expandable inline toggle |
| 7 | No inline scores on LiveNowSection cards | `useLiveMatch` per visible card (max 3 listeners) |

### Items Remaining Deferred

| # | Item | Reason |
|---|------|--------|
| 3 | ScoreEvent visibility uses parent match check | Simpler, functionally equivalent, secure |
| 6 | Full sticky/FAB for 4+ matches | Expandable toggle covers 80% of need |

---

## Section 1: Cloud Functions Infrastructure + Security Lockdown

### Architecture

Single HTTPS callable function (`processMatchCompletion`) replaces the current client-side cross-user write pattern. The client calls it once after match completion.

**Why callable over Firestore trigger:** Match docs update on every point scored. A trigger would fire hundreds of times (bailing at a guard clause each time) but still incur invocation costs. A callable fires exactly once.

**Why one function, not two:** The original two-trigger design (`onMatchCompleted` -> stats -> `onStatsWritten` -> tier/leaderboard) creates a fragile cascade with compounding cold start latency and partial-failure risk.

### Function Flow

```
Client: match completed → calls processMatchCompletion({ matchId })
Cloud Function (Admin SDK):
  1. Read match doc, validate genuinely completed
  2. Resolve participants (from match + tournament registrations)
  3. For each participant (transaction per user):
     a. Idempotency check (matchRef exists? skip)
     b. Read existing stats
     c. Compute new stats, tier, composite score (SERVER-SIDE, not copied from client)
     d. Write: matchRef + stats + leaderboard (atomic batch)
  4. Write public tier docs (outside transaction, non-critical)
  5. Update spectator projection status to 'completed'
```

**Critical design decision — no "stats laundering":** The Cloud Function computes stats from match data, not copying client-written values. This prevents a malicious client from writing fake stats that get elevated with Admin SDK privileges.

### Project Structure

```
Projects/ScoringApp/
  functions/
    src/
      index.ts
      callable/
        processMatchCompletion.ts
      lib/
        statsComputation.ts
        participantResolution.ts
    package.json          # firebase-admin, firebase-functions v6+
    tsconfig.json
  shared-types/           # NOT "shared/" — avoids src/shared/ collision
    types.ts              # Canonical type definitions
    utils/
      tierEngine.ts       # Pure computation (used by both client + functions)
      leaderboardScoring.ts
```

### Security Rules Changes

All four cross-user write paths locked down after migration:

```
/users/{uid}/public/{docId}      → allow write: if false (Cloud Function only)
/users/{uid}/stats/{docId}       → allow write: if false
/leaderboard/{uid}               → allow write: if false
/users/{uid}/matchRefs/{refId}   → allow write: if false
```

Exception: User-editable profile fields (displayName, profileVisibility) split into a separate rule allowing owner writes but blocking computed fields (tier, elo, rank).

### Gen 2 Configuration

- `memory: 256MiB`
- `maxInstances: 10`
- `concurrency: 16` (lower than default 80 due to transactional workload)
- `retry: false` initially (add once idempotency is bulletproof)
- `minInstances: 0` (scale to zero)
- Region: same as Firestore

### Migration Sequence

1. Deploy Cloud Function (both old client writes AND function work simultaneously)
2. Deploy new client that calls the callable instead of direct writes
3. Deploy restrictive security rules (only after all clients updated)

### Known Debt

- Achievement evaluation has an idempotency gap (move into transaction later)
- Match doc `status` field needs rule lockdown (who can set `completed`)
- `sharedWith` array validation (prevents matchRef injection into arbitrary users)

---

## Section 2: Spectator Projection Live Updates (Client-Side)

### Approach

Piggyback on the existing `syncProcessor.ts` match sync job. When processing a tournament match that's in-progress, write the spectator projection as a fire-and-forget side effect.

```typescript
// In syncProcessor.ts, after match write succeeds:
if (match.tournamentId && match.status === 'in-progress') {
  try {
    const names = getSanitizedNamesFromContext(job.context);
    const projection = buildSpectatorProjection(match, names, '');
    await setDoc(ref, projection); // full write, doc is ~300 bytes
  } catch (err) {
    console.warn('[syncProcessor] Projection update failed (non-fatal):', err);
  }
}
```

### Key Design Decisions

- **No Cloud Function:** Sync queue already handles deduplication (deterministic job ID). Zero additional infrastructure, no cold start latency.
- **Full `setDoc` over merge:** Doc is tiny (~300 bytes). Merge provides no real benefit — Firestore `onSnapshot` delivers the entire doc regardless.
- **Fire-and-forget:** Projection write failure must NOT fail the match sync job. Next score change retries naturally.
- **Remove `tournamentShareCode` from projection:** Share codes are access tokens. Spectators arriving via share link already have it.
- **Re-run privacy sanitization on each write:** If a player changes `profileVisibility` mid-match, names update. Read from local Dexie state.
- **Store sanitized names in sync job context:** `buildSpectatorProjection` needs 3 args (match, names, shareCode). Names stored at enqueue time.

### Visibility Revocation

- Match completion: `processMatchCompletion` callable updates projection to `status: 'completed'` (NOT delete — avoids blanking spectator UI)
- Match goes private: updates to `status: 'revoked'`
- UI handles both states gracefully ("Match completed!" / "No longer public")
- Scheduled daily cleanup function garbage-collects stale projections

### Firestore Rules — Field Validation

Add `hasOnly()` whitelist to prevent content injection into world-readable subdoc:

```
allow update: if ...existing ownership checks...
  && request.resource.data.keys().hasOnly([
       'publicTeam1Name', 'publicTeam2Name', 'team1Score', 'team2Score',
       'gameNumber', 'team1Wins', 'team2Wins', 'status',
       'tournamentId', 'spectatorCount', 'updatedAt', 'visibility'
     ]);
```

---

## Section 3: Client-Side UX Fixes

### Item #5: Filter Completed Pool Matches from "Live Now"

**Single Firestore query** replaces the current `getInProgressMatches()` approach for pool matches:

```typescript
const inProgressQuery = query(
  collection(db, 'matches'),
  where('tournamentId', '==', tournamentId),
  where('status', '==', 'in-progress')
);
```

- One listener, server-side filtering, auto-removes completed matches
- Requires composite index on `(tournamentId, status)` in `firestore.indexes.json`
- Matches start in **pending state** (skeleton, no LIVE badge) until query resolves — prevents flash-then-disappear
- Retained matches capped at **3** (was unlimited), retention reduced to **2 minutes** (was 5) to prevent clutter in fast tournaments
- Live matches always sort before FINAL matches

### Item #7: Inline Scores on LiveNowSection Cards

Call `useLiveMatch` inside `<For>` loop for each visible card (max 3 listeners):

- Compact horizontal layout: `[Ct 1]  Team A  7 - 5  Team B  LIVE`
- Score skeleton placeholder during loading (same width as score digits, no layout shift)
- Omit game count in compact card — save for drill-down view
- CSS transition on border color for live -> final state change (300ms ease-out)
- Use `<For>` (not `<Index>`) to ensure proper listener cleanup on item change

### Item #6: Expandable "+N more"

Replace dead text with expandable inline toggle:

- Collapsed: "+3 more live" (clickable, expands to show all)
- Expanded: "Show fewer" (clickable, collapses back to MAX_VISIBLE)
- Keeps spectator in context (vs. scroll-to-pools which breaks mental model)

### Changes Summary

- `PublicTournamentPage.tsx` — single Firestore query for in-progress matches; cap retention at 3/2min
- `LiveNowSection.tsx` — `useLiveMatch` per visible card, compact score layout, expandable overflow, score skeleton
- `firestore.indexes.json` — composite index `(tournamentId, status)`

---

## Specialist Reviews

Each design section was reviewed by 3-4 specialists before approval:

**Round 1 (trade-off assessment):** Firestore modeling, Security, Cloud Functions architecture, UX/Frontend
**Section 1 reviews:** Firestore modeling, Security, Cloud Functions architecture, Codebase fit
**Section 2 reviews:** Firestore modeling, Security, Codebase fit
**Section 3 reviews:** UX/Frontend, Codebase fit, Performance

Key findings incorporated:
- Stats laundering prevention (Security)
- Single callable over trigger chain (Cloud Functions)
- Client-side projection writes with field validation (Security + Cloud Functions)
- Single Firestore query over N listeners (Performance)
- Pending state to prevent flash-then-disappear (UX)
- Expandable inline over scroll-to-section (UX)
- Retention clutter caps (UX)
