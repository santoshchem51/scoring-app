# Phase 3: Differentiate — Design Document

**Date**: 2026-02-14
**Status**: Approved
**Scope**: 8 features in 3 groups
**Tech Budget**: ~8KB additional (canvas-confetti ~6KB + pointer gesture utils ~2KB)
**Prereqs**: Phase 1 (Fix & Foundation) and Phase 2 (Premium Feel) complete

---

## Overview

Phase 3 turns PickleScore from a solid scoring tool into a standout app that players prefer over competitors. Eight features organized into three dependency-ordered groups: Core Interactions (foundation), Sensory Experience (engagement), Platform Polish (reach).

---

## Group A: Core Interactions

### 1. Quick Game

**Problem**: Starting a game requires 5+ taps through the setup form. Court-side, users want to start scoring immediately.

**Design**:
- Prominent "Quick Game" button at the top of GameSetupPage, above the full form
- One tap creates a match with smart defaults from settingsStore: game type, scoring mode, points to win, match format
- Team names default to "Team 1" / "Team 2", colors default to Green / Orange
- Navigates directly to `/score/:id`
- Full setup form remains below with "— or customize —" divider

**Data flow**: `Quick Game tap → create Match with settings defaults → save to IndexedDB → navigate to /score/:id`

### 2. Custom Team Colors

**Problem**: Both teams look identical on the scoreboard. Hard to distinguish at a glance.

**Design**:
- 6 preset color options per team, displayed as color swatches below each team name input in GameSetupPage
- Colors stored in match config: `team1Color` and `team2Color` fields on Match type

**Color Palette** (high contrast on dark `#1e1e2e` and outdoor `#ffffff` backgrounds):

| Name | Hex | Default For |
|------|-----|-------------|
| Green | `#22c55e` | Team 1 |
| Orange | `#f97316` | Team 2 |
| Blue | `#3b82f6` | Alt |
| Red | `#ef4444` | Alt |
| Purple | `#a855f7` | Alt |
| Teal | `#14b8a6` | Alt |

**Scoreboard integration**: Team colors used for border/ring, score background glow, serve indicator pulse, game point badge. Colors carry through to celebrations and score cards.

### 3. Swipe Gestures

**Problem**: Tapping small buttons during fast-paced play is error-prone. Swipe gestures are more natural for one-handed court-side use.

**Design**:
- **Swipe right** on a team's score panel → Score point for that team
- **Swipe left** on a team's score panel → Undo last action
- Minimum 50px horizontal, <30px vertical displacement (prevents false triggers during scroll)
- Visual feedback: Score panel slides slightly in swipe direction, snaps back
- Only active on scoring page in `serving` state
- Implementation via `pointerdown`/`pointermove`/`pointerup` events (native, 0 dependencies)
- Buttons remain fully functional — gestures are additive

---

## Group B: Sensory Experience

### 4. Celebration Animations (Full Suite)

**Trigger**: Game or match completion.

**Components**:

1. **Canvas Confetti** (canvas-confetti, ~6KB)
   - Game win: Single burst from bottom-center, 50 particles, winning team's color
   - Match win: Double burst from both sides, 150 particles, both team colors, longer duration
   - Canvas overlay at z-50, auto-cleans after 3 seconds

2. **Screen Flash**
   - Full-screen overlay flashes winning team's color at 20% opacity
   - 300ms CSS animation: `opacity 0 → 0.2 → 0`

3. **Victory Sound** (Web Audio API)
   - Game win: Rising 3-note arpeggio (C5→E5→G5, 100ms each)
   - Match win: 5-note fanfare (C5→E5→G5→C6 sustained, 500ms total)
   - Respects `soundEffects` setting: off = silent, subtle = single tone, full = full arpeggio

4. **Haptic Burst**
   - Game win: `navigator.vibrate([50, 30, 50])` — short double buzz
   - Match win: `navigator.vibrate([50, 30, 50, 30, 100])` — triple buzz crescendo
   - Respects `hapticFeedback` setting

5. **Reduced Motion**: Skips confetti + flash, keeps sound + haptic only

### 5. Voice Score Announcements

**Engine**: Web Speech API (`speechSynthesis.speak()`) — native, 0KB.

**Announcement triggers**:

| Event | Announcement | Example |
|-------|-------------|---------|
| Point scored | Score call | "4-2-1" or "4-2" |
| Side out | "Side out" | "Side out" |
| Game point | "Game point, [team]" | "Game point, Eagles" |
| Match point | "Match point, [team]" | "Match point, Hawks" |
| Deuce | "Deuce" | When tied at pointsToWin-1 |
| Game over | "[Team] wins game [N], [score]" | "Eagles win game 1, 11-7" |
| Match over | "[Team] wins the match, [games]" | "Eagles win the match, 2-1" |
| First server | "First server" | On game start |
| Server switch | "Second server" | When server changes within team |

**Settings**:
- New field: `voiceAnnouncements: 'off' | 'scores' | 'full'`
- `off`: No speech
- `scores`: Only score calls after points
- `full`: All events above
- Settings page gets "Voice" section with 3 OptionCards

**Implementation**: `useVoiceAnnouncements` hook listens to XState state transitions. Utterance queue prevents overlapping speech.

---

## Group C: Platform Polish

### 6. Shareable Score Cards

**Score card design** (Canvas API, 1080x1080px):
- Dark background (`#161625`) with subtle gradient
- PickleScore logo wordmark at top
- Team names in Oswald font with custom team colors
- Final score in large Oswald numbers (e.g., "11 — 7")
- Game-by-game breakdown for multi-game matches
- Match metadata: date, scoring mode
- "Scored with PickleScore" watermark at bottom

**Sharing flow**:
1. "Share" button on match completion screen and on match cards in history
2. Canvas renders score card off-screen
3. Canvas converted to PNG blob
4. Primary: `navigator.share({ files: [blob] })` — native OS share sheet
5. Fallback 1: `navigator.clipboard.write([ClipboardItem])` — copy to clipboard, show toast
6. Fallback 2: Download as PNG via `<a download>`
7. Feature detection determines available method

### 7. Full Tablet/iPad Layout

**Breakpoint**: `min-width: 768px`

| Page | Phone | Tablet |
|------|-------|--------|
| Game Setup | Single column, sticky Start | Two-column: options left, teams right |
| Scoring | Stacked scoreboard + controls | Side-by-side scoreboard, controls below |
| History | Single column cards | Two-column grid of match cards |
| Players | Single column | Form left, player list right |
| Settings | Single column | Grouped sections side-by-side |

**Layout**: `md:grid md:grid-cols-2` on page containers. Max-width from `max-w-xl` to `max-w-3xl` at tablet breakpoint. BottomNav stays 4-item, centered with `max-w-md`.

### 8. Outdoor/High-Contrast Mode

**Problem**: Dark mode is unreadable in direct sunlight. Pickleball is primarily an outdoor sport.

**Design**:
- New setting: `displayMode: 'dark' | 'outdoor'`
- Outdoor mode swaps the color palette via `.outdoor` class on `<html>`

**Color token swap**:

| Token | Dark Mode | Outdoor Mode |
|-------|-----------|-------------|
| `--color-surface` | `#1e1e2e` | `#ffffff` |
| `--color-surface-light` | `#2a2a3e` | `#f1f5f9` |
| `--color-surface-lighter` | `#363650` | `#e2e8f0` |
| `--color-on-surface` | `#e2e8f0` | `#0f172a` |
| `--color-on-surface-muted` | `#a0aec0` | `#475569` |
| `--color-score` | `#facc15` | `#ca8a04` |

- Score numbers +20% larger in outdoor mode for sunlight readability
- Toggle in Settings with sun/moon icon
- CSS custom properties swap instantly — all existing `bg-surface`, `text-on-surface` classes auto-adapt

---

## Data Model Changes

**settingsStore additions**:
```typescript
voiceAnnouncements: 'off' | 'scores' | 'full';  // default: 'off'
displayMode: 'dark' | 'outdoor';                  // default: 'dark'
```

**Match config additions** (in `data/types.ts`):
```typescript
team1Color: string;  // hex color, default '#22c55e'
team2Color: string;  // hex color, default '#f97316'
```

---

## Tech Dependencies

| Feature | Library | Size | Alternative |
|---------|---------|------|-------------|
| Confetti | canvas-confetti | ~6KB | CSS-only (less impressive) |
| Swipe | Native pointer events | 0KB | hammer.js (~7KB, overkill) |
| Voice | Web Speech API | 0KB | — |
| Score cards | Canvas API | 0KB | — |
| Share | Web Share API | 0KB | — |
| Clipboard | Clipboard API | 0KB | — |
| Outdoor mode | CSS custom properties | 0KB | — |
| Tablet layout | Tailwind responsive | 0KB | — |

**Total new bundle**: ~6-8KB (canvas-confetti only significant addition)

---

## Execution Groups

| Group | Features | Dependencies | Parallelizable |
|-------|----------|-------------|----------------|
| **A** | Quick Game, Team Colors, Swipe Gestures | None (foundation) | Yes (3 independent tasks) |
| **B** | Celebrations, Voice | Team Colors (for confetti colors) | Yes (2 independent tasks) |
| **C** | Score Cards, Tablet, Outdoor | Team Colors, Celebrations complete | Partially (Score Cards needs colors; Tablet + Outdoor independent) |
