import { onMount, onCleanup } from 'solid-js';

interface SwipeConfig {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  minDistance?: number;
  maxVertical?: number;
}

export function useSwipeGesture(
  getElement: () => HTMLElement | undefined,
  config: SwipeConfig,
) {
  const minDist = config.minDistance ?? 50;
  const maxVert = config.maxVertical ?? 30;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onPointerDown = (e: PointerEvent) => {
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!tracking) return;
    const el = getElement();
    if (!el) return;
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    if (dy > maxVert) {
      tracking = false;
      el.style.transform = '';
      return;
    }
    const clamped = Math.max(-20, Math.min(20, dx * 0.3));
    el.style.transform = `translateX(${clamped}px)`;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    const el = getElement();
    if (el) {
      el.style.transform = '';
      el.style.transition = 'transform 150ms ease-out';
      setTimeout(() => { if (el) el.style.transition = ''; }, 150);
    }
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    if (dy > maxVert) return;
    if (dx > minDist && config.onSwipeRight) config.onSwipeRight();
    if (dx < -minDist && config.onSwipeLeft) config.onSwipeLeft();
  };

  const onPointerCancel = () => {
    tracking = false;
    const el = getElement();
    if (el) el.style.transform = '';
  };

  onMount(() => {
    const el = getElement();
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
  });

  onCleanup(() => {
    const el = getElement();
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
  });
}
