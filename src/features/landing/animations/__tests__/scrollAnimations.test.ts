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
    cleanup();
    expect(hero.querySelector('.glow-trace')).toBeFalsy();
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
