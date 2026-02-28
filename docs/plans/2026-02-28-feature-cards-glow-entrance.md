# Feature Cards Glow Burst Entrance — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the underwhelming scroll entrance on the "Everything You Need" feature cards with a dramatic border-trace glow + blur-to-sharp materialize effect, each card glowing in its own accent color.

**Architecture:** All changes live in `scrollAnimations.ts`. For each card, we inject a temporary overlay `<div>` with a `conic-gradient` border that GSAP animates from 0% to 100% coverage. Simultaneously, the card itself deblurs and scales in. Overlays are removed after animation completes. Accent colors are read from the existing `--card-accent` CSS variable already set on each card.

**Tech Stack:** GSAP + ScrollTrigger (already installed), CSS `conic-gradient` + `mask`, CSS `filter: blur()`

---

### Task 1: Write failing test — border trace overlay injection

**Files:**
- Test: `src/features/landing/animations/__tests__/scrollAnimations.test.ts`

**Step 1: Write the failing test**

Add a test that verifies feature cards get a `.glow-trace` overlay injected during scroll animation setup.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep existing mocks, they're fine

describe('setupScrollAnimations — glow entrance', () => {
  let featuresEl: HTMLElement;
  let gridEl: HTMLElement;
  let innerEl: HTMLElement;

  function makeCard(hero: boolean, accentRgb: string): HTMLElement {
    const card = document.createElement('div');
    if (hero) card.classList.add('lg:col-span-2');
    card.style.setProperty('--card-accent', `rgba(${accentRgb}, 0.1)`);
    card.style.setProperty('--card-accent-border', `rgba(${accentRgb}, 0.25)`);
    card.setAttribute('data-accent-rgb', accentRgb);
    return card;
  }

  beforeEach(() => {
    featuresEl = document.createElement('div');
    gridEl = document.createElement('div');
    innerEl = document.createElement('div');
    featuresEl.appendChild(gridEl);
    gridEl.appendChild(innerEl);
  });

  it('injects .glow-trace overlay into each feature card', async () => {
    const hero1 = makeCard(true, '34, 197, 94');
    const hero2 = makeCard(true, '245, 158, 11');
    const compact1 = makeCard(false, '139, 92, 246');
    innerEl.appendChild(hero1);
    innerEl.appendChild(hero2);
    innerEl.appendChild(compact1);

    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: document.createElement('div'),
      tournaments: null,
      finalCta: document.createElement('div'),
    });

    expect(hero1.querySelector('.glow-trace')).toBeTruthy();
    expect(hero2.querySelector('.glow-trace')).toBeTruthy();
    expect(compact1.querySelector('.glow-trace')).toBeTruthy();
  });

  it('sets initial hidden state with blur on feature cards', async () => {
    const { gsap } = await import('gsap');
    const hero = makeCard(true, '34, 197, 94');
    innerEl.appendChild(hero);

    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: document.createElement('div'),
      tournaments: null,
      finalCta: document.createElement('div'),
    });

    // gsap.set should be called with blur in the filter
    const setCalls = (gsap.set as ReturnType<typeof vi.fn>).mock.calls;
    const heroSetCall = setCalls.find(
      (c: unknown[]) => c[0] === hero && typeof c[1] === 'object' && 'filter' in (c[1] as Record<string, unknown>)
    );
    expect(heroSetCall).toBeTruthy();
    expect((heroSetCall![1] as Record<string, unknown>).filter).toContain('blur');
  });

  it('cleanup removes .glow-trace overlays', async () => {
    const hero = makeCard(true, '34, 197, 94');
    innerEl.appendChild(hero);

    const { setupScrollAnimations } = await import('../scrollAnimations');
    const cleanup = setupScrollAnimations({
      features: featuresEl,
      steps: document.createElement('div'),
      tournaments: null,
      finalCta: document.createElement('div'),
    });

    expect(hero.querySelector('.glow-trace')).toBeTruthy();
    cleanup();
    expect(hero.querySelector('.glow-trace')).toBeFalsy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: FAIL — no `.glow-trace` elements injected, no `filter: blur` in gsap.set calls

---

### Task 2: Implement border trace overlay injection + initial hidden state

**Files:**
- Modify: `src/features/landing/animations/scrollAnimations.ts` (lines 16–63, the feature card section)

**Step 1: Add helper to create border trace overlay**

Add this function above `setupScrollAnimations`:

```typescript
/**
 * Creates a border-trace overlay div with conic-gradient for the glow animation.
 * The overlay traces the card border using a conic-gradient mask.
 */
function createGlowTrace(card: HTMLElement, accentRgb: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'glow-trace';
  overlay.style.cssText = `
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    pointer-events: none;
    z-index: 2;
    opacity: 0;
    border: 2px solid transparent;
    background: conic-gradient(from 0deg, rgba(${accentRgb}, 0.8), rgba(${accentRgb}, 0.3) 30%, transparent 50%) border-box;
    -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  `;
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  card.appendChild(overlay);
  return overlay;
}

/** Reads the accent RGB from the data attribute or falls back to green */
function getAccentRgb(card: HTMLElement): string {
  return card.getAttribute('data-accent-rgb') ?? '34, 197, 94';
}
```

**Step 2: Replace the feature card animation block (lines 16–63)**

Replace the entire `featureCards.forEach(...)` block with:

```typescript
  // Feature cards: glow border trace + blur-to-sharp materialize
  const featureCards = Array.from(
    sections.features.querySelectorAll(':scope > div > div > div')
  ) as HTMLElement[];

  const glowOverlays: HTMLElement[] = [];
  let compactIndex = 0;

  featureCards.forEach((card) => {
    const isHero = card.classList.contains('lg:col-span-2');
    const accentRgb = getAccentRgb(card);
    const overlay = createGlowTrace(card, accentRgb);
    glowOverlays.push(overlay);

    if (isHero) {
      // Hero cards: blur + scale down, dramatic entrance
      gsap.set(card, { opacity: 0, scale: 0.85, filter: 'blur(8px)' });
      gsap.set(overlay, { opacity: 0 });

      const delay = compactIndex === 0 ? 0 : 0.15; // stagger between two hero cards
      compactIndex++;

      triggers.push(
        ScrollTrigger.create({
          trigger: card,
          start: 'top 90%',
          onEnter: () => {
            // Phase 1: Border traces in
            gsap.to(overlay, {
              opacity: 1,
              duration: 0.5,
              delay,
              ease: 'power2.inOut',
              onComplete: () => {
                // Phase 3: Glow pulse then fade
                gsap.to(card, {
                  boxShadow: `0 0 30px rgba(${accentRgb}, 0.3), 0 0 60px rgba(${accentRgb}, 0.1)`,
                  duration: 0.3,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(card, {
                      boxShadow: '0 0 0px transparent',
                      duration: 0.6,
                      ease: 'power2.inOut',
                    });
                    gsap.to(overlay, { opacity: 0, duration: 0.5, delay: 0.3 });
                  },
                });
              },
            });
            // Phase 2: Card materializes (deblur + scale)
            gsap.to(card, {
              opacity: 1, scale: 1, filter: 'blur(0px)',
              duration: 0.6, ease: 'power2.out',
              delay: delay + 0.15,
            });
          },
          once: true,
        })
      );
    } else {
      // Compact cards: rise + deblur, faster border trace
      const staggerDelay = 0.4 + (compactIndex - 2) * 0.15; // offset after hero cards
      // Note: compactIndex starts at 2 because hero cards incremented it
      gsap.set(card, { opacity: 0, y: 30, scale: 0.9, filter: 'blur(6px)' });
      gsap.set(overlay, { opacity: 0 });

      triggers.push(
        ScrollTrigger.create({
          trigger: card,
          start: 'top 90%',
          onEnter: () => {
            // Border trace (faster for compact)
            gsap.to(overlay, {
              opacity: 1,
              duration: 0.35,
              delay: staggerDelay,
              ease: 'power2.inOut',
              onComplete: () => {
                gsap.to(card, {
                  boxShadow: `0 0 20px rgba(${accentRgb}, 0.25)`,
                  duration: 0.25,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(card, {
                      boxShadow: '0 0 0px transparent',
                      duration: 0.5,
                      ease: 'power2.inOut',
                    });
                    gsap.to(overlay, { opacity: 0, duration: 0.4, delay: 0.2 });
                  },
                });
              },
            });
            // Card materializes
            gsap.to(card, {
              opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
              duration: 0.5, ease: 'power2.out',
              delay: staggerDelay + 0.1,
            });
          },
          once: true,
        })
      );
      compactIndex++;
    }
  });
```

**Step 3: Update cleanup to remove overlays**

In the return cleanup function, add overlay removal before `triggers.forEach`:

```typescript
  return () => {
    glowOverlays.forEach(el => el.remove());
    triggers.forEach(t => t.kill());
  };
```

But `glowOverlays` must be accessible in the closure — it already is since it's declared inside `setupScrollAnimations`.

**Step 4: Run tests**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: All 4 tests PASS (1 old + 3 new)

**Step 5: Commit**

```bash
git add src/features/landing/animations/scrollAnimations.ts src/features/landing/animations/__tests__/scrollAnimations.test.ts
git commit -m "feat: glow border trace + blur materialize entrance for feature cards"
```

---

### Task 3: Add `data-accent-rgb` attributes to feature cards in LandingPage

**Files:**
- Modify: `src/features/landing/LandingPage.tsx` (line ~170, the feature card div)

The animation reads accent colors via `data-accent-rgb`. Add this attribute to each card.

**Step 1: Add the data attribute**

In `LandingPage.tsx`, find the feature card `<div>` (around line 169–176) and add the data attribute to the style object block:

```tsx
              <div
                use:tilt={{ maxDeg: f.hero ? 4 : 6, scale: 1.0 }}
                data-accent-rgb={f.accentRgb}
                class={`bg-surface-light rounded-xl border border-border transition-all duration-300 hover-lift ${f.hero ? 'lg:col-span-2 p-6 sm:p-8' : 'p-5'}`}
```

**Step 2: Visual verification**

Open http://localhost:5173/ in browser, scroll to the feature section, and verify:
- Hero cards materialize with a colored border trace (green / amber glow)
- Compact cards rise up with their own accent glow traces
- Border glow pulses once then fades
- Total animation completes in ~1.5s
- After animation, cards look identical to before (no leftover visual artifacts)

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (460+)

**Step 4: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "feat: add data-accent-rgb to feature cards for glow entrance animation"
```

---

### Task 4: Fix compactIndex stagger bug

The current implementation reuses `compactIndex` for both hero card stagger and compact card delay calculation. This is fragile. Let's separate them.

**Step 1: Write a targeted test**

Add to the test file:

```typescript
  it('staggers compact cards with increasing delay after hero cards', async () => {
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');

    const hero1 = makeCard(true, '34, 197, 94');
    const hero2 = makeCard(true, '245, 158, 11');
    const c1 = makeCard(false, '139, 92, 246');
    const c2 = makeCard(false, '6, 182, 212');
    const c3 = makeCard(false, '249, 115, 22');
    const c4 = makeCard(false, '244, 63, 94');
    [hero1, hero2, c1, c2, c3, c4].forEach(c => innerEl.appendChild(c));

    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: document.createElement('div'),
      tournaments: null,
      finalCta: document.createElement('div'),
    });

    // All 6 cards should have glow overlays
    const overlays = featuresEl.querySelectorAll('.glow-trace');
    expect(overlays.length).toBe(6);
  });
```

**Step 2: Run test**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: PASS — this validates the full 6-card setup works

**Step 3: Refactor stagger to use separate counters**

In `scrollAnimations.ts`, replace the single `compactIndex` with two counters:

```typescript
  let heroIndex = 0;
  let compactIdx = 0;
```

Hero cards use `heroIndex` for their 0/0.15 stagger. Compact cards use `compactIdx * 0.15` offset from `0.4`:

```typescript
    if (isHero) {
      const delay = heroIndex * 0.15;
      heroIndex++;
      // ... rest of hero animation
    } else {
      const staggerDelay = 0.4 + compactIdx * 0.15;
      compactIdx++;
      // ... rest of compact animation
    }
```

**Step 4: Run tests**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/features/landing/animations/scrollAnimations.ts src/features/landing/animations/__tests__/scrollAnimations.test.ts
git commit -m "refactor: separate hero/compact stagger counters for clarity"
```

---

### Task 5: Visual QA + full test suite

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (460+)

**Step 2: Visual QA in browser**

Open http://localhost:5173/ and verify:
1. Scroll down to "Everything You Need" section
2. Hero cards appear with green/amber border trace + deblur (~700ms)
3. Compact cards follow with violet/cyan/orange/rose traces (~1s mark)
4. Each glow pulses once then fades cleanly
5. After animation, hover effects (tilt, glow, accent color) all still work
6. Refresh page and scroll again — animation replays correctly
7. Check mobile viewport (resize to 375px) — cards still animate properly

**Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: visual QA adjustments for glow entrance"
```
