import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import InteractiveBackground from '../InteractiveBackground';

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

// jsdom has no ResizeObserver — stub it
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
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

afterEach(() => {
  cleanup();
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
});
