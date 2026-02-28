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
