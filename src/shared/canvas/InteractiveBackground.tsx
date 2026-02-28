import { onMount, onCleanup, createSignal } from 'solid-js';
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { createWaveRenderer } from './waveRenderer';

interface InteractiveBackgroundProps {
  mode: 'animated' | 'static';
  waveCount?: number;
  waveOpacity?: number;
  glowIntensity?: number;
  glowRadius?: number;
  topClearance?: number;
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
        topClearance={props.topClearance}
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
      topClearance: props.topClearance,
    });

    // Plain mutable cursor — NOT a signal
    const cursor = { x: -1000, y: -1000 };

    // --- Resize handling ---
    // Fix 7: Cache getBoundingClientRect, invalidated on resize
    let cachedRect: DOMRect | null = null;

    // Fix 6: Read DPR inside resize() for multi-monitor support
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      canvasEl.width = w * dpr;
      canvasEl.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cachedRect = null;
    }

    // Fix 2: rAF-based debounced resize (shared by both static and animated paths)
    let resizeRafId: number | null = null;

    resize();

    // --- Static mode: single render and stop ---
    // Fix 5: Resize and redraw in static mode
    if (props.mode === 'static') {
      function resizeAndDraw() {
        resize();
        renderer.draw(0, canvasEl.offsetWidth, canvasEl.offsetHeight, { x: -1000, y: -1000 });
      }
      resizeAndDraw();
      const ro = new ResizeObserver(() => {
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          resizeAndDraw();
        });
      });
      ro.observe(canvasEl);
      onCleanup(() => {
        ro.disconnect();
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      });
      return;
    }

    // --- Animated mode ---

    // Fix 2: Debounced ResizeObserver for animated mode
    function debouncedResize() {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        resize();
      });
    }
    const ro = new ResizeObserver(debouncedResize);
    ro.observe(canvasEl);

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
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
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

    // Thermal fallback
    let thermalDropped = false;
    let slowFrameCount = 0;

    // Fix 7: Extract idle timer reset into a helper (also Fix 1: recovery on interaction)
    function resetIdleTimer() {
      idle = false;
      thermalDropped = false;
      slowFrameCount = 0;
      clearTimeout(idleTimer!);
      idleTimer = setTimeout(() => { idle = true; }, 45_000);
    }

    // Fix 7: Merged onInteraction — mousemove handled by onMouseMove below
    function onInteraction() {
      resetIdleTimer();
    }
    document.addEventListener('touchstart', onInteraction, { passive: true });
    document.addEventListener('scroll', onInteraction, { passive: true });
    resetIdleTimer(); // start timer

    // Cursor tracking (desktop only — pointer: fine check)
    // Fix 7: Use cached rect and merge idle reset into mousemove
    const hasPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    function onMouseMove(e: MouseEvent) {
      if (!cachedRect) cachedRect = canvasEl.getBoundingClientRect();
      cursor.x = e.clientX - cachedRect.left;
      cursor.y = e.clientY - cachedRect.top;
      resetIdleTimer();
    }
    if (hasPointer) {
      document.addEventListener('mousemove', onMouseMove, { passive: true });
    }

    // rAF loop
    let rafId: number;
    let lastFrame = 0;
    const FRAME_INTERVAL = 33; // ~30fps

    function loop(t: number) {
      rafId = requestAnimationFrame(loop);

      // Fix 1: Reset lastFrame before pausing so first frame after resume is clean
      if (tabHidden || offScreen || idle || reducedMotion || thermalDropped) {
        lastFrame = 0;
        return;
      }

      // 30fps throttle
      if (t - lastFrame < FRAME_INTERVAL) return;

      // Fix 3: Thermal monitoring — raised threshold to 66ms, count to 10
      const frameDuration = t - lastFrame;
      if (lastFrame > 0 && frameDuration > 66) {
        slowFrameCount++;
        if (slowFrameCount >= 10) {
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
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisChange);
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
      aria-hidden="true"
    />
  );
};

export default InteractiveBackground;
