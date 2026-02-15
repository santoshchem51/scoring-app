# Phase 3: Differentiate — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 8 differentiating features (Quick Game, team colors, swipe gestures, celebrations, voice announcements, shareable score cards, tablet layout, outdoor mode) that turn PickleScore from a solid tool into a standout app.

**Architecture:** Three dependency-ordered groups — Group A (data model + core interactions) must complete first, then Group B (celebrations + voice) and Group C (score cards + tablet + outdoor) can proceed. Each feature is a self-contained hook or component wired into existing pages.

**Tech Stack:** SolidJS 1.9 + TypeScript + Vite 7 + Tailwind CSS v4 + XState v5 + canvas-confetti (~6KB) + Web Speech API + Canvas API + Web Share API

**SolidJS Rules:**
- Use `import type` for type-only imports (`verbatimModuleSyntax: true`)
- Use `class` not `className`
- Don't destructure props — use `props.foo`
- Use `createSignal`, `createEffect`, `on`, `onMount`, `onCleanup`, `Show`, `For`, `Switch/Match`

---

## Group A: Core Interactions (Tasks 1–5)

### Task 1: Data Model & Settings Foundation

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/data/db.ts` (if needed for schema version)

**Context:** Every Phase 3 feature needs these data model changes. Team colors go on Match, voice/display settings go in settingsStore. This task touches no UI — just data shapes and defaults.

**Step 1: Add team colors to Match type**

In `src/data/types.ts`, add two optional fields to the `Match` interface:

```typescript
export interface Match {
  id: string;
  config: MatchConfig;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Name: string;
  team2Name: string;
  team1Color?: string;   // ADD: hex color, e.g., '#22c55e'
  team2Color?: string;   // ADD: hex color, e.g., '#f97316'
  games: GameResult[];
  winningSide: 1 | 2 | null;
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
  lastSnapshot?: string | null;
}
```

Make them optional (`?`) so existing matches in IndexedDB don't break.

**Step 2: Add voice and display settings**

In `src/stores/settingsStore.ts`, update the `Settings` interface and defaults:

```typescript
interface Settings {
  defaultScoringMode: 'sideout' | 'rally';
  defaultPointsToWin: 11 | 15 | 21;
  defaultMatchFormat: 'single' | 'best-of-3' | 'best-of-5';
  scoringUIMode: ScoringUIMode;
  keepScreenAwake: boolean;
  soundEffects: 'off' | 'subtle' | 'full';
  hapticFeedback: boolean;
  voiceAnnouncements: 'off' | 'scores' | 'full';  // ADD
  displayMode: 'dark' | 'outdoor';                  // ADD
}
```

Update the `loadSettings()` default return to include:
```typescript
voiceAnnouncements: 'off',
displayMode: 'dark',
```

**Step 3: Export team color constants**

Create a new file `src/shared/constants/teamColors.ts`:

```typescript
export interface TeamColor {
  name: string;
  hex: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Teal', hex: '#14b8a6' },
];

export const DEFAULT_TEAM1_COLOR = '#22c55e';
export const DEFAULT_TEAM2_COLOR = '#f97316';
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass (no UI changes, only type additions).

**Step 5: Commit**

```bash
git add src/data/types.ts src/stores/settingsStore.ts src/shared/constants/teamColors.ts
git commit -m "feat: add team colors to Match, voice/display settings to store"
```

---

### Task 2: Quick Game

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Context:** Add a prominent "Quick Game" button at the top of the Game Setup page. One tap creates a match using defaults from settingsStore and navigates to scoring. The existing form stays below with a divider.

**Step 1: Add Quick Game handler and UI**

In `GameSetupPage.tsx`, add a `quickStart` async function next to the existing `startGame`:

```typescript
const quickStart = async () => {
  const s = settings();
  const config: MatchConfig = {
    gameType: 'doubles',
    scoringMode: s.defaultScoringMode,
    matchFormat: s.defaultMatchFormat,
    pointsToWin: s.defaultPointsToWin,
  };
  const match: Match = {
    id: crypto.randomUUID(),
    config,
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    team1Color: DEFAULT_TEAM1_COLOR,
    team2Color: DEFAULT_TEAM2_COLOR,
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
  };
  try {
    await matchRepository.save(match);
    navigate(`/score/${match.id}`);
  } catch (err) {
    console.error('Failed to start quick game:', err);
  }
};
```

Add the import at top:
```typescript
import { DEFAULT_TEAM1_COLOR, DEFAULT_TEAM2_COLOR } from '../../shared/constants/teamColors';
```

In the JSX, insert the Quick Game button and divider as the first child inside `<div class="p-4 space-y-6 pb-24">`:

```tsx
{/* Quick Game */}
<button
  type="button"
  onClick={quickStart}
  class="w-full bg-primary text-surface font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-3"
  aria-label="Quick Game — start with defaults"
>
  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
  Quick Game
</button>

{/* Divider */}
<div class="flex items-center gap-3 text-on-surface-muted">
  <div class="flex-1 border-t border-surface-lighter" />
  <span class="text-xs uppercase tracking-wider">or customize</span>
  <div class="flex-1 border-t border-surface-lighter" />
</div>
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 3: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "feat: add Quick Game one-tap start with smart defaults"
```

---

### Task 3: Team Color Picker

**Files:**
- Create: `src/shared/components/ColorPicker.tsx`
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Context:** Add a color swatch picker below each team name input. The selected color gets stored on the Match when the game starts.

**Step 1: Create ColorPicker component**

Create `src/shared/components/ColorPicker.tsx`:

```tsx
import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { TEAM_COLORS } from '../constants/teamColors';

interface Props {
  selected: string;
  onSelect: (hex: string) => void;
  label: string;
}

const ColorPicker: Component<Props> = (props) => {
  return (
    <div class="flex gap-2" role="radiogroup" aria-label={props.label}>
      <For each={TEAM_COLORS}>
        {(color) => (
          <button
            type="button"
            onClick={() => props.onSelect(color.hex)}
            class={`w-8 h-8 rounded-full transition-transform ${
              props.selected === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ "background-color": color.hex }}
            role="radio"
            aria-checked={props.selected === color.hex}
            aria-label={color.name}
          />
        )}
      </For>
    </div>
  );
};

export default ColorPicker;
```

**Step 2: Integrate into GameSetupPage**

In `GameSetupPage.tsx`, add color state signals after the team name signals:

```typescript
import { DEFAULT_TEAM1_COLOR, DEFAULT_TEAM2_COLOR } from '../../shared/constants/teamColors';
import ColorPicker from '../../shared/components/ColorPicker';

// Inside the component, after team name signals:
const [team1Color, setTeam1Color] = createSignal(DEFAULT_TEAM1_COLOR);
const [team2Color, setTeam2Color] = createSignal(DEFAULT_TEAM2_COLOR);
```

Add `team1Color` and `team2Color` to the Match object in `startGame`:
```typescript
team1Color: team1Color(),
team2Color: team2Color(),
```

In the Teams fieldset JSX, add a ColorPicker below each input:

```tsx
<div>
  <label for="team1-name" class="sr-only">Team 1 name</label>
  <input ... />
  <div class="mt-2">
    <ColorPicker selected={team1Color()} onSelect={setTeam1Color} label="Team 1 color" />
  </div>
</div>
<div>
  <label for="team2-name" class="sr-only">Team 2 name</label>
  <input ... />
  <div class="mt-2">
    <ColorPicker selected={team2Color()} onSelect={setTeam2Color} label="Team 2 color" />
  </div>
</div>
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 4: Commit**

```bash
git add src/shared/components/ColorPicker.tsx src/features/scoring/GameSetupPage.tsx
git commit -m "feat: add team color picker with 6 preset colors"
```

---

### Task 4: Scoreboard Team Colors

**Files:**
- Modify: `src/features/scoring/components/Scoreboard.tsx`
- Modify: `src/features/scoring/ScoringPage.tsx`

**Context:** Pass team colors from the loaded Match through to Scoreboard. Use team colors for ring/border, score glow, serve indicator, and game point badge instead of the hardcoded primary/score colors.

**Step 1: Add color props to Scoreboard**

In `Scoreboard.tsx`, add two new props:

```typescript
interface Props {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  scoringMode: ScoringMode;
  gameType: GameType;
  pointsToWin?: number;
  team1Color?: string;  // ADD
  team2Color?: string;  // ADD
}
```

Add color helpers inside the component:

```typescript
const t1Color = () => props.team1Color ?? '#22c55e';
const t2Color = () => props.team2Color ?? '#f97316';
```

Replace the hardcoded classList on each team panel. For Team 1, replace the existing classList and style:

```tsx
<div
  class="flex flex-col items-center py-6 rounded-2xl transition-all"
  style={{
    "background-color": isServing(1) ? `${t1Color()}20` : team1GamePoint() ? `${t1Color()}15` : undefined,
    "box-shadow": isServing(1) ? `0 0 20px 4px ${t1Color()}30` : undefined,
    border: isServing(1) || team1GamePoint() ? `2px solid ${t1Color()}` : '2px solid transparent',
    animation: isServing(1) ? undefined : undefined,
  }}
  classList={{
    'bg-surface-light': !isServing(1) && !team1GamePoint(),
  }}
  aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}`}
>
```

Do the same for Team 2 using `t2Color()`.

For the serve pulse animation, replace the hardcoded `pulse-glow` animation with a custom CSS variable:

```tsx
style={isServing(1) ? {
  "background-color": `${t1Color()}20`,
  border: `2px solid ${t1Color()}`,
  "box-shadow": `0 0 20px 4px ${t1Color()}30`,
} : team1GamePoint() ? {
  "background-color": `${t1Color()}15`,
  border: `2px solid ${t1Color()}`,
} : undefined}
```

Update the serving indicator text to use team color:
```tsx
<Show when={isServing(1)}>
  <span class="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: t1Color() }}>
    {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
  </span>
</Show>
<Show when={team1GamePoint()}>
  <span class="mt-1 text-xs font-bold uppercase tracking-wider animate-pulse" style={{ color: t1Color() }}>Game Point</span>
</Show>
```

Repeat analogous changes for Team 2.

**Step 2: Pass colors from ScoringPage**

In `ScoringPage.tsx`, add color props to both Scoreboard usages (portrait and landscape):

```tsx
<Scoreboard
  team1Name={props.match.team1Name}
  team2Name={props.match.team2Name}
  team1Score={ctx().team1Score}
  team2Score={ctx().team2Score}
  servingTeam={ctx().servingTeam}
  serverNumber={ctx().serverNumber}
  scoringMode={props.match.config.scoringMode}
  gameType={props.match.config.gameType}
  pointsToWin={props.match.config.pointsToWin}
  team1Color={props.match.team1Color}
  team2Color={props.match.team2Color}
/>
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 4: Commit**

```bash
git add src/features/scoring/components/Scoreboard.tsx src/features/scoring/ScoringPage.tsx
git commit -m "feat: scoreboard uses custom team colors for ring, glow, and indicators"
```

---

### Task 5: Swipe Gestures

**Files:**
- Create: `src/shared/hooks/useSwipeGesture.ts`
- Modify: `src/features/scoring/components/Scoreboard.tsx`

**Context:** Add swipe-right-to-score and swipe-left-to-undo on each team's score panel. Uses native pointer events, no library. Visual feedback via translateX during swipe.

**Step 1: Create useSwipeGesture hook**

Create `src/shared/hooks/useSwipeGesture.ts`:

```typescript
import { onCleanup } from 'solid-js';

interface SwipeConfig {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  minDistance?: number;
  maxVertical?: number;
}

export function useSwipeGesture(
  getElement: () => HTMLElement | undefined,
  config: SwipeConfig,
) {
  const minDist = config.minDistance ?? 50;
  const maxVert = config.maxVertical ?? 30;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onPointerDown = (e: PointerEvent) => {
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!tracking) return;
    const el = getElement();
    if (!el) return;
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    if (dy > maxVert) {
      tracking = false;
      el.style.transform = '';
      return;
    }
    // Damped slide: max 20px visual offset
    const clamped = Math.max(-20, Math.min(20, dx * 0.3));
    el.style.transform = `translateX(${clamped}px)`;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    const el = getElement();
    if (el) {
      el.style.transform = '';
      el.style.transition = 'transform 150ms ease-out';
      setTimeout(() => { if (el) el.style.transition = ''; }, 150);
    }
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    if (dy > maxVert) return;
    if (dx > minDist && config.onSwipeRight) config.onSwipeRight();
    if (dx < -minDist && config.onSwipeLeft) config.onSwipeLeft();
  };

  const onPointerCancel = () => {
    tracking = false;
    const el = getElement();
    if (el) el.style.transform = '';
  };

  // Attach after mount via setTimeout to ensure element exists
  setTimeout(() => {
    const el = getElement();
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
  }, 0);

  onCleanup(() => {
    const el = getElement();
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
  });
}
```

**Step 2: Add swipe callbacks to Scoreboard props**

In `Scoreboard.tsx`, add swipe callback props:

```typescript
interface Props {
  // ... existing props ...
  onSwipeScoreTeam1?: () => void;
  onSwipeScoreTeam2?: () => void;
  onSwipeUndo?: () => void;
}
```

Add refs and hook calls inside the component:

```typescript
let team1PanelRef: HTMLDivElement | undefined;
let team2PanelRef: HTMLDivElement | undefined;

useSwipeGesture(() => team1PanelRef, {
  onSwipeRight: props.onSwipeScoreTeam1,
  onSwipeLeft: props.onSwipeUndo,
});
useSwipeGesture(() => team2PanelRef, {
  onSwipeRight: props.onSwipeScoreTeam2,
  onSwipeLeft: props.onSwipeUndo,
});
```

Add `ref={team1PanelRef}` and `ref={team2PanelRef}` to the respective team panel divs. Also add `touch-action: pan-y` style to prevent horizontal scroll interference:

```tsx
<div
  ref={team1PanelRef}
  style={{ "touch-action": "pan-y", ... }}
  ...
>
```

**Step 3: Wire swipe callbacks in ScoringPage**

In `ScoringPage.tsx`, pass the swipe handlers to both Scoreboard instances:

```tsx
<Scoreboard
  ...
  onSwipeScoreTeam1={() => scorePoint(1)}
  onSwipeScoreTeam2={() => scorePoint(2)}
  onSwipeUndo={() => undo()}
/>
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 5: Commit**

```bash
git add src/shared/hooks/useSwipeGesture.ts src/features/scoring/components/Scoreboard.tsx src/features/scoring/ScoringPage.tsx
git commit -m "feat: swipe-right to score, swipe-left to undo on score panels"
```

---

## Group B: Sensory Experience (Tasks 6–8)

### Task 6: Install canvas-confetti & Celebration Hook

**Files:**
- Install: `canvas-confetti` npm package
- Create: `src/shared/hooks/useCelebration.ts`

**Context:** Celebration suite that fires on game/match win: confetti particles, screen flash, victory sound, haptic burst. Respects reduced motion and sound/haptic settings.

**Step 1: Install canvas-confetti**

Run: `npm install canvas-confetti`
Run: `npm install -D @types/canvas-confetti` (if types exist, otherwise skip)

**Step 2: Create useCelebration hook**

Create `src/shared/hooks/useCelebration.ts`:

```typescript
import confetti from 'canvas-confetti';
import { useSoundEffects } from './useSoundEffects';
import { useHaptics } from './useHaptics';
import { settings } from '../../stores/settingsStore';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hexToRgb(hex: string): string {
  return hex; // canvas-confetti accepts hex strings directly
}

export function useCelebration() {
  const sounds = useSoundEffects();
  const haptics = useHaptics();

  const gameWin = (teamColor: string) => {
    // Sound (always, if enabled)
    sounds.gameWin();

    // Haptic burst: double buzz
    if (settings().hapticFeedback) {
      try { navigator.vibrate([50, 30, 50]); } catch {}
    }

    // Visual (skip if reduced motion)
    if (prefersReducedMotion()) return;

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;z-index:45;pointer-events:none;background:${teamColor};opacity:0;transition:opacity 150ms;`;
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0.2'; });
    setTimeout(() => { flash.style.opacity = '0'; }, 150);
    setTimeout(() => { flash.remove(); }, 400);

    // Confetti burst from bottom center
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { x: 0.5, y: 1 },
      colors: [teamColor, '#facc15', '#ffffff'],
      disableForReducedMotion: true,
    });
  };

  const matchWin = (team1Color: string, team2Color: string) => {
    // Sound: fanfare
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047];
    const durations = [0.12, 0.12, 0.12, 0.3];
    let time = ctx.currentTime;
    const level = settings().soundEffects;
    if (level !== 'off') {
      const vol = level === 'subtle' ? 0.1 : 0.3;
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = vol;
        gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
        osc.start(time);
        osc.stop(time + durations[i]);
        time += durations[i] * 0.85;
      });
    }

    // Haptic: triple buzz crescendo
    if (settings().hapticFeedback) {
      try { navigator.vibrate([50, 30, 50, 30, 100]); } catch {}
    }

    if (prefersReducedMotion()) return;

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;z-index:45;pointer-events:none;background:${team1Color};opacity:0;transition:opacity 150ms;`;
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0.2'; });
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => { flash.remove(); }, 500);

    // Double confetti burst from both sides
    const colors = [team1Color, team2Color, '#facc15', '#ffffff'];
    confetti({ particleCount: 80, spread: 60, origin: { x: 0.2, y: 0.9 }, colors, disableForReducedMotion: true });
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.8, y: 0.9 }, colors, disableForReducedMotion: true });
    }, 200);
  };

  return { gameWin, matchWin };
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 4: Commit**

```bash
git add package.json package-lock.json src/shared/hooks/useCelebration.ts
git commit -m "feat: celebration hook with confetti, screen flash, victory sound, haptics"
```

---

### Task 7: Wire Celebrations into ScoringPage

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx`

**Context:** Trigger `gameWin()` when entering `betweenGames` state and `matchWin()` when entering `matchOver` state. Use the team colors from the loaded match.

**Step 1: Add celebration hook to ScoringView**

In `ScoringPage.tsx`, import and use the celebration hook inside `ScoringView`:

```typescript
import { useCelebration } from '../../shared/hooks/useCelebration';
import { DEFAULT_TEAM1_COLOR, DEFAULT_TEAM2_COLOR } from '../../shared/constants/teamColors';
```

Inside the ScoringView component:
```typescript
const celebration = useCelebration();
const t1Color = () => props.match.team1Color ?? DEFAULT_TEAM1_COLOR;
const t2Color = () => props.match.team2Color ?? DEFAULT_TEAM2_COLOR;
```

**Step 2: Add effect to watch state changes**

Import `createEffect` and `on` from 'solid-js', then add after the state signals:

```typescript
import { Switch, Match, Show, createResource, onCleanup, onMount, createSignal, createEffect, on } from 'solid-js';
```

```typescript
// Celebration trigger
createEffect(on(stateName, (name, prev) => {
  if (prev === undefined) return;
  if (name === 'betweenGames') {
    const winnerColor = winningSide() === 1 ? t1Color() : t2Color();
    celebration.gameWin(winnerColor);
  }
  if (name === 'matchOver') {
    celebration.matchWin(t1Color(), t2Color());
  }
}));
```

Note: `stateName` is already a function (`stateName()` returns the current state), but for `on()` we need an accessor. Since `stateName` is already defined as `const stateName = () => { ... }`, it works as an accessor directly.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "feat: trigger celebrations on game/match win with team colors"
```

---

### Task 8: Voice Score Announcements

**Files:**
- Create: `src/shared/hooks/useVoiceAnnouncements.ts`
- Modify: `src/features/scoring/ScoringPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Context:** Web Speech API hook that announces scores and game events. Three levels: off, scores only, full commentary. Listens to state machine context changes.

**Step 1: Create useVoiceAnnouncements hook**

Create `src/shared/hooks/useVoiceAnnouncements.ts`:

```typescript
import { settings } from '../../stores/settingsStore';

function speak(text: string) {
  const level = settings().voiceAnnouncements;
  if (level === 'off') return;
  if (!('speechSynthesis' in window)) return;

  // Cancel any queued speech to prevent overlap
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.volume = 0.8;
  speechSynthesis.speak(utterance);
}

interface ScoreState {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
}

interface VoiceConfig {
  team1Name: string;
  team2Name: string;
  scoringMode: 'sideout' | 'rally';
  gameType: 'singles' | 'doubles';
  pointsToWin: number;
}

export function useVoiceAnnouncements(config: VoiceConfig) {
  const level = () => settings().voiceAnnouncements;

  const announceScore = (state: ScoreState) => {
    if (level() === 'off') return;

    // Build score call
    if (config.scoringMode === 'sideout' && config.gameType === 'doubles') {
      const serving = state.servingTeam === 1 ? state.team1Score : state.team2Score;
      const receiving = state.servingTeam === 1 ? state.team2Score : state.team1Score;
      speak(`${serving} ${receiving} ${state.serverNumber}`);
    } else {
      speak(`${state.team1Score} ${state.team2Score}`);
    }
  };

  const announceSideOut = () => {
    if (level() !== 'full') return;
    speak('Side out');
  };

  const announceGamePoint = (teamName: string) => {
    if (level() !== 'full') return;
    speak(`Game point, ${teamName}`);
  };

  const announceMatchPoint = (teamName: string) => {
    if (level() !== 'full') return;
    speak(`Match point, ${teamName}`);
  };

  const announceDeuce = () => {
    if (level() !== 'full') return;
    speak('Deuce');
  };

  const announceGameOver = (teamName: string, gameNumber: number, score1: number, score2: number) => {
    if (level() !== 'full') return;
    speak(`${teamName} wins game ${gameNumber}, ${score1} to ${score2}`);
  };

  const announceMatchOver = (teamName: string, gamesWon1: number, gamesWon2: number) => {
    if (level() !== 'full') return;
    speak(`${teamName} wins the match, ${gamesWon1} to ${gamesWon2}`);
  };

  const announceFirstServer = () => {
    if (level() !== 'full') return;
    speak('First server');
  };

  const announceSecondServer = () => {
    if (level() !== 'full') return;
    speak('Second server');
  };

  return {
    announceScore,
    announceSideOut,
    announceGamePoint,
    announceMatchPoint,
    announceDeuce,
    announceGameOver,
    announceMatchOver,
    announceFirstServer,
    announceSecondServer,
  };
}
```

**Step 2: Integrate voice into ScoringPage**

In `ScoringPage.tsx`, import and use the voice hook inside ScoringView:

```typescript
import { useVoiceAnnouncements } from '../../shared/hooks/useVoiceAnnouncements';
```

Inside ScoringView:
```typescript
const voice = useVoiceAnnouncements({
  team1Name: props.match.team1Name,
  team2Name: props.match.team2Name,
  scoringMode: props.match.config.scoringMode,
  gameType: props.match.config.gameType,
  pointsToWin: props.match.config.pointsToWin,
});
```

Add a `createEffect` that watches the context for score changes and announces:

```typescript
createEffect(on(
  () => ({ ...ctx(), state: stateName() }),
  (current, prev) => {
    if (!prev) return;

    // Score changed — announce score
    if (current.team1Score !== prev.team1Score || current.team2Score !== prev.team2Score) {
      voice.announceScore(current);

      // Check for game point / match point / deuce
      const target = props.match.config.pointsToWin;
      const t1Near = current.team1Score >= target - 1 && current.team1Score > current.team2Score;
      const t2Near = current.team2Score >= target - 1 && current.team2Score > current.team1Score;
      const deuce = current.team1Score >= target - 1 && current.team2Score >= target - 1 && current.team1Score === current.team2Score;

      if (deuce) {
        setTimeout(() => voice.announceDeuce(), 1200);
      } else if (t1Near || t2Near) {
        const teamName = t1Near ? props.match.team1Name : props.match.team2Name;
        setTimeout(() => voice.announceGamePoint(teamName), 1200);
      }
    }

    // Side out
    if (current.servingTeam !== prev.servingTeam) {
      voice.announceSideOut();
    }

    // Server number changed within same team
    if (current.serverNumber !== prev.serverNumber && current.servingTeam === prev.servingTeam) {
      voice.announceSecondServer();
    }

    // Game over
    if (current.state === 'betweenGames' && prev.state !== 'betweenGames') {
      const winner = current.gamesWon[0] > prev.gamesWon[0] ? props.match.team1Name : props.match.team2Name;
      voice.announceGameOver(winner, current.gameNumber - 1, current.team1Score, current.team2Score);
    }

    // Match over
    if (current.state === 'matchOver' && prev.state !== 'matchOver') {
      voice.announceMatchOver(winnerName(), current.gamesWon[0], current.gamesWon[1]);
    }
  },
));
```

**Step 3: Add Voice section to SettingsPage**

In `SettingsPage.tsx`, add a Voice section after the Haptics section:

```tsx
{/* Voice Announcements */}
<fieldset>
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    Voice
  </legend>
  <div class="grid grid-cols-3 gap-3">
    <OptionCard
      label="Off"
      selected={settings().voiceAnnouncements === 'off'}
      onClick={() => setSettings({ voiceAnnouncements: 'off' })}
    />
    <OptionCard
      label="Scores"
      selected={settings().voiceAnnouncements === 'scores'}
      onClick={() => setSettings({ voiceAnnouncements: 'scores' })}
    />
    <OptionCard
      label="Full"
      selected={settings().voiceAnnouncements === 'full'}
      onClick={() => setSettings({ voiceAnnouncements: 'full' })}
    />
  </div>
</fieldset>
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 5: Commit**

```bash
git add src/shared/hooks/useVoiceAnnouncements.ts src/features/scoring/ScoringPage.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: voice score announcements (Web Speech API) with off/scores/full levels"
```

---

## Group C: Platform Polish (Tasks 9–11)

### Task 9: Shareable Score Cards

**Files:**
- Create: `src/shared/utils/renderScoreCard.ts`
- Create: `src/shared/utils/shareScoreCard.ts`
- Modify: `src/features/scoring/ScoringPage.tsx` (add Share button on matchOver)
- Modify: `src/features/history/components/MatchCard.tsx` (add Share button)

**Context:** Canvas API renders a branded 1080x1080 score card image. Share via Web Share API with clipboard and download fallbacks.

**Step 1: Create renderScoreCard utility**

Create `src/shared/utils/renderScoreCard.ts`:

```typescript
import type { Match } from '../../data/types';

export function renderScoreCard(match: Match): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  const t1Color = match.team1Color ?? '#22c55e';
  const t2Color = match.team2Color ?? '#f97316';

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, '#161625');
  grad.addColorStop(1, '#1e1e2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Logo wordmark
  ctx.textAlign = 'center';
  ctx.font = '700 48px Oswald, system-ui, sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('Pickle', 480, 100);
  ctx.fillStyle = '#facc15';
  ctx.fillText('Score', 640, 100);

  // Date
  ctx.font = '400 28px system-ui, sans-serif';
  ctx.fillStyle = '#a0aec0';
  ctx.fillText(new Date(match.startedAt).toLocaleDateString(), 540, 150);

  // VS divider line
  ctx.strokeStyle = '#363650';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(540, 220);
  ctx.lineTo(540, 800);
  ctx.stroke();

  // Team 1 (left side)
  ctx.textAlign = 'center';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = t1Color;
  ctx.fillText(match.team1Name, 270, 300);

  // Team 2 (right side)
  ctx.fillStyle = t2Color;
  ctx.fillText(match.team2Name, 810, 300);

  // Scores per game
  match.games.forEach((game, i) => {
    const y = 420 + i * 120;

    // Game label
    ctx.font = '400 24px system-ui, sans-serif';
    ctx.fillStyle = '#a0aec0';
    ctx.fillText(`Game ${game.gameNumber}`, 540, y - 30);

    // Team 1 score
    ctx.font = '700 72px Oswald, system-ui, sans-serif';
    ctx.fillStyle = game.winningSide === 1 ? t1Color : '#e2e8f0';
    ctx.fillText(String(game.team1Score), 270, y + 40);

    // Team 2 score
    ctx.fillStyle = game.winningSide === 2 ? t2Color : '#e2e8f0';
    ctx.fillText(String(game.team2Score), 810, y + 40);
  });

  // Winner banner
  const winnerName = match.winningSide === 1 ? match.team1Name : match.team2Name;
  const winnerColor = match.winningSide === 1 ? t1Color : t2Color;
  ctx.font = '700 40px Oswald, system-ui, sans-serif';
  ctx.fillStyle = winnerColor;
  ctx.fillText(`${winnerName} Wins!`, 540, 900);

  // Match info
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillStyle = '#a0aec0';
  const mode = match.config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally';
  const type = match.config.gameType === 'doubles' ? 'Doubles' : 'Singles';
  ctx.fillText(`${type} · ${mode} · To ${match.config.pointsToWin}`, 540, 950);

  // Watermark
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Scored with PickleScore', 540, 1040);

  return canvas;
}
```

**Step 2: Create shareScoreCard utility**

Create `src/shared/utils/shareScoreCard.ts`:

```typescript
import type { Match } from '../../data/types';
import { renderScoreCard } from './renderScoreCard';

export async function shareScoreCard(match: Match): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const canvas = renderScoreCard(match);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const file = new File([blob], `picklescore-${match.id.slice(0, 8)}.png`, { type: 'image/png' });

    // Try Web Share API
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'PickleScore Result',
        files: [file],
      });
      return 'shared';
    }

    // Fallback: clipboard
    if (navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        return 'copied';
      } catch {
        // Clipboard failed, try download
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
```

**Step 3: Add Share button to match completion in ScoringPage**

In `ScoringPage.tsx`, import the share utility:

```typescript
import { shareScoreCard } from '../../shared/utils/shareScoreCard';
```

Add a `[shareStatus, setShareStatus]` signal:
```typescript
const [shareStatus, setShareStatus] = createSignal<string | null>(null);
```

In the `matchOver` Match block, add a Share button after the "Save & Finish" button:

```tsx
<button
  type="button"
  onClick={async () => {
    const freshMatch = await matchRepository.getById(props.match.id);
    if (!freshMatch) return;
    const completedMatch = { ...freshMatch, team1Color: props.match.team1Color, team2Color: props.match.team2Color };
    const result = await shareScoreCard(completedMatch);
    setShareStatus(result === 'shared' ? 'Shared!' : result === 'copied' ? 'Copied to clipboard!' : result === 'downloaded' ? 'Downloaded!' : 'Share failed');
    setTimeout(() => setShareStatus(null), 2000);
  }}
  class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
>
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
  {shareStatus() ?? 'Share Score Card'}
</button>
```

**Step 4: Add Share button to MatchCard**

In `MatchCard.tsx`, add a small share icon button:

```typescript
import { createSignal } from 'solid-js';
import { shareScoreCard } from '../../../shared/utils/shareScoreCard';
```

Inside the component:
```typescript
const [sharing, setSharing] = createSignal(false);

const handleShare = async () => {
  setSharing(true);
  await shareScoreCard(props.match);
  setSharing(false);
};
```

Add a share button in the header row (next to the date/time):

```tsx
<div class="flex items-center justify-between">
  <span class="text-xs text-on-surface-muted">{date()} {time()}</span>
  <div class="flex items-center gap-2">
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing()}
      class="p-1.5 rounded-lg text-on-surface-muted hover:text-primary transition-colors"
      aria-label="Share score card"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    </button>
    <span class="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
      {m().config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally'}
    </span>
  </div>
</div>
```

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 6: Commit**

```bash
git add src/shared/utils/renderScoreCard.ts src/shared/utils/shareScoreCard.ts src/features/scoring/ScoringPage.tsx src/features/history/components/MatchCard.tsx
git commit -m "feat: shareable score cards with Web Share, clipboard, and download fallbacks"
```

---

### Task 10: Full Tablet/iPad Layout

**Files:**
- Modify: `src/shared/components/PageLayout.tsx`
- Modify: `src/shared/components/BottomNav.tsx`
- Modify: `src/features/scoring/GameSetupPage.tsx`
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/players/PlayersPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Context:** At `md:` breakpoint (768px+), switch from single-column to two-column grid layouts. Bump max-width from `max-w-xl` to `max-w-3xl`.

**Step 1: Update PageLayout max-width**

In `PageLayout.tsx`, change the max-width on the main content div:

```tsx
<div class="max-w-lg mx-auto md:max-w-3xl">
```

Also update the header:
```tsx
<div class="max-w-lg mx-auto md:max-w-3xl">
```

**Step 2: Update BottomNav max-width**

In `BottomNav.tsx`, update:

```tsx
<div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1">
```

**Step 3: GameSetupPage two-column layout**

Wrap the form in a responsive grid. Replace the outer `<div class="p-4 space-y-6 pb-24">` with:

```tsx
<div class="p-4 pb-24">
  {/* Quick Game + Divider stay full-width */}
  {/* Quick Game button JSX */}
  {/* Divider JSX */}

  {/* Two-column grid for the form */}
  <div class="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0 mt-6">
    {/* Left column: Game options */}
    <div class="space-y-6">
      {/* Game Type fieldset */}
      {/* Scoring fieldset */}
      {/* Points to Win fieldset */}
      {/* Match Format fieldset */}
    </div>
    {/* Right column: Teams */}
    <div class="space-y-6">
      {/* Teams fieldset with color pickers */}
    </div>
  </div>
</div>
```

**Step 4: HistoryPage two-column grid**

In `HistoryPage.tsx`, change the For wrapper to use a grid at tablet:

```tsx
<div class="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
  <For each={matches()}>
    {(match) => <MatchCard match={match} />}
  </For>
</div>
```

**Step 5: PlayersPage two-column layout**

In `PlayersPage.tsx`, wrap form + list in a grid:

```tsx
<div class="p-4 md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0">
  <div>
    <AddPlayerForm />
  </div>
  <div>
    <Show when={...} fallback={...}>
      <div class="space-y-2">
        <For each={players()}>{...}</For>
      </div>
    </Show>
  </div>
</div>
```

**Step 6: SettingsPage two-column layout**

In `SettingsPage.tsx`, wrap setting groups in a grid:

```tsx
<div class="p-4 md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
  <div class="space-y-6">
    {/* Screen, Sound Effects, Haptics, Voice */}
  </div>
  <div class="space-y-6">
    {/* Default Scoring, Points to Win, Match Format */}
  </div>
</div>
{/* App Info stays full-width below */}
<div class="flex flex-col items-center gap-2 pt-4 pb-4">
  <Logo size="md" />
  <p class="text-xs text-on-surface-muted">v1.0 — Offline-first pickleball scoring</p>
</div>
```

**Step 7: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 8: Commit**

```bash
git add src/shared/components/PageLayout.tsx src/shared/components/BottomNav.tsx src/features/scoring/GameSetupPage.tsx src/features/history/HistoryPage.tsx src/features/players/PlayersPage.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: tablet two-column layout at md: breakpoint (768px+)"
```

---

### Task 11: Outdoor/High-Contrast Mode

**Files:**
- Modify: `src/styles.css`
- Modify: `src/stores/settingsStore.ts` (already done in Task 1)
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `index.html`

**Context:** Toggle between dark mode and outdoor/high-contrast mode. Outdoor mode swaps all CSS custom properties via `.outdoor` class on `<html>`. All existing Tailwind classes using `bg-surface`, `text-on-surface` etc. automatically adapt.

**Step 1: Add outdoor mode CSS**

In `src/styles.css`, add after the `@theme` block:

```css
/* Outdoor/High-Contrast Mode */
html.outdoor {
  --color-surface: #ffffff;
  --color-surface-light: #f1f5f9;
  --color-surface-lighter: #e2e8f0;
  --color-surface-deep: #f8fafc;
  --color-on-surface: #0f172a;
  --color-on-surface-muted: #475569;
  --color-score: #ca8a04;
  --color-primary-glow: rgba(34, 197, 94, 0.1);
  --color-accent-glow: rgba(249, 115, 22, 0.1);
  --color-score-glow: rgba(202, 138, 4, 0.15);
}

html.outdoor .skeleton {
  background: linear-gradient(90deg, var(--color-surface-light) 25%, var(--color-surface-lighter) 50%, var(--color-surface-light) 75%);
}
```

**Step 2: Apply display mode class in App.tsx**

In `src/app/App.tsx`, add a `createEffect` that toggles the `.outdoor` class and updates `theme-color` meta tag:

```typescript
import { createEffect } from 'solid-js';
import { settings } from '../stores/settingsStore';
```

Inside the component, before the return:
```typescript
createEffect(() => {
  const mode = settings().displayMode;
  document.documentElement.classList.toggle('outdoor', mode === 'outdoor');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', mode === 'outdoor' ? '#ffffff' : '#1e1e2e');
  }
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) {
    colorScheme.setAttribute('content', mode === 'outdoor' ? 'light' : 'dark');
  }
});
```

**Step 3: Add Display Mode section to SettingsPage**

In `SettingsPage.tsx`, add a Display section at the top (before Screen):

```tsx
{/* Display Mode */}
<fieldset>
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    Display
  </legend>
  <div class="grid grid-cols-2 gap-3">
    <OptionCard
      label="Dark"
      description="Indoor / night"
      selected={settings().displayMode === 'dark'}
      onClick={() => setSettings({ displayMode: 'dark' })}
    />
    <OptionCard
      label="Outdoor"
      description="Bright / sunlight"
      selected={settings().displayMode === 'outdoor'}
      onClick={() => setSettings({ displayMode: 'outdoor' })}
    />
  </div>
</fieldset>
```

**Step 4: Add outdoor score size bump**

In `src/styles.css`, add a rule that increases score font size in outdoor mode:

```css
html.outdoor .text-7xl {
  font-size: 5.5rem; /* ~20% larger than 4.5rem */
}
```

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 6: Commit**

```bash
git add src/styles.css src/app/App.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: outdoor/high-contrast mode with light palette and larger scores"
```

---

## Execution Groups Summary

| Group | Tasks | Can Parallelize |
|-------|-------|----------------|
| **A** | 1 (foundation), 2 (Quick Game), 3 (Color Picker), 4 (Scoreboard colors), 5 (Swipe) | Task 1 first, then 2+3+5 parallel, then 4 after 3 |
| **B** | 6 (Celebration hook), 7 (Wire celebrations), 8 (Voice) | 6→7 sequential, 8 independent |
| **C** | 9 (Score Cards), 10 (Tablet), 11 (Outdoor) | 10+11 parallel, 9 after colors exist |

**Suggested pipeline:**
- **G1**: Task 1 (foundation) — commit
- **G2**: Tasks 2 + 3 + 5 in parallel — commit each
- **G3**: Task 4 (needs Task 3 colors) — commit
- **G4**: Tasks 6 + 8 in parallel — commit each
- **G5**: Task 7 (needs Task 6) — commit
- **G6**: Tasks 9 + 10 + 11 in parallel — commit each
