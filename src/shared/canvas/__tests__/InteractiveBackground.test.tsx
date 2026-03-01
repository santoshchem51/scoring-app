import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import InteractiveBackground from '../InteractiveBackground';

// Save original so we can restore it in afterAll
const originalGetContext = HTMLCanvasElement.prototype.getContext;

// jsdom has no canvas — stub getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  scale: vi.fn(),
  setTransform: vi.fn(),
})) as any;

// jsdom has no ResizeObserver — stub it with spy-able disconnect
let resizeObserverDisconnectSpy: ReturnType<typeof vi.fn>;
if (typeof globalThis.ResizeObserver === 'undefined') {
  resizeObserverDisconnectSpy = vi.fn();
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect = resizeObserverDisconnectSpy;
    constructor(_cb: any, _opts?: any) {}
  } as any;
} else {
  resizeObserverDisconnectSpy = vi.fn();
}

// jsdom has no IntersectionObserver — stub it
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    constructor(_cb: any, _opts?: any) {}
  } as any;
}

const mockCancelAnimationFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');

afterAll(() => {
  // Restore the original prototype method to avoid leaking across test files
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('outdoor');
  vi.clearAllMocks();
});

describe('InteractiveBackground', () => {
  it('renders a canvas element with aria-hidden', () => {
    const { container } = render(() => <InteractiveBackground mode="animated" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.getAttribute('aria-hidden')).toBe('true');
  });

  it('cancels rAF on unmount', () => {
    const { unmount } = render(() => <InteractiveBackground mode="animated" />);
    unmount();
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });

  it('renders canvas in static mode without starting animation loop', () => {
    const mockRAF = vi.spyOn(globalThis, 'requestAnimationFrame');
    const initialCallCount = mockRAF.mock.calls.length;
    render(() => <InteractiveBackground mode="static" />);
    // Static mode: one rAF for the single render, then stops
    // Should NOT continuously call rAF
    expect(mockRAF.mock.calls.length - initialCallCount).toBeLessThanOrEqual(1);
    mockRAF.mockRestore();
  });

  it('renders nothing when outdoor class is present', () => {
    document.documentElement.classList.add('outdoor');
    const { container } = render(() => <InteractiveBackground mode="animated" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeNull();
  });

  it('renders single frame when prefers-reduced-motion matches', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return {
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as any;
      }
      // For pointer queries and others, return non-matching
      return {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as any;
    }) as any;

    const mockRAF = vi.spyOn(globalThis, 'requestAnimationFrame');
    const initialCallCount = mockRAF.mock.calls.length;
    render(() => <InteractiveBackground mode="animated" />);
    // Reduced motion: should NOT start the animation loop (no rAF call)
    expect(mockRAF.mock.calls.length - initialCallCount).toBe(0);
    mockRAF.mockRestore();
    window.matchMedia = originalMatchMedia;
  });

  it('disconnects ResizeObserver on unmount', () => {
    const disconnectSpy = vi.fn();
    const OrigRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class MockRO {
      observe() {}
      unobserve() {}
      disconnect = disconnectSpy;
      constructor(_cb: any) {}
    } as any;

    const { unmount } = render(() => <InteractiveBackground mode="animated" />);
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();

    globalThis.ResizeObserver = OrigRO;
  });

  it('does not register mousemove when pointer:fine does not match', () => {
    const originalMatchMedia = window.matchMedia;
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    window.matchMedia = vi.fn((query: string) => {
      if (query === '(hover: hover) and (pointer: fine)') {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any;
      }
      return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any;
    }) as any;

    render(() => <InteractiveBackground mode="animated" />);

    const mousemoveCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    );
    expect(mousemoveCalls).toHaveLength(0);

    addEventListenerSpy.mockRestore();
    window.matchMedia = originalMatchMedia;
  });
});
