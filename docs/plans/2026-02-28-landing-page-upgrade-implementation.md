# Landing Page Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the landing page with GSAP scroll animations, Lenis smooth scroll, and glassmorphism hero — two prototypes (Premium vs Creative) in separate worktrees.

**Architecture:** Animation modules are pure TS functions in `src/features/landing/animations/` that take DOM elements and return GSAP timelines/ScrollTriggers. Lenis bridges to GSAP's ticker. All lazy-loaded on the landing route. Both prototypes share Tasks 1-4, then diverge.

**Tech Stack:** GSAP + ScrollTrigger, Lenis, SolidJS 1.9, TypeScript, Vitest

---

## Phase 1: Shared Foundation (both worktrees)

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install gsap and lenis**

```bash
npm install gsap lenis
```

**Step 2: Verify installation**

```bash
node -e "require('gsap'); require('lenis'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install gsap and lenis for landing page animations"
```

---

### Task 2: Create Lenis init module with tests

**Files:**
- Create: `src/features/landing/animations/initLenis.ts`
- Create: `src/features/landing/animations/__tests__/initLenis.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/features/landing/animations/__tests__/initLenis.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock gsap and lenis before imports
vi.mock('gsap', () => {
  const ticker = { add: vi.fn(), remove: vi.fn() };
  return {
    default: { registerPlugin: vi.fn(), ticker },
    gsap: { registerPlugin: vi.fn(), ticker },
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { update: vi.fn(), refresh: vi.fn(), killAll: vi.fn() },
}));

vi.mock('lenis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      destroy: vi.fn(),
      raf: vi.fn(),
    })),
  };
});

describe('initLenis', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('returns a cleanup function', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const { initLenis } = await import('../initLenis');
    const cleanup = initLenis();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('returns noop cleanup when reduced motion is preferred', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { initLenis } = await import('../initLenis');
    const cleanup = initLenis();
    expect(typeof cleanup).toBe('function');
    cleanup(); // should not throw
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/landing/animations/__tests__/initLenis.test.ts
```
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/features/landing/animations/initLenis.ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function initLenis(): () => void {
  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  const lenis = new Lenis({
    lerp: 0.1,
    touchMultiplier: 1.5,
  });

  // Bridge Lenis scroll events to GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // Drive Lenis from GSAP's ticker for frame-perfect sync
  const tickerCallback = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0); // prevent GSAP from compensating for lag

  return () => {
    gsap.ticker.remove(tickerCallback);
    lenis.destroy();
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/landing/animations/__tests__/initLenis.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/features/landing/animations/initLenis.ts src/features/landing/animations/__tests__/initLenis.test.ts
git commit -m "feat: add Lenis smooth scroll init with GSAP ticker bridge"
```

---

### Task 3: Create barrel export with lazy loading

**Files:**
- Create: `src/features/landing/animations/index.ts`

**Step 1: Create barrel**

```typescript
// src/features/landing/animations/index.ts
export { initLenis } from './initLenis';
```

**Step 2: Commit**

```bash
git add src/features/landing/animations/index.ts
git commit -m "feat: add animations barrel export"
```

---

### Task 4: Replace hero radial gradient with glassmorphism card

**Files:**
- Modify: `src/features/landing/LandingPage.tsx:79`

**Step 1: Replace the hero content wrapper**

Change line 79 from:
```tsx
<div class="relative z-10 max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl rounded-2xl px-6 py-8" style={{ "background": "radial-gradient(ellipse at center, rgba(15, 17, 24, 0.85) 0%, rgba(15, 17, 24, 0.6) 60%, transparent 100%)" }}>
```

To:
```tsx
<div class="relative z-10 max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl rounded-2xl px-8 py-10 backdrop-blur-md border border-white/5" style={{ "background": "rgba(15, 17, 24, 0.5)" }}>
```

**Step 2: Verify visually**

```bash
npx vite --port 5199
```
Open http://localhost:5199 — hero text should be readable with frosted glass effect, waves visible through blur.

**Step 3: Run all tests**

```bash
npx vitest run
```
Expected: All 460 tests pass (no test changes needed — visual-only change)

**Step 4: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "feat: replace hero radial gradient with glassmorphism card"
```

---

## Phase 2A: Premium Product Site (worktree `landing-premium`)

### Task 5A: Hero entrance animation

**Files:**
- Create: `src/features/landing/animations/heroAnimations.ts`
- Create: `src/features/landing/animations/__tests__/heroAnimations.test.ts`
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Write failing tests**

```typescript
// src/features/landing/animations/__tests__/heroAnimations.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('gsap', () => {
  const tl = {
    from: vi.fn().mockReturnThis(),
    to: vi.fn().mockReturnThis(),
    kill: vi.fn(),
  };
  return {
    default: { timeline: vi.fn(() => tl), matchMedia: vi.fn() },
    gsap: { timeline: vi.fn(() => tl), matchMedia: vi.fn() },
  };
});

describe('createHeroEntrance (premium)', () => {
  it('returns a GSAP timeline with kill method', async () => {
    const { createHeroEntrance } = await import('../heroAnimations');
    const els = {
      logo: document.createElement('div'),
      headline: document.createElement('div'),
      subtext: document.createElement('div'),
      ctas: document.createElement('div'),
      card: document.createElement('div'),
    };
    const tl = createHeroEntrance(els);
    expect(tl).toBeDefined();
    expect(typeof tl.kill).toBe('function');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement hero entrance (Premium style)**

```typescript
// src/features/landing/animations/heroAnimations.ts
import { gsap } from 'gsap';

export interface HeroElements {
  logo: HTMLElement;
  headline: HTMLElement;
  subtext: HTMLElement;
  ctas: HTMLElement;
  card: HTMLElement;
}

export function createHeroEntrance(els: HeroElements) {
  const tl = gsap.timeline({ delay: 0.1 });

  // Set initial hidden state
  gsap.set([els.logo, els.headline, els.subtext, els.ctas], {
    opacity: 0,
    y: 20,
  });

  tl.to(els.logo, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' })
    .to(els.headline, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, '-=0.1')
    .to(els.subtext, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1')
    .to(els.ctas, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1')
    .to(els.card, {
      borderColor: 'rgba(255,255,255,0.1)',
      duration: 0.4,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: 1,
    }, '-=0.3');

  return tl;
}
```

**Step 4: Add refs to LandingPage.tsx hero elements**

Add `let` refs for logo, headline, subtext, ctas, card inside the component. Use `ref={el}` on each element. In `onMount`, dynamically import animations and call:

```typescript
onMount(async () => {
  const { initLenis } = await import('./animations');
  const { createHeroEntrance } = await import('./animations/heroAnimations');
  const lenisCleanup = initLenis();
  const heroTl = createHeroEntrance({ logo: logoEl, headline: headlineEl, subtext: subtextEl, ctas: ctasEl, card: cardEl });
  onCleanup(() => { heroTl.kill(); lenisCleanup(); });
});
```

**Step 5: Run tests, commit**

```bash
npx vitest run src/features/landing
git add -A && git commit -m "feat: add premium hero entrance animation with GSAP"
```

---

### Task 6A: Scroll-triggered section reveals (Premium)

**Files:**
- Create: `src/features/landing/animations/scrollAnimations.ts`
- Create: `src/features/landing/animations/__tests__/scrollAnimations.test.ts`
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Write failing tests**

```typescript
// src/features/landing/animations/__tests__/scrollAnimations.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('gsap', () => ({
  gsap: { from: vi.fn(), set: vi.fn(), matchMedia: vi.fn() },
  default: { from: vi.fn(), set: vi.fn(), matchMedia: vi.fn() },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: vi.fn(), killAll: vi.fn() },
}));

describe('setupScrollAnimations (premium)', () => {
  it('returns a cleanup function', async () => {
    const { setupScrollAnimations } = await import('../scrollAnimations');
    const sections = {
      features: document.createElement('div'),
      steps: document.createElement('div'),
      tournaments: document.createElement('div'),
      finalCta: document.createElement('div'),
    };
    const cleanup = setupScrollAnimations(sections);
    expect(typeof cleanup).toBe('function');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement scroll animations (Premium style)**

```typescript
// src/features/landing/animations/scrollAnimations.ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface SectionElements {
  features: HTMLElement;
  steps: HTMLElement;
  tournaments: HTMLElement | null;
  finalCta: HTMLElement;
}

export function setupScrollAnimations(sections: SectionElements): () => void {
  const triggers: ScrollTrigger[] = [];

  // Feature cards: fade up, stagger
  const featureCards = sections.features.querySelectorAll(':scope > div > div');
  if (featureCards.length) {
    gsap.set(featureCards, { opacity: 0, y: 40 });
    triggers.push(
      ScrollTrigger.create({
        trigger: sections.features,
        start: 'top 80%',
        onEnter: () => {
          gsap.to(featureCards, {
            opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
            stagger: 0.08,
          });
        },
        once: true,
      })
    );
  }

  // How It Works: sequential fade up
  const stepCards = sections.steps.querySelectorAll(':scope > div > div');
  if (stepCards.length) {
    gsap.set(stepCards, { opacity: 0, y: 30 });
    triggers.push(
      ScrollTrigger.create({
        trigger: sections.steps,
        start: 'top 80%',
        onEnter: () => {
          gsap.to(stepCards, {
            opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
            stagger: 0.15,
          });
        },
        once: true,
      })
    );
  }

  // Final CTA: scale in
  gsap.set(sections.finalCta, { opacity: 0, scale: 0.97 });
  triggers.push(
    ScrollTrigger.create({
      trigger: sections.finalCta,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(sections.finalCta, {
          opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out',
        });
      },
      once: true,
    })
  );

  return () => {
    triggers.forEach(t => t.kill());
  };
}
```

**Step 4: Wire into LandingPage.tsx**

Add refs to feature section, steps section, final CTA section. Add `data-section` attributes for querying. In `onMount`, call `setupScrollAnimations()`. Remove `stagger-in` CSS class from feature grid (GSAP handles it now).

**Step 5: Run all tests, verify visually, commit**

```bash
npx vitest run
git add -A && git commit -m "feat: add premium scroll-triggered section reveals"
```

---

### Task 7A: Final polish and cleanup (Premium)

- Update `animations/index.ts` barrel to export all modules
- Remove unused CSS `stagger-in` class from feature section
- Run full test suite: `npx vitest run` (all pass)
- Type check: `npx tsc --noEmit` (clean)
- Build: `npx vite build` (success)
- Commit

---

## Phase 2B: Creative Showcase (worktree `landing-creative`)

### Task 5B: Hero entrance animation (Creative)

Same file structure as 5A but with dramatic animations:

```typescript
// heroAnimations.ts — Creative version
export function createHeroEntrance(els: HeroElements & { headlineWords: HTMLElement[] }) {
  const tl = gsap.timeline({ delay: 0.1 });

  // Glass card scales in with overshoot
  gsap.set(els.card, { opacity: 0, scale: 0.85 });
  tl.to(els.card, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' });

  // Logo drops with bounce
  gsap.set(els.logo, { opacity: 0, y: -30 });
  tl.to(els.logo, { opacity: 1, y: 0, duration: 0.4, ease: 'bounce.out' }, 0.2);

  // Headline words animate individually
  gsap.set(els.headlineWords, { opacity: 0, y: 30, rotateX: 10 });
  tl.to(els.headlineWords, {
    opacity: 1, y: 0, rotateX: 0,
    duration: 0.3, ease: 'power3.out',
    stagger: 0.08,
  }, 0.4);

  // Subtext fades
  gsap.set(els.subtext, { opacity: 0, y: 20 });
  tl.to(els.subtext, { opacity: 1, y: 0, duration: 0.3 }, 0.9);

  // CTAs spring in
  gsap.set(els.ctas, { opacity: 0, scale: 0.8 });
  tl.to(els.ctas, {
    opacity: 1, scale: 1,
    duration: 0.4, ease: 'elastic.out(1, 0.5)',
  }, 1.1);

  return tl;
}
```

**LandingPage.tsx changes:** Split headline into 3 `<span>` elements:
```tsx
<p class="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 text-gradient" style={{ "font-family": "var(--font-score)" }}>
  <span ref={word1El}>Score. </span>
  <span ref={word2El}>Organize. </span>
  <span ref={word3El}>Compete.</span>
</p>
```

---

### Task 6B: Scroll-triggered section reveals (Creative)

Same structure as 6A but with dramatic transforms:

- Feature cards: `scale:0.85→1, y:60→0, rotateX:5→0`, stagger 100ms
- How It Works: alternate `x:-80→0` / `x:80→0` per step, `back.out(1.2)`
- Tournament cards: `rotation:-3→0, y:50→0`, stagger 80ms
- Final CTA: `scale:0.8→1` with `elastic.out`

---

### Task 7B: Canvas parallax (Creative only)

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`
- Modify: `src/features/landing/animations/scrollAnimations.ts`

Add a ScrollTrigger with `scrub: true` on the canvas section:
```typescript
ScrollTrigger.create({
  trigger: heroSection,
  start: 'top top',
  end: 'bottom top',
  scrub: true,
  animation: gsap.to(canvasWrapper, { y: -100, ease: 'none' }),
});
```

This makes the canvas scroll at ~0.5x speed relative to content.

---

### Task 8B: Final polish and cleanup (Creative)

Same as 7A — barrel exports, remove old CSS stagger-in, full test suite, type check, build.

---

## Phase 3: Compare and Choose

After both worktrees are built:
1. Run both dev servers on different ports
2. User compares side-by-side
3. Pick winner or mix elements from both
4. Merge chosen branch to main
