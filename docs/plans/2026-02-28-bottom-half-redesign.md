# Bottom-Half Landing Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat bottom-half of the landing page (How It Works, Final CTA, Footer) with a connected glow-path steps section, a dramatic CTA entrance with persistent glow pulse, and a subtle footer fade.

**Architecture:** Changes span 3 files: `scrollAnimations.ts` (replace Steps/CTA animation blocks + add footer), `LandingPage.tsx` (add SVG connector line, footer ref, CTA sub-refs), `styles.css` (add persistent CTA glow keyframes + connector responsive styles). The `SectionElements` interface gains a `footer` field.

**Tech Stack:** GSAP + ScrollTrigger (existing), SVG `stroke-dashoffset` for line draw, CSS `@keyframes` for persistent button glow

---

### Task 1: Add persistent CTA button glow keyframes to styles.css

**Files:**
- Modify: `src/styles.css`
- Test: Visual only (CSS keyframes)

**Step 1: Add the keyframes and utility class**

Add after the existing `@keyframes gradient-shimmer` block in `src/styles.css`:

```css
/* Persistent CTA glow pulse */
@keyframes cta-glow-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.2), 0 0 30px rgba(34, 197, 94, 0.1); }
  50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.4), 0 0 50px rgba(34, 197, 94, 0.15); }
}

.cta-glow-active {
  animation: cta-glow-pulse 2s ease-in-out infinite;
}
```

**Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add persistent CTA glow pulse keyframes"
```

---

### Task 2: Add connector line responsive styles to styles.css

**Files:**
- Modify: `src/styles.css`

**Step 1: Add connector line styles**

Add after the CTA glow styles:

```css
/* How It Works connector line */
.steps-connector {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
  pointer-events: none;
  transform: translateY(-50%);
}

.steps-connector line {
  stroke: rgba(34, 197, 94, 0.3);
  stroke-width: 2;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
}

/* Vertical connector for mobile stacked layout */
@media (max-width: 639px) {
  .steps-connector {
    top: 0;
    left: 50%;
    width: 2px;
    height: 100%;
    transform: translateX(-50%);
  }
}
```

**Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add connector line responsive styles for How It Works"
```

---

### Task 3: Write failing tests for new scroll animations

**Files:**
- Modify: `src/features/landing/animations/__tests__/scrollAnimations.test.ts`

**Step 1: Add tests for new sections**

Add a new describe block after the existing glow entrance tests:

```typescript
describe('setupScrollAnimations — bottom half redesign', () => {
  let stepsEl: HTMLElement;
  let finalCtaEl: HTMLElement;
  let footerEl: HTMLElement;
  let featuresEl: HTMLElement;

  function makeStepsSection(): HTMLElement {
    // Builds: section > div.max-w > [h2, div.relative > [svg.steps-connector, div.grid > [step1, step2, step3]]]
    const section = document.createElement('section');
    const maxW = document.createElement('div');
    const h2 = document.createElement('h2');
    const wrapper = document.createElement('div');
    wrapper.classList.add('relative');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('steps-connector');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(line);
    const grid = document.createElement('div');
    for (let i = 0; i < 3; i++) {
      const step = document.createElement('div');
      const circle = document.createElement('div');
      circle.classList.add('step-circle');
      step.appendChild(circle);
      grid.appendChild(step);
    }
    wrapper.appendChild(svg);
    wrapper.appendChild(grid);
    maxW.appendChild(h2);
    maxW.appendChild(wrapper);
    section.appendChild(maxW);
    return section;
  }

  function makeCtaSection(): HTMLElement {
    const section = document.createElement('section');
    const inner = document.createElement('div');
    const h2 = document.createElement('h2');
    const btn = document.createElement('a');
    btn.classList.add('cta-btn');
    inner.appendChild(h2);
    inner.appendChild(btn);
    section.appendChild(inner);
    return section;
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('gsap', () => ({
      gsap: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
      default: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
    }));
    vi.mock('gsap/ScrollTrigger', () => ({
      ScrollTrigger: { create: vi.fn().mockReturnValue({ kill: vi.fn() }), killAll: vi.fn(), refresh: vi.fn() },
    }));

    stepsEl = makeStepsSection();
    finalCtaEl = makeCtaSection();
    footerEl = document.createElement('footer');
    featuresEl = document.createElement('div');
    // features needs nested structure: div > div > div (no cards)
    const g = document.createElement('div');
    const i = document.createElement('div');
    featuresEl.appendChild(g);
    g.appendChild(i);
  });

  it('sets initial blur+opacity on step cards', async () => {
    const { gsap } = await import('gsap');
    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: stepsEl,
      tournaments: null,
      finalCta: finalCtaEl,
      footer: footerEl,
    });

    const setCalls = (gsap.set as ReturnType<typeof vi.fn>).mock.calls;
    const stepCalls = setCalls.filter(
      (c: unknown[]) => typeof c[1] === 'object' && 'filter' in (c[1] as Record<string, unknown>)
    );
    // Should have at least 3 step card blur sets
    expect(stepCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('sets initial hidden state on CTA heading and button', async () => {
    const { gsap } = await import('gsap');
    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: stepsEl,
      tournaments: null,
      finalCta: finalCtaEl,
      footer: footerEl,
    });

    const setCalls = (gsap.set as ReturnType<typeof vi.fn>).mock.calls;
    // CTA heading should have blur
    const h2 = finalCtaEl.querySelector('h2')!;
    const headingSet = setCalls.find(
      (c: unknown[]) => c[0] === h2
    );
    expect(headingSet).toBeTruthy();
  });

  it('sets initial hidden state on footer', async () => {
    const { gsap } = await import('gsap');
    const { setupScrollAnimations } = await import('../scrollAnimations');
    setupScrollAnimations({
      features: featuresEl,
      steps: stepsEl,
      tournaments: null,
      finalCta: finalCtaEl,
      footer: footerEl,
    });

    const setCalls = (gsap.set as ReturnType<typeof vi.fn>).mock.calls;
    const footerSet = setCalls.find(
      (c: unknown[]) => c[0] === footerEl
    );
    expect(footerSet).toBeTruthy();
  });
});
```

**Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: New tests FAIL — `footer` is not in `SectionElements`, old animation doesn't set blur on steps

**Step 3: Commit**

```bash
git add src/features/landing/animations/__tests__/scrollAnimations.test.ts
git commit -m "test: add failing tests for bottom-half redesign animations"
```

---

### Task 4: Implement new scroll animations for Steps, CTA, and Footer

**Files:**
- Modify: `src/features/landing/animations/scrollAnimations.ts` (lines 4-9 interface, lines 156-191 Steps+CTA blocks)

**Step 1: Update `SectionElements` interface**

Add `footer` field:

```typescript
export interface SectionElements {
  features: HTMLElement;
  steps: HTMLElement;
  tournaments: HTMLElement | null;
  finalCta: HTMLElement;
  heroSection?: HTMLElement;
  footer?: HTMLElement;
}
```

**Step 2: Replace the Steps animation block (lines 156-175)**

Replace the "How It Works" section with:

```typescript
  // How It Works: connector line draw + staggered step deblur
  const connectorSvg = sections.steps.querySelector('.steps-connector');
  const connectorLine = connectorSvg?.querySelector('line');
  const stepCards = Array.from(
    sections.steps.querySelectorAll(':scope > div > div.relative > div:last-child > div')
  ) as HTMLElement[];

  // Set initial hidden state on steps
  stepCards.forEach((card) => {
    gsap.set(card, { opacity: 0, y: 20, filter: 'blur(6px)' });
  });

  // Set initial state on connector line
  if (connectorLine) {
    const length = 1000; // Will be recalculated on enter
    connectorLine.style.strokeDasharray = `${length}`;
    connectorLine.style.strokeDashoffset = `${length}`;
  }

  // Single trigger for the whole steps section
  triggers.push(
    ScrollTrigger.create({
      trigger: sections.steps,
      start: 'top 85%',
      onEnter: () => {
        // Draw the connector line
        if (connectorLine) {
          gsap.to(connectorLine, {
            strokeDashoffset: 0,
            duration: 1.5,
            ease: 'power2.inOut',
          });
        }

        // Stagger step reveals as line reaches each point
        stepCards.forEach((card, i) => {
          const circle = card.querySelector('.step-circle') as HTMLElement | null;
          const delay = 0.2 + i * 0.5; // Timed to match line progress

          // Step card deblurs and rises
          gsap.to(card, {
            opacity: 1, y: 0, filter: 'blur(0px)',
            duration: 0.4, ease: 'power2.out',
            delay,
          });

          // Circle glow pulse
          if (circle) {
            gsap.to(circle, {
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.2)',
              duration: 0.3, ease: 'power2.out',
              delay: delay + 0.1,
              onComplete: () => {
                gsap.to(circle, {
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
                  duration: 0.6, ease: 'power2.inOut',
                });
              },
            });
          }
        });
      },
      once: true,
    })
  );
```

**Step 3: Replace the Final CTA animation block (lines 177-191)**

Replace with:

```typescript
  // Final CTA: heading deblurs, button materializes with glow burst
  const ctaHeading = sections.finalCta.querySelector('h2');
  const ctaButton = sections.finalCta.querySelector('a');

  if (ctaHeading) {
    gsap.set(ctaHeading, { opacity: 0, y: 20, filter: 'blur(10px)' });
  }
  if (ctaButton) {
    gsap.set(ctaButton, { opacity: 0, scale: 0.8 });
  }

  triggers.push(
    ScrollTrigger.create({
      trigger: sections.finalCta,
      start: 'top 85%',
      onEnter: () => {
        // Heading deblurs and rises
        if (ctaHeading) {
          gsap.to(ctaHeading, {
            opacity: 1, y: 0, filter: 'blur(0px)',
            duration: 0.5, ease: 'power2.out',
          });
        }
        // Button materializes with glow burst
        if (ctaButton) {
          gsap.to(ctaButton, {
            opacity: 1, scale: 1,
            duration: 0.6, ease: 'back.out(1.4)',
            delay: 0.4,
            onComplete: () => {
              // Glow burst
              gsap.to(ctaButton, {
                boxShadow: '0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(34, 197, 94, 0.15)',
                duration: 0.3, ease: 'power2.out',
                onComplete: () => {
                  // Settle, then start persistent CSS pulse
                  gsap.to(ctaButton, {
                    boxShadow: '0 0 0px transparent',
                    duration: 0.4, ease: 'power2.inOut',
                    onComplete: () => {
                      (ctaButton as HTMLElement).classList.add('cta-glow-active');
                    },
                  });
                },
              });
            },
          });
        }
      },
      once: true,
    })
  );
```

**Step 4: Add footer fade animation (after CTA, before canvas parallax)**

```typescript
  // Footer: subtle fade-in
  if (sections.footer) {
    gsap.set(sections.footer, { opacity: 0, y: 10 });
    triggers.push(
      ScrollTrigger.create({
        trigger: sections.footer,
        start: 'top 95%',
        onEnter: () => {
          gsap.to(sections.footer!, {
            opacity: 1, y: 0,
            duration: 0.4, ease: 'power2.out',
          });
        },
        once: true,
      })
    );
  }
```

**Step 5: Run tests**

Run: `npx vitest run src/features/landing/animations/__tests__/scrollAnimations.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/features/landing/animations/scrollAnimations.ts src/features/landing/animations/__tests__/scrollAnimations.test.ts
git commit -m "feat: connected glow-path steps, dramatic CTA entrance, footer fade"
```

---

### Task 5: Update LandingPage.tsx — SVG connector, step-circle class, footer ref

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Add footer ref declaration (after `finalCtaEl` ref)**

```typescript
  let footerEl!: HTMLElement;
```

**Step 2: Pass footer to setupScrollAnimations**

Update the call around line 98:

```typescript
    const scrollCleanup = setupScrollAnimations({
      features: featuresEl,
      steps: stepsEl,
      tournaments: null,
      finalCta: finalCtaEl,
      heroSection: heroSectionEl,
      footer: footerEl,
    });
```

**Step 3: Replace the How It Works section markup (lines 206-227)**

Replace with:

```tsx
      {/* How It Works */}
      <section ref={stepsEl} class="px-4 py-12 md:py-16">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-animated"
            style={{ "font-family": "var(--font-score)" }}
          >
            How It Works
          </h2>
          <div class="relative">
            {/* Connector line between step circles */}
            <svg
              class="steps-connector hidden sm:block"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="16.67%" y1="20" x2="83.33%" y2="20" />
            </svg>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
              <For each={STEPS}>{(step, i) => (
                <div use:tilt={{ maxDeg: 4, scale: 1.0 }} class="text-center" style={{ "transition": "transform 0.3s ease-out" }}>
                  <div
                    class="step-circle w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3"
                    style={{ "box-shadow": "0 0 20px rgba(34,197,94,0.3)" }}
                  >
                    {i() + 1}
                  </div>
                  <h3 class="font-bold text-on-surface mb-1">{step.title}</h3>
                  <p class="text-sm text-on-surface-muted">{step.description}</p>
                </div>
              )}</For>
            </div>
          </div>
        </div>
      </section>
```

**Step 4: Add ref to footer**

Change:
```tsx
      <footer class="px-4 py-8 text-center border-t border-border">
```
To:
```tsx
      <footer ref={footerEl} class="px-4 py-8 text-center border-t border-border">
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "feat: add SVG connector line, step-circle class, footer ref to landing page"
```

---

### Task 6: Visual QA + full test suite

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Visual QA in browser**

Open http://localhost:5173/ and verify:

1. **How It Works**: Scroll down — green connector line draws left-to-right, each step deblurs as line reaches it, circles pulse green glow
2. **Final CTA**: "Ready to play?" heading deblurs, button scales in with glow burst, then starts persistent glow breathing
3. **Footer**: Fades in subtly with slight rise
4. **Mobile** (resize to 375px): Connector line hidden on mobile (sm:block), steps animate individually without connector
5. **Feature cards above**: Still animate correctly with glow border trace (no regression)
6. **Refresh and re-scroll**: All animations replay correctly

**Step 3: Fix any visual issues and commit**

```bash
git add -A
git commit -m "fix: visual QA adjustments for bottom-half redesign"
```
