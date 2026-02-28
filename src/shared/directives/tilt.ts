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
