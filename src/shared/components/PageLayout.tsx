import { onMount } from 'solid-js';
import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  let mainRef: HTMLElement | undefined;

  onMount(() => {
    if (!mainRef) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mainRef.style.opacity = '1';
      return;
    }
    mainRef.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
  });

  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <div class="max-w-lg mx-auto md:max-w-xl">
          <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
        </div>
      </header>
      <main ref={mainRef} id="main-content" class="flex-1 overflow-y-auto pb-24" style={{ opacity: "0" }}>
        <div class="max-w-lg mx-auto md:max-w-xl">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
