import { describe, it, expect, vi } from 'vitest';

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
