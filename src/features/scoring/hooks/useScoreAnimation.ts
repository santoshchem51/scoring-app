import { createEffect, on } from 'solid-js';
import type { Accessor } from 'solid-js';

export function useScoreAnimation(
  scoreValue: Accessor<number>,
  getElement: () => HTMLElement | undefined,
) {
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  createEffect(
    on(scoreValue, (_current, prev) => {
      if (prev === undefined) return;
      if (prefersReducedMotion()) return;
      const el = getElement();
      if (!el) return;
      el.animate(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.2)', filter: 'brightness(1.5)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      );
    }),
  );
}
