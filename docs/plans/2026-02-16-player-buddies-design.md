# Player Buddies — Design Document

**Date:** 2026-02-16
**Status:** Approved
**Layer:** New feature (independent of Layers 4-10)

---

## Problem

Regular pickleball players organize pickup games through WhatsApp groups and polls. The coordination loop is painful:
- "Who's playing today?" — polling availability
- "When should we play?" — finding a time that works
- "We need one more!" — scrambling to fill spots

Every step involves noise, context-switching, and manual tracking. PickleScore can own this workflow with less friction and more joy.

## Vision

Replace WhatsApp coordination for pickleball buddy groups. One app for scoring AND organizing. Pull players from WhatsApp into PickleScore, and once they're here, make it so good they never go back.

## Design Principles

1. **One-tap everything** — RSVP, check-in, and status updates are single taps, never modals or forms
2. **Smart defaults** — Pre-fill from group settings (location, day, time). Creating a session for a recurring group should take < 5 seconds
3. **Glanceable** — See who's in, who's out, and how many spots remain at a glance without drilling into anything
4. **Joyful micro-interactions** — Satisfying animations on RSVP, check-in confirmations, spot-filled celebrations. Match the premium feel of the scoring experience (WAAPI animations, haptics, sound effects)
5. **Progressive disclosure** — Simple by default, powerful when needed. Show In/Out buttons first; time-slot voting and open calls are there when you need them, hidden when you don't
6. **Warm, not clinical** — Friendly avatars, color-coded statuses, inviting empty states. This is for friends organizing fun, not a project management tool

---

## Architecture: Hybrid (Groups as Context, Sessions as Action)

**Groups** provide social identity — "The Tuesday Crew", "Park Regulars"
**Sessions** are the actions — "This Saturday at 10am"

Sessions belong to groups but can also exist standalone (open calls). This maps to real life: your group is your crew, a session is a specific game.

---

## Data Model

### BuddyGroup

The social identity.

```typescript
interface BuddyGroup {
  id: string;
  name: string;                    // "Tuesday Evening Crew"
  description: string;             // "We play at Riverside Park"
  createdBy: string;               // userId of creator (admin)
  defaultLocation: string | null;  // common playing spot
  defaultDay: string | null;       // "tuesday" — for recurring groups
  defaultTime: string | null;      // "18:00" — for recurring groups
  memberCount: number;             // denormalized for list views
  visibility: 'private' | 'public'; // discoverable or invite-only
  shareCode: string | null;        // for invite links
  createdAt: number;
  updatedAt: number;
}
```

### BuddyGroupMember

```typescript
interface BuddyGroupMember {
  userId: string;
  displayName: string;             // snapshot for fast rendering
  photoURL: string | null;
  role: 'admin' | 'member';       // admin = creator + promoted members
  joinedAt: number;
}
```

### GameSession

The action — a specific game proposal.

```typescript
interface GameSession {
  id: string;
  groupId: string | null;          // null = standalone open call
  createdBy: string;               // userId
  title: string;                   // "Saturday Morning Doubles"
  location: string;
  courtsAvailable: number;         // how many courts
  spotsTotal: number;              // total player spots (e.g., 8 for 2 courts)
  spotsConfirmed: number;          // denormalized count of "in" RSVPs

  // Scheduling
  scheduledDate: number | null;    // fixed date (for recurring/simple)
  timeSlots: TimeSlot[] | null;    // for time-slot voting (ad-hoc)
  confirmedSlot: TimeSlot | null;  // winning time slot after voting

  // RSVP config
  rsvpStyle: 'simple' | 'voting';  // In/Out/Maybe vs time-slot voting
  rsvpDeadline: number | null;     // optional cutoff time

  // Visibility & sharing
  visibility: 'group' | 'open';   // group-only or open call
  shareCode: string;               // always generated for link sharing

  // Auto-management
  autoOpenOnDropout: boolean;      // auto-flip to open if someone bails
  minPlayers: number;              // minimum needed to play (e.g., 4)

  status: 'proposed' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: number;
  updatedAt: number;
}

interface TimeSlot {
  id: string;
  date: number;
  startTime: string;   // "09:00"
  endTime: string;     // "11:00"
  voteCount: number;   // denormalized
}
```

### SessionRSVP

```typescript
interface SessionRSVP {
  userId: string;
  displayName: string;
  photoURL: string | null;
  response: 'in' | 'out' | 'maybe';
  dayOfStatus: 'none' | 'on-my-way' | 'here' | 'cant-make-it';
  selectedSlotIds: string[];        // for voting style
  respondedAt: number;
  statusUpdatedAt: number | null;
}
```

### BuddyNotification

```typescript
interface BuddyNotification {
  id: string;
  userId: string;           // recipient
  type: BuddyNotificationType;
  sessionId: string | null;
  groupId: string | null;
  actorName: string;        // "Raj proposed a session"
  message: string;          // pre-rendered text
  read: boolean;
  createdAt: number;
}

type BuddyNotificationType =
  | 'session_proposed'       // new session in your group
  | 'session_confirmed'      // enough players — game is on
  | 'session_cancelled'      // session cancelled
  | 'spot_opened'            // someone bailed, spot available
  | 'player_joined'          // someone RSVP'd in (for creator)
  | 'group_invite'           // invited to join a group
  | 'voting_reminder';       // deadline approaching
```

### Firestore Structure

```
/buddyGroups/{groupId}                     <- group doc
/buddyGroups/{groupId}/members/{userId}    <- membership
/gameSessions/{sessionId}                  <- top-level (enables open call queries)
/gameSessions/{sessionId}/rsvps/{userId}   <- RSVP responses
/users/{userId}/buddyNotifications/{notifId} <- in-app notifications
```

Sessions are top-level (not nested under groups) so open calls can be queried independently.

---

## User Flows

### Flow 1: Create a Group

```
Buddies tab -> "+ New Group" -> Name, description, default location/day/time
-> Group created -> Share invite link (copy/WhatsApp) -> Members join via link
```

Admin can also search & add members directly (reuses existing PlayerSearch).

### Flow 2: Propose a Session (Recurring / Simple RSVP)

```
Group page -> "+ New Session" -> Pre-filled from group defaults
-> Tweak date/courts/spots -> Post -> Members see it
-> Tap In / Out / Maybe (one tap, inline, no modal)
-> Enough people confirm -> Status flips to "confirmed"
```

### Flow 3: Propose a Session (Ad-hoc / Time-slot Voting)

```
Group page -> "+ New Session" -> Toggle to "Find a time"
-> Add 2-4 time slots -> Post -> Members vote on slots
-> Deadline or enough votes -> Creator picks winning slot -> "confirmed"
```

### Flow 4: Open Call — "We Need More"

```
Session page -> spots 3/4 -> "Open to community" toggle
-> Appears on /play feed -> Any user taps "I'm in"
-> Spots fill -> Auto-closes
```

Also works standalone from `/play` without a group.

### Flow 5: WhatsApp Bridge

```
Session created -> "Share" button -> picklescore.app/s/ABC123
-> Share to WhatsApp -> Recipient taps link -> Sees session in browser
-> "Join on PickleScore" CTA -> Sign in -> RSVP in app
```

View without auth, RSVP requires sign-in. This is the funnel into the app.

### Flow 6: Day-of Status Updates

RSVP lifecycle extends on game day:

```
RSVP Phase:     in / out / maybe
Day-of Phase:   on my way -> i'm here / can't make it
```

**"Can't make it" flow:**
```
Player was "in" -> Taps "Can't make it" -> spotsConfirmed decrements
-> If below minPlayers -> "Need 1 more" alert
-> If autoOpenOnDropout -> auto-flips to open on /play feed
```

**"I'm here" flow:**
```
Game day -> Taps "On my way" (optional) -> Arrives -> Taps "I'm here"
-> Green check on avatar -> Others see who's at the court
```

**Day-of status display:**

| Status | Display |
|--------|---------|
| in (no update) | Avatar — "Confirmed" |
| on-my-way | Avatar + motion icon — "On the way" |
| here | Avatar + green check — "At the court" |
| cant-make-it | Avatar grayed — "Can't make it" |

---

## Screens & Routes

| Route | Screen | Purpose |
|-------|--------|---------|
| `/buddies` | Buddies Home | My groups list + open play section |
| `/buddies/:groupId` | Group Detail | Members, upcoming/past sessions, settings |
| `/session/:sessionId` | Session Detail | RSVPs, voting, spots, share, day-of status |
| `/play` | Open Play | Browse open sessions, create standalone |
| `/s/:shareCode` | Public Session | Shareable landing (view without auth) |
| `/g/:shareCode` | Group Invite | Join group landing page |

### Navigation

New **"Buddies"** tab in the bottom nav. `/play` is a sub-section within Buddies (toggle or tab) to avoid cluttering the nav bar.

### Screen Details

**Buddies Home (`/buddies`)**
- My groups as cards (name, member avatars, next session date/time)
- "Open Play" toggle/tab showing nearby open sessions
- FAB: "+ New Group"
- Badge on tab for unread notifications

**Group Detail (`/buddies/:groupId`)**
- Header: group name, member count, share button
- Members: horizontal avatar row (tap to manage for admin)
- Upcoming sessions: cards with date, location, spots (3/4), inline RSVP buttons
- Past sessions: collapsed history
- FAB: "+ New Session" (pre-filled from group defaults)

**Session Detail (`/session/:sessionId`)**
- Header: title, date/time, location, map pin
- Spots tracker: visual "4 of 8" with avatar pills (color-coded by status)
- RSVP: inline In/Out/Maybe buttons (simple) OR time-slot grid (voting)
- Who's playing: names + statuses at a glance
- Day-of: status buttons replace RSVP buttons on game day
- Share button: copy / WhatsApp / native share
- "Open to community" toggle
- Celebration animation when all spots fill

---

## Sharing & Notifications

### Share Links

Sessions: `picklescore.app/s/ABC123`
Groups: `picklescore.app/g/XYZ789`

**Share sheet:** Copy link, WhatsApp deep link (`https://wa.me/?text=...`), Web Share API

**Public pages** work without auth for viewing, require sign-in for actions.

### In-App Notifications

Lightweight, scoped to Buddies only. Badge on Buddies tab.

**Trigger rules — meaningful state changes only (not every RSVP):**

| Event | Notified |
|-------|----------|
| Session proposed | All group members (except creator) |
| Session confirmed (spots filled) | All "in" and "maybe" responders |
| Someone bails | Session creator |
| Spot filled by open-call user | Session creator |
| Group invite | Invited user |
| Voting deadline in 2h | Members who haven't voted |
| Session cancelled | All "in" responders |

---

## Security Rules

**BuddyGroups** (`/buddyGroups/{groupId}`)
- Read: members; anyone if visibility == 'public'
- Create: any authenticated user
- Update/Delete: admin role only

**BuddyGroupMembers** (`/buddyGroups/{groupId}/members/{userId}`)
- Read: any group member
- Create: admin adds anyone; user adds self (join via share code)
- Delete: admin removes anyone; user removes self (leave)

**GameSessions** (`/gameSessions/{sessionId}`)
- Read: group members if 'group'; anyone if 'open'
- Create: group members (group sessions); any auth user (standalone)
- Update/Delete: creator only

**SessionRSVPs** (`/gameSessions/{sessionId}/rsvps/{userId}`)
- Read: anyone who can read parent session
- Create/Update/Delete: userId == auth.uid only

**BuddyNotifications** (`/users/{userId}/buddyNotifications/{notifId}`)
- Read/Update/Delete: userId == auth.uid only

### Firestore Indexes

| Collection | Fields | Purpose |
|------------|--------|---------|
| gameSessions | groupId, status, scheduledDate | Group's upcoming sessions |
| gameSessions | visibility(open), status, scheduledDate | Open play discovery |
| gameSessions | createdBy, createdAt DESC | "My sessions" |
| buddyGroups | visibility(public), createdAt DESC | Discoverable groups |
| buddyNotifications | userId, read, createdAt DESC | Unread notifications |
| members (collection group) | userId | "My groups" cross-query |

### Denormalization

| Field | On | Why |
|-------|-----|-----|
| memberCount | BuddyGroup | List views without reading members |
| spotsConfirmed | GameSession | "5/8" without counting RSVPs |
| displayName, photoURL | Member, RSVP | Render without user profile fetches |
| voteCount | TimeSlot | Tallies without counting |

Updated atomically with source actions.

---

## UX Quality Bar

This feature must match the premium feel established in the scoring experience:

- **WAAPI animations** on RSVP state changes (In button pulse, avatar slide-in)
- **Haptic feedback** on RSVP tap, check-in confirmation
- **Sound effects** — subtle confirmation sounds on key actions
- **Celebration** when all spots fill (confetti or similar)
- **Skeleton loading** for session lists and group pages
- **Inviting empty states** — "No sessions yet" with friendly illustration and clear CTA
- **Color-coded status** — green (here), blue (on the way), amber (maybe), gray (out/can't make it)
- **Avatar pills** with status indicators for glanceable who's-who
- **Smooth transitions** between views (solid-transition-group)

The goal: opening the Buddies tab should feel like opening a group chat with friends, not a spreadsheet.

---

## What This Feature Does NOT Include

- Tournament integration (casual only)
- Push notifications (Layer 5)
- Location-based discovery / geolocation (Layer 6)
- Player stats or ELO (Layer 7)
- Chat / messaging between players
- Payment collection
