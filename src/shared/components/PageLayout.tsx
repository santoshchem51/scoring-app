import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <div class="max-w-lg md:max-w-xl mx-auto">
          <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
        </div>
      </header>
      <main id="main-content" class="flex-1 overflow-y-auto pb-24">
        <div class="max-w-lg md:max-w-xl mx-auto">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
