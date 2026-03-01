import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

describe('tilt directive', () => {
  let el: HTMLDivElement;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // Default: no reduced motion
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.resetModules();
  });

  function createMockElement() {
    el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 200, height: 150,
      right: 300, bottom: 250, x: 100, y: 100, toJSON: () => {},
    });
    const listeners: Record<string, EventListener> = {};
    el.addEventListener = vi.fn((type: string, fn: EventListener) => {
      listeners[type] = fn;
    });
    el.removeEventListener = vi.fn((type: string, _fn: EventListener) => {
      delete listeners[type];
    });
    return { listeners };
  }

  async function applyTiltInRoot(options?: { maxDeg?: number; scale?: number }) {
    const { tilt } = await import('../tilt');
    const { listeners } = createMockElement();
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;
      tilt(el, () => options);
    });

    // Trigger mouseenter so the cached rect is populated
    listeners['mouseenter']?.(new MouseEvent('mouseenter'));
    return { listeners, dispose };
  }

  it('applies perspective transform on mousemove', async () => {
    const { listeners } = await applyTiltInRoot({ maxDeg: 10 });
    const event = new MouseEvent('mousemove', { clientX: 250, clientY: 175 });
    listeners['mousemove']?.(event);
    expect(el.style.transform).toContain('perspective');
    expect(el.style.transform).toContain('rotateX');
    expect(el.style.transform).toContain('rotateY');
  });

  it('resets transform on mouseleave', async () => {
    const { listeners } = await applyTiltInRoot();
    listeners['mousemove']?.(new MouseEvent('mousemove', { clientX: 250, clientY: 175 }));
    expect(el.style.transform).not.toBe('');
    listeners['mouseleave']?.(new MouseEvent('mouseleave'));
    expect(el.style.transform).toBe('');
  });

  it('registers mouseenter, mousemove, and mouseleave listeners', async () => {
    await applyTiltInRoot();
    expect(el.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
    expect(el.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(el.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('removes listeners on cleanup', async () => {
    const { dispose } = await applyTiltInRoot();
    dispose();
    expect(el.removeEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
    expect(el.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(el.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('does nothing when prefers-reduced-motion matches', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    vi.resetModules();
    const { tilt } = await import('../tilt');
    createMockElement();

    createRoot((dispose) => {
      tilt(el, () => ({}));
      dispose();
    });

    expect(el.addEventListener).not.toHaveBeenCalled();
  });
});
