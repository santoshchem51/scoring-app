# Pickleball Scoring App - UI/UX Competitive Research

**Date**: 2026-02-14
**Purpose**: Best-in-class UI/UX patterns for a pickleball scoring PWA that feels like a $50M startup product, not a weekend side project.

---

## 1. Top Scoring Apps - Competitive Analysis

### 1A. Pickleball-Specific Apps

#### PicklePlay (pickleplay.com)
- **What they do well**: Court finder + social features create stickiness beyond just scoring. Clean white-and-green brand. Simple onboarding. The app focuses on connecting players to courts and events, not primarily live scoring.
- **Where they fall short**: Scoring is not the core experience. The app is more of a social/scheduling platform. Users on app stores complain about bugs in matchmaking and events, but rarely rave about the scoring UI itself because it is basic.
- **Key takeaway**: PicklePlay proves that the pickleball space lacks a dedicated, beautiful scoring app. Their scoring is an afterthought. This is your gap.

#### DUPR (dupr.com)
- **What they do well**: Clean, data-driven UI. Dark navy/blue palette with bright accents. Rating number is the hero element (giant, bold, front-and-center). Match result entry is streamlined. Strong card-based layout with clear hierarchy. Professional-feeling typography. They nailed the "seriousness" of competitive pickleball.
- **Where they fall short**: DUPR is a rating system, not a live scorer. Match entry is post-hoc. The app is slow and heavy. Users complain about rating accuracy and app performance, not the visual design.
- **Key takeaway**: DUPR proves that pickleball players respond to a premium-feeling, data-rich dark UI. Steal their typographic confidence and card hierarchy, but outperform them on speed and live interaction.

#### Scoreholio (scoreholio.com)
- **What they do well**: Tournament bracket management is their strength. Bracket visualization is clear. They handle complex tournament structures (round robin, double elimination). The scoring interface is functional for tournament directors.
- **Where they fall short**: UI is utilitarian/functional, not beautiful. Designed for tournament organizers, not casual players. The live scoring flow feels like filling out a form, not an immersive experience. Visual design is dated (lots of white space, basic form elements, small text).
- **Key takeaway**: Scoreholio is optimized for tournament directors at a table with an iPad, not players courtside with a phone. Your app should be optimized for the opposite: courtside, one-handed, in sunlight, between points.

#### PB Score / Pickleball Score Counter (various App Store apps)
- **What they do well**: Simple, single-purpose. Big score numbers. Fast to start a game.
- **Where they fall short**: Most look like they were built in a weekend. Generic UI, no personality, no delight. Basic counter apps with no match history, no stats, no persistence. Many use default system fonts and colors.
- **Key takeaway**: The bar is LOW. Most pickleball scoring apps are counter apps with two big numbers and two plus buttons. Any serious design effort will stand out massively.

### 1B. Other Sports Scoring Apps (Cross-Sport Benchmarks)

#### GameTime Scoreboard (iOS/Android)
- **What they do well**: Beautiful full-screen scoreboard mode. Configurable for many sports. High-contrast colors designed for readability. Support for scoreboard display on external screens/TVs.
- **Pattern to steal**: Full-screen "scoreboard mode" that hides all chrome and just shows scores. Great for spectators or when mounted courtside.

#### ScoreKeeper (various platforms)
- **What they do well**: Clean material design. Supports many sports. Customizable team colors. Match history timeline view.
- **Pattern to steal**: Per-team color customization. The ability for each team to have its own accent color creates visual identity and makes the interface instantly scannable.

#### ESPN / CBS Sports / Apple Sports
- **What they do well**: Apple Sports especially nails the live scoring experience with real-time animations, a dark UI, bold typography, and a glanceable design. Score updates animate smoothly. The app opens instantly to live scores. Information hierarchy is masterful: score is huge, everything else is secondary.
- **Pattern to steal**: Apple Sports' "glanceable" design philosophy. You should be able to glance at the screen for 0.5 seconds and know the score, who's serving, and the game count. Nothing else should compete for attention.

#### NBA / NFL Official Apps
- **What they do well**: Live activity widgets, dynamic color themes per team, rich animations for scoring events, dark mode with team-colored accents.
- **Pattern to steal**: Dynamic theming. When Team 1 scores, the whole screen subtly flashes their color. It creates emotional connection to the scoring action.

### 1C. What Users Consistently Praise and Complain About (Across All Scoring Apps)

**Universal praise:**
- "Easy to use with one hand"
- "Big numbers I can see from far away"
- "Starts fast, no sign-up required"
- "Works without internet"
- "Remembers my games"

**Universal complaints:**
- "Accidentally tapped the wrong button" (need undo + confirmation for critical actions)
- "Screen went to sleep mid-game" (wake lock is mandatory)
- "Can't see it in sunlight" (low-contrast dark themes fail outdoors)
- "Too many taps to start a game" (onboarding friction kills)
- "Lost my match data" (persistence/backup is critical)
- "Ads ruin the experience" (an ad-free, clean experience is a differentiator)

---

## 2. Mobile Sports App UX Trends 2025-2026

### 2A. Visual Design Trends

#### Dark Mode as Default (Not Just an Option)
- Sports apps in 2025-2026 overwhelmingly default to dark mode. Apple Sports, DUPR, Strava's activity screens, Nike Run Club all lean dark. Dark mode signals "premium" in the sports category. It also reduces eye strain in varied lighting and reduces battery drain on OLED screens (relevant for courtside use).
- **Specific recommendation**: Your dark theme is correct. But go beyond flat dark backgrounds. Use layered surfaces with subtle elevation (surface, surface-light, surface-lighter is a good start). Add subtle gradients on hero elements (score backgrounds).

#### "Athletic Minimalism" Over Glassmorphism/Neumorphism
- Glassmorphism (frosted glass effects) peaked around 2022-2023 and is now seen as decorative/distracting for utilitarian apps. Neumorphism never gained traction in sports apps because it has poor contrast and is terrible in sunlight.
- The current trend is **"athletic minimalism"**: bold type, high contrast, generous whitespace, monochromatic with one or two bright accent colors, aggressive font weights (800-900), and zero unnecessary decoration.
- **Specific recommendation**: Skip glassmorphism and neumorphism entirely. Instead invest in typography quality. Use a premium sports-feeling font like Inter (for UI), paired with a display font for scores (tabular figures are mandatory).

#### Bold Typography & Tabular Figures
- Score numbers should be the single most prominent element on screen. 2025-2026 trend is toward extremely large (72-120px), extra-bold (800-900 weight) score displays.
- **Tabular figures** (monospaced numbers) are mandatory so digits don't jump around as scores change. Your current `tabular-nums` class is correct.
- **Specific recommendation**: Consider bumping score display to `text-8xl` or even `text-9xl`. The score should be readable from 6-8 feet away (someone on the adjacent court glancing over). Use `font-variant-numeric: tabular-nums` and test with scores like "0" vs "11" to ensure no layout shift.

#### Animated Transitions (Purposeful, Not Decorative)
- The 2025-2026 standard is "motion with meaning": transitions that convey state change, not just eye candy. Apple's Human Interface Guidelines and Material Design 3 both emphasize purposeful motion.
- Scoring apps benefit from: score increment animations (number rolls up), serve indicator transitions (smooth slide), game completion celebrations (brief, 1-2 seconds max).
- **Specific recommendation**: Every state change should have a micro-transition (150-300ms). Score changes should animate (counter rolling). Serve indicator should slide smoothly between teams. But during active play, animations must NEVER delay the next tap.

#### High-Contrast Color Systems
- The trend is away from pastel accents and toward high-saturation, high-contrast accent colors. Neon greens, electric blues, bright oranges on dark backgrounds.
- **Your current palette analysis**: `#22c55e` (green-500) as primary and `#f97316` (orange-500) as accent is solid. `#facc15` (yellow-400) for scores is excellent for visibility. These are high-saturation colors that read well on dark backgrounds and in sunlight.

### 2B. Interaction Design Trends

#### Gesture-First Navigation
- Bottom sheet patterns, swipe-to-dismiss, pull-to-refresh, swipe between tabs are now expected, not optional. Users expect apps to respond to gestures the same way native apps do.
- **Specific recommendation**: Consider swipe-left/right on the scoring screen to switch between "score view" and "stats view" during a game.

#### Haptic Feedback as Standard
- In 2025, haptic feedback on score taps is expected in premium sports apps. The Taptic Engine / Vibration API is widely supported.
- **Specific recommendation**: `navigator.vibrate(10)` on score tap (light), `navigator.vibrate([10, 50, 10])` on game complete (double pulse), `navigator.vibrate([10, 30, 10, 30, 10])` on match complete (celebration). Note: Vibration API is not available on iOS Safari. For iOS, you can use AudioContext to trigger a tiny click sound as a substitute.

#### Skeleton Screens Over Spinners
- Loading spinners are a 2019 pattern. 2025-2026 uses skeleton screens (animated placeholder shapes) or instant/optimistic UI. Your app should never show a spinner because it is offline-first with local data -- data should be available instantly.
- **Specific recommendation**: Eliminate all loading states for local data. If match history takes time to query from IndexedDB (it should not, but just in case), show a skeleton of MatchCard shapes, not "Loading...".

---

## 3. Scoring-Specific UX Patterns

### 3A. Button Design for Live Scoring

#### The "Fat Finger" Problem
- Courtside use means sweaty fingers, rushed taps between rallies, possible glove use. Buttons must be LARGE.
- **Minimum tap target**: 48px is the WCAG minimum. For scoring apps, the standard is 64-80px tall and full-width (or half-width in a 2-column grid).
- Your current `py-6` on score buttons is approximately 72px total height with text. This is good. Do not go smaller.

#### The "Wrong Button" Problem
- The #1 user complaint in scoring app reviews is accidentally tapping the wrong team's score button. Solutions used by top apps:
  1. **Spatial separation**: Score buttons for Team 1 and Team 2 should be clearly separated (your 2-column grid is correct).
  2. **Color differentiation**: Each team's button should be a distinctly different color (you have green vs orange, which is excellent -- also colorblind-safe since it is not red vs green).
  3. **Confirmation for corrections**: Undo should be extremely easy (one tap, no confirmation dialog). The undo button should always be visible.
  4. **Visual feedback**: On tap, the button should have an obvious pressed state (scale + color change + haptic).

#### The "Scorekeeper's Thumb" Layout
- Research pattern from real scorekeepers: the person scoring usually holds the phone in one hand (left or right) and taps with their thumb. Buttons should be in the **bottom half** of the screen, reachable by thumb. The score display should be in the **top half**, visible at a glance.
- **Specific recommendation**: Your current layout already places controls below the scoreboard. Ensure the entire scoring area (buttons) is within thumb reach. Consider a "flip" option that swaps which team is on which side (left-handed vs right-handed scorekeepers).

### 3B. Outdoor/Sunlight Readability

#### The Sunlight Problem
- Outdoor pickleball means direct sunlight hitting the screen. This is the #1 environmental challenge.
- **Solutions used by successful outdoor apps (running, cycling, golf)**:
  1. **Ultra-high contrast**: Score numbers should be white or bright yellow on a very dark background. Minimum contrast ratio of 7:1 (WCAG AAA). Your `#facc15` (yellow) on `#1e1e2e` (dark surface) has a contrast ratio of approximately 9.5:1 -- excellent.
  2. **Large font sizes**: Scores should be readable at arm's length in sunlight. 72px minimum for score digits.
  3. **Avoid light/pastel colors for important information**: Pastel colors wash out in sunlight. Everything critical should be saturated/bold.
  4. **Optional "high visibility" mode**: Some running apps offer a mode that cranks up font size and contrast even further. Consider an explicit "outdoor mode" that increases score size to fill the screen and uses black backgrounds with white/yellow text only.
  5. **Avoid pure white backgrounds**: White backgrounds in sunlight create glare. Dark mode is genuinely better outdoors.

### 3C. Sound Design

#### Audio Feedback Patterns
- Premium scoring apps use subtle audio cues:
  - **Score tap**: Short, crisp "tick" or "pop" sound (< 100ms)
  - **Game point**: A distinct tone that signals "this is game point" without being annoying
  - **Game complete**: Brief celebration sound (chime, horn, whistle -- keep it under 1.5 seconds)
  - **Undo**: A reverse/rewind sound effect
- **Key rule**: All sounds must be optional and default to OFF or SUBTLE. Nothing is more annoying than someone else's scoring app beeping on the next court.
- **Specific recommendation**: Implement sounds using Web Audio API (not `<audio>` elements) for zero-latency playback. Provide a sound toggle in settings. Consider three levels: Off, Subtle (score taps only), Full (all events).

### 3D. Score Announcement Patterns

#### The "0-0-2" Problem (Unique to Pickleball)
- Pickleball's side-out scoring produces the iconic three-number call: "serving team score - receiving team score - server number." Example: "4-2-1" means serving team has 4, receiving has 2, server #1.
- **The killer feature that no app does well**: Automatically announce the score in the correct pickleball format after each point. Display "4-2-1" prominently. Consider text-to-speech announcement.
- **Specific recommendation**: Add a prominent score call display. For side-out scoring, show the three-number score call in large text: `{servingTeamScore}-{receivingTeamScore}-{serverNumber}`. This is what players actually say out loud before each serve, and seeing it on screen is immediately useful.

---

## 4. PWA UX Best Practices - Feeling Native

### 4A. Critical "Native Feel" Patterns

#### App Shell Architecture
- Load the app shell (header, nav, layout) instantly from cache. Content fills in from IndexedDB. The user should never see a white screen or "loading" page.
- **Your current state**: The PageLayout + BottomNav are the app shell. These should be visible within 100ms of opening the app.

#### Disable Browser Behaviors
- **Pull-to-refresh**: PWAs in standalone mode should disable the browser's pull-to-refresh (which navigates away from the app). Use `overscroll-behavior-y: contain` on the html/body element.
- **Rubber-band scrolling**: On iOS, the overscroll "bounce" feels webby. Disable with `overflow: hidden` on root and manage scroll within specific containers.
- **Text selection**: Disable text selection on interactive elements (score display, buttons) to prevent accidental selection on long-press.
- **Double-tap zoom**: Disable with `touch-action: manipulation` on the html element.
- **Context menu on long-press**: Disable with `-webkit-touch-callout: none` on interactive elements.

```css
/* Critical PWA native-feel CSS */
html {
  overscroll-behavior-y: contain;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
}

/* Allow selection only in text inputs */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}
```

#### Smooth Page Transitions
- Native apps have smooth slide transitions between pages. PWAs that jump instantly between routes feel like websites.
- **Specific recommendation**: Use the View Transitions API (`document.startViewTransition()`) for page transitions. SolidJS supports this via `@solidjs/router`'s transition hooks. Implement a slide-right transition for "going deeper" and slide-left for "going back."

#### Status Bar Integration
- Set the status bar color to match your app's header with `<meta name="theme-color">`. On iOS, use `apple-mobile-web-app-status-bar-style` set to `black-translucent` for a fully immersive feel.
- **Specific recommendation**: Use `theme_color: '#1e1e2e'` (your surface color) so the status bar blends seamlessly into your dark header.

#### Install Prompt
- Implement a custom install prompt that appears after the user has used the app 2-3 times (not on first visit). Use the `beforeinstallprompt` event.
- **Specific recommendation**: Show a subtle banner after the user completes their first game: "Install Pickle Score for a full-screen experience." Do not show it before they have gotten value from the app.

### 4B. Offline UX Patterns

#### Offline Indicators
- Since your app is offline-first, the default state IS offline. Do not show "You are offline" as a warning. Instead, show "Sync available" or a cloud icon when the user IS online (for future cloud sync).
- **Anti-pattern to avoid**: Big yellow/red "OFFLINE" banners. Your app works offline by design. Treat offline as the normal state.

#### Conflict-Free Local Operations
- Every operation (score a point, start a game, view history) should work instantly with no network dependency. Never show a spinner for a local operation.

---

## 5. Micro-Interactions & Animations

### 5A. Score Change Animation

The single most important animation in a scoring app. This is what users see 50+ times per game.

#### Counter Roll Animation
- When the score changes from 7 to 8, the digit should "roll" upward (old digit slides up and fades, new digit slides in from below). This is the pattern used by Apple Sports, ESPN, and every premium live score display.
- Duration: 200-300ms, ease-out curve.
- **Implementation**: Use CSS transitions on the score digit container. When the score signal changes, animate `transform: translateY(-100%)` on the old number and `translateY(0)` on the new number.

```css
.score-digit-enter {
  animation: slideUp 250ms ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

#### Score Panel Pulse
- When a team scores, their score panel should briefly "pulse" -- a subtle scale up (1.02-1.05x) and back, or a brief background color flash (their team color at 30% opacity, fading to normal).
- Duration: 300ms total.
- **This is what separates "professional" from "student project."**

### 5B. Serve Indicator Transition

#### Smooth Serve Slide
- When serve changes sides (side-out), the serve indicator should not just appear/disappear. It should smoothly slide from one team's panel to the other.
- **Implementation**: Use `transform: translateX()` with a transition. The serve indicator ball/badge animates its X position from the left panel to the right panel.
- Consider a brief "rotation" animation when the server number changes (1 -> 2) within the same team.

### 5C. Game Completion Celebration

#### The "Match Point" Build-Up
- When a team reaches match point (e.g., score is 10 in a game to 11), add a subtle visual indicator -- a pulsing border on their score panel, or "GAME POINT" text that fades in. Build anticipation.

#### Game Complete Animation
- When a game ends: confetti burst (lightweight CSS/canvas confetti, not a heavy library), the winning score pulses and glows, and the game score comparison animates in.
- Duration: 1.5-2 seconds max. Must have a "tap anywhere to dismiss" escape hatch. Never block the user from continuing.
- **Key reference**: Duolingo's lesson-complete animation is the gold standard for "celebratory but not annoying."

#### Match Complete Celebration
- Match completion should be more dramatic than game completion. Larger confetti, the winner's name animates in with scale, final score comparison shows all games.
- **Key rule**: Keep it brief. Players want to shake hands and move on, not watch a 5-second animation.

### 5D. Undo Feedback

#### Reverse Animation
- When the user taps "Undo," the score should animate in REVERSE -- the digit rolls down instead of up. This creates a visceral sense of "rewinding time."
- The undo button itself should show a brief checkmark or "Done" state after tapping to confirm the action was registered.

### 5E. Button Press Feedback

#### The "Pressed" State
- Your current `active:scale-95` is a solid foundation. Enhance it:
  - Add `active:brightness-90` for a subtle darkening effect.
  - Combine with haptic feedback (Vibration API).
  - Consider a brief "ripple" effect originating from the tap point (Material Design style) but simpler -- just a radial background pulse.
- **Critical**: The pressed state must be INSTANT. No 150ms delay. Use `touch-action: manipulation` and ensure no `:hover` states on mobile interfere with `:active` states.

### 5F. Page Transitions

#### Route Change Animations
- **Forward navigation** (e.g., Home -> Game Setup -> Live Score): Slide in from right.
- **Backward navigation** (e.g., Live Score -> History): Slide in from left.
- **Tab switching** (bottom nav): Cross-fade (150ms).
- Duration: 200-300ms, ease-in-out.
- Use the View Transitions API for native-like smoothness.

---

## 6. Design System for a Sports Scoring App

### 6A. Color Palette

#### Primary Palette (Current)
Your current colors are well-chosen. Here is a refined version with additional utility colors:

```
// Core
--color-surface:          #0f0f1a    // Deeper black (upgrade from #1e1e2e for better contrast)
--color-surface-raised:   #1a1a2e    // Cards, panels (was surface-light)
--color-surface-overlay:  #252540    // Modals, sheets (was surface-lighter)
--color-border:           #2a2a45    // Subtle borders

// Text
--color-text-primary:     #f0f0f5    // Primary text (slightly warmer than pure white)
--color-text-secondary:   #8888a0    // Secondary/muted text
--color-text-score:       #facc15    // Score display (bright yellow - your current choice is great)

// Accents
--color-team-1:           #22c55e    // Green (serve team / team 1 default)
--color-team-2:           #f97316    // Orange (team 2 default)
--color-accent-info:      #3b82f6    // Blue (informational)
--color-accent-danger:    #ef4444    // Red (destructive actions, errors)
--color-accent-warning:   #eab308    // Yellow (match point indicator)

// Semantic
--color-serving:          #22c55e    // Serving indicator
--color-game-point:       #eab308    // Game point indicator
--color-victory:          #a855f7    // Victory/celebration (purple -- unique, celebratory)
```

#### Why This Palette Works for Sports
1. **High saturation accents on low-saturation backgrounds**: Score and team colors pop.
2. **Green + Orange**: Distinct even for most colorblind users (deuteranopia can distinguish green vs orange because of brightness difference). Avoid red+green.
3. **Yellow for scores**: Yellow is the highest-visibility color on dark backgrounds. Used by scoreboards worldwide for a reason.
4. **Deeper surface color**: Moving from `#1e1e2e` to `#0f0f1a` increases contrast ratio with all text and accent colors. OLED screens will render this as true black, saving battery.

### 6B. Typography Scale

#### Recommended Type Scale
Use a modular scale (1.25 ratio) anchored to the score display:

```
Score Display:    96px / 800 weight / tabular-nums    (text-8xl or custom)
Score Secondary:  48px / 700 weight / tabular-nums    (game score, set score)
Page Title:       24px / 700 weight                    (h1)
Section Title:    16px / 600 weight / uppercase / tracking-wider  (section headers)
Body:             16px / 400 weight                    (descriptions, info)
Body Small:       14px / 400 weight                    (timestamps, metadata)
Caption:          12px / 500 weight / uppercase / tracking-wider  (labels, badges)
Button Primary:   18px / 700 weight                    (CTA buttons)
Button Secondary: 14px / 600 weight                    (secondary actions)
```

#### Font Recommendations
- **UI font**: Inter (already loaded by most browsers, excellent tabular figures, clean and athletic). Alternative: Plus Jakarta Sans (slightly rounder, more "friendly").
- **Score display**: Inter with `font-variant-numeric: tabular-nums`. Or for even more impact, use a dedicated display font like "DM Sans" (extra bold looks great at large sizes) or "Outfit" (geometric, modern, athletic).
- **Avoid**: Serif fonts (too formal), handwriting fonts (unprofessional), system fonts (generic feeling).

### 6C. Spacing System

Use a 4px base grid with a component spacing scale:

```
--space-xs:   4px    // Inline spacing, icon gaps
--space-sm:   8px    // Related element spacing
--space-md:   12px   // Component internal padding
--space-lg:   16px   // Component external margins, section spacing
--space-xl:   24px   // Section gaps
--space-2xl:  32px   // Page section gaps
--space-3xl:  48px   // Major layout gaps
```

#### Touch Target Sizes
```
Minimum tap target:        48px x 48px (WCAG requirement)
Primary action button:     Full-width x 56-64px
Score button:              Half-width x 72-80px
Bottom nav item:           48px x 48px
Icon button:               44px x 44px (with 48px visible hit area via padding)
```

### 6D. Border Radius System

Use a consistent radius scale:

```
--radius-sm:   8px     // Badges, small elements
--radius-md:   12px    // Cards, input fields
--radius-lg:   16px    // Panels, larger cards
--radius-xl:   24px    // Score panels, CTAs
--radius-full: 9999px  // Pills, circular elements
```

Your current `rounded-xl` (12px) and `rounded-2xl` (16px) usage is good. Consider `rounded-3xl` (24px) for score panels to make them feel more "app-like" and less "web-form-like."

### 6E. Icon Style

- **Line icons** (stroke-based, 2px stroke) for navigation and secondary actions. This matches your current SVG icon approach.
- **Filled icons** for active/selected states in bottom nav.
- **Custom iconography** for sport-specific elements: pickleball paddle, serve indicator, etc. Consider a custom serve indicator that uses a small pickleball icon rather than just text.
- **Icon size**: 24px standard, 20px in compact contexts, 28px in headers.

### 6F. Elevation & Depth

Instead of drop shadows (which don't read well on dark backgrounds), use:
- **Surface color layers**: Each level of elevation is a slightly lighter shade of the dark background.
- **Subtle borders**: 1px borders at `--color-border` opacity to define card edges.
- **Glow effects for emphasis**: Instead of shadows, use a subtle glow (box-shadow with a colored, transparent shadow) on active/highlighted elements.

```css
/* Glow effect for serving team panel */
.score-panel-serving {
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.15),
              0 0 40px rgba(34, 197, 94, 0.05);
}
```

---

## 7. Accessibility in Sports Apps

### 7A. Voice Announcements

#### Screen Reader Support
- Every score change should trigger a live region announcement: `aria-live="polite"` on the score display. When the score changes, the screen reader announces "Team 1: 7, Team 2: 5, Server 2 serving."
- Game completion should use `aria-live="assertive"`: "Game over. Team 1 wins 11 to 7."

#### Optional Audio Score Calls
- Implement text-to-speech score announcements using the Web Speech API (`speechSynthesis.speak()`). This is distinct from screen reader support -- it's a feature any user can enable to hear the score called out loud.
- **Use case**: In noisy environments or for referees who need hands-free score announcements.
- **Implementation**: After each point, call `speechSynthesis.speak(new SpeechSynthesisUtterance("4 - 2 - 1"))` with the pickleball score format.

### 7B. High Contrast Mode

#### System Preference Detection
- Detect `prefers-contrast: more` media query and automatically increase contrast:
  - Score text becomes pure white on pure black
  - Button borders become thicker (2px -> 3px)
  - All muted text becomes full-opacity text
  - Remove any decorative opacity/transparency effects

#### Manual "Outdoor Mode"
- A toggle in settings that switches to an ultra-high-contrast theme:
  - Pure black background (#000000)
  - Score in pure white (#FFFFFF) at maximum size
  - Buttons with thick white borders
  - All decorative elements removed
  - This is effectively an accessibility feature disguised as a usability feature.

### 7C. Adjustable Text Size

#### Dynamic Type Support
- Respect the user's system font size preference. Use `rem` units for all text sizes so they scale with the root font size.
- **Specific recommendation**: Test your UI at 150% and 200% font scale. The scoring screen must not break at 200%.
- Consider a settings toggle: "Score Size" with options Small / Medium / Large / Extra Large.

### 7D. Reduced Motion

- Detect `prefers-reduced-motion: reduce` and disable all animations:
  - Score changes are instant (no roll animation)
  - Page transitions are instant (no slide)
  - Celebrations are static (no confetti, just text)
- This is a WCAG requirement, not optional.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7E. Color Independence

- Never convey information through color alone. The serve indicator uses color (green for serving team) but also includes text ("Serving" / "Server 1"). This is correct.
- Team identification should use position (left = team 1, right = team 2) AND color AND name. Your current layout handles this well.

### 7F. Focus Management

- For keyboard / switch control users, ensure a logical tab order through the scoring interface: Score button Team 1 -> Score button Team 2 -> Side Out -> Undo.
- Active game controls should receive focus automatically when the scoring state changes.

---

## 8. The "$50M Startup" Differentiators

### What separates a professional product from a side project:

1. **Instant startup**: The app opens in <500ms to the last-used screen. No splash screen (or a 200ms branded splash max). The scoring screen is immediately interactive.

2. **Zero-config first game**: Tap "Quick Game" and you are scoring in 2 taps. No team names required. No settings required. Defaults are smart (doubles, side-out, to 11). Setup is available but never required.

3. **Score call display**: Show "4-2-1" (the traditional pickleball score call) prominently. No other app does this well. It is the single most pickleball-specific UX element possible.

4. **Haptic language**: Different haptic patterns for different events create a physical language. Point scored = single tap. Side out = double tap. Game point = long pulse. Match over = celebration pattern.

5. **Ambient awareness**: Show game point status automatically. Show "Switch sides" reminder at the appropriate score in tournament play. Show "First server gets one serve" at game start. The app knows the rules so the player does not have to remember.

6. **Match resume**: If the app crashes or the browser closes, the match resumes exactly where it left off (you already have this with `lastSnapshot`).

7. **Export/share**: After a match, offer "Share result" that generates a beautiful score card image (canvas-rendered) for social media. This is a growth hack and a delight feature.

8. **Seasonal/contextual themes**: Special court-colored themes (indoor blue, outdoor green), tournament mode with bracket colors, special themes for holidays or pickleball events.

9. **Sound design**: Professional-quality, custom sound effects. Not beeps -- actual designed sounds. Think of the iOS keyboard click, or the Wordle tile flip sound. These tiny details signal quality.

10. **Micro-copy**: Every piece of text should feel like it was written by a person who plays pickleball. "Side Out!" not "Serve Change." "Game Point!" not "Match Point Approaching." "First server rule applies" not "Initial serve limitation active."

---

## 9. Specific Improvements to Current Implementation

Based on the codebase review, here are the highest-impact UI/UX improvements ordered by priority:

### P0 - Must Have (Users will notice absence)

1. **Add PWA native-feel CSS**: Add `overscroll-behavior`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, and user-select controls to `styles.css`.

2. **Score animation**: Add a counter-roll animation to the `text-7xl` score display in `Scoreboard.tsx`. Currently, scores just jump from one number to the next.

3. **Haptic feedback**: Add `navigator.vibrate()` calls to `ScoreControls.tsx` button handlers.

4. **Score call display**: Add the traditional "X-Y-Z" pickleball score call below the scoreboard in `ScoringPage.tsx`.

5. **Game point indicator**: Detect game point state and show a visual indicator (pulsing border, "GAME POINT" text).

### P1 - Should Have (Users will feel the difference)

6. **Serve transition animation**: Animate the serve indicator smoothly between teams instead of instant swap.

7. **Score panel pulse**: Add a brief pulse animation to the scoring team's panel when they score.

8. **Page transitions**: Add View Transitions API integration to route changes.

9. **Deeper surface color**: Darken the base surface color from `#1e1e2e` to `#0f0f1a` or `#111122` for more contrast and OLED-friendliness.

10. **Quick start flow**: Add a "Quick Game" button that starts a game with defaults (doubles, side-out, 11, Team 1 vs Team 2) in one tap.

### P2 - Nice to Have (Delighters that create word-of-mouth)

11. **Game completion celebration**: Add a brief confetti/celebration animation on game/match end.

12. **Sound effects**: Add optional audio feedback for scoring events.

13. **Outdoor mode**: Add a high-contrast outdoor mode toggle.

14. **Score sharing**: Generate a shareable score card image after match completion.

15. **Voice announcements**: Add optional text-to-speech score calls using Web Speech API.

---

## Sources and References

- **Apple Human Interface Guidelines - Motion**: https://developer.apple.com/design/human-interface-guidelines/motion
- **Material Design 3 - Motion**: https://m3.material.io/styles/motion/overview
- **WCAG 2.2 - Target Size**: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **Web.dev - PWA Checklist**: https://web.dev/pwa-checklist/
- **View Transitions API**: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
- **Vibration API**: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- **Wake Lock API**: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock
- **PicklePlay App**: https://www.pickleplay.com
- **DUPR**: https://www.dupr.com
- **Scoreholio**: https://www.scoreholio.com
- **Apple Sports App**: Available on iOS as built-in app
- **Strava Design Language**: https://www.strava.com
- **ESPN App**: https://www.espn.com/apps
