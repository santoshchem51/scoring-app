import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('gsap', () => ({
  gsap: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
  default: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: vi.fn().mockReturnValue({ kill: vi.fn() }), killAll: vi.fn(), refresh: vi.fn() },
}));

describe('setupScrollAnimations (creative)', () => {
  it('returns a cleanup function', async () => {
    const { setupScrollAnimations } = await import('../scrollAnimations');
    const sections = {
      features: document.createElement('div'),
      steps: document.createElement('div'),
      tournaments: null,
      finalCta: document.createElement('div'),
    };
    const cleanup = setupScrollAnimations(sections);
    expect(typeof cleanup).toBe('function');
  });
});

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

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('gsap', () => ({
      gsap: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
      default: { from: vi.fn(), set: vi.fn(), to: vi.fn(), matchMedia: vi.fn(), registerPlugin: vi.fn() },
    }));
    vi.mock('gsap/ScrollTrigger', () => ({
      ScrollTrigger: { create: vi.fn().mockReturnValue({ kill: vi.fn() }), killAll: vi.fn(), refresh: vi.fn() },
    }));

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
    expect(hero.style.overflow).toBe('hidden');
    expect(hero.style.position).toBe('relative');
    cleanup();
    expect(hero.querySelector('.glow-trace')).toBeFalsy();
    expect(hero.style.overflow).toBe('');
    expect(hero.style.position).toBe('');
  });

  it('creates overlays for all 6 cards (2 hero + 4 compact)', async () => {
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

    const overlays = featuresEl.querySelectorAll('.glow-trace');
    expect(overlays.length).toBe(6);
  });
});

describe('setupScrollAnimations — bottom half redesign', () => {
  let stepsEl: HTMLElement;
  let finalCtaEl: HTMLElement;
  let footerEl: HTMLElement;
  let featuresEl: HTMLElement;

  function makeStepsSection(): HTMLElement {
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
    for (let idx = 0; idx < 3; idx++) {
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
    const g = document.createElement('div');
    const inner = document.createElement('div');
    featuresEl.appendChild(g);
    g.appendChild(inner);
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
    // Find calls that set filter with blur on step card elements
    const grid = stepsEl.querySelector('.relative > div:last-child')!;
    const stepDivs = Array.from(grid.children);
    const stepBlurCalls = setCalls.filter(
      (c: unknown[]) => stepDivs.includes(c[0] as Element) && typeof c[1] === 'object' && 'filter' in (c[1] as Record<string, unknown>)
    );
    expect(stepBlurCalls.length).toBe(3);
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
    const h2 = finalCtaEl.querySelector('h2')!;
    const btn = finalCtaEl.querySelector('a')!;
    const headingSet = setCalls.find((c: unknown[]) => c[0] === h2);
    const btnSet = setCalls.find((c: unknown[]) => c[0] === btn);
    expect(headingSet).toBeTruthy();
    expect(btnSet).toBeTruthy();
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
    const footerSet = setCalls.find((c: unknown[]) => c[0] === footerEl);
    expect(footerSet).toBeTruthy();
  });
});
