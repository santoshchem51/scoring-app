import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock gsap and lenis before imports
vi.mock('gsap', () => {
  const ticker = { add: vi.fn(), remove: vi.fn(), lagSmoothing: vi.fn() };
  return {
    default: { registerPlugin: vi.fn(), ticker },
    gsap: { registerPlugin: vi.fn(), ticker },
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { update: vi.fn(), refresh: vi.fn(), killAll: vi.fn() },
}));

vi.mock('lenis', () => {
  const LenisMock = vi.fn(function (this: Record<string, unknown>) {
    this.on = vi.fn();
    this.destroy = vi.fn();
    this.raf = vi.fn();
  });
  return { default: LenisMock };
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
