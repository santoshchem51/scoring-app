import { describe, it, expect, vi, afterEach } from 'vitest';

describe('tilt directive', () => {
  let el: HTMLDivElement;
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function applyTilt(options?: { maxDeg?: number; scale?: number }) {
    const { tilt } = await import('../tilt');
    el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 200, height: 150,
      right: 300, bottom: 250, x: 100, y: 100, toJSON: () => {},
    });
    const listeners: Record<string, EventListener> = {};
    const origAdd = el.addEventListener.bind(el);
    const origRemove = el.removeEventListener.bind(el);
    el.addEventListener = vi.fn((type: string, fn: EventListener) => {
      listeners[type] = fn;
      origAdd(type, fn);
    });
    el.removeEventListener = vi.fn((type: string, fn: EventListener) => {
      origRemove(type, fn);
    });

    tilt(el, () => options);
    return { listeners };
  }

  it('applies perspective transform on mousemove', async () => {
    const { listeners } = await applyTilt({ maxDeg: 10 });
    const event = new MouseEvent('mousemove', { clientX: 250, clientY: 175 });
    listeners['mousemove']?.(event);
    expect(el.style.transform).toContain('perspective');
    expect(el.style.transform).toContain('rotateX');
    expect(el.style.transform).toContain('rotateY');
  });

  it('resets transform on mouseleave', async () => {
    const { listeners } = await applyTilt();
    listeners['mousemove']?.(new MouseEvent('mousemove', { clientX: 250, clientY: 175 }));
    expect(el.style.transform).not.toBe('');
    listeners['mouseleave']?.(new MouseEvent('mouseleave'));
    expect(el.style.transform).toBe('');
  });

  it('registers both mousemove and mouseleave listeners', async () => {
    await applyTilt();
    expect(el.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(el.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });
});
