import { describe, it, expect, vi } from 'vitest';

vi.mock('gsap', () => {
  const tl = {
    from: vi.fn().mockReturnThis(),
    to: vi.fn().mockReturnThis(),
    kill: vi.fn(),
  };
  return {
    default: { timeline: vi.fn(() => tl), set: vi.fn(), matchMedia: vi.fn() },
    gsap: { timeline: vi.fn(() => tl), set: vi.fn(), matchMedia: vi.fn() },
  };
});

describe('createHeroEntrance (creative)', () => {
  it('returns a GSAP timeline with kill method', async () => {
    const { createHeroEntrance } = await import('../heroAnimations');
    const els = {
      logo: document.createElement('div'),
      headline: document.createElement('div'),
      subtext: document.createElement('div'),
      ctas: document.createElement('div'),
      card: document.createElement('div'),
      headlineWords: [
        document.createElement('span'),
        document.createElement('span'),
        document.createElement('span'),
      ],
    };
    const tl = createHeroEntrance(els);
    expect(tl).toBeDefined();
    expect(typeof tl.kill).toBe('function');
  });
});
