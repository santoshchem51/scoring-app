# Interactive Background & Parallax Effects — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a canvas-based generative wave background with cursor-following glow and card parallax tilt to the landing page (animated) and public tournament page (static).

**Architecture:** Single `<canvas>` element renders simplex-noise wave lines + cursor radial glow in one rAF loop. A separate `use:tilt` SolidJS directive handles card parallax. The canvas component lives in `src/shared/canvas/` with pure math separated from rendering for testability.

**Tech Stack:** SolidJS 1.9, TypeScript, Canvas 2D, open-simplex-noise, Vitest

---

### Task 1: Install open-simplex-noise

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `npm install open-simplex-noise`

**Step 2: Verify tree-shakeable import works**

Run: `node -e "const { makeNoise2D } = require('open-simplex-noise'); console.log(typeof makeNoise2D)"`
Expected: `function`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install open-simplex-noise for generative wave background"
```

---

### Task 2: Wave system — pure math engine

**Files:**
- Create: `src/shared/canvas/waveSystem.ts`
- Create: `src/shared/canvas/__tests__/waveSystem.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/shared/canvas/__tests__/waveSystem.test.ts
import { describe, it, expect } from 'vitest';
import { generateWaves } from '../waveSystem';
import type { WaveConfig } from '../waveSystem';

const config: WaveConfig = { count: 8, width: 800, height: 600 };

describe('generateWaves', () => {
  it('returns the requested number of wave lines', () => {
    const waves = generateWaves(0, config);
    expect(waves).toHaveLength(8);
  });

  it('each wave has points spanning the full width', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      expect(wave.points.length).toBeGreaterThan(10);
      expect(wave.points[0].x).toBe(0);
      expect(wave.points[wave.points.length - 1].x).toBe(config.width);
    }
  });

  it('all points have y values within reasonable bounds', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      for (const pt of wave.points) {
        expect(pt.y).toBeGreaterThan(-100);
        expect(pt.y).toBeLessThan(config.height + 100);
      }
    }
  });

  it('produces different output at different timestamps', () => {
    const a = generateWaves(0, config);
    const b = generateWaves(5000, config);
    expect(a[0].points[5].y).not.toBeCloseTo(b[0].points[5].y, 1);
  });

  it('is deterministic — same time produces same output', () => {
    const a = generateWaves(1234, config);
    const b = generateWaves(1234, config);
    expect(a).toEqual(b);
  });

  it('wave opacity values are within 0.08–0.25 range', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      expect(wave.opacity).toBeGreaterThanOrEqual(0.08);
      expect(wave.opacity).toBeLessThanOrEqual(0.25);
    }
  });

  it('respects custom wave count', () => {
    const waves = generateWaves(0, { ...config, count: 4 });
    expect(waves).toHaveLength(4);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/canvas/__tests__/waveSystem.test.ts`
Expected: FAIL — cannot find module `../waveSystem`

**Step 3: Write the implementation**

```typescript
// src/shared/canvas/waveSystem.ts
import { makeNoise2D } from 'open-simplex-noise';

export interface WaveConfig {
  count: number;
  width: number;
  height: number;
}

export interface WavePoint {
  x: number;
  y: number;
}

export interface WaveLine {
  points: WavePoint[];
  opacity: number;
}

const noise2D = makeNoise2D(42);
const STEP = 8; // pixels between sample points
const FREQUENCY = 0.003;
const AMPLITUDE_RATIO = 0.08; // wave amplitude as fraction of height

export function generateWaves(time: number, config: WaveConfig): WaveLine[] {
  const { count, width, height } = config;
  const waves: WaveLine[] = [];
  const t = time * 0.0005;

  for (let i = 0; i < count; i++) {
    const baseY = (height / (count + 1)) * (i + 1);
    const amplitude = height * AMPLITUDE_RATIO;
    const opacity = 0.1 + (i % 3) * 0.04; // varies between 0.10, 0.14, 0.18
    const points: WavePoint[] = [];

    for (let x = 0; x <= width; x += STEP) {
      const n = noise2D(x * FREQUENCY + i * 0.5, t + i * 0.3);
      points.push({ x, y: baseY + n * amplitude });
    }

    // Ensure last point is exactly at width
    if (points[points.length - 1].x !== width) {
      const n = noise2D(width * FREQUENCY + i * 0.5, t + i * 0.3);
      points.push({ x: width, y: baseY + n * amplitude });
    }

    waves.push({ points, opacity });
  }

  return waves;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/canvas/__tests__/waveSystem.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add src/shared/canvas/waveSystem.ts src/shared/canvas/__tests__/waveSystem.test.ts
git commit -m "feat: add wave system pure math engine with tests"
```

---

### Task 3: Wave renderer — canvas drawing logic

**Files:**
- Create: `src/shared/canvas/waveRenderer.ts`
- Create: `src/shared/canvas/__tests__/waveRenderer.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/shared/canvas/__tests__/waveRenderer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createWaveRenderer } from '../waveRenderer';

function makeMockCtx() {
  const addColorStop = vi.fn();
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop })),
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(_v: string) {},
    set fillStyle(_v: string | CanvasGradient) {},
    canvas: { width: 1600, height: 1200 },
  } as unknown as CanvasRenderingContext2D;
}

describe('createWaveRenderer', () => {
  it('clears the canvas on every draw', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('draws stroke paths for each wave line', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('creates a radial gradient when cursor is within bounds', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: 400, y: 300 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('skips glow when cursor is off-screen', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it('respects custom wave count', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 4, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    // 4 waves = 4 beginPath + 4 stroke calls
    expect(ctx.beginPath).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/canvas/__tests__/waveRenderer.test.ts`
Expected: FAIL — cannot find module `../waveRenderer`

**Step 3: Write the implementation**

```typescript
// src/shared/canvas/waveRenderer.ts
import { generateWaves } from './waveSystem';

export interface RendererConfig {
  waveCount: number;
  waveOpacity: number;
  glowIntensity?: number;
  glowRadius?: number;
}

interface Cursor {
  x: number;
  y: number;
}

const WAVE_COLOR = '34, 197, 94'; // green RGB
const GLOW_COLOR_PRIMARY = '34, 197, 94';
const GLOW_COLOR_ACCENT = '249, 115, 22';
const NAV_CLEARANCE = 80; // px — no waves in top nav area

export function createWaveRenderer(ctx: CanvasRenderingContext2D, config: RendererConfig) {
  const glowRadius = config.glowRadius ?? 250;
  const glowIntensity = config.glowIntensity ?? 1;
  let lastGlowX = -1000;
  let lastGlowY = -1000;
  let cachedGradient: CanvasGradient | null = null;

  function draw(time: number, w: number, h: number, cursor: Cursor) {
    ctx.clearRect(0, 0, w, h);

    const cursorInBounds = cursor.x >= 0 && cursor.x <= w && cursor.y >= 0 && cursor.y <= h;

    // Draw cursor glow (radial gradient) before waves so waves render on top
    if (cursorInBounds) {
      // Only recreate gradient if cursor moved >5px
      const dx = cursor.x - lastGlowX;
      const dy = cursor.y - lastGlowY;
      if (dx * dx + dy * dy > 25 || !cachedGradient) {
        cachedGradient = ctx.createRadialGradient(
          cursor.x, cursor.y, 0,
          cursor.x, cursor.y, glowRadius,
        );
        cachedGradient.addColorStop(0, `rgba(${GLOW_COLOR_PRIMARY}, ${0.25 * glowIntensity})`);
        cachedGradient.addColorStop(0.5, `rgba(${GLOW_COLOR_ACCENT}, ${0.08 * glowIntensity})`);
        cachedGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lastGlowX = cursor.x;
        lastGlowY = cursor.y;
      }

      ctx.save();
      ctx.fillStyle = cachedGradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Generate and draw waves
    const waves = generateWaves(time, { count: config.waveCount, width: w, height: h });

    for (const wave of waves) {
      ctx.beginPath();

      let started = false;
      for (const pt of wave.points) {
        // Skip points in the nav clearance zone
        if (pt.y < NAV_CLEARANCE) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }

      // Calculate opacity — boost near cursor
      let opacity = wave.opacity * (config.waveOpacity / 0.15); // scale to configured opacity
      if (cursorInBounds) {
        // Find closest point in this wave to cursor
        let minDist = Infinity;
        for (const pt of wave.points) {
          const d = Math.hypot(pt.x - cursor.x, pt.y - cursor.y);
          if (d < minDist) minDist = d;
        }
        if (minDist < glowRadius) {
          const boost = (1 - minDist / glowRadius) * 0.25;
          opacity = Math.min(opacity + boost, 0.4);
        }
      }

      ctx.strokeStyle = `rgba(${WAVE_COLOR}, ${opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  return { draw };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/canvas/__tests__/waveRenderer.test.ts`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add src/shared/canvas/waveRenderer.ts src/shared/canvas/__tests__/waveRenderer.test.ts
git commit -m "feat: add wave renderer with cursor glow and opacity boost"
```

---

### Task 4: InteractiveBackground SolidJS component

**Files:**
- Create: `src/shared/canvas/InteractiveBackground.tsx`
- Create: `src/shared/canvas/index.ts`
- Create: `src/shared/canvas/__tests__/InteractiveBackground.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/shared/canvas/__tests__/InteractiveBackground.test.tsx
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
})) as any;

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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/canvas/__tests__/InteractiveBackground.test.tsx`
Expected: FAIL — cannot find module `../InteractiveBackground`

**Step 3: Write the implementation**

```typescript
// src/shared/canvas/InteractiveBackground.tsx
import { onMount, onCleanup, createSignal, createEffect } from 'solid-js';
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { createWaveRenderer } from './waveRenderer';

interface InteractiveBackgroundProps {
  mode: 'animated' | 'static';
  waveCount?: number;
  waveOpacity?: number;
  glowIntensity?: number;
  glowRadius?: number;
  class?: string;
}

const InteractiveBackground: Component<InteractiveBackgroundProps> = (props) => {
  // Hide in outdoor mode
  const [isOutdoor, setIsOutdoor] = createSignal(
    document.documentElement.classList.contains('outdoor'),
  );

  // Watch for outdoor mode changes
  onMount(() => {
    const observer = new MutationObserver(() => {
      setIsOutdoor(document.documentElement.classList.contains('outdoor'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    onCleanup(() => observer.disconnect());
  });

  return (
    <Show when={!isOutdoor()}>
      <CanvasLayer
        mode={props.mode}
        waveCount={props.waveCount}
        waveOpacity={props.waveOpacity}
        glowIntensity={props.glowIntensity}
        glowRadius={props.glowRadius}
        class={props.class}
      />
    </Show>
  );
};

const CanvasLayer: Component<InteractiveBackgroundProps> = (props) => {
  let canvasEl!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const renderer = createWaveRenderer(ctx, {
      waveCount: props.waveCount ?? 8,
      waveOpacity: props.waveOpacity ?? 0.15,
      glowIntensity: props.glowIntensity ?? 1,
      glowRadius: props.glowRadius ?? 250,
    });

    // Plain mutable cursor — NOT a signal
    const cursor = { x: -1000, y: -1000 };

    // --- Resize handling ---
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      canvasEl.width = w * dpr;
      canvasEl.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvasEl);

    // --- Static mode: single render and stop ---
    if (props.mode === 'static') {
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      renderer.draw(0, w, h, { x: -1000, y: -1000 });
      onCleanup(() => ro.disconnect());
      return;
    }

    // --- Animated mode ---

    // Cursor tracking (desktop only — pointer: fine check)
    const hasPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    function onMouseMove(e: MouseEvent) {
      const rect = canvasEl.getBoundingClientRect();
      cursor.x = e.clientX - rect.left;
      cursor.y = e.clientY - rect.top;
    }
    if (hasPointer) {
      document.addEventListener('mousemove', onMouseMove, { passive: true });
    }

    // Reduced motion check
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    function onMotionChange(e: MediaQueryListEvent) {
      reducedMotion = e.matches;
      if (reducedMotion) {
        // Render one static frame
        const w = canvasEl.offsetWidth;
        const h = canvasEl.offsetHeight;
        renderer.draw(0, w, h, { x: -1000, y: -1000 });
      }
    }
    motionQuery.addEventListener('change', onMotionChange);

    if (reducedMotion) {
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      renderer.draw(0, w, h, { x: -1000, y: -1000 });
      onCleanup(() => {
        ro.disconnect();
        document.removeEventListener('mousemove', onMouseMove);
        motionQuery.removeEventListener('change', onMotionChange);
      });
      return;
    }

    // Visibility pause
    let tabHidden = document.hidden;
    function onVisChange() { tabHidden = document.hidden; }
    document.addEventListener('visibilitychange', onVisChange);

    // IntersectionObserver pause
    let offScreen = false;
    const io = new IntersectionObserver(([entry]) => {
      offScreen = !entry.isIntersecting;
    });
    io.observe(canvasEl);

    // Idle suspension
    let idle = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    function onInteraction() {
      if (idle) idle = false;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { idle = true; }, 45_000);
    }
    document.addEventListener('mousemove', onInteraction, { passive: true });
    document.addEventListener('touchstart', onInteraction, { passive: true });
    document.addEventListener('scroll', onInteraction, { passive: true });
    onInteraction(); // start timer

    // Thermal fallback
    let thermalDropped = false;
    let slowFrameCount = 0;

    // rAF loop
    let rafId: number;
    let lastFrame = 0;
    const FRAME_INTERVAL = 33; // ~30fps

    function loop(t: number) {
      rafId = requestAnimationFrame(loop);

      if (tabHidden || offScreen || idle || reducedMotion || thermalDropped) return;

      // 30fps throttle
      if (t - lastFrame < FRAME_INTERVAL) return;

      // Thermal monitoring
      const frameDuration = t - lastFrame;
      if (lastFrame > 0 && frameDuration > 40) {
        slowFrameCount++;
        if (slowFrameCount >= 5) {
          thermalDropped = true;
          // Render one last static frame
          const w = canvasEl.offsetWidth;
          const h = canvasEl.offsetHeight;
          renderer.draw(t, w, h, { x: -1000, y: -1000 });
          return;
        }
      } else {
        slowFrameCount = 0;
      }

      lastFrame = t;
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      renderer.draw(t, w, h, cursor);
    }

    rafId = requestAnimationFrame(loop);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisChange);
      document.removeEventListener('mousemove', onInteraction);
      document.removeEventListener('touchstart', onInteraction);
      document.removeEventListener('scroll', onInteraction);
      motionQuery.removeEventListener('change', onMotionChange);
      if (idleTimer) clearTimeout(idleTimer);
    });
  });

  return (
    <canvas
      ref={canvasEl!}
      class={`absolute inset-0 w-full h-full pointer-events-none ${props.class ?? ''}`}
      style={{ "will-change": "transform" }}
      aria-hidden="true"
    />
  );
};

export default InteractiveBackground;
```

```typescript
// src/shared/canvas/index.ts
export { default as InteractiveBackground } from './InteractiveBackground';
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/canvas/__tests__/InteractiveBackground.test.tsx`
Expected: 3 tests PASS

**Step 5: Run full test suite to check nothing is broken**

Run: `npx vitest run`
Expected: All 430+ tests PASS

**Step 6: Commit**

```bash
git add src/shared/canvas/InteractiveBackground.tsx src/shared/canvas/index.ts src/shared/canvas/__tests__/InteractiveBackground.test.tsx
git commit -m "feat: add InteractiveBackground component with lifecycle management"
```

---

### Task 5: Tilt directive

**Files:**
- Create: `src/shared/directives/tilt.ts`
- Create: `src/shared/directives/__tests__/tilt.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/shared/directives/__tests__/tilt.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('tilt directive', () => {
  let el: HTMLDivElement;
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function applyTilt(options?: { maxDeg?: number; scale?: number }) {
    // Import fresh each time
    const { tilt } = await import('../tilt');
    el = document.createElement('div');
    // Simulate element dimensions
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 200, height: 150,
      right: 300, bottom: 250, x: 100, y: 100, toJSON: () => {},
    });
    // The directive returns a cleanup function via onCleanup,
    // but in test we track listeners manually
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
    // Mouse at center-right of element (200, 175 = center)
    const event = new MouseEvent('mousemove', { clientX: 250, clientY: 175 });
    listeners['mousemove']?.(event);
    expect(el.style.transform).toContain('perspective');
    expect(el.style.transform).toContain('rotateX');
    expect(el.style.transform).toContain('rotateY');
  });

  it('resets transform on mouseleave', async () => {
    const { listeners } = await applyTilt();
    // First move to apply a transform
    listeners['mousemove']?.(new MouseEvent('mousemove', { clientX: 250, clientY: 175 }));
    expect(el.style.transform).not.toBe('');
    // Then leave
    listeners['mouseleave']?.(new MouseEvent('mouseleave'));
    expect(el.style.transform).toBe('');
  });

  it('registers both mousemove and mouseleave listeners', async () => {
    await applyTilt();
    expect(el.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(el.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/directives/__tests__/tilt.test.ts`
Expected: FAIL — cannot find module `../tilt`

**Step 3: Write the implementation**

```typescript
// src/shared/directives/tilt.ts
import { onCleanup } from 'solid-js';

export interface TiltOptions {
  maxDeg?: number;
  scale?: number;
}

export function tilt(el: HTMLElement, accessor: () => TiltOptions | undefined) {
  const opts = accessor() ?? {};
  const maxDeg = opts.maxDeg ?? 8;
  const scale = opts.scale ?? 1.02;

  const onMouseMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(800px) rotateX(${-dy * maxDeg}deg) rotateY(${dx * maxDeg}deg) scale(${scale})`;
  };

  const onMouseLeave = () => {
    el.style.transform = '';
  };

  el.addEventListener('mousemove', onMouseMove);
  el.addEventListener('mouseleave', onMouseLeave);

  onCleanup(() => {
    el.removeEventListener('mousemove', onMouseMove);
    el.removeEventListener('mouseleave', onMouseLeave);
  });
}

declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      tilt: TiltOptions;
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/directives/__tests__/tilt.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/shared/directives/tilt.ts src/shared/directives/__tests__/tilt.test.ts
git commit -m "feat: add use:tilt parallax directive with tests"
```

---

### Task 6: Integrate into LandingPage

**Files:**
- Modify: `src/features/landing/LandingPage.tsx:73-80` (replace aurora gradient)
- Modify: `src/features/landing/LandingPage.tsx:120-129` (add tilt to feature cards)
- Modify: `src/features/landing/LandingPage.tsx:144-152` (add tilt to step cards)

**Step 1: Replace aurora gradient with InteractiveBackground**

In `src/features/landing/LandingPage.tsx`, add imports at top:

```typescript
import { InteractiveBackground } from '../../shared/canvas';
import { tilt } from '../../shared/directives/tilt';
const _tilt = tilt; // prevent tree-shaking
```

Replace lines 73-80 (the hero section opening + aurora div):

Old:
```tsx
{/* Hero */}
<section class="relative px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center overflow-hidden">
  {/* Aurora gradient background */}
  <div
    class="absolute inset-0 -z-10"
    style={{
      background: "radial-gradient(ellipse at 30% 0%, rgba(34,197,94,0.12), transparent 50%), radial-gradient(ellipse at 70% 0%, rgba(249,115,22,0.08), transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(250,204,21,0.06), transparent 50%)"
    }}
  />
```

New:
```tsx
{/* Hero */}
<section class="relative px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center overflow-hidden">
  <InteractiveBackground mode="animated" />
```

**Step 2: Add tilt to feature cards**

Replace lines 121-129 (the feature card div):

Old:
```tsx
<div class="bg-surface-light rounded-xl p-5 border border-border transition-all duration-200 hover-lift">
```

New:
```tsx
<div use:tilt={{ maxDeg: 6, scale: 1.03 }} class="bg-surface-light rounded-xl p-5 border border-border transition-all duration-300 hover-lift" style={{ "transition-property": "transform, box-shadow" }}>
```

**Step 3: Add tilt to how-it-works step cards**

Replace line 145 (step card div):

Old:
```tsx
<div class="text-center">
```

New:
```tsx
<div use:tilt={{ maxDeg: 4, scale: 1.02 }} class="text-center" style={{ "transition": "transform 0.3s ease-out" }}>
```

**Step 4: Run dev server and visually verify**

Run: `npx vite --port 5199`
Check: http://localhost:5199/
Verify:
- Wave lines visible on dark background, gently drifting
- Cursor glow illuminates nearby wave lines on desktop
- Feature cards tilt on hover
- No aurora gradient remnants
- Mobile viewport: waves drift, no cursor effects

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "feat: replace aurora gradient with interactive canvas background on landing page"
```

---

### Task 7: Integrate into PublicTournamentPage

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx:56-58`

**Step 1: Add import**

At top of `src/features/tournaments/PublicTournamentPage.tsx`:

```typescript
import { InteractiveBackground } from '../../shared/canvas';
```

**Step 2: Add static canvas background**

Wrap the `PageLayout` return value — change lines 56-58:

Old:
```tsx
return (
  <PageLayout title={tournament()?.name ?? 'Tournament'}>
    <div class="p-4 space-y-6">
```

New:
```tsx
return (
  <PageLayout title={tournament()?.name ?? 'Tournament'}>
    <div class="relative">
      <InteractiveBackground mode="static" waveCount={6} waveOpacity={0.1} />
      <div class="relative z-10 p-4 space-y-6">
```

Also add the matching closing `</div>` before the existing `</div>` that closes the content area. Find the closing `</div>` for `<div class="p-4 space-y-6">` and wrap it:

```tsx
      </div> {/* closes relative z-10 */}
    </div> {/* closes relative container */}
```

**Step 3: Run dev server and visually verify**

Run: `npx vite --port 5199`
Navigate to a public tournament page (e.g., http://localhost:5199/t/SOMECODE)
Verify:
- Static wave lines visible as subtle background texture
- No animation or drift
- Content is readable on top of waves
- No performance impact (no rAF running)

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/PublicTournamentPage.tsx
git commit -m "feat: add static wave background to public tournament pages"
```

---

### Task 8: Cleanup and final verification

**Files:**
- Possibly modify: `src/styles.css` (remove unused aurora utilities if any)

**Step 1: Check if aurora gradient styles exist as reusable classes**

The aurora gradient was inline in LandingPage.tsx (not a CSS class), so `styles.css` likely needs no changes. Verify by searching:

Run: `grep -r "aurora" src/ --include="*.css" --include="*.tsx" --include="*.ts"`

If any aurora-specific CSS classes exist that are no longer used, remove them.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (430 existing + ~18 new ≈ 448+)

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run build**

Run: `npx vite build`
Expected: Build succeeds

**Step 5: Manual QA checklist**

- [ ] Landing page: waves animate, cursor glow works on desktop
- [ ] Landing page mobile viewport: waves drift, no cursor effects
- [ ] Public tournament page: static wave texture, no animation
- [ ] Outdoor mode toggle: canvas disappears completely
- [ ] `prefers-reduced-motion`: static frame only, no loop
- [ ] Tab switching: animation pauses and resumes
- [ ] Feature cards: tilt on hover, smooth settle on leave
- [ ] Content is readable over the wave background

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: cleanup and verify interactive background integration"
```
