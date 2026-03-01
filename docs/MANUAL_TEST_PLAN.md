# PickleScore — Manual Test Plan

> **Purpose:** Comprehensive manual test cases covering what unit tests cannot —
> real device behavior, end-to-end workflows, cross-feature interactions, and
> Firebase integration. Keep this updated as features are added.
>
> **Legend:** `[ ]` = not tested, `[x]` = passed, `[!]` = failed (add issue link)

---

## 1. Scoring — Live Match Experience

### 1.1 Match Setup
- [ ] Create singles match with sideout scoring, best-of-3, 11 points
- [ ] Create doubles match with rally scoring, single game, 21 points
- [ ] Create match with best-of-5 format, 15 points
- [ ] Team names appear correctly on scoreboard after setup
- [ ] Team color picker works and colors render on scoreboard

### 1.2 Live Scoring
- [ ] Tap to score increments correct team's score
- [ ] Sideout mode: only serving team can score; non-serving tap triggers side-out
- [ ] Rally mode: either team can score on any tap
- [ ] Win-by-2 enforced: game doesn't end at 11-10 (continues to 12-10, etc.)
- [ ] Game ends correctly at pointsToWin with 2+ lead
- [ ] Between-games transition shows correct game number
- [ ] Match ends when team wins required number of games (1, 2, or 3)
- [ ] Undo reverses last action correctly (score, side-out, fault)
- [ ] Multiple undos work in sequence back to game start
- [ ] Swipe right to score works on touch devices
- [ ] Swipe left to undo works on touch devices

### 1.3 Device Features During Scoring
- [ ] Screen stays awake during active match (wake lock setting ON)
- [ ] Screen wake lock releases when match ends or navigated away
- [ ] Haptic feedback fires on score (setting ON, Android)
- [ ] Sound effects play on score (subtle mode)
- [ ] Sound effects play on score (full mode)
- [ ] Voice announces score after each point (scores mode)
- [ ] Voice announces score + game context (full mode)
- [ ] Voice picker in settings changes the announcement voice
- [ ] Rate/pitch sliders affect voice output
- [ ] Test button in settings plays sample announcement

### 1.4 Match Completion
- [ ] Match over screen shows final scores and winner
- [ ] Match saved to history after completion
- [ ] Match saved to local Dexie database
- [ ] Player stats updated after match (logged-in user)
- [ ] Celebration animation plays on match end

---

## 2. History & Match Records

### 2.1 Match History
- [ ] Completed matches appear in history list (newest first)
- [ ] Each entry shows teams, scores, date, game type
- [ ] Singles and doubles matches display correctly
- [ ] Empty state shows when no matches recorded
- [ ] History persists across app restarts (Dexie)

---

## 3. Players

### 3.1 Player Management
- [ ] Add new player with name
- [ ] Player appears in player list
- [ ] Delete player removes from list
- [ ] Player list persists across restarts
- [ ] Empty state when no players added

---

## 4. Tournaments

### 4.1 Tournament Creation (requires auth)
- [ ] Create round-robin tournament with all required fields
- [ ] Create single-elimination tournament
- [ ] Create pool-bracket (hybrid) tournament
- [ ] Access mode selector shows all 4 options: open, approval, invite-only, group
- [ ] Selecting "group" mode shows buddy group picker
- [ ] Tournament appears in "My Tournaments" after creation
- [ ] Tournament appears in public browse (if listed/public)

### 4.2 Registration — Open Mode
- [ ] Any logged-in user can register immediately (status = confirmed)
- [ ] Registration count increments on browse card
- [ ] User sees "Registered" state after registering
- [ ] Duplicate registration blocked

### 4.3 Registration — Approval Mode
- [ ] User submits registration (status = pending)
- [ ] User sees "Pending Approval" state
- [ ] Organizer sees pending count badge on dashboard
- [ ] ApprovalQueue shows pending registrations
- [ ] Organizer approves → status changes to confirmed
- [ ] Organizer declines with reason → status changes to declined
- [ ] Declined user sees rejection reason

### 4.4 Registration — Invite-Only Mode
- [ ] Non-invited user cannot register (button disabled or hidden)
- [ ] Organizer sends invitation
- [ ] Invited user sees invitation in Invitation Inbox
- [ ] Invited user accepts → can register (confirmed)
- [ ] Invited user declines → invitation removed

### 4.5 Registration — Group Mode
- [ ] Only buddy group members see registration option
- [ ] Non-members cannot register
- [ ] Group member registers successfully (confirmed)

### 4.6 Registration — Withdrawal
- [ ] Registered player can withdraw
- [ ] Withdrawn registration reduces count
- [ ] Player can re-register after withdrawal (if mode allows)

### 4.7 Tournament Discovery
- [ ] Browse tab shows public tournaments
- [ ] Filter by status works (upcoming, in-progress, completed)
- [ ] Filter by format works (round-robin, elimination, pool-bracket)
- [ ] Access mode badge appears on browse cards
- [ ] Share code link (`/t/:code`) loads tournament details

### 4.8 Organizer Dashboard
- [ ] Status transitions work: setup → registration → pool-play → bracket → completed
- [ ] Cannot skip status steps (e.g., setup directly to bracket)
- [ ] Pause/resume tournament works
- [ ] Cancel tournament works with confirmation
- [ ] Player manager: add player manually
- [ ] Player manager: remove player
- [ ] Pairing panel: auto-pair generates valid pairings
- [ ] Pairing panel: manual pairing works
- [ ] Scoring a tournament match updates standings
- [ ] Rescoring a match recalculates standings correctly
- [ ] Bracket advancement works after match completion

### 4.9 Pool Play
- [ ] Pool assignments display correctly
- [ ] Round-robin schedule generated for each pool
- [ ] Standings update after each match
- [ ] Pool winners advance to bracket

### 4.10 Bracket Elimination
- [ ] Bracket renders correctly (2, 4, 8, 16 players)
- [ ] Match results advance winner to next round
- [ ] Final match determines tournament winner
- [ ] Seeding respects pool play standings (pool-bracket format)

---

## 5. Buddy System

### 5.1 Group Management
- [ ] Create buddy group with name and visibility (private/public)
- [ ] Share code generated for group
- [ ] Invite link (`/g/:code`) loads group invite page
- [ ] Accept invite adds user to group
- [ ] Group appears in buddies list
- [ ] Admin can update group settings
- [ ] Admin can remove members
- [ ] Member can leave group

### 5.2 Game Sessions
- [ ] Create session with date, time, location
- [ ] Simple RSVP: in/out/maybe options work
- [ ] Voting RSVP: time slot voting works
- [ ] Session appears in group detail
- [ ] Share code for session works (`/s/:code`)
- [ ] Day-of status updates: on-my-way, here, can't-make-it
- [ ] Session status transitions: proposed → confirmed → completed/cancelled

### 5.3 Notifications
- [ ] Notification appears when invited to group
- [ ] Notification appears for new session in group
- [ ] Notification count badge shows on buddies nav
- [ ] Mark notification as read clears badge
- [ ] StatusAvatar shows correct online/activity state

---

## 6. Authentication & Sync

### 6.1 Google Sign-In
- [ ] Sign-in button launches Google OAuth popup
- [ ] Successful login shows user name/avatar
- [ ] Auth state persists across page refresh
- [ ] Sign-out clears auth state
- [ ] Protected routes redirect to login when not authenticated

### 6.2 Cloud Sync
- [ ] On login: local matches push to Firestore
- [ ] On login: cloud matches pull to local Dexie
- [ ] User profile created/updated on login
- [ ] Player stats sync fires after match completion (fire-and-forget)
- [ ] Sync errors don't crash the app (console warnings only)

### 6.3 Offline Behavior
- [ ] App loads when offline (cached assets)
- [ ] Can create and score a match offline
- [ ] Match saved locally when offline
- [ ] Matches sync to cloud when connection restored
- [ ] No error dialogs when offline — graceful degradation

---

## 7. Firestore Security Rules

### 7.1 Match Rules
- [ ] Owner can create and update own match
- [ ] Non-owner cannot update someone else's match
- [ ] Match cannot be deleted via client

### 7.2 Tournament Rules
- [ ] Only organizer can update tournament
- [ ] Non-organizer cannot change tournament status
- [ ] Registration rules enforce access mode (test each mode)
- [ ] Invitation rules: only organizer creates, only invitee responds
- [ ] Listed tournament must be public (invariant enforced)

### 7.3 Player Stats Rules
- [ ] MatchRef requires `ownerId == auth.uid` on create
- [ ] MatchRef cannot be updated or deleted after creation
- [ ] Stats can be written by any authenticated user (tournament cross-user)
- [ ] Stats cannot be deleted

### 7.4 Buddy Group Rules
- [ ] Any authenticated user can create a group
- [ ] Only admin/creator can update group
- [ ] Only admin can delete group
- [ ] Members can add/remove themselves
- [ ] Non-members cannot write to group

---

## 8. PWA & Mobile

### 8.1 Installation
- [ ] "Add to Home Screen" prompt appears (Android Chrome)
- [ ] App installs with correct icon (192x192, 512x512)
- [ ] Installed app launches in standalone mode (no browser chrome)
- [ ] iOS: Add to Home Screen works with apple-touch-icon
- [ ] App icon renders correctly on home screen

### 8.2 Responsive Design
- [ ] Scoreboard usable on small phones (320px width)
- [ ] Scoreboard usable on tablets (landscape)
- [ ] Tournament bracket scrollable on mobile
- [ ] Navigation works on all screen sizes
- [ ] Bottom nav doesn't overlap content

### 8.3 Display Modes
- [ ] Dark mode renders correctly (default)
- [ ] Outdoor mode: high contrast, readable in sunlight
- [ ] Mode switch applies immediately without reload

---

## 9. Cross-Feature Integration

### 9.1 Tournament → Scoring → Stats
- [ ] Match created from tournament dashboard opens scoring page
- [ ] Completing tournament match returns to dashboard
- [ ] Tournament standings update after match scored
- [ ] Player stats (tier, win/loss) update for tournament participants
- [ ] Match appears in player's history

### 9.2 Buddy → Session → Scoring
- [ ] Session created in buddy group
- [ ] Players RSVP to session
- [ ] Match created from session context
- [ ] Match linked back to session/group

### 9.3 Auth → Data Continuity
- [ ] Matches created before login persist after login
- [ ] Matches created before login sync to cloud after login
- [ ] Logging out and back in retains all data
- [ ] Different user logging in sees their own data (not previous user's)

---

## 10. Edge Cases & Error Handling

### 10.1 Network Failures
- [ ] Firestore write failure shows warning, doesn't crash
- [ ] Registration on flaky network doesn't create duplicates
- [ ] Tournament status change failure rolls back UI state
- [ ] Stats sync failure doesn't block match completion

### 10.2 Empty States
- [ ] No matches → empty state in history
- [ ] No players → empty state in players page
- [ ] No tournaments → empty state in browse tab
- [ ] No buddy groups → empty state in buddies page
- [ ] No notifications → no badge, clean UI

### 10.3 Form Validation
- [ ] Tournament name required (cannot be empty)
- [ ] Tournament name max length enforced (100 chars)
- [ ] Team names required in match setup
- [ ] Buddy group name max length enforced (50 chars)
- [ ] Invalid share codes show 404 or error message

### 10.4 Concurrent Usage
- [ ] Two organizers managing same tournament don't corrupt data
- [ ] Two scorekeepers on same match — last write wins gracefully
- [ ] Rapid tapping on score button doesn't skip/double-count

---

## 11. Performance

- [ ] App loads in under 3 seconds on mobile (first paint)
- [ ] Scoring page responds to taps in under 100ms
- [ ] Tournament with 32+ players loads bracket without lag
- [ ] Browse page with 50+ tournaments scrolls smoothly
- [ ] No memory leaks during extended scoring session (30+ min)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-01 | Initial comprehensive test plan created | Claude + Santosh |
